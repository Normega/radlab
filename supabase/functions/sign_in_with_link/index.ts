// sign_in_with_link — exchanges a participant_links token for a Supabase
// session. Every /s/{token} open depends on this; if it fails, no participant
// can reach any session.
//
// THIS FILE MUST MATCH WHAT IS DEPLOYED. It was out of sync until 2026-07-31:
// the repo held a simpler implementation built on
// admin.auth.admin.createSession({ user_id }), which does NOT exist in
// supabase-js@2 — deploying it returned "createSession is not a function" and
// 500'd every sign-in (verified by deploying and rolling back within ~60s; only
// test traffic was affected). Do not "simplify" back to createSession without
// first confirming the method exists in the pinned client, and always test
// against an expired synthetic-account token before trusting a deploy.
//
// Known rough edge, not yet fixed: generateLink-then-verifyOtp is racy — a
// second request for the same user invalidates the first token, the likely
// source of the recurring otp_expired errors in the runtime logs. It also
// depends on SUPABASE_ANON_KEY, whose legacy JWT pair was revoked 2026-07-30
// (still injected and working as of this writing — see send_message's note).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { token } = await req.json()
    if (!token) return json({ error: 'token required' }, 400)

    const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // 1. Look up the participant link by token
    const { data: link, error: linkErr } = await admin
      .from('participant_links')
      .select('participant_id, status')
      .eq('token', token)
      .single()

    if (linkErr || !link) return json({ error: 'not_found' }, 404)
    if (link.status === 'revoked') return json({ error: 'revoked' }, 403)

    // 2. Look up the participant's auth user to get their email
    const { data: { user }, error: userErr } = await admin.auth.admin.getUserById(link.participant_id)
    if (userErr || !user) {
      console.error('getUserById error:', userErr)
      return json({ error: 'not_found' }, 404)
    }

    // 3. Generate a single-use magic link token (does NOT send any email)
    const { data: linkData, error: genErr } = await admin.auth.admin.generateLink({
      type:  'magiclink',
      email: user.email!,
    })
    if (genErr || !linkData?.properties?.hashed_token) {
      console.error('generateLink error:', genErr)
      return json({ error: `Link generation failed: ${genErr?.message}` }, 500)
    }

    // 4. Verify the token server-side to obtain a session
    //    verifyOtp with token_hash works without a browser — it calls POST /auth/v1/verify directly
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    })
    const { data: authData, error: verifyErr } = await anon.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type:       'magiclink',
    })
    if (verifyErr || !authData?.session) {
      console.error('verifyOtp error:', verifyErr)
      return json({ error: `Session creation failed: ${verifyErr?.message}` }, 500)
    }

    return json({
      access_token:  authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    })
  } catch (e) {
    console.error(e)
    return json({ error: e.message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
