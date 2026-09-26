// buddy_send — Accountability Buddy daily email (website.md "Accountability
// Buddy"; spec §4). Called hourly at :00 by pg_cron with the service key.
//
// Proceeds only Monday–Friday 08:00–11:59 Toronto time. For each active,
// unpaused student with no send today: claim the day (buddy_claim_send inserts
// a 'pending' row — two overlapping runs cannot both send), email a fresh link,
// then buddy_finish_send marks it 'sent' and supersedes the previous link in one
// transaction — or 'failed', leaving the previous link live and the day
// retryable on the next tick. A send is recorded as successful only after
// Resend returns success.
//
// Callers:
//   service key            — the cron run; also { force: true, student_id }
//                            (bypasses the time window, active/pause and the
//                            once-a-day rule; for the Sunday test plan), and
//                            test sends.
//   super-admin user JWT   — test sends ONLY: { test: 'checkin', student_id }.
//                            Emails norman@radlab.zone the student's current
//                            email with a dead link and writes NOTHING (no
//                            buddy_sends row, so the student's live link and
//                            quote rotation are untouched).
//
// verify_jwt = false in config.toml: the cron presents an sb_secret_ key, which
// is not a JWT, so this function does its own auth check.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import {
  torontoNow, inSendWindow, isPaused, currentMilestone, newlyCompleted, pickQuote,
  randomToken, sha256Hex, type Milestone,
} from './logic.ts'
import { renderBuddyEmail } from './email.ts'

// On the UofT UTmail+ allowlist. Do not change without a new UofT IT request.
const FROM = 'Accountability Buddy <research@mail.radlab.zone>'
const SITE = 'https://radlab.zone'
const TEST_TO = 'norman@radlab.zone'
// A token that can never match (not 64 hex chars): the page shows "link not found".
const TEST_LINK = `${SITE}/buddy/test-send-not-live`

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// The column is buddy_students.reply_to; it is spelled via Record<> here so the
// replyToField guard (which forbids a `reply_to` key near an SDK send) stays
// meaningful. What goes to Resend is camelCase replyTo, below.
type Student = {
  id: string; name: string; email: string; active: boolean; paused_until: string | null
  zoom_url: string | null; next_meeting_at: string | null
} & Record<'reply_to', string>

// Everything the email needs for one student. Reads only.
async function composeFor(db: SupabaseClient, s: Student, linkUrl: string, isTest: boolean) {
  const [{ data: ms, error: msErr }, { data: prev }, { data: quotes }, { data: used }] = await Promise.all([
    db.from('buddy_milestones').select('position, title, target_date, done_at').eq('student_id', s.id),
    db.from('buddy_sends').select('sent_at').eq('student_id', s.id).eq('status', 'sent')
      .order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('buddy_quotes').select('id, quote, source, tag').eq('active', true),
    db.from('buddy_sends').select('quote_id').eq('student_id', s.id).eq('status', 'sent').not('quote_id', 'is', null),
  ])
  if (msErr) throw new Error(`milestones: ${msErr.message}`)

  const milestones = (ms ?? []) as Milestone[]
  const uses = new Map<string, number>()
  for (const r of used ?? []) uses.set(r.quote_id, (uses.get(r.quote_id) ?? 0) + 1)
  const quote = pickQuote(quotes ?? [], uses)

  const meetingAt = s.next_meeting_at && new Date(s.next_meeting_at).getTime() > Date.now() ? s.next_meeting_at : null
  const email = renderBuddyEmail({
    firstName: s.name.split(' ')[0],
    current: currentMilestone(milestones),
    completed: newlyCompleted(milestones, prev?.sent_at ?? null),
    linkUrl, meetingAt, zoomUrl: s.zoom_url, quote, isTest,
  })
  return { email, quoteId: quote?.id ?? null }
}

