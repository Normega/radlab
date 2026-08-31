// send_message — core email sending primitive.
// Called by check_schedule (cron) or directly for test sends from the admin UI.
//
// POST body: { schedule_id: string, test_override_email?: string,
//              is_reminder?: boolean, final_notice?: 'gate'|'terminal'|'window' }
// When test_override_email is provided this is a test send — consent is skipped,
// recipient is the override address, subject is prefixed with [TEST].
// When is_reminder is true (reminder resends from check_schedule) the copy is
// framed as a follow-up nudge rather than a first-time invitation.
// final_notice is the deadline-anchored last-chance reminder on a critical
// session; check_schedule decides both whether it applies and which kind, since
// that derivation needs the study's design_graph (see _shared/criticalSession.ts).
// A first send whose preceding session went unused additionally leads with a
// short, non-punitive acknowledgment — or, at MAX_ACK_STREAK+ consecutive
// misses, a get-back-on-track note with a formal-withdrawal offer (see
// missedSessionState below).

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { renderEmail } from '../_shared/emailTemplate.ts'
import { getOrCreateUnsubscribeToken } from '../_shared/unsubscribeToken.ts'
import { issueLink } from '../_shared/issueLink.ts'
import { resolveParticipantEmail } from '../_shared/participantEmail.ts'
import { RESEARCH_REPLY_TO } from '../_shared/replyTo.ts'

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
    // Caller JWT path. Deliberately does NOT use SUPABASE_ANON_KEY: that var is
    // deprecated in favour of publishable keys, and the legacy JWT pair it used
    // to hold was revoked 2026-07-30 — when it eventually stops being injected,
    // this path would 401 in a way indistinguishable from an expired session.
    // getUser(jwt) validates the token server-side; the service key is only the
    // apikey for that call, and the role read below is a gate, so reading the
    // true role rather than the RLS-visible one is what we want.
    const auth = createClient(supabaseUrl, serviceKey)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: authErr } = await auth.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await auth
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'lab') return json({ error: 'Forbidden' }, 403)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { schedule_id, test_override_email, is_reminder, final_notice } = body

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

    // Link expiry from the compiled session slot. The label rides along for the
    // final notice, which names the session it's about ("your Midpoint
    // Assessment") — the same source renderTerminationEmail names it by.
    let expiresHours = 48
    let sessionLabel: string | null = null
    let sessionDayNumber: number | null = null
    if (row.study_session_id) {
      const { data: session } = await db
        .from('study_sessions')
        .select('link_expires_hours, label, day_number')
        .eq('id', row.study_session_id)
        .single()
      if (session?.link_expires_hours) expiresHours = session.link_expires_hours
      sessionLabel     = session?.label ?? null
      sessionDayNumber = session?.day_number ?? null
    }

    // ── Protocol position, NOT elapsed days ───────────────────────────────────
    //
    // `participant_schedule.study_day` is date-derived (days since the
    // participant's t0, plus one), so any real-world slippage inflates it: a
    // participant who uses the full 3-day midpoint window, or whose Phase 2
    // re-anchors when their fork resolves, gets emailed a number that climbs
    // past the protocol's own day map. Observed 2026-08-13 — a session the
    // protocol calls Day 28 rendered as "Study Day 39".
    //
    // Participants read this as progress ("how far through am I?"), not as a
    // calendar, so it is computed as a position: rank this session's
    // `day_number` among the study's DISTINCT day_numbers, out of how many
    // there are. Distinct because parallel arms share day_numbers — Phase 2
    // Day 1 exists three times, once per condition — and a participant
    // traverses exactly one of them, so counting rows would treble the total
    // and make it differ by arm. Derived entirely from the compiled
    // `study_sessions`, so it is identical for every participant regardless of
    // arm, and immune to date drift.
    let dayOrdinal: number | null = null
    let dayTotal:   number | null = null
    if (sessionDayNumber != null) {
      const { data: allSessions } = await db
        .from('study_sessions')
        .select('day_number')
        .eq('study_id', row.study_id)
        .not('day_number', 'is', null)

      const days = [...new Set((allSessions ?? []).map(s => s.day_number as number))]
        .sort((a, b) => a - b)
      const idx = days.indexOf(sessionDayNumber)
      if (idx !== -1) {
        dayOrdinal = idx + 1
        dayTotal   = days.length
      }
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

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://radlab.zone'
    const linkUrl = `${siteUrl}/s/${token}`

    // 6. Generate unsubscribe URL (omitted for test sends). The token is the
    // permanent per-participant/study one — the withdrawal link below reuses it.
    let unsubToken: string | null = null
    let unsubscribeUrl: string | null = null
    if (!isTest) {
      unsubToken = await getOrCreateUnsubscribeToken(db, row.participant_id, row.study_id)
      unsubscribeUrl = `${siteUrl}/unsubscribe/${unsubToken}`
    }

    // For a reminder the link has already been alive a while, so its remaining
    // lifetime is shorter than the session's full expiry window. Show whole
    // hours REMAINING, rounded down so we never promise more time than is
    // actually left. First sends (and the rare case where we lack the link's
    // expires_at) keep the full window, which is accurate at issue time.
    // Load-bearing for the final notice, whose whole point is the countdown —
    // and where the floor keeps "about 12 hours" from ever overstating.
    let displayExpiresHours = expiresHours
    if ((is_reminder || final_notice) && linkExpiresAt) {
      const remainingHours = Math.floor((new Date(linkExpiresAt).getTime() - Date.now()) / 3_600_000)
      displayExpiresHours = Math.max(1, remainingHours)
    }

    // Acknowledge a previous session the participant didn't get to, on the
    // email that gives them the next one. Skipped for test sends (no real
    // history to reason about) and for reminders (renderEmail's reminder
    // lead-in takes precedence — see MISSED_INTRO there).
    const missState: MissState = !isTest && !is_reminder && !final_notice
      ? await missedSessionState(db, row)
      : 'none'
    const afterMissed = missState === 'ack'
    const lapsed = missState === 'lapsed'

    // The withdrawal offer that rides the lapsed email. Reuses the permanent
    // per-participant/study token the unsubscribe link is built from — the
    // route decides the action, and /withdraw requires an explicit confirm
    // click before anything changes (safe against link-scanner prefetch).
    const withdrawUrl = lapsed && unsubToken ? `${siteUrl}/withdraw/${unsubToken}` : null

    // Response rate so far — on reminders and on the email that follows a
    // missed session (single miss or lapsed streak), i.e. only where the
    // participant has lapsed and we're already writing about it. Never on a
    // plain first send: there the number changes nothing and reads as a
    // running score. Only computed once there's enough history for it to mean
    // anything (see checkInProgress). It also selects the missed-session
    // lead-in, so a low rate doesn't get told the miss was "occasional" (see
    // LOW_RATE_PCT in emailTemplate.ts).
    // Never computed for a final notice — renderEmail suppresses the line there
    // anyway, so the query would be pure waste on the one send that is timing-
    // critical (it fires within a 12 h deadline window).
    const progress = !isTest && !final_notice && (is_reminder || afterMissed || lapsed)
      ? await checkInProgress(db, row)
      : null

    // 7. Render email (subject + HTML + plain text)
    const { subject, html, text } = renderEmail({
      first_name:      firstName,
      // Protocol position, not the date-derived participant_schedule.study_day
      // (see the dayOrdinal derivation above). Falls back to the elapsed
      // counter only when the study has no compiled day_numbers to rank
      // against, so single-shot studies behave exactly as before.
      study_day:       dayOrdinal ?? row.study_day,
      study_day_total: dayTotal,
      link_url:        linkUrl,
      expires_hours:   displayExpiresHours,
      custom_subject:  customSubject,
      custom_body:     customBody,
      unsubscribe_url: unsubscribeUrl,
      is_test:         isTest,
      is_reminder:     !!is_reminder,
      after_missed:    afterMissed,
      lapsed,
      withdraw_url:    withdrawUrl,
      final_notice:    final_notice ?? null,
      session_label:   sessionLabel,
      progress,
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
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'research@radlab.zone'

    const { data: sendData, error: sendErr } = await resend.emails.send({
      from: fromEmail,
      // camelCase: the SDK maps replyTo -> reply_to on the wire and drops
      // unrecognised keys silently. See _shared/replyTo.ts.
      replyTo: RESEARCH_REPLY_TO,
      to,
      subject,
      html,
      text,
    })

    const sendStatus = sendErr ? 'failed' : 'sent'

    // 9. Log the send attempt. Final notices get their own kind: they are the
    // only session email that names a consequence, so "did this participant
    // actually receive their warning before being withdrawn?" has to be
    // answerable from message_log alone.
    await logMessage(db, row.participant_id, sendStatus, isTest, null, final_notice ? 'final_notice' : 'session_link')

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

// Beyond this many consecutive misses, stop the warm single-miss ack. Someone
// who has missed four in a row has disengaged, and a warm "no problem" on every
// email starts to read as tone-deaf rather than kind. Instead of falling back
// to generic copy (which read as the system not noticing), that case now gets
// the lapsed tier: a plain get-back-on-track note plus a formal-withdrawal
// offer (see LAPSED_INTRO in emailTemplate.ts and the /withdraw page).
const MAX_ACK_STREAK = 4

// What the immediately-preceding schedule rows say about this send:
//   'none'   — previous session wasn't a miss (or there's no history)
//   'ack'    — previous session was missed, streak below MAX_ACK_STREAK:
//              lead with the warm single-miss acknowledgment
//   'lapsed' — MAX_ACK_STREAK+ consecutive misses: lead with the
//              get-back-on-track + withdrawal-offer copy
type MissState = 'none' | 'ack' | 'lapsed'

/**
 * Whether the session immediately before this one closed unused — i.e. the
 * participant was emailed a link (attempts >= 1), never completed it, and its
 * window has since closed — and if so, whether the miss streak is short enough
 * for the warm ack ('ack') or long enough for the withdrawal offer ('lapsed').
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
async function missedSessionState(
  db: SupabaseClient,
  row: { id: string; participant_id: string; study_id: string; scheduled_date: string; send_time: string | null },
): Promise<MissState> {
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
    return 'none'
  }

  // The date-only filter above keeps same-day siblings scheduled later than
  // this row (3-check-ins-a-day studies), so drop them by full key.
  const thisKey = scheduleKey(row.scheduled_date, row.send_time)
  const prior = (data ?? []).filter((r) => scheduleKey(r.scheduled_date, r.send_time) < thisKey)
  if (prior.length === 0) return 'none'

  // Which of those rows still have an openable link? Same liveness test as the
  // link reuse check above — status 'active' and not past expires_at.
  const { data: priorLinks, error: linkErr } = await db
    .from('participant_links')
    .select('schedule_id, status, expires_at')
    .in('schedule_id', prior.map((r) => r.id))

  if (linkErr) {
    console.warn('missed-session link lookup failed:', linkErr.message)
    return 'none'
  }

  const nowMs = Date.now()
  const stillOpen = new Set(
    (priorLinks ?? [])
      .filter((l) => l.status === 'active' && (!l.expires_at || new Date(l.expires_at).getTime() > nowMs))
      .map((l) => l.schedule_id),
  )

  const isMiss = (r: { id: string; status: string; attempts: number | null }) =>
    r.status !== 'completed' && (r.attempts ?? 0) >= 1 && !stillOpen.has(r.id)

  if (!isMiss(prior[0])) return 'none'

  let streak = 0
  for (const r of prior) {
    if (!isMiss(r)) break
    streak++
  }
  if (streak < MAX_ACK_STREAK) return 'ack'

  // The lapsed offer rides only the FIRST emailed send of a day. Repeating
  // "are we wasting each other's time" three times a day turns a reality
  // check into pestering. Later sends that day fall back to generic copy —
  // not the warm ack, which the streak has already outgrown. Note the guard
  // is positional, not "was it offered": if the streak crosses MAX_ACK_STREAK
  // mid-day, the day's earlier sends carried the ack, not the offer, and the
  // first offer still waits for the next day's first send — a few hours'
  // delay, accepted for the simpler rule. A suppressed/blocked same-day row
  // (attempts 0) doesn't count: no email went out.
  const offeredToday = prior.some(
    (r) => r.scheduled_date === row.scheduled_date && (r.attempts ?? 0) >= 1,
  )
  return offeredToday ? 'none' : 'lapsed'
}

// Below this many closed check-ins the number is noise, and worse than noise
// early on: someone who misses their first would read "0 out of 1 (0%)" at
// exactly the moment a nudge should be encouraging.
const MIN_PROGRESS_SESSIONS = 3

/**
 * The participant's response rate over check-ins that have already closed.
 *
 * Denominator = prior rows that were actually emailed (`attempts >= 1`), so
 * system-blocked and never-sent rows can't score anyone down for something they
 * were never asked to do. It excludes the row this email is about, whose window
 * is still open on a reminder by construction.
 *
 * No link-liveness check is needed here, unlike followsMissedSession: issueLink
 * revokes every other active link when it issues one, so at most one link is
 * live at a time and it is this row's. Any *prior* row is therefore closed
 * already, and its status alone settles whether it was answered.
 *
 * Returns null below MIN_PROGRESS_SESSIONS — the caller omits the line entirely
 * rather than rendering a number built on one or two data points.
 *
 * NOTE: "responded to" here means the schedule row reached 'completed'. That is
 * the display-side twin of the enforcement counter, which is still unsettled
 * (docs/markdowns/adherence_copy_linkage_scope.md §2.6/§2.8 — the two candidate
 * definitions disagree for 3 of 17 live participants). This deliberately does
 * NOT try to match the enforcement rule: it makes no claim about standing, so
 * it only has to be an honest description of the schedule. If a threshold is
 * ever stated alongside it, the two must be reconciled first.
 */
async function checkInProgress(
  db: SupabaseClient,
  row: { id: string; participant_id: string; study_id: string; scheduled_date: string; send_time: string | null },
): Promise<{ completed: number; total: number; pct: number } | null> {
  const { data, error } = await db
    .from('participant_schedule')
    .select('scheduled_date, send_time, status, attempts')
    .eq('participant_id', row.participant_id)
    .eq('study_id', row.study_id)
    .neq('id', row.id)
    .gte('attempts', 1)
    .lte('scheduled_date', row.scheduled_date)

  if (error) {
    console.warn('check-in progress lookup failed:', error.message)
    return null
  }

  // Date-only filter above still admits same-day siblings scheduled later than
  // this row (several-check-ins-a-day studies) — drop them by full key.
  const thisKey = scheduleKey(row.scheduled_date, row.send_time)
  const prior = (data ?? []).filter((r) => scheduleKey(r.scheduled_date, r.send_time) < thisKey)

  const total = prior.length
  if (total < MIN_PROGRESS_SESSIONS) return null

  const completed = prior.filter((r) => r.status === 'completed').length
  return { completed, total, pct: Math.round((completed / total) * 100) }
}

async function logMessage(
  db: SupabaseClient,
  participantId: string,
  status: string,
  isTest: boolean,
  suppressedReason: string | null,
  kind: 'session_link' | 'final_notice' = 'session_link',
) {
  const { error } = await db.from('message_log').insert({
    participant_id: participantId,
    sent_at: new Date().toISOString(),
    channel: 'email',
    status,
    is_test: isTest,
    suppressed_reason: suppressedReason,
    kind,
  })
  if (error) console.error('Failed to write message_log:', error.message)
}
