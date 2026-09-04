import { createClient } from '@supabase/supabase-js'

// POST /api/lounge-signup  { email, password, slug }
//   → { ok:true } | { exists:true } | { error }
//
// Replaces client-side supabase.auth.signUp for the Lecture Lounge. The
// difference is WHO builds the confirmation email. Supabase's own mailer
// links straight to /auth/v1/verify, which consumes the confirmation token
// on a plain GET — and university mail runs Microsoft Defender Safe Links,
// which performs exactly that GET on every link it delivers (see
// roster-join.js for the incident that established this). Here the token is
// minted server-side and the email links to our own /class/confirm page,
// which is inert until a human presses the button.
//
// A confirmation token has a gentler worst case than a magic link: if a
// scanner somehow does consume it, the account is simply confirmed — the
// student signs in with the password they chose and loses nothing. The
// confirm page says as much when it meets an already-spent token.
//
// Existing accounts: a CONFIRMED account is never touched — the caller is
// told to sign in instead (mailbox proof happened once already; re-running
// signup must not become a password reset). An UNCONFIRMED account holds
// nothing — its owner never proved the mailbox or signed in — so it is
// deleted and recreated with the new password, and a fresh confirmation is
// sent. That is also what un-strands anyone half-registered by the old flow.

const normalizeEmail = (e) => String(e ?? '').trim().toLowerCase()

// Same rationale as roster-join: the From domain has no MX, replies must
// land in a real course mailbox.
const COURSE_REPLY_TO = { psy240: 'psy240@radlab.zone', psy309: 'psy309@radlab.zone' }
const replyToFor = (slug) =>
  COURSE_REPLY_TO[String(slug ?? '').trim().toLowerCase()] ?? 'research@radlab.zone'

// Cooldown for re-sends to the same unconfirmed address, enforced from
// auth's own confirmation_sent_at — no extra table needed.
const RESEND_COOLDOWN_S = 90

async function findUserByEmail(service, email) {
  // Admin API only pages; auth.users is not reachable through PostgREST.
  // Fine at course scale — a page holds 1000 users.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    const hit = (data?.users ?? []).find(u => normalizeEmail(u.email) === email)
    if (hit) return hit
    if ((data?.users ?? []).length < 1000) return null
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password ?? '')
  const slug = String(req.body?.slug ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Enter an email address' })
  }
  if (password.length < 6 || password.length > 72) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  if (!slug) return res.status(400).json({ error: 'Missing class' })

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !serviceKey || !resendKey) {
    return res.status(500).json({ error: 'Server misconfigured for Lounge signup' })
  }
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    // The class is only for email copy and the confirm page's return path —
    // but a signup POSTed against no real class is not a real signup.
    const { data: cls } = await service.from('classes').select('id, name').eq('slug', slug).maybeSingle()
    if (!cls) return res.status(404).json({ error: `No class at /${slug}` })

    const mint = () => service.auth.admin.generateLink({ type: 'signup', email, password })

    let { data: linkData, error: linkErr } = await mint()

    if (linkErr && /already|registered|exists/i.test(linkErr.message)) {
      const user = await findUserByEmail(service, email)
      if (!user) throw new Error(linkErr.message)
      if (user.email_confirmed_at) {
        // Not an error to the caller: the card switches to sign-in mode.
        return res.status(200).json({ exists: true })
      }
      if (user.confirmation_sent_at
        && Date.now() - Date.parse(user.confirmation_sent_at) < RESEND_COOLDOWN_S * 1000) {
        return res.status(429).json({ error: 'A confirmation email was just sent — check your inbox (and spam) first.' })
      }
      // Unconfirmed = never proved the mailbox, never signed in, holds no
      // data. Recreate so the password they typed TODAY is the one that works.
      const { error: delErr } = await service.auth.admin.deleteUser(user.id)
      if (delErr) throw new Error(delErr.message)
      ;({ data: linkData, error: linkErr } = await mint())
    }
    if (linkErr) throw new Error(linkErr.message)

    const hashed = linkData?.properties?.hashed_token
    const vtype = linkData?.properties?.verification_type || 'signup'
    if (!hashed) throw new Error('no hashed_token')

    const origin = process.env.SITE_URL || 'https://radlab.zone'
    const link = `${origin}/class/confirm?t=${encodeURIComponent(hashed)}`
      + `&ty=${encodeURIComponent(vtype)}&slug=${encodeURIComponent(slug)}`

    const fromEmail = process.env.LOUNGE_FROM_EMAIL || 'Lecture Lounge <lounge@course.radlab.zone>'
    const rsp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail, reply_to: replyToFor(slug), to: email,
        subject: `Confirm your account — ${cls.name}`,
        text: `Almost there!\n\nTap to confirm your account for ${cls.name}:\n${link}\n\n`
          + `You'll be asked to press one more button — that's deliberate; it keeps `
          + `automated mail scanners from using the link before you do.\n\n`
          + `If the page says the link was already used, your account is confirmed — `
          + `just sign in with your password.\n\n`
          + `If you didn't create this account, you can ignore this email.`,
        html: `<p>Almost there!</p>
             <p><a href="${link}" style="display:inline-block;padding:12px 26px;border-radius:24px;background:#d63384;color:#fff;text-decoration:none;font-weight:600">Confirm your account</a></p>
             <p style="font-size:13px;color:#666">You'll be asked to press one more button — that's deliberate; it keeps automated mail scanners from using the link before you do.</p>
             <p style="font-size:13px;color:#666">If the page says the link was already used, your account is confirmed — just sign in with your password.</p>
             <p style="font-size:13px;color:#666;margin-top:18px">If you didn't create this account, you can ignore this email.</p>`,
      }),
    })
    if (!rsp.ok) throw new Error(`Resend ${rsp.status}`)

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
