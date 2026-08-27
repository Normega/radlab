// The seamless half of the Lounge→Field Guide bridge (2026-08-27, built with
// Norm's explicit approval).
//
// POST { token } — a Lecture Lounge email-verification token. This endpoint
// consumes it server-side (the same single-use verify_utoronto_email RPC the
// client used to call directly) and, when the verified address matches the
// Field Guide roster, mints a magic action link and returns it, so the
// verify-success screen can offer "Continue to the Field Guide →" with no
// second email.
//
// Why this is safe: the action link is only ever handed to the browser that
// presented a valid, unexpired verify token — i.e. someone who just clicked
// a link sent to that address. That is the same proof-of-control standard as
// emailing the link (§2a.4); the custody chain never widens. A garbage or
// replayed token gets the RPC's not_found and no link is minted.
//
// Failure posture: verification is the primary job. If the roster lookup or
// mint fails after a successful verify, we still report ok — the client
// shows the normal success screen and the student can use the Field Guide
// join door later. Never let the bridge dampen verification.

import { createClient } from '@supabase/supabase-js'

const normalize = (e) =>
  String(e ?? '').trim().toLowerCase().replace(/@(mail\.|alum\.)?utoronto\.ca$/, '@utoronto.ca')

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const token = String(req.body?.token ?? '').trim()
  if (!token) return res.status(400).json({ error: 'Missing token' })

  const mainUrl = process.env.VITE_SUPABASE_URL
  const mainAnon = process.env.VITE_SUPABASE_ANON_KEY
  if (!mainUrl || !mainAnon) {
    return res.status(500).json({ error: 'Missing env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY' })
  }

  // 1. Consume the verify token — anon client, same definer RPC the
  // verification page called before this endpoint existed.
  const main = createClient(mainUrl, mainAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: verified, error: verifyErr } = await main.rpc('verify_utoronto_email', { p_token: token })
  if (verifyErr) return res.status(500).json({ error: verifyErr.message })
  if (!verified?.ok) return res.status(200).json(verified ?? { error: 'not_found' })

  // 2. Verified. Everything from here is best-effort — always return ok.
  const result = { ok: true, email: verified.email }

  const courseUrl = process.env.COURSE_SUPABASE_URL
  const courseKey = process.env.COURSE_SUPABASE_SERVICE_KEY
  if (courseUrl && courseKey && verified.email) {
    try {
      const service = createClient(courseUrl, courseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: found, error: findErr } = await service.rpc('roster_find_by_key', {
        p_match_key: normalize(verified.email),
      })
      if (findErr) throw new Error(findErr.message)
      const row = Array.isArray(found) ? found[0] : found
      if (row) {
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
        if (link) {
          result.fieldGuideUrl = link
          // Same stamp roster-join uses after an email send, so staff see
          // the touch in the roster console regardless of route.
          await service.rpc('roster_mark_invited', { p_id: row.id })
        }
      }
    } catch {
      // swallowed by design — see failure posture above
    }
  }

  return res.status(200).json(result)
}
