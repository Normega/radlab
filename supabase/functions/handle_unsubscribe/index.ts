// handle_unsubscribe — processes unsubscribe requests from email links.
// No authentication required — the token is the credential.
// Uses the service role client to update study_enrollments (RLS bypass needed).

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

    // 1. Validate input
    if (!token) {
      return json({ error: 'token is required' }, 400)
    }

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // 2. Look up the token
    const { data: tokenRow } = await db
      .from('participant_unsubscribe_tokens')
      .select('id, participant_id, study_id')
      .eq('token', token)
      .maybeSingle()

    if (!tokenRow) {
      return json({ error: 'invalid_token' }, 404)
    }

    const { participant_id, study_id } = tokenRow

    // 3. Fetch current enrollment record
    const { data: enrollment } = await db
      .from('study_enrollments')
      .select('id, email_reminders')
      .eq('study_id', study_id)
      .eq('profile_id', participant_id)
      .maybeSingle()

    if (!enrollment) {
      return json({ error: 'enrollment_not_found' }, 404)
    }

    if (enrollment.email_reminders === false) {
      return json({ status: 'already_unsubscribed' })
    }

    // 4. Check if messaging is required for this study
    const { data: study } = await db
      .from('studies')
      .select('messaging_required')
      .eq('id', study_id)
      .single()

    if (study?.messaging_required === true) {
      return json({ status: 'blocked', reason: 'messaging_required' })
    }

    // 5. Set email_reminders = false
    await db
      .from('study_enrollments')
      .update({ email_reminders: false, email_unsubscribed_at: new Date().toISOString() })
      .eq('id', enrollment.id)

    // 6. Record used_at for audit (token stays valid — unsubscribe is idempotent)
    await db
      .from('participant_unsubscribe_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.id)
      .is('used_at', null)

    // 7. Done
    return json({ status: 'success' })

  } catch (err) {
    console.error('handle_unsubscribe unexpected error:', err)
    const msg = err instanceof Error ? err.message : 'Unexpected error'
    return json({ error: msg }, 500)
  }
})