async function sendOne(
  db: SupabaseClient, resend: Resend, s: Student, today: string, forced: boolean,
): Promise<{ student_id: string; status: string; error?: string }> {
  const token = randomToken()
  const tokenHash = await sha256Hex(token)
  const { email, quoteId } = await composeFor(db, s, `${SITE}/buddy/${token}`, false)

  const { data: sendId, error: claimErr } = await db.rpc('buddy_claim_send', {
    p_student: s.id, p_send_date: today, p_token_hash: tokenHash, p_quote_id: quoteId, p_forced: forced,
  })
  if (claimErr) return { student_id: s.id, status: 'claim_error', error: claimErr.message }
  if (!sendId) return { student_id: s.id, status: 'already_sent_today' }

  let ok = false, resendId: string | null = null, errMsg: string | null = null
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [s.email],
      replyTo: s.reply_to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })
    if (error) errMsg = `${error.name ?? 'error'}: ${error.message}`
    else { ok = true; resendId = data?.id ?? null }
  } catch (e) {
    errMsg = e instanceof Error ? e.message : String(e)
  }

  // Record the outcome. Retried once: if this never lands, the row stays
  // 'pending' and is failed (and the day retried) by a claim 15 minutes later.
  const finish = () => db.rpc('buddy_finish_send', {
    p_send_id: sendId, p_ok: ok, p_resend_id: resendId, p_error: errMsg,
  })
  let { error: finErr } = await finish()
  if (finErr) ({ error: finErr } = await finish())
  if (finErr) console.error(`buddy_send: finish failed for send ${sendId} (email ok=${ok}):`, finErr.message)

  if (!ok) console.error(`buddy_send: Resend failed for student ${s.id}:`, errMsg)
  return ok
    ? { student_id: s.id, status: 'sent' }
    : { student_id: s.id, status: 'failed', error: errMsg ?? undefined }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } })

  const authHeader = req.headers.get('Authorization') ?? ''
  const isService = authHeader === `Bearer ${serviceKey}`
  if (!isService) {
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error } = await db.auth.getUser(jwt)
    if (error || !user) return json({ error: 'Unauthorized' }, 401)
    const { data: profile } = await db.from('profiles').select('super_admin').eq('id', user.id).maybeSingle()
    if (!profile?.super_admin) return json({ error: 'Forbidden — super admin required' }, 403)
  }

  const body = await req.json().catch(() => ({}))
  const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
  const now = torontoNow(new Date())

  try {
    // ── Test send: emails Norm, writes nothing ────────────────────────────────
    if (body?.test === 'checkin') {
      if (typeof body.student_id !== 'string') return json({ error: 'test needs student_id' }, 400)
      const { data: s } = await db.from('buddy_students').select('*').eq('id', body.student_id).maybeSingle()
      if (!s) return json({ error: 'student not found' }, 404)
      const { email } = await composeFor(db, s as Student, TEST_LINK, true)
      const { data, error } = await resend.emails.send({
        from: FROM, to: [TEST_TO], replyTo: s.reply_to,
        subject: email.subject, html: email.html, text: email.text,
      })
      if (error) return json({ test: true, sent: 0, error: error.message }, 502)
      return json({ test: true, sent: 1, to: TEST_TO, resend_id: data?.id, note: 'no buddy_sends row written' })
    }

    if (!isService) return json({ error: 'Forbidden — user callers may only send tests' }, 403)

    // ── Forced send (manual, service key only) ────────────────────────────────
    if (body?.force === true) {
      if (typeof body.student_id !== 'string') return json({ error: 'force needs student_id' }, 400)
      const { data: s } = await db.from('buddy_students').select('*').eq('id', body.student_id).maybeSingle()
      if (!s) return json({ error: 'student not found' }, 404)
      const result = await sendOne(db, resend, s as Student, now.date, true)
      return json({ forced: true, today: now.date, results: [result] })
    }

    // ── Scheduled run ─────────────────────────────────────────────────────────
    if (!inSendWindow(now)) {
      return json({ skipped: true, reason: 'outside_window', today: now.date, hour: now.hour, dow: now.isoDow })
    }

    const { data: students, error: stErr } = await db.from('buddy_students').select('*').eq('active', true)
    if (stErr) return json({ error: stErr.message }, 500)

    const results = []
    for (const s of (students ?? []) as Student[]) {
      if (isPaused(s.paused_until, now.date)) { results.push({ student_id: s.id, status: 'paused' }); continue }
      const { count } = await db.from('buddy_sends').select('id', { count: 'exact', head: true })
        .eq('student_id', s.id).eq('send_date', now.date).eq('forced', false).in('status', ['pending', 'sent'])
      if ((count ?? 0) > 0) { results.push({ student_id: s.id, status: 'already_sent_today' }); continue }
      try {
        results.push(await sendOne(db, resend, s, now.date, false))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`buddy_send: student ${s.id} errored before sending:`, msg)
        results.push({ student_id: s.id, status: 'error', error: msg })
      }
    }
    return json({ today: now.date, hour: now.hour, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('buddy_send error:', msg)
    return json({ error: msg }, 500)
  }
})
