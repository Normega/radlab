// handle_ripple_unsubscribe — processes Ripple reminder unsubscribe requests.
// No authentication required — the token is the credential.
//
// Returns { status: 'token_not_found' } (200, not 4xx) when the token is not
// in ripple_unsubscribe_tokens, so the caller (Unsubscribe.jsx) can fall through
// to handle_unsubscribe for participant study tokens without error handling.

import { createClient } from 'npm:@supabase/supabase-js@2'

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

  try {
    const body = await req.json().catch(() => ({}))
    const { token } = body

    if (!token) return json({ error: 'token is required' }, 400)

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // 1. Look up the token
    const { data: tokenRow } = await db
      .from('ripple_unsubscribe_tokens')
      .select('id, user_id')
      .eq('token', token)
      .maybeSingle()

    // 200 sentinel so caller can detect and fall through to handle_unsubscribe
    if (!tokenRow) return json({ status: 'token_not_found' })

    // 2. Fetch the Ripple row
    const { data: ripple } = await db
      .from('ripples')
      .select('reminder_enabled')
      .eq('user_id', tokenRow.user_id)
      .maybeSingle()

    if (!ripple) return json({ status: 'token_not_found' })

    // 3. Idempotent
    if (ripple.reminder_enabled === false) {
      return json({ status: 'already_unsubscribed' })
    }

    // 4. Disable reminders
    await db
      .from('ripples')
      .update({ reminder_enabled: false })
      .eq('user_id', tokenRow.user_id)

    // 5. Mark token used (audit trail; token remains valid — unsubscribe is idempotent)
    await db
      .from('ripple_unsubscribe_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.id)
      .is('used_at', null)

    return json({ status: 'success' })

  } catch (err) {
    console.error('handle_ripple_unsubscribe unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})
