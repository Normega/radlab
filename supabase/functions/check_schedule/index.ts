// check_schedule — cron-triggered scheduler.
// Queries for due pending schedule rows and sends (or suppresses) each one.
//
// Schedule: every 15 minutes, via a pg_cron job calling this over net.http_post
// (see `cron.job` in the database — not deployed with `--schedule`).
//
// Also callable manually via HTTP POST for testing.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LAB_TIMEZONE = 'America/Toronto'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** date ('YYYY-MM-DD') + time ('HH:MM:SS') for an instant, in a given IANA time zone. */
function formatInTimeZone(instant: Date, timeZone: string): { date: string; time: string } {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(instant)

  return { date, time }
}

/** Lexicographically comparable key for a (scheduled_date, send_time) pair. */
function scheduleKey(date: string, time: string): string {
  return `${date}T${time}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const db: SupabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const now = new Date()
    const { date: todayStr, time: nowTime } = formatInTimeZone(now, LAB_TIMEZONE)
    const nowKey = scheduleKey(todayStr, nowTime)

    // 0. Auto-expire any active links whose expires_at has passed.
    //    Prevents stale manually-issued links from blocking automated sends indefinitely.
    await db
      .from('participant_links')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lt('expires_at', now.toISOString())

    // 1. Fetch pending rows scheduled today or earlier (date-only filter; the
    // send_time cutoff is applied below since Postgres can't compare it
    // against "now" without knowing which rows are for today).
    const { data: candidateRows, error: fetchErr } = await db
      .from('participant_schedule')
      .select('id, participant_id, study_id, scheduled_date, send_time, attempts')
      .eq('status', 'pending')
      .lte('scheduled_date', todayStr)

    if (fetchErr) {
      console.error('Failed to fetch due rows:', fetchErr.message)
      return json({ error: fetchErr.message }, 500)
    }

    const dueRows = (candidateRows ?? []).filter(
      (r) => scheduleKey(r.scheduled_date, r.send_time) <= nowKey,
    )

    if (dueRows.length === 0) {
      return json({ processed: 0, suppressed: 0, failed: 0 })
    }

    // Fetch reminder settings in bulk (keyed by study_id)
    const studyIds = [...new Set(dueRows.map((r) => r.study_id))]
    const studyMap: Record<string, { max_attempts: number; reminder_interval_hours: number | null }> = {}

    const { data: studies } = await db
      .from('studies')
      .select('id, max_attempts, reminder_interval_hours')
      .in('id', studyIds)

    for (const s of studies ?? []) {
      studyMap[s.id] = {
        max_attempts: s.max_attempts ?? 1,
        reminder_interval_hours: s.reminder_interval_hours ?? null,
      }
    }

    let processed = 0
    let suppressed = 0
    let failed = 0

    for (const row of dueRows) {
      const settings = studyMap[row.study_id] ?? { max_attempts: 1, reminder_interval_hours: null }

      // 2a. Max attempts check
      if ((row.attempts ?? 0) >= settings.max_attempts) {
        await suppressRow(db, row.id, row.participant_id, 'max_attempts_reached')
        suppressed++
        continue
      }

      // 2b. Active link check — participant already has an active link for a different row
      const { data: activeLink } = await db
        .from('participant_links')
        .select('id, schedule_id')
        .eq('participant_id', row.participant_id)
        .eq('status', 'active')
        .maybeSingle()

      if (activeLink && activeLink.schedule_id !== row.id) {
        await suppressRow(db, row.id, row.participant_id, 'existing_active_link')
        suppressed++
        continue
      }

      // 2c. New link imminent check — another pending row for this participant
      // is due within reminder_interval_hours of now.
      if (settings.reminder_interval_hours) {
        const cutoffInstant = new Date(now.getTime() + settings.reminder_interval_hours * 60 * 60 * 1000)
        const { date: cutoffDate, time: cutoffTime } = formatInTimeZone(cutoffInstant, LAB_TIMEZONE)
        const cutoffKey = scheduleKey(cutoffDate, cutoffTime)

        const { data: candidates } = await db
          .from('participant_schedule')
          .select('id, scheduled_date, send_time')
          .eq('participant_id', row.participant_id)
          .eq('status', 'pending')
          .neq('id', row.id)
          .lte('scheduled_date', cutoffDate)

        const imminentRow = (candidates ?? []).find((c) => {
          const key = scheduleKey(c.scheduled_date, c.send_time)
          return key > nowKey && key <= cutoffKey
        })

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
          body: JSON.stringify({ schedule_id: row.id }),
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
    db.from('participant_schedule').update({ status: 'blocked' }).eq('id', rowId),
  ])
  if (logRes.error) console.error('Failed to log suppression:', logRes.error.message)
  if (schedRes.error) console.error('Failed to update schedule status:', schedRes.error.message)
}
