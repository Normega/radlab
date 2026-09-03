// WP5 (plan §2a): staff-triggered roster invites. POST { course_id,
// roster_ids?: string[], all?: boolean } with a staff bearer token.
//
// For each target row: ensure an auth user exists on radlab-academic
// (admin.createUser — identity.handle_new_user creates the person row),
// mint a magic link with admin.generateLink, and send it OURSELVES via
// Resend. Supabase's built-in auth mailer is rate-limited to a handful of
// messages per hour (§2a.6) and can never send a 300-student bulk; going
// through Resend with generateLink bypasses the auth mailer entirely.
//
// The emailed link expires (project OTP expiry), so the email also carries
// the permanent fallback: /academic/fieldguide/join, where a roster match
// self-serves a fresh link. Clicking either link lands the student signed
// in; enrollment happens client-side via enroll_from_roster(), which is the
// "mailbox proven" moment (§2a.4).
//
// Batches are capped per call; the client loops while `remaining > 0`.
// A staged rollout (invite a handful, then the rest) is just selecting rows.

import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const BATCH_CAP = 40
const INVITE_LIFETIME_CAP = 10 // per row, for the staff-triggered path

// The From address sits on course.radlab.zone, which has no MX, so a reply to
// it hard-bounces. These apex addresses are real Workspace mailboxes. Unknown
// codes fall back to the lab address rather than guessing a course — see
// supabase/functions/_shared/replyTo.ts for the full rationale.
const COURSE_REPLY_TO = { psy240: 'psy240@radlab.zone', psy309: 'psy309@radlab.zone' }
const replyToFor = (code) =>
  COURSE_REPLY_TO[String(code ?? '').trim().toLowerCase()] ?? 'research@radlab.zone'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

