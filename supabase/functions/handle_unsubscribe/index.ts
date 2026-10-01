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

    // Every read and the write below are error-checked (2026-10-01). A failed
    // read used to look like "not found" or "not required", and a failed write
    // still returned success, so the page said "unsubscribed" while reminders
    // kept coming.

    // 2. Look up the token
    const { data: tokenRow, error: tokenErr } = await db
      .from('participant_unsubscribe_tokens')
      .select('id, participant_id, study_id')
      .eq('token', token)
      .maybeSingle()

    if (tokenErr) throw new Error(`token lookup failed: ${tokenErr.message}`)
    if (!tokenRow) {
      return json({ error: 'invalid_token' }, 404)
    }

    const { participant_id, study_id } = tokenRow

    // 3. Fetch current enrollment record
    const { data: enrollment, error: enrErr } = await db
      .from('study_enrollments')
      .select('id, email_reminders')
      .eq('study_id', study_id)
      .eq('profile_id', participant_id)
      .maybeSingle()

    if (enrErr) throw new Error(`enrollment lookup failed: ${enrErr.message}`)
    if (!enrollment) {
      return json({ error: 'enrollment_not_found' }, 404)
    }

    if (enrollment.email_reminders === false) {
      return json({ status: 'already_unsubscribed' })
    }

    // 4. Check if messaging is required for this study
    const { data: study, error: studyErr } = await db
      .from('studies')
      .select('messaging_required')
      .eq('id', study_id)
      .single()

    if (studyErr) throw new Error(`study lookup failed: ${studyErr.message}`)

    if (study?.messaging_required === true) {
      return json({ status: 'blocked', reason: 'messaging_required' })
    }

    // 5. Set email_reminders = false -- and confirm a row actually changed
    const { data: updated, error: updErr } = await db
      .from('study_enrollments')
      .update({ email_reminders: false, email_unsubscribed_at: new Date().toISOString() })
      .eq('id', enrollment.id)
      .select('id')

    if (updErr) throw new Error(`unsubscribe update failed: ${updErr.message}`)
    if (!updated?.length) throw new Error('unsubscribe update changed no rows')

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
