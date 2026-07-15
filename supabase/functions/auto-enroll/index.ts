// auto-enroll — creates a participant account and session link for SONA / Prolific participants.
//
// No Authorization header needed; called unauthenticated from the study join page.
// Uses the service role key internally.
//
// POST body: { study_id, external_id, source: 'sona'|'prolific', prolific_study_id?, prolific_session_id? }
// Returns:   { token } | { error }

import { createClient } from 'npm:@supabase/supabase-js@2'
import { baselineTimeOfDay, materializeSchedule } from '../_shared/materializeSchedule.ts'
import type { Graph } from '../_shared/materializeSchedule.ts'
import { processAdherenceWithdrawal } from '../_shared/processAdherenceWithdrawal.ts'

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
      .select('id, allow_external_enrollment, external_enrollment_source, design_graph')
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
      .select('id, profile_id, status')
      .eq('study_id', study_id)
      .eq('external_id', external_id)
      .maybeSingle()

    let participantId: string

    if (existing?.profile_id) {
      // Withdrawn (adherence termination or manual admin withdraw) is final —
      // exit before materializeSchedule, whose adherence gate would otherwise
      // re-detect the failure and re-run the whole withdrawal (+ email) on
      // every re-entry click.
      if (existing.status === 'withdrawn') {
        return json({ error: 'Your participation in this study has ended.' }, 409)
      }

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

    const today = new Date().toISOString().split('T')[0]

    // 6. Longitudinal studies (Experiment Builder): materialize the full
    // multi-day schedule from the graph. Other delivery modes fall through
    // to the legacy single-session path below.
    if (study.design_graph) {
      const graph = study.design_graph as Graph

      let result
      try {
        result = await materializeSchedule(admin, {
          participantId,
          studyId: study_id,
          graph,
          t0Date: today,
          baselineSendTime: baselineTimeOfDay(graph),
          // Participant is in the browser right now — unlock the first row
          // and issue its link so it can be returned in this response.
          unlockFirst: true,
        })
      } catch (err) {
        console.error('materializeSchedule failed:', err)
        return json({ error: 'Failed to schedule this study for the participant.' }, 500)
      }

      // Defense-in-depth only — the adherence gate can't realistically
      // resolve at enrollment time, before any daily sessions exist. Real
      // handling lives in check_schedule's advance pass.
      if (result.withdrawal) {
        try {
          await processAdherenceWithdrawal(admin, { participantId, studyId: study_id, withdrawal: result.withdrawal })
        } catch (err) {
          console.error('processAdherenceWithdrawal failed:', err)
        }
        return json({ error: 'Your participation in this study has ended.' }, 409)
      }

      if (result.inserted === 0) {
        // Idempotent no-op: schedule already existed for this participant.
        // The early re-entry check above only returns a link that is still
        // active and unexpired; if we got here none was found. Reissuing an
        // expired link for a later due session is check_schedule's job.
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
        return json(
          { error: 'Your session link has expired. A new link will be sent when your next session is due.' },
          409,
        )
      }

      const { data: unlockedSchedule, error: unlockedErr } = await admin
        .from('participant_schedule')
        .select('link_id')
        .eq('participant_id', participantId)
        .eq('study_id', study_id)
        .eq('status', 'unlocked')
        .single()

      if (unlockedErr || !unlockedSchedule?.link_id) {
        return json({ error: 'Failed to issue a session link.' }, 500)
      }

      const { data: link, error: linkErr } = await admin
        .from('participant_links')
        .select('token')
        .eq('id', unlockedSchedule.link_id)
        .single()

      if (linkErr || !link) {
        return json({ error: 'Failed to issue a session link.' }, 500)
      }

      return json({ token: link.token })
    }

    // 6b. Legacy single-shot path (in_person / online_single): one session,
    // schedule row created immediately.
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
