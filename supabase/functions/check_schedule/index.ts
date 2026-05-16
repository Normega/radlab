// check_schedule — cron-triggered scheduler.
// Queries for due pending schedule rows and sends (or suppresses) each one.
//
// Schedule: every 15 minutes
// supabase functions deploy check_schedule --schedule "*/15 * * * *"
//
// Also callable manually via HTTP POST for testing.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const db: SupabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // 1. Fetch all due pending rows (status = pending, scheduled_for <= now, not null)
    const { data: dueRows, error: fetchErr } = await db
      .from('participant_schedule')
      .select('id, participant_id, study_id, protocol_id, attempts')
      .eq('status', 'pending')
      .not('scheduled_for', 'is', null)
      .lte('scheduled_for', new Date().toISOString())

    if (fetchErr) {
      console.error('Failed to fetch due rows:', fetchErr.message)
      return json({ error: fetchErr.message }, 500)
    }

    if (!dueRows || dueRows.length === 0) {
      return json({ processed: 0, suppressed: 0, failed: 0 })
    }

    // Fetch protocol settings in bulk (keyed by protocol_id)
    const protocolIds = [...new Set(dueRows.map(r => r.protocol_id).filter(Boolean))]
    const protocolMap: Record<string, { max_attempts: number; reminder_interval_hours: number | null }> = {}

    if (protocolIds.length > 0) {
      const { data: protocols } = await db
        .from('study_protocols')
        .select('id, max_attempts, reminder_interval_hours')
        .in('id', protocolIds)

      for (const p of (protocols ?? [])) {
        protocolMap[p.id] = {
          max_attempts: p.max_attempts ?? 1,
          reminder_interval_hours: p.reminder_interval_hours ?? null,
        }
      }
    }

    let processed = 0
    let suppressed = 0
    let failed     = 0

    for (const row of dueRows) {
      const protocol = protocolMap[row.protocol_id] ?? { max_attempts: 1, reminder_interval_hours: null }

      // 2a. Max attempts check
      if ((row.attempts ?? 0) >= protocol.max_attempts) {
        await suppressRow(db, row.id, row.participant_id, 'max_attempts_reached')
        suppressed++
        continue
      }

      // 2b. Active link check — participant already has an active link for a different row
      const { data: activeLink } = await db
        .from('participant_links')
        .select('id, schedule_instance_id')
        .eq('participant_id', row.participant_id)
        .eq('status', 'active')
        .maybeSingle()

      if (activeLink && activeLink.schedule_instance_id !== row.id) {
        await suppressRow(db, row.id, row.participant_id, 'existing_active_link')
        suppressed++
        continue
      }

      // 2c. New link imminent check — another pending row is due within reminder_interval_hours
      if (protocol.reminder_interval_hours) {
        const imminentCutoff = new Date(Date.now() + protocol.reminder_interval_hours * 60 * 60 * 1000).toISOString()
        const { data: imminentRow } = await db
          .from('participant_schedule')
          .select('id')
          .eq('participant_id', row.participant_id)
          .eq('status', 'pending')
          .not('scheduled_for', 'is', null)
          .gt('scheduled_for', new Date().toISOString())
          .lte('scheduled_for', imminentCutoff)
          .neq('id', row.id)
          .maybeSingle()

        if (imminentRow) {
          await suppressRow(db, row.id, row.participant_id, 'new_link_imminent')
          suppressed++
          continue
        }
      }

      // 3. Not suppressed — send the message
      try {
        const sendRes = await fetch(`${supabaseUrl}/functions/v1/send_message`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ schedule_instance_id: row.id }),
        })

        const sendBody = await sendRes.json()

        if (sendBody?.suppressed) {
          // Consent suppressed — log it
          await suppressRow(db, row.id, row.participant_id, sendBody.reason ?? 'consent_not_given')
          suppressed++
        } else if (sendBody?.success) {
          // Increment attempts on success
          await db
            .from('participant_schedule')
            .update({ attempts: (row.attempts ?? 0) + 1 })
            .eq('id', row.id)
          processed++
        } else {
          console.error(`send_message failed for row ${row.id}:`, sendBody?.error)
          failed++
        }
      } catch (sendErr) {
        console.error(`send_message fetch error for row ${row.id}:`, sendErr)
        failed++
      }
    }

    return json({ processed, suppressed, failed })

  } catch (err) {
    console.error('check_schedule unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function suppressRow(db: SupabaseClient, rowId: string, participantId: string, reason: string) {
  const [logRes, schedRes] = await Promise.all([
    db.from('message_log').insert({
      participant_id: participantId,
      sent_at: new Date().toISOString(),
      channel: 'email',
      status: 'suppressed',
      suppressed_reason: reason,
      is_test: false,
    }),
    db.from('participant_schedule').update({ status: 'suppressed' }).eq('id', rowId),
  ])
  if (logRes.error) console.error('Failed to log suppression:', logRes.error.message)
  if (schedRes.error) console.error('Failed to update schedule status:', schedRes.error.message)
}
