// study-signup-verify — step two of self-enrollment: the emailed token comes
// back, and only now does anything durable get created.
//
// Called unauthenticated from /study/verify (verify_jwt = false): the click may
// land on a device with no session at all, which is the normal case when the
// form was filled on a laptop and the mail opened on a phone.
//
// POST body: { token }
// Returns:   { token: <session link token> } | { error }
//
// This deliberately does NOT extend auto-enroll. That function is live for
// three studies and its gates are SONA/Prolific-shaped; branching it for a
// third source risks all of them. It shares the same _shared modules instead
// (materializeSchedule, issueLink's expiry convention), so the parts that must
// agree do agree. Unifying the two enrollment cores is a follow-up.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { baselineTimeOfDay, materializeSchedule } from '../_shared/materializeSchedule.ts'
import type { Graph } from '../_shared/materializeSchedule.ts'
import { todayInLabTz } from '../_shared/labDate.ts'
import { selfEnrollExternalId, selfEnrollDisplayName } from '../_shared/selfEnrollId.ts'

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

type Admin = ReturnType<typeof createClient>

/** The newest usable session link for a participant in a study, or null. */
async function activeLinkToken(admin: Admin, participantId: string, studyId: string) {
  const { data } = await admin
    .from('participant_links')
    .select('token')
    .eq('participant_id', participantId)
    .eq('study_id', studyId)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.token ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed.' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let claimedRequestId: string | null = null

  try {
    const { token } = await req.json()
    if (!token) return json({ error: 'not_found' }, 400)

    // 1. Claim the token. The UPDATE ... WHERE consumed_at IS NULL inside this
    //    RPC is what makes a double-click impossible to turn into two
    //    enrollments: two concurrent calls, one row updated.
    const { data: claim, error: claimErr } = await admin
      .rpc('claim_signup_request', { p_token: token })
    if (claimErr) {
      console.error('claim_signup_request failed:', claimErr.message)
      return json({ error: 'unexpected' }, 500)
    }

    if (claim.status === 'not_found') return json({ error: 'not_found' }, 404)
    if (claim.status === 'expired')   return json({ error: 'expired' }, 410)

    // Already used — a refresh, or the link clicked twice. Hand back the
    // session link this request already produced rather than an error.
    if (claim.status === 'already') {
      if (!claim.enrollment_id) return json({ error: 'in_progress' }, 409)
      const { data: enrollment } = await admin
        .from('study_enrollments').select('profile_id, study_id')
        .eq('id', claim.enrollment_id).maybeSingle()
      if (!enrollment?.profile_id) return json({ error: 'unexpected' }, 500)
      const existing = await activeLinkToken(admin, enrollment.profile_id, enrollment.study_id)
      return existing
        ? json({ token: existing })
        : json({ error: 'link_expired' }, 410)
    }

    claimedRequestId = claim.request_id
    const studyId = claim.study_id

    // 2. Re-check the study. Between the sign-up and the click, it may have
    //    closed — and enrolling into a study that has stopped recruiting is
    //    exactly what `active` is supposed to prevent.
    const { data: study, error: studyErr } = await admin
      .from('studies')
      .select('id, name, active, allow_self_enrollment, design_graph')
      .eq('id', studyId)
      .single()
    if (studyErr || !study)               return json({ error: 'not_found' }, 404)
    if (study.active !== true)            return json({ error: 'closed' }, 403)
    if (study.allow_self_enrollment !== true) return json({ error: 'closed' }, 403)

    const externalId = await selfEnrollExternalId(claim.match_key)

    // 3. Existing enrollment? Signing up twice must resume, not duplicate. The
    //    unique index on (study_id, external_id) is the backstop; this is the
    //    graceful path.
    const { data: existingEnrollment } = await admin
      .from('study_enrollments')
      .select('id, profile_id, status')
      .eq('study_id', studyId)
      .eq('external_id', externalId)
      .maybeSingle()

    if (existingEnrollment?.status === 'withdrawn') {
      return json({ error: 'withdrawn' }, 409)
    }

    let participantId: string
    let enrollmentId: string

    if (existingEnrollment?.profile_id) {
      participantId = existingEnrollment.profile_id
      enrollmentId  = existingEnrollment.id
      // Refresh the identifiers: this click proves the mailbox, and the
      // student may have corrected a typo on a second attempt.
      await admin.from('study_enrollments')
        .update({
          contact_email:        claim.email,
          contact_email_set_at: new Date().toISOString(),
          student_number:       claim.student_number,
        })
        .eq('id', enrollmentId)
    } else {
      // 4. Mint the account. The synthetic address is built from the OPAQUE
      //    external id, never the student's own address — see selfEnrollId.ts.
      const authEmail = `${externalId}@participants.radlab.zone`
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email:         authEmail,
        password:      crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { display_name: selfEnrollDisplayName(externalId) },
      })

      if (createErr) {
        const exists = createErr.message?.includes('already been registered')
          || (createErr as { code?: string }).code === 'email_exists'
        if (!exists) {
          console.error('createUser failed:', createErr.message)
          return json({ error: 'unexpected' }, 500)
        }
        const { data: { users }, error: listErr } = await admin.auth.admin.listUsers()
        if (listErr) return json({ error: 'unexpected' }, 500)
        const found = users.find(u => u.email === authEmail)
        if (!found) return json({ error: 'unexpected' }, 500)
        participantId = found.id
      } else {
        participantId = created.user.id
      }

      await admin.from('profiles')
        .update({ role: 'participant', study_id: studyId, is_anonymous: true })
        .eq('id', participantId)

      // 5. The enrollment, carrying the identifiers and the consent timestamp.
      //    consent_date is when they ACTUALLY consented on the sign-up page,
      //    not now — otherwise the record misstates when consent was given.
      const { data: enrollment, error: enrollErr } = await admin
        .from('study_enrollments')
        .insert({
          study_id:             studyId,
          profile_id:           participantId,
          external_id:          externalId,
          external_source:      'self',
          contact_email:        claim.email,
          contact_email_set_at: new Date().toISOString(),
          student_number:       claim.student_number,
          consent_date:         claim.consented_at,
        })
        .select('id')
        .single()

      if (enrollErr || !enrollment) {
        console.error('study_enrollments insert failed:', enrollErr?.message)
        return json({ error: 'unexpected' }, 500)
      }
      enrollmentId = enrollment.id
    }

    // 6. Schedule and first session link. Same two shapes auto-enroll handles.
    const today = todayInLabTz()

    if (study.design_graph) {
      const result = await materializeSchedule(admin, {
        participantId,
        studyId,
        graph:            study.design_graph as Graph,
        t0Date:           today,
        baselineSendTime: baselineTimeOfDay(study.design_graph as Graph),
        // The participant is in the browser right now, so unlock row one and
        // issue its link to hand straight back.
        unlockFirst: true,
      })

      if (result.completedStudy) {
        await admin.rpc('finalize_signup_request', {
          p_request_id: claimedRequestId, p_enrollment_id: enrollmentId,
        })
        return json({ error: 'already_completed' }, 409)
      }

      if (result.inserted === 0) {
        // Schedule already existed — a re-signup. Hand back the live link.
        const existing = await activeLinkToken(admin, participantId, studyId)
        await admin.rpc('finalize_signup_request', {
          p_request_id: claimedRequestId, p_enrollment_id: enrollmentId,
        })
        return existing ? json({ token: existing }) : json({ error: 'link_expired' }, 410)
      }

      const { data: unlocked } = await admin
        .from('participant_schedule')
        .select('link_id')
        .eq('participant_id', participantId).eq('study_id', studyId)
        .eq('status', 'unlocked')
        .maybeSingle()

      const { data: link } = unlocked?.link_id
        ? await admin.from('participant_links').select('token').eq('id', unlocked.link_id).maybeSingle()
        : { data: null }

      if (!link?.token) {
        console.error('self-enroll: no link issued for a freshly materialised schedule')
        return json({ error: 'unexpected' }, 500)
      }

      await admin.rpc('finalize_signup_request', {
        p_request_id: claimedRequestId, p_enrollment_id: enrollmentId,
      })
      claimedRequestId = null
      return json({ token: link.token })
    }

    // 6b. Single-session studies.
    const { data: session, error: sessionErr } = await admin
      .from('study_sessions')
      .select('id, send_time, link_expires_hours')
      .eq('study_id', studyId)
      .order('order_index', { ascending: true })
      .limit(1)
      .single()

    if (sessionErr || !session) {
      console.error('self-enroll: study has no sessions configured')
      return json({ error: 'unexpected' }, 500)
    }

    const { data: sched, error: schedErr } = await admin
      .from('participant_schedule')
      .insert({
        participant_id:   participantId,
        study_id:         studyId,
        study_session_id: session.id,
        scheduled_date:   today,
        send_time:        session.send_time,
        status:           'unlocked',
      })
      .select('id')
      .single()

    if (schedErr || !sched) {
      console.error('participant_schedule insert failed:', schedErr?.message)
      return json({ error: 'unexpected' }, 500)
    }

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + (session.link_expires_hours ?? 48))

    const { data: link, error: linkErr } = await admin
      .from('participant_links')
      .insert({
        schedule_id:    sched.id,
        participant_id: participantId,
        study_id:       studyId,
        expires_at:     expiresAt.toISOString(),
        status:         'active',
      })
      .select('id, token')
      .single()

    if (linkErr || !link) {
      console.error('participant_links insert failed:', linkErr?.message)
      return json({ error: 'unexpected' }, 500)
    }

    await admin.from('participant_schedule').update({ link_id: link.id }).eq('id', sched.id)

    await admin.rpc('finalize_signup_request', {
      p_request_id: claimedRequestId, p_enrollment_id: enrollmentId,
    })
    claimedRequestId = null
    return json({ token: link.token })

  } catch (err) {
    console.error('study-signup-verify unhandled error:', err)
    return json({ error: 'unexpected' }, 500)
  } finally {
    // A claim that never reached finalize must become retryable — the student
    // still holds the only copy of that link. Release on failure, never on
    // success: the same rule the client submit lock follows, for the same
    // reason (a completed enrollment must not repeat, a failed one must).
    if (claimedRequestId) {
      const { error } = await admin.rpc('release_signup_claim', { p_request_id: claimedRequestId })
      if (error) console.error('release_signup_claim failed:', error.message)
    }
  }
})
