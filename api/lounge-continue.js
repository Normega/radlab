import { createClient } from '@supabase/supabase-js'

// POST /api/lounge-continue  { fg_token, slug }
//   → { ok, email, token_hash, type, created }
//
// The Field Guide → Lecture Lounge half of the bridge. `api/fieldguide-continue`
// already does the reverse; this is its mirror, and rests on the same argument.
//
// The two halves of the platform authenticate against DIFFERENT Supabase
// projects, so a student signed in to the Field Guide arrives at the Lounge
// looking like a stranger and is asked to make a second account. They already
// hold proof of their U of T mailbox, though: Field Guide access is only
// granted by clicking a token emailed to the roster address. That is the same
// proof-of-control standard the Lounge's own email verification uses, so this
// endpoint spends it rather than asking for it again.
//
// What it does NOT do is hand back a session directly. It returns the hashed
// token of a freshly minted main-project link, and the browser exchanges it
// itself with verifyOtp — the same shape as the sign-in confirm page, so no
// access token is ever written into a response body or a redirect URL.
//
// Failure posture: every failure returns a plain refusal and the caller falls
// back to the ordinary join card. A broken bridge must never be a locked door.

const normalize = (e) =>
  String(e ?? '').trim().toLowerCase().replace(/@(mail\.|alum\.)?utoronto\.ca$/, '@utoronto.ca')

// Both spellings of a U of T address, so a student verified under one is
// matched when the roster carries the other.
const variants = (email) => {
  const base = normalize(email)
  const local = base.split('@')[0]
  return [...new Set([String(email).trim().toLowerCase(), base, `${local}@mail.utoronto.ca`])]
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const fgToken = String(req.body?.fg_token ?? '').trim()
  const slug = String(req.body?.slug ?? '').trim().toLowerCase()
  if (!fgToken || fgToken === 'undefined' || !slug) {
    return res.status(400).json({ error: 'Required: fg_token, slug' })
  }

  const courseUrl = process.env.COURSE_SUPABASE_URL
  const courseAnon = process.env.COURSE_SUPABASE_ANON_KEY
  const mainUrl = process.env.VITE_SUPABASE_URL
  const mainKey = process.env.SUPABASE_SERVICE_KEY
  if (!courseUrl || !courseAnon || !mainUrl || !mainKey) {
    return res.status(500).json({ error: 'Server misconfigured for the Lounge bridge' })
  }

  try {
    // 1. Who is this, according to the ACADEMIC project? The token is checked
    //    by that project, not parsed here — a forged one simply fails.
    const asUser = createClient(courseUrl, courseAnon, {
      global: { headers: { Authorization: `Bearer ${fgToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: who, error: whoErr } = await asUser.auth.getUser()
    const email = who?.user?.email
    if (whoErr || !email) return res.status(401).json({ error: 'Field Guide session not recognised' })

    // 2. And are they actually enrolled in something? A Field Guide account
    //    with no enrollment gets no class membership out of this.
    //
    //    Read this as the STUDENT, not with the service key. `enrollments` has
    //    an RLS policy of `person_id = current_person_id()`, so their own JWT
    //    already scopes the answer to them — no person-id lookup needed, and no
    //    way for this query to see anyone else. The service-key route would
    //    have to resolve auth_user_id → identity.people first, and `identity`
    //    is deliberately NOT on PostgREST's exposed-schema list (that is where
    //    the PII lives), so `.schema('identity')` fails with "Invalid schema" —
    //    the bug this endpoint shipped with, seen as a bogus 403.
    const { data: enrolled, error: enrErr } = await asUser
      .from('enrollments').select('id').eq('status', 'active').limit(1)
    // Surface a read failure as a failure. Folding it into "no enrollment"
    // is what disguised a schema error as a considered refusal.
    if (enrErr) throw new Error(`enrollment read failed: ${enrErr.message}`)
    if (!enrolled?.length) return res.status(403).json({ error: 'No active Field Guide enrollment' })

    // 3. The main project. Find the class first — no class, nothing to join.
    const main = createClient(mainUrl, mainKey, { auth: { persistSession: false } })
    const { data: cls } = await main.from('classes').select('id').eq('slug', slug).maybeSingle()
    if (!cls) return res.status(404).json({ error: `No class at /${slug}` })

    // Match an existing account by its VERIFIED U of T address before making a
    // new one, so a student who joined the Lounge months ago under a personal
    // address keeps that account, their avatar and their participation.
    const { data: existing } = await main.from('profiles')
      .select('id, utoronto_email').in('utoronto_email', variants(email)).limit(1)
    let userId = existing?.[0]?.id ?? null
    let created = false

    if (!userId) {
      const { error: cuErr } = await main.auth.admin.createUser({ email, email_confirm: true })
      if (cuErr && !/already|exists|registered/i.test(cuErr.message)) throw new Error(cuErr.message)
      created = !cuErr
    }

    // generateLink both mints the token AND resolves the user, so an account
    // that already existed under this exact address needs no extra lookup.
    const { data: linkData, error: linkErr } = await main.auth.admin.generateLink({
      type: 'magiclink', email,
    })
    if (linkErr) throw new Error(linkErr.message)
    userId = userId ?? linkData?.user?.id
    const tokenHash = linkData?.properties?.hashed_token
    const type = linkData?.properties?.verification_type || 'magiclink'
    if (!userId || !tokenHash) throw new Error('could not mint a session for that address')

    // 4. Stamp the verified address and join the class. Marking it verified is
    //    the whole point: Field Guide access already proved this mailbox, and
    //    without the stamp their participation would not be creditable.
    await main.from('profiles').update({
      utoronto_email: email,
      utoronto_verified_at: new Date().toISOString(),
    }).eq('id', userId).is('utoronto_verified_at', null)

    await main.from('class_members')
      .upsert({ class_id: cls.id, user_id: userId }, { onConflict: 'class_id,user_id' })

    return res.status(200).json({ ok: true, email, token_hash: tokenHash, type, created })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
