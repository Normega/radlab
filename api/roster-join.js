// WP5 (plan §2a): the public QR / self-serve sign-in endpoint. POST { email }.
//
// A roster match sends a fresh magic link to that address (via Resend — see
// roster-invite.js for why not the auth mailer) and reports matched:true.
// Submitting the form proves nothing (§2a.4): status only becomes `enrolled`
// when the link is clicked and enroll_from_roster() runs under that session.
//
// No match → the attempt lands in identity.roster_match_attempts for staff
// to resolve, and the student is told to see the instructor — the commonest
// real failure is a personal address, and silence would strand them.
//
// This is an unauthenticated endpoint that triggers email sends, so it is
// deliberately stingy: per-address cooldown, lifetime send cap per roster
// row, a truthful matched/unmatched answer only for plausible U of T
// addresses (anything else gets the same "couldn't match" path), and an IP
// hash on unmatched attempts so abuse is visible to staff.

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

const COOLDOWN_S = 120
const LIFETIME_SEND_CAP = 50 // covers a whole term of sign-ins

const normalize = (e) =>
  String(e ?? '').trim().toLowerCase().replace(/@(mail\.|alum\.)?utoronto\.ca$/, '@utoronto.ca')

// The From address sits on course.radlab.zone, which has no MX, so a reply to
// it hard-bounces. These apex addresses are real Workspace mailboxes. Unknown
// codes fall back to the lab address rather than guessing a course — see
// supabase/functions/_shared/replyTo.ts for the full rationale.
const COURSE_REPLY_TO = { psy240: 'psy240@radlab.zone', psy309: 'psy309@radlab.zone' }
const replyToFor = (code) =>
  COURSE_REPLY_TO[String(code ?? '').trim().toLowerCase()] ?? 'research@radlab.zone'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const url = process.env.COURSE_SUPABASE_URL
  const serviceKey = process.env.COURSE_SUPABASE_SERVICE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const missing = [
    !url && 'COURSE_SUPABASE_URL',
    !serviceKey && 'COURSE_SUPABASE_SERVICE_KEY',
    !resendKey && 'RESEND_API_KEY',
  ].filter(Boolean)
  if (missing.length) return res.status(500).json({ error: `Missing env: ${missing.join(', ')}` })

  const raw = String(req.body?.email ?? '').trim()
  if (!raw || raw.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return res.status(400).json({ error: 'Enter an email address' })
  }
  const key = normalize(raw)

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const ipHash = createHash('sha256')
    .update(String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim())
    .digest('hex').slice(0, 16)

  // Via rpc: identity is not exposed to PostgREST (see roster-invite.js).
  const { data: found } = await service.rpc('roster_find_by_key', { p_match_key: key })
  const row = Array.isArray(found) ? found[0] : found

  if (!row) {
    await service.rpc('roster_log_attempt', {
      p_submitted: raw, p_match_key: key, p_ip_hash: ipHash,
    })
    return res.status(200).json({ matched: false })
  }

  // Cooldown + lifetime cap. 429 tells the join page to say "already sent —
  // check your inbox" rather than implying failure.
  if (row.last_invited_at && (Date.now() - Date.parse(row.last_invited_at)) < COOLDOWN_S * 1000) {
    return res.status(429).json({ matched: true, error: 'A link was just sent — check your inbox (and spam), then try again in a couple of minutes.' })
  }
  if (row.invite_count >= LIFETIME_SEND_CAP) {
    return res.status(429).json({ matched: true, error: 'Send limit reached for this address — contact the course team.' })
  }

  try {
    const { error: cuErr } = await service.auth.admin.createUser({
      email: row.email, email_confirm: true,
    })
    if (cuErr && !/already|exists/i.test(cuErr.message)) throw new Error(cuErr.message)

    const origin = process.env.SITE_URL || 'https://radlab.zone'
    const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
      type: 'magiclink', email: row.email,
      options: { redirectTo: `${origin}/academic/fieldguide/wiki` },
    })
    if (linkErr) throw new Error(linkErr.message)
    const link = linkData?.properties?.action_link
    if (!link) throw new Error('no action_link')

    const fromEmail = process.env.FROM_EMAIL || 'PSY240 Field Guide <fieldguide@course.radlab.zone>'
    // Best-effort: a lookup failure costs the course-specific reply address,
    // never the sign-in link the student is waiting on.
    const { data: courseCode } = await service.rpc('roster_course_code', { p_id: row.id })
    const first = row.full_name.split(' ')[0]
    const rsp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail, reply_to: replyToFor(courseCode), to: row.email,
        subject: 'Your Field Guide sign-in link',
        text: `Hi ${first},\n\nHere is your sign-in link for the course Field Guide:\n${link}\n\nIf you didn't request this, you can ignore it.`,
        html: `<p>Hi ${first},</p><p><a href="${link}" style="display:inline-block;padding:10px 22px;border-radius:22px;background:#d63384;color:#fff;text-decoration:none;font-weight:600">Sign in to the Field Guide</a></p><p style="color:#666;font-size:13px">If you didn't request this, you can ignore it.</p>`,
      }),
    })
    if (!rsp.ok) throw new Error(`Resend ${rsp.status}`)

    await service.rpc('roster_mark_invited', { p_id: row.id })

    return res.status(200).json({ matched: true })
  } catch (e) {
    return res.status(500).json({ error: `Could not send the link: ${e.message}` })
  }
}