function inviteEmail({ name, link, joinUrl, courseCode }) {
  const subject = `Your ${courseCode} Field Guide access link`
  const text =
`Hi ${name},

You're on the ${courseCode} roster. The course reference wiki — the Field Guide — is ready for you.

Sign in (this link is personal to you):
${link}

The link expires after a while. If it has, get a fresh one any time by entering your U of T email at:
${joinUrl}

No password is needed — signing in is always by email link.

— ${courseCode} course team`
  const html =
`<p>Hi ${esc(name)},</p>
<p>You're on the <b>${esc(courseCode)}</b> roster. The course reference wiki — the <b>Field Guide</b> — is ready for you.</p>
<p><a href="${esc(link)}" style="display:inline-block;padding:10px 22px;border-radius:22px;background:#d63384;color:#fff;text-decoration:none;font-weight:600">Sign in to the Field Guide</a></p>
<p style="color:#666;font-size:13px">The link is personal to you and expires after a while. If it has expired, get a fresh one any time by entering your U of T email at <a href="${esc(joinUrl)}">${esc(joinUrl)}</a>. No password is needed — signing in is always by email link.</p>
<p>— ${esc(courseCode)} course team</p>`
  return { subject, text, html }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const url = process.env.COURSE_SUPABASE_URL
  const anonKey = process.env.COURSE_SUPABASE_ANON_KEY
  const serviceKey = process.env.COURSE_SUPABASE_SERVICE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const missing = [
    !url && 'COURSE_SUPABASE_URL', !anonKey && 'COURSE_SUPABASE_ANON_KEY',
    !serviceKey && 'COURSE_SUPABASE_SERVICE_KEY', !resendKey && 'RESEND_API_KEY',
  ].filter(Boolean)
  if (missing.length) return res.status(500).json({ error: `Missing env: ${missing.join(', ')}` })

  const { course_id, roster_ids, all } = req.body ?? {}
  if (!course_id) return res.status(400).json({ error: 'course_id required' })
  if (!all && !(Array.isArray(roster_ids) && roster_ids.length)) {
    return res.status(400).json({ error: 'roster_ids or all:true required' })
  }

  // ── Auth: same pattern as api/ingest.js — caller's JWT, own-rows RLS ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: staffRows, error: enrollErr } = await userClient
    .from('enrollments')
    .select('id, role, courses ( code )')
    .eq('course_id', course_id).eq('status', 'active').in('role', ['ta', 'instructor'])
  if (enrollErr) return res.status(500).json({ error: `Enrollment check failed: ${enrollErr.message}` })
  if (!staffRows?.length) return res.status(403).json({ error: 'No active TA/instructor enrollment for this course' })
  // Every staffRow above is filtered to the requested course_id, so the
  // embedded code IS this course's code — but if the embed ever comes back
  // empty, failing beats a silent 'PSY240' default that would stamp another
  // course's invites with the wrong identity.
  const courseCode = staffRows[0]?.courses?.code
  if (!courseCode) return res.status(500).json({ error: 'Course code lookup failed for this course_id' })

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Targets, via a SECURITY DEFINER rpc rather than a direct table read:
  // identity is NOT on PostgREST's exposed-schema list (that is where the PII
  // lives), so `.schema('identity')` fails with "Invalid schema". The rpc
  // enforces the same rules — never dropped, never over the lifetime cap,
  // `all` meaning everyone not yet enrolled.
  const { data: targets, error: tErr } = await service.rpc('roster_invite_targets', {
    p_course_id: course_id,
    p_ids: all ? null : roster_ids,
    p_all: !!all,
    p_cap: INVITE_LIFETIME_CAP,
    p_limit: BATCH_CAP + 1,
  })
  if (tErr) return res.status(500).json({ error: `Roster read failed: ${tErr.message}` })

  const batch = (targets ?? []).slice(0, BATCH_CAP)
  const remaining = Math.max(0, (targets?.length ?? 0) - BATCH_CAP)

  const origin = process.env.SITE_URL || 'https://radlab.zone'
  // Course-scoped since the /academic/:courseCode routes shipped (phase 4).
  // Old emails carrying /academic/fieldguide/* keep working via the immortal
  // legacy shims; only newly sent mail gets these.
  const courseSlug = courseCode.toLowerCase()
  const redirectTo = `${origin}/academic/${courseSlug}/wiki`
  const joinUrl = `${origin}/academic/${courseSlug}/join`
  const fromEmail = process.env.FROM_EMAIL || 'PSY240 Field Guide <fieldguide@course.radlab.zone>'

  const sent = []
  const failed = []
  for (const row of batch) {
    try {
      // Ensure the auth user exists; 'email_exists' is the normal repeat case.
      const { error: cuErr } = await service.auth.admin.createUser({
        email: row.email, email_confirm: true,
      })
      if (cuErr && !/already|exists/i.test(cuErr.message)) throw new Error(`createUser: ${cuErr.message}`)

      const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
        type: 'magiclink', email: row.email, options: { redirectTo },
      })
      if (linkErr) throw new Error(`generateLink: ${linkErr.message}`)
      const link = linkData?.properties?.action_link
      if (!link) throw new Error('generateLink returned no action_link')

      const { subject, text, html } = inviteEmail({ name: row.full_name.split(' ')[0], link, joinUrl, courseCode })
      // Resend allows ~2 requests/sec; a 429 gets one spaced retry, and the
      // paced loop below keeps the steady rate under the limit. The 2026-09-03
      // PSY240 bulk run stalled here: after the first fast batch, every send
      // was refused, no row advanced, and the client re-fetched the same
      // targets forever.
      const sendOnce = () => fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, reply_to: replyToFor(courseCode), to: row.email, subject, text, html }),
      })
      let rsp = await sendOnce()
      if (rsp.status === 429) { await sleep(1500); rsp = await sendOnce() }
      if (!rsp.ok) throw new Error(`Resend ${rsp.status}: ${(await rsp.text()).slice(0, 200)}`)

      await service.rpc('roster_mark_invited', { p_id: row.id })

      sent.push(row.email)
    } catch (e) {
      failed.push({ email: row.email, error: e.message })
    }
    await sleep(550)
  }

  return res.status(200).json({ sent: sent.length, failed, remaining })
}
