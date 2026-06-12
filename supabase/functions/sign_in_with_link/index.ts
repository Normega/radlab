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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Look up the link to get the participant's user id
    const { data: link, error: linkErr } = await admin
      .from('participant_links')
      .select('participant_id, status')
      .eq('token', token)
      .single()

    if (linkErr || !link) return json({ error: 'not_found' }, 404)
    if (link.status === 'revoked') return json({ error: 'revoked' }, 403)

    // Create a short-lived Supabase session for this participant
    const { data: sessionData, error: sessErr } = await admin.auth.admin.createSession({
      user_id: link.participant_id,
    })
    if (sessErr || !sessionData?.session) {
      return json({ error: `Session creation failed: ${sessErr?.message}` }, 500)
    }

    return json({
      access_token:  sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
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
