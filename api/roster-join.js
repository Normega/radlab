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

  // Salted, because the IPv4 space is small enough to brute-force an unsalted
  // hash straight back to an address — the same reasoning auto-enroll's hasher
  // already carries, which this one was missing. The salt falls back to the
  // service key (guaranteed present, checked above) so no new env var is
  // needed; set ROSTER_IP_SALT to pin it independently of key rotation.
  //
  // Rows logged before 2026-09-03 hold short unsalted digests and will not
  // group with new ones. That only affects eyeballing repeats in the staff
  // triage list; nothing joins on this value.
  const ipSalt = process.env.ROSTER_IP_SALT ?? serviceKey
  const clientIp = String(
    req.headers['x-forwarded-for']
    ?? req.headers['cf-connecting-ip']
    ?? req.headers['x-real-ip']
    ?? ''
  ).split(',')[0].trim()
  const ipHash = clientIp
    ? createHash('sha256').update(`${ipSalt}:${clientIp}`).digest('hex')
    : null

  // Which course's join door was this? The course-scoped mounts
  // (/academic/psy240/join) send their code; the immortal legacy door
  // (lecture-slide QR codes) sends nothing.
  const requestedCourse = String(req.body?.courseCode ?? '').trim().toUpperCase() || null
  // Where should the sign-in land the student? The Lounge's signed-out card
  // sends next:'lounge' so its confirm page can chain straight through the
  // bridge; anything else (or nothing) keeps the wiki destination.
  const next = req.body?.next === 'lounge' ? 'lounge' : null

  // Via rpc: identity is not exposed to PostgREST (see roster-invite.js).
  // A course-scoped door tries ITS course's roster first, so a student on two
  // rosters gets the course whose door they walked through. Falling back to
  // the unscoped match is deliberate: a PSY309-only student scanning the
  // PSY240 QR still gets signed in — to their own course, since everything
  // downstream (email copy, Reply-To, redirect) derives from the matched
  // row's course, not from the door.
  let found = null
  if (requestedCourse) {
    ;({ data: found } = await service.rpc('roster_find_by_key_in_course', {
      p_match_key: key, p_course_code: requestedCourse,
    }))
  }
  if (!found || (Array.isArray(found) && !found.length)) {
    ;({ data: found } = await service.rpc('roster_find_by_key', { p_match_key: key }))
  }
  const row = Array.isArray(found) ? found[0] : found

  if (!row) {
    // Not on any roster — but the roster is only where people START. Staff
    // (TA/instructor) are never on one, and an enrolled student's roster row
    // can be gone. Anyone with an active enrollment gets the same sign-in
    // email; the door is one door (Norm, 2026-09-05 — he hit the old
    // password form on /tracking). No cooldown on this path: it has no
    // roster row to track one on, and its population is enrolled people.
    const { data: enrolled } = await service.rpc('enrolled_person_by_key', { p_match_key: key })
    const person = Array.isArray(enrolled) ? enrolled[0] : enrolled
    if (person?.email) {
      try {
        await sendSignInEmail(service, resendKey, {
          email: person.email, fullName: '', courseCode: person.course_code, next,
        })
        return res.status(200).json({ matched: true })
      } catch (e) {
        return res.status(500).json({ error: `Could not send the link: ${e.message}` })
      }
    }
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
    // Best-effort: a lookup failure costs the course-specific reply address
    // and redirect, never the sign-in link the student is waiting on.
    // Fetched BEFORE the link is minted (phase 4) because the redirect now
    // targets the matched row's course-scoped wiki.
    const { data: courseCode } = await service.rpc('roster_course_code', { p_id: row.id })
    await sendSignInEmail(service, resendKey, {
      email: row.email, fullName: row.full_name, courseCode, next,
    })
    await service.rpc('roster_mark_invited', { p_id: row.id })
    return res.status(200).json({ matched: true })
  } catch (e) {
    return res.status(500).json({ error: `Could not send the link: ${e.message}` })
  }
}

