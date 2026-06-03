import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Verify caller is a lab member via their JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'lab') {
      return json({ error: 'Forbidden — lab role required' }, 403)
    }

    const { studyId, sonaId } = await req.json()
    if (!studyId) return json({ error: 'studyId required' }, 400)

    // Use service role key to bypass RLS for profile creation
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('RADLAB_SERVICE_ROLE_KEY')!,
    )

    // 1. Create a real auth user (triggers the handle_new_user profile row creation)
    const displayName   = sonaId ? `SONA-${sonaId}` : 'Participant'
    const syntheticEmail = `anon-${crypto.randomUUID()}@radlab.internal`

    const { data: { user: authUser }, error: createUserErr } = await admin.auth.admin.createUser({
      email:         syntheticEmail,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    })
    if (createUserErr || !authUser) throw new Error(`Auth user creation failed: ${createUserErr?.message}`)

    const participantId = authUser.id

    // 2. Upsert the profile row (handles both trigger-created and no-trigger cases)
    const { error: profileErr } = await admin.from('profiles').upsert({
      id:           participantId,
      role:         'participant',
      is_anonymous: true,
      display_name: displayName,
      sona_id:      sonaId ?? null,
    })
    if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`)

    // 2. Create enrollment record
    const now = new Date().toISOString()
    const { error: enrollErr } = await admin.from('study_enrollments').insert({
      study_id:     studyId,
      profile_id:   participantId,
      external_id:  sonaId ?? null,
      enrolled_at:  now,
      consent_date: now,
      status:       'enrolled',
    })
    if (enrollErr) throw new Error(`Enrollment insert failed: ${enrollErr.message}`)

    // 3. Fetch study_sessions for this study (ordered by day_number)
    const { data: sessions, error: sessErr } = await admin
      .from('study_sessions')
      .select('id, day_number, send_time, link_expires_hours, order_index')
      .eq('study_id', studyId)
      .order('day_number', { ascending: true })
    if (sessErr) throw new Error(`Sessions fetch failed: ${sessErr.message}`)
    if (!sessions?.length) throw new Error('No sessions configured for this study.')

    const today = new Date().toISOString().slice(0, 10)
    const scheduleRows = sessions.map((s, i) => ({
      participant_id:   participantId,
      study_id:         studyId,
      study_session_id: s.id,
      scheduled_date:   i === 0 ? today : null,
      send_time:        s.send_time,
      status:           'pending',
    }))

    const { data: inserted, error: schedErr } = await admin
      .from('participant_schedule')
      .insert(scheduleRows)
      .select('id')
    if (schedErr) throw new Error(`Schedule insert failed: ${schedErr.message}`)

    // 4. Issue link for day 1
    const day1ScheduleId     = inserted![0].id
    const expiresHours       = sessions[0].link_expires_hours ?? 48
    const expiresAt          = new Date(Date.now() + expiresHours * 3600 * 1000).toISOString()

    const tokenBytes = crypto.getRandomValues(new Uint8Array(24))
    const token = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

    const { data: link, error: linkErr } = await admin
      .from('participant_links')
      .insert({
        schedule_id:    day1ScheduleId,
        participant_id: participantId,
        study_id:       studyId,
        expires_at:     expiresAt,
        token,
      })
      .select('token')
      .single()
    if (linkErr) throw new Error(`Link insert failed: ${linkErr.message}`)

    await admin
      .from('participant_schedule')
      .update({ status: 'link_sent' })
      .eq('id', day1ScheduleId)

    return json({ token: link.token, participantId })
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
