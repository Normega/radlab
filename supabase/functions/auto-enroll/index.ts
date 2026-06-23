// auto-enroll — creates a participant account and session link for SONA / Prolific participants.
//
// No Authorization header needed; called unauthenticated from the study join page.
// Uses the service role key internally.
//
// POST body: { study_id, external_id, source: 'sona'|'prolific', prolific_study_id?, prolific_session_id? }
// Returns:   { token } | { error }

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
    const { study_id, external_id, source, prolific_study_id, prolific_session_id } =
      await req.json()

    if (!study_id || !external_id || !source) {
      return json({ error: 'Missing required fields: study_id, external_id, source.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Verify the study exists and permits external enrollment from this source.
    const { data: study, error: studyErr } = await admin
      .from('studies')
      .select('id, allow_external_enrollment, external_enrollment_source')
      .eq('id', study_id)
      .single()

    if (studyErr || !study) return json({ error: 'Study not found.' }, 404)

    if (!study.allow_external_enrollment) {
      return json({ error: 'This study is not open for external enrollment.' }, 403)
    }

    const src: string = study.external_enrollment_source
    if (src !== 'both' && src !== source) {
      return json({ error: 'This study does not accept enrollments from this platform.' }, 403)
    }

    // 2. Check for an existing enrollment to support re-entry.
    const { data: existing } = await admin
      .from('study_enrollments')
      .select('id, profile_id')
      .eq('study_id', study_id)
      .eq('external_id', external_id)
      .maybeSingle()

    let participantId: string

    if (existing?.profile_id) {
      participantId = existing.profile_id

      // Return a still-active link if one exists.
      const { data: activeLink } = await admin
        .from('participant_links')
        .select('token')
        .eq('participant_id', participantId)
        .eq('study_id', study_id)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeLink) return json({ token: activeLink.token })

      // Existing enrollment but link expired — fall through to create a new link.
    } else {
      // 3. Create (or find) the auth account for this external participant.
      const safeId = external_id.toLowerCase().replace(/[^a-z0-9]/g, '-')
      const email  = `ext-${source}-${safeId}@participants.radlab.zone`

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password:      crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { display_name: `${source.toUpperCase()} ${external_id}` },
      })

      if (createErr) {
        if (
          createErr.message?.includes('already been registered') ||
          (createErr as { code?: string }).code === 'email_exists'
        ) {
          // Look up the existing user by email.
          const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
          if (listErr) return json({ error: 'Failed to look up participant account.' }, 500)
          const found = users.find(u => u.email === email)
          if (!found) return json({ error: createErr.message }, 500)
          participantId = found.id
        } else {
          return json({ error: createErr.message }, 500)
        }
      } else {
        participantId = created.user.id
      }

      // 4. Update the auto-created profile row (inserted by DB trigger on auth.users).
      await admin
        .from('profiles')
        .update({ role: 'participant', study_id, is_anonymous: true })
        .eq('id', participantId)

      // 5. Create the enrollment record.
      const meta: Record<string, string> = {}
      if (prolific_study_id)   meta.prolific_study_id   = prolific_study_id
      if (prolific_session_id) meta.prolific_session_id = prolific_session_id

      const { error: enrollErr } = await admin.from('study_enrollments').insert({
        study_id,
        profile_id:      participantId,
        external_id,
        external_source: source,
        external_meta:   meta,
      })

      if (enrollErr) {
        return json({ error: 'Enrollment failed. Please contact the study team.' }, 500)
      }
    }

    // 6. Find the first study session (lowest order_index).
    const { data: session, error: sessionErr } = await admin
      .from('study_sessions')
      .select('id, send_time, link_expires_hours')
      .eq('study_id', study_id)
      .order('order_index', { ascending: true })
      .limit(1)
      .single()

    if (sessionErr || !session) {
      return json({ error: 'No sessions are configured for this study yet.' }, 500)
    }

    // 7. Create a participant_schedule entry.
    const today = new Date().toISOString().split('T')[0]

    const { data: sched, error: schedErr } = await admin
      .from('participant_schedule')
      .insert({
        participant_id:   participantId,
        study_id,
        study_session_id: session.id,
        scheduled_date:   today,
        send_time:        session.send_time,
        status:           'unlocked',
      })
      .select('id')
      .single()

    if (schedErr) {
      return json({ error: 'Failed to create session schedule.' }, 500)
    }

    // 8. Create the participant_link.
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + (session.link_expires_hours ?? 48))

    const { data: link, error: linkErr } = await admin
      .from('participant_links')
      .insert({
        schedule_id:    sched.id,
        participant_id: participantId,
        study_id,
        expires_at:     expiresAt.toISOString(),
        status:         'active',
      })
      .select('id, token')
      .single()

    if (linkErr) {
      return json({ error: 'Failed to create session link.' }, 500)
    }

    // 9. Back-fill schedule.link_id (deferred circular reference).
    await admin
      .from('participant_schedule')
      .update({ link_id: link.id })
      .eq('id', sched.id)

    return json({ token: link.token })

  } catch (err) {
    console.error('auto-enroll unhandled error:', err)
    return json({ error: 'An unexpected error occurred.' }, 500)
  }
})