// The whole sign-in send, shared by the roster path and the enrolled-person
// path so the two can never drift: create-if-missing, mint the token, build
// the inert-door link, email it via Resend.
async function sendSignInEmail(service, resendKey, { email, fullName, courseCode, next }) {
    const { error: cuErr } = await service.auth.admin.createUser({
      email, email_confirm: true,
    })
    if (cuErr && !/already|exists/i.test(cuErr.message)) throw new Error(cuErr.message)

    const origin = process.env.SITE_URL || 'https://radlab.zone'
    const redirectTo = courseCode
      ? `${origin}/academic/${String(courseCode).toLowerCase()}/wiki`
      : `${origin}/academic/fieldguide/wiki` // immortal shim resolves it
    const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
      type: 'magiclink', email,
      options: { redirectTo },
    })
    if (linkErr) throw new Error(linkErr.message)
    // Deliberately NOT properties.action_link. That URL hits Supabase's
    // /auth/v1/verify, which consumes the token on a plain GET — which is
    // exactly what the university's mail scanner performs on every link it
    // sees. The email points at our own confirmation page instead, carrying
    // the token hash; that page does nothing until a human clicks.
    const hashed = linkData?.properties?.hashed_token
    const vtype = linkData?.properties?.verification_type || 'magiclink'
    if (!hashed) throw new Error('no hashed_token')
    const link = `${origin}/academic/${String(courseCode || 'psy240').toLowerCase()}/signin`
      + `?t=${encodeURIComponent(hashed)}&ty=${encodeURIComponent(vtype)}`
      + (next ? `&n=${next}` : '')
    // The numeric code that accompanies the same link (length is whatever the
    // project's OTP setting mints — seven here, not the six the docs imply, so
    // nothing downstream may assume six). It is the PRIMARY
    // path now: university mail runs Microsoft Defender Safe Links, which
    // fetches every URL in every message to scan it — and a Supabase magic
    // link is single-use, so the scanner redeems it seconds after delivery and
    // the student's own tap arrives at a spent token. Confirmed 2026-09-04:
    // a student on an iPhone had six sessions minted against her account, all
    // from Azure IPs with rotating desktop user agents, none from her phone.
    // A scanner can follow a link; it cannot type a code into a form.
    const otp = linkData?.properties?.email_otp ?? null

    const fromEmail = process.env.FROM_EMAIL || 'PSY240 Field Guide <fieldguide@course.radlab.zone>'
    // Staff matches carry no roster name; "there" reads fine in a greeting.
    const first = String(fullName ?? '').split(' ')[0] || 'there'
    const rsp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail, reply_to: replyToFor(courseCode), to: email,
        subject: 'Your Field Guide sign-in',
        // Two independent ways in. The link is one tap and lands on a page
        // that stays inert until pressed, so a mail scanner following it
        // cannot spend the token. The code needs no link at all, so it
        // survives even a scanner that presses buttons. Neither is a
        // decoration: keep both.
        text: `Hi ${first},\n\nTap to sign in to the course Field Guide:\n${link}\n\n`
          + (otp ? `Or type this code into the page you came from: ${otp}\n\n` : '')
          + `Either way lasts an hour. If you didn't request this, you can ignore it.`,
        html: `<p>Hi ${first},</p>
             <p><a href="${link}" style="display:inline-block;padding:12px 26px;border-radius:24px;background:#d63384;color:#fff;text-decoration:none;font-weight:600">Sign in to the Field Guide</a></p>
             <p style="font-size:13px;color:#666">You'll be asked to press one more button — that's deliberate, and it's what stops the university's mail scanner from using your link up before you get to it.</p>`
          + (otp
              ? `<p style="font-size:14px;color:#444;margin-top:18px">Prefer to type it? Enter this code on the page you came from:</p>
             <p style="font-size:28px;font-weight:700;letter-spacing:5px;font-family:monospace;margin:4px 0 0">${otp}</p>`
              : '')
          + `<p style="color:#666;font-size:13px;margin-top:18px">Either way lasts an hour. If you didn't request this, you can ignore it.</p>`,
      }),
    })
    if (!rsp.ok) throw new Error(`Resend ${rsp.status}`)
}
