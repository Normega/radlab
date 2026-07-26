// send_message — core email sending primitive.
// Called by check_schedule (cron) or directly for test sends from the admin UI.
//
// POST body: { schedule_id: string, test_override_email?: string, is_reminder?: boolean }
// When test_override_email is provided this is a test send — consent is skipped,
// recipient is the override address, subject is prefixed with [TEST].
// When is_reminder is true (reminder resends from check_schedule) the copy is
// framed as a follow-up nudge rather than a first-time invitation.
// A first send whose preceding session went unused additionally leads with a
// short, non-punitive acknowledgment (see followsMissedSession below).

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { renderEmail } from '../_shared/emailTemplate.ts'
import { getOrCreateUnsubscribeToken } from '../_shared/unsubscribeToken.ts'
import { issueLink } from '../_shared/issueLink.ts'
import { resolveParticipantEmail } from '../_shared/participantEmail.ts'

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Require service-role Bearer (from check_schedule) or a valid lab-member JWT.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  if (authHeader !== `Bearer ${serviceKey}`) {
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await callerClient
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'lab') return json({ error: 'Forbidden' }, 403)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { schedule_id, test_override_email, is_reminder } = body

    // 1. Validate input
    if (!schedule_id) {
      return json({ error: 'schedule_id is required' }, 400)
    }

    const isTest = !!test_override_email

    // Service role client — bypasses RLS; required for auth.users lookups.
    const db: SupabaseClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // 2. Fetch the schedule row
    const { data: row, error: rowErr } = await db
      .from('participant_schedule')
      .select('id, participant_id, study_id, study_session_id, scheduled_date, send_time, study_day, link_id, status, attempts')
      .eq('id', schedule_id)
      .single()

    if (rowErr || !row) {
      return json({ error: 'Schedule row not found' }, 400)
    }

    // Link expiry from the compiled session slot.
    let expiresHours = 48
    if (row.study_session_id) {
      const { data: session } = await db
        .from('study_sessions')
        .select('link_expires_hours')
        .eq('id', row.study_session_id)
        .single()
      if (session?.link_expires_hours) expiresHours = session.link_expires_hours
    }

    // Per-study custom email subject/body (nullable — null uses default template).
    const { data: study } = await db
      .from('studies')
      .select('email_subject, email_body')
      .eq('id', row.study_id)
      .single()

    const customSubject = study?.email_subject ?? null
    const customBody    = study?.email_body ?? null

    // 3. Fetch participant profile and email
    const { data: profile } = await db
      .from('profiles')
      .select('id, display_name')
      .eq('id', row.participant_id)
      .single()

    const displayName = profile?.display_name ?? ''
    const firstName   = displayName.split(' ')[0] || 'Participant'

    // Prefers study_enrollments.contact_email; falls back to the auth email
    // only when it isn't a synthetic ext-*@participants.radlab.zone address
    // (external enrollments' auth email is undeliverable by construction).
    const participantEmail = await resolveParticipantEmail(db, row.participant_id, row.study_id)

    // 4. Email opt-out check (skipped for test sends). Not gated on
    // consent_date: the first link is emailed at enrollment, before the
    // participant consents at /s/{token}, so requiring consent would block
    // all first sends. No enrollment row => treat as opted in.
    if (!isTest) {
      const { data: enrollment } = await db
        .from('study_enrollments')
        .select('email_reminders')
        .eq('study_id', row.study_id)
        .eq('profile_id', row.participant_id)
        .maybeSingle()

      if (enrollment?.email_reminders === false) {
        return json({ suppressed: true, reason: 'consent_not_given' })
      }
    }

    // 5. Resolve or create participant link
    let token: string | null = null
    let linkExpiresAt: string | null = null

    if (row.link_id) {
      const { data: existingLink } = await db
        .from('participant_links')
        .select('token, status, expires_at')
        .eq('id', row.link_id)
        .single()

      const stillActive = existingLink?.status === 'active' &&
        (!existingLink.expires_at || new Date(existingLink.expires_at) > new Date())

      if (stillActive) {
        token = existingLink!.token
        linkExpiresAt = existingLink!.expires_at ?? null
      }
    }

    if (!token) {
      // Reusing an expired or revoked token would email a dead link.
      const link = await issueLink(db, {
        scheduleId: row.id,
        participantId: row.participant_id,
        studyId: row.study_id,
        linkExpiresHours: expiresHours,
      })
      token = link.token
      await db.from('participant_schedule').update({ status: 'link_sent' }).eq('id', row.id)
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://radlab.vercel.app'
    const linkUrl = `${siteUrl}/s/${token}`

    // 6. Generate unsubscribe URL (omitted for test sends)
    let unsubscribeUrl: string | null = null
    if (!isTest) {
      const unsubToken = await getOrCreateUnsubscribeToken(db, row.participant_id, row.study_id)
      unsubscribeUrl = `${siteUrl}/unsubscribe/${unsubToken}`
    }

    // For a reminder the link has already been alive a while, so its remaining
    // lifetime is shorter than the session's full expiry window. Show whole
    // hours REMAINING, rounded down so we never promise more time than is
    // actually left. First sends (and the rare case where we lack the link's
    // expires_at) keep the full window, which is accurate at issue time.
    let displayExpiresHours = expiresHours
    if (is_reminder && linkExpiresAt) {
      const remainingHours = Math.floor((new Date(linkExpiresAt).getTime() - Date.now()) / 3_600_000)
      displayExpiresHours = Math.max(1, remainingHours)
    }

    // Acknowledge a previous session the participant didn't get to, on the
    // email that gives them the next one. Skipped for test sends (no real
    // history to reason about) and for reminders (renderEmail's reminder
    // lead-in takes precedence — see MISSED_INTRO there).
    const afterMissed = !isTest && !is_reminder && await followsMissedSession(db, row)

    // 7. Render email (subject + HTML + plain text)
    const { subject, html, text } = renderEmail({
      first_name:      firstName,
      study_day:       row.study_day,
      link_url:        linkUrl,
      expires_hours:   displayExpiresHours,
      custom_subject:  customSubject,
      custom_body:     customBody,
      unsubscribe_url: unsubscribeUrl,
      is_test:         isTest,
      is_reminder:     !!is_reminder,
      after_missed:    afterMissed,
    })

    // Warn if any template variables remain unresolved after substitution
    for (const [label, content] of [['subject', subject], ['text', text]] as const) {
      const unresolved = content.match(/\{\{[^}]+\}\}/g)
      if (unresolved) console.warn(`Unresolved template variables in ${label}:`, unresolved)
    }

    // 8. Send via Resend
    const to = isTest ? test_override_email : participantEmail
    if (!to) {
      await logMessage(db, row.participant_id, 'failed', isTest, null)
      return json({ success: false, error: 'No recipient email found for participant' })
    }

    const resend    = new Resend(Deno.env.get('RESEND_API_KEY'))
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'research@radlab.vercel.app'

    const { data: sendData, error: sendErr } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
      text,
    })

    const sendStatus = sendErr ? 'failed' : 'sent'

    // 9. Log the send attempt
    await logMessage(db, row.participant_id, sendStatus, isTest, null)

    // 10. Return result
    if (sendErr) {
      console.error('Resend error:', sendErr)
      return json({ success: false, error: sendErr.message })
    }

    return json({ success: true, message_id: sendData?.id, recipient: to })

  } catch (err) {
    console.error('send_message unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rows are ordered by the (date, time) pair, which Postgres can't compare as a
 *  tuple over PostgREST — same lexicographic key trick as check_schedule. */
function scheduleKey(date: string, time: string | null): string {
  return `${date}T${time ?? '00:00:00'}`
}

// Beyond this many consecutive misses, stop acknowledging. Someone who has
// missed four in a row has disengaged, and a warm "no problem" on every email
// starts to read as tone-deaf rather than kind — that case belongs to the
// adherence-withdrawal path, not to more cheerful copy.
const MAX_ACK_STREAK = 4

/**
 * True when the session immediately before this one closed unused — i.e. the
 * participant was emailed a link (attempts >= 1), never completed it, and its
 * window has since closed.
 *
 * A miss is defined by the CLOSED WINDOW, not by status === 'missed'. The
 * 'missed' label is only applied by check_schedule step 0b, which considers
 * rows with scheduled_date < today — so in a several-times-a-day study an
 * intra-day miss keeps a non-terminal 'link_sent' status until the next day.
 * Keying off the label meant the 20:00 email never acknowledged a missed 14:00
 * (observed live 2026-07-25), which is exactly the case this feature exists
 * for. A dead link is the reliable signal in both cases.
 *
 * Deliberately the *immediately* preceding row, so a miss is only acknowledged
 * on the very next email: if they've completed anything since, that completion
 * is the preceding row and nothing is said. Rows that were never emailed
 * (system-blocked, or 'unlocked' first sessions the cron never sends) are
 * excluded by the attempts check — apologizing for a link the participant never
 * received would only confuse them. A row whose link is still live isn't a miss
 * yet: the participant can still do it, and the reminder pass covers that.
 */
async function followsMissedSession(
  db: SupabaseClient,
  row: { id: string; participant_id: string; study_id: string; scheduled_date: string; send_time: string | null },
): Promise<boolean> {
  const { data, error } = await db
    .from('participant_schedule')
    .select('id, scheduled_date, send_time, status, attempts')
    .eq('participant_id', row.participant_id)
    .eq('study_id', row.study_id)
    .neq('id', row.id)
    .lte('scheduled_date', row.scheduled_date)
    .order('scheduled_date', { ascending: false })
    .order('send_time', { ascending: false })
    .limit(MAX_ACK_STREAK + 4)

  if (error) {
    console.warn('missed-session lookup failed:', error.message)
    return false
  }

  // The date-only filter above keeps same-day siblings scheduled later than
  // this row (3-check-ins-a-day studies), so drop them by full key.
  const thisKey = scheduleKey(row.scheduled_date, row.send_time)
  const prior = (data ?? []).filter((r) => scheduleKey(r.scheduled_date, r.send_time) < thisKey)
  if (prior.length === 0) return false

  // Which of those rows still have an openable link? Same liveness test as the
  // link reuse check above — status 'active' and not past expires_at.
  const { data: priorLinks, error: linkErr } = await db
    .from('participant_links')
    .select('schedule_id, status, expires_at')
    .in('schedule_id', prior.map((r) => r.id))

  if (linkErr) {
    console.warn('missed-session link lookup failed:', linkErr.message)
    return false
  }

  const nowMs = Date.now()
  const stillOpen = new Set(
    (priorLinks ?? [])
      .filter((l) => l.status === 'active' && (!l.expires_at || new Date(l.expires_at).getTime() > nowMs))
      .map((l) => l.schedule_id),
  )

  const isMiss = (r: { id: string; status: string; attempts: number | null }) =>
    r.status !== 'completed' && (r.attempts ?? 0) >= 1 && !stillOpen.has(r.id)

  if (!isMiss(prior[0])) return false

  let streak = 0
  for (const r of prior) {
    if (!isMiss(r)) break
    streak++
  }
  return streak < MAX_ACK_STREAK
}

async function logMessage(
  db: SupabaseClient,
  participantId: string,
  status: string,
  isTest: boolean,
  suppressedReason: string | null,
) {
  const { error } = await db.from('message_log').insert({
    participant_id: participantId,
    sent_at: new Date().toISOString(),
    channel: 'email',
    status,
    is_test: isTest,
    suppressed_reason: suppressedReason,
  })
  if (error) console.error('Failed to write message_log:', error.message)
}
