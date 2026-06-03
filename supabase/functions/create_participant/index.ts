// create_participant — creates a silent auth account for an in-person study participant.
//
// Uses the service role key so no confirmation email is sent and no rate limits apply.
// The RA's session is verified via the Authorization header before the account is created.
//
// POST body: { participantId: string, studyId: string }
// Returns:   { userId: string } | { error: string }

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
    // Verify the caller is an authenticated lab member
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await anonClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'lab') return json({ error: 'Forbidden: lab role required' }, 403)

    // Parse request body
    const { participantId, studyId } = await req.json()
    if (!participantId || !studyId) return json({ error: 'participantId and studyId are required' }, 400)

    // Create the participant account using the service role key (no email sent)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const email = `p-${participantId.toLowerCase().replace(/[^a-z0-9]/g, '-')}@participants.radlab.zone`

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password:      crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { display_name: `Participant ${participantId}` },
    })

    let userId: string
    if (createErr) {
      // If email already exists, look up the existing user instead of failing
      if (createErr.message?.includes('already been registered') || createErr.code === 'email_exists') {
        const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers()
        if (listErr) return json({ error: listErr.message }, 500)
        const existing = users.find(u => u.email === email)
        if (!existing) return json({ error: createErr.message }, 400)
        userId = existing.id
      } else {
        return json({ error: createErr.message }, 400)
      }
    } else {
      userId = created.user.id
    }

    // Update the profile row (created by trigger) with role + study_id
    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({ role: 'participant', study_id: studyId })
      .eq('id', userId)

    if (updateErr) return json({ error: updateErr.message }, 500)

    return json({ userId })

  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
