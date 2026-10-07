// open-join — the open-recruitment route (posters, social media) into a study
// that has studies.open_join_slug set. Today: Liliana Study 3 — Paid, at
// /join/habits.
//
// Called unauthenticated from the public /join/:slug page and from
// SessionEntry's email step (verify_jwt = false in config.toml).
//
// The order is the point (Norm, 2026-10-01): nothing identifying is collected
// from anyone the screener turns away.
//
//   action 'start'        { slug, src?, device_id? } -> { token } | { status: 'screened_out' } | { error }
//       An anonymous account + enrollment (external_source 'open') + schedule,
//       and a link to the entry session. SessionEntry runs the screener there.
//   action 'submit_email' { token, email }           -> { status: 'sent' | 'already_sent' } | { error }
//       Only after a passed screener, on studies that have one. Accepts
//       @mail.utoronto.ca only (students;
//       keeps out scams and spam), one sign-up per address per study family,
//       not while active in an excluded study. Emails the entry link to that
//       address and retires the in-browser one, so continuing REQUIRES the
//       inbox: the email is the address check.
//
// Repeat screening: one attempt per device (a random id the page keeps in
// localStorage, stored hashed) and a per-IP ceiling. Neither is airtight -- a
// new browser profile is a new device -- but together with one sign-up per
// email they make retrying with different answers awkward, which is the agreed
// bar (Norm, 2026-10-01). The IP ceiling is generous because campus networks put
// many students behind one address.

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { baselineTimeOfDay, materializeSchedule } from '../_shared/materializeSchedule.ts'
import type { Graph } from '../_shared/materializeSchedule.ts'
import { todayInLabTz } from '../_shared/labDate.ts'
import { issueLink } from '../_shared/issueLink.ts'
import { RESEARCH_REPLY_TO } from '../_shared/replyTo.ts'
import { renderOpenJoinEmail } from '../_shared/openJoinEmail.ts'

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

// Students only. Staff (@utoronto.ca) and alumni addresses are not accepted.
const STUDENT_EMAIL = /^[a-z0-9._%+'-]+@mail\.utoronto\.ca$/

const IP_MAX_PER_HOUR = Number(Deno.env.get('OPEN_JOIN_IP_MAX_PER_HOUR') ?? '20')
const ENTRY_LINK_HOURS_DEFAULT = 72

async function sha256(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s)
  const hash  = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const SALT = () => Deno.env.get('ENROLL_IP_SALT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function hashClientIp(req: Request): Promise<string | null> {
  const raw = req.headers.get('x-forwarded-for')
    ?? req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
  const ip = raw?.split(',')[0]?.trim()
  return ip ? sha256(`${SALT()}:${ip}`) : null
}

/** Latest real screener attempt: 'passed' | 'failed' | 'none'. A failed attempt
 *  with a newer staff retake grant reads as 'none' (they may screen again). */
async function screenerState(db: SupabaseClient, participantId: string, studyId: string) {
  const { data: latest } = await db
    .from('screener_results')
    .select('phase1_passed, phase2_passed, screened_at')
    .eq('participant_id', participantId)
    .eq('study_id', studyId)
    .is('resubmission_of', null)
    .order('screened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!latest) return 'none'
  // Same reading as SessionEntry's screener gate.
  if (latest.phase1_passed === true && latest.phase2_passed === true) return 'passed'
  const { data: enr } = await db
    .from('study_enrollments')
    .select('screener_retake_granted_at')
    .eq('profile_id', participantId)
    .eq('study_id', studyId)
    .maybeSingle()
  const grant = enr?.screener_retake_granted_at
  if (grant && new Date(grant) > new Date(latest.screened_at)) return 'none'
  return 'failed'
}

/** The participant's entry session: the earliest uncompleted row. */
async function entryRow(db: SupabaseClient, participantId: string, studyId: string) {
  const { data } = await db
    .from('participant_schedule')
    .select('id, status, study_session_id')
    .eq('participant_id', participantId)
    .eq('study_id', studyId)
    .is('completed_at', null)
    .order('scheduled_date', { ascending: true })
    .order('send_time', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
}

async function entryLinkHours(db: SupabaseClient, studySessionId: string | null) {
  if (!studySessionId) return ENTRY_LINK_HOURS_DEFAULT
  const { data } = await db.from('study_sessions').select('link_expires_hours').eq('id', studySessionId).maybeSingle()
  return data?.link_expires_hours ?? ENTRY_LINK_HOURS_DEFAULT
}

/** A usable token for the entry session: the active one, else a fresh one. */
async function entryToken(db: SupabaseClient, participantId: string, studyId: string): Promise<string | null> {
  const { data: active } = await db
    .from('participant_links')
    .select('token')
    .eq('participant_id', participantId)
    .eq('study_id', studyId)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (active?.token) return active.token

  const entry = await entryRow(db, participantId, studyId)
  if (!entry) return null
  if (entry.status !== 'blocked') {
    await db.from('participant_schedule').update({ status: 'unlocked' }).eq('id', entry.id)
  }
  const link = await issueLink(db, {
    scheduleId: entry.id,
    participantId,
    studyId,
    linkExpiresHours: await entryLinkHours(db, entry.study_session_id),
  })
  return link.token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed.' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const action = body?.action

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // ── start ────────────────────────────────────────────────────────────────
    if (action === 'start') {
      const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
      const src  = typeof body.src === 'string' ? body.src.trim().slice(0, 40) : null
      const deviceId = typeof body.device_id === 'string' ? body.device_id.trim().slice(0, 100) : ''
      if (!slug) return json({ error: 'This link is incomplete. Please scan the QR code again.' }, 400)

      const { data: study } = await db
        .from('studies')
        .select('id, active, design_graph')
        .eq('open_join_slug', slug)
        .maybeSingle()
      if (!study || study.active === false) {
        return json({ error: 'This study is not currently accepting participants.' }, 404)
      }
      if (!study.design_graph) {
        return json({ error: 'This study is not ready yet. Please try again later.' }, 503)
      }

      const deviceHash = deviceId ? await sha256(`${SALT()}:device:${deviceId}`) : null
      const ipHash     = await hashClientIp(req)

      // One screening per device. Someone who returns mid-way (closed the tab
      // before finishing the screener, or before giving an email) resumes;
      // someone screened out does not get another go.
      if (deviceHash) {
        const { data: prior } = await db
          .from('open_join_attempts')
          .select('enrollment_id, study_enrollments(profile_id, contact_email, status)')
          .eq('study_id', study.id)
          .eq('device_hash', deviceHash)
          .not('enrollment_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const enr = prior?.study_enrollments as unknown as { profile_id: string; contact_email: string | null; status: string } | null
        if (enr?.profile_id) {
          const state = await screenerState(db, enr.profile_id, study.id)
          if (state === 'failed') return json({ status: 'screened_out' })
          if (enr.contact_email) {
            return json({ error: "You've already signed up from this device. Your link was sent to your U of T email — please check your inbox (and junk folder)." }, 409)
          }
          if (enr.status === 'withdrawn') {
            return json({ error: 'Your participation in this study has ended.' }, 409)
          }
          const token = await entryToken(db, enr.profile_id, study.id)
          if (token) return json({ token })
        }
      }

      // Per-IP ceiling on new attempts. Fail open on a lookup error.
      if (ipHash) {
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { count, error: cErr } = await db
          .from('open_join_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('study_id', study.id)
          .eq('ip_hash', ipHash)
          .gte('created_at', since)
        if (!cErr && (count ?? 0) >= IP_MAX_PER_HOUR) {
          return json({ error: 'Too many sign-ups from this network in the last hour. Please try again later.' }, 429)
        }
      }

      // Anonymous account. The address is synthetic and undeliverable by
      // construction (participantEmail.ts never sends to this domain); the real
      // address arrives later as contact_email.
      const uid = crypto.randomUUID()
      const externalId = 'O-' + uid.replace(/-/g, '').slice(0, 10).toUpperCase()
      const { data: created, error: createErr } = await db.auth.admin.createUser({
        email:         `ext-open-${uid}@participants.radlab.zone`,
        password:      crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { display_name: `Open ${externalId}` },
      })
      if (createErr || !created?.user) {
        console.error('open-join: createUser failed:', createErr?.message)
        return json({ error: 'Something went wrong. Please try again.' }, 500)
      }
      const participantId = created.user.id

      await db.from('profiles')
        .update({ role: 'participant', study_id: study.id, is_anonymous: true })
        .eq('id', participantId)

      const { data: enrollment, error: enrollErr } = await db.from('study_enrollments').insert({
        study_id:        study.id,
        profile_id:      participantId,
        external_id:     externalId,
        external_source: 'open',
        external_meta:   src ? { src } : {},
      }).select('id').single()
      if (enrollErr || !enrollment) {
        console.error('open-join: enrollment insert failed:', enrollErr?.message)
        return json({ error: 'Something went wrong. Please try again.' }, 500)
      }

      await db.from('open_join_attempts').insert({
        study_id: study.id, device_hash: deviceHash, ip_hash: ipHash, enrollment_id: enrollment.id, src,
      })

      try {
        const graph = study.design_graph as Graph
        await materializeSchedule(db, {
          participantId,
          studyId: study.id,
          graph,
          t0Date: todayInLabTz(),
          baselineSendTime: baselineTimeOfDay(graph),
          unlockFirst: true,
        })
      } catch (err) {
        console.error('open-join: materializeSchedule failed:', err)
        return json({ error: 'Something went wrong preparing the study. Please try again.' }, 500)
      }

      const token = await entryToken(db, participantId, study.id)
      if (!token) return json({ error: 'Something went wrong preparing the study. Please try again.' }, 500)
      return json({ token })
    }

    // ── submit_email ─────────────────────────────────────────────────────────
    if (action === 'submit_email') {
      const token = typeof body.token === 'string' ? body.token.trim() : ''
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (!token) return json({ error: 'This page has expired. Please scan the QR code again.' }, 400)

      const { data: link } = await db
        .from('participant_links')
        .select('id, participant_id, study_id, schedule_id, status, expires_at')
        .eq('token', token)
        .maybeSingle()
      if (!link) return json({ error: 'This page has expired. Please scan the QR code again.' }, 404)

      const { data: enrollment } = await db
        .from('study_enrollments')
        .select('id, external_source, contact_email, status')
        .eq('profile_id', link.participant_id)
        .eq('study_id', link.study_id)
        .maybeSingle()
      if (!enrollment || enrollment.external_source !== 'open') {
        return json({ error: 'This page is not part of the sign-up process.' }, 400)
      }
      if (enrollment.status === 'withdrawn') {
        return json({ error: 'Your participation in this study has ended.' }, 409)
      }
      if (enrollment.contact_email) {
        // Already done: the link went to that address. Say where, not what.
        return json({ status: 'already_sent' })
      }
      if (link.status !== 'active' || new Date(link.expires_at) < new Date()) {
        return json({ error: 'This page has expired. Please scan the QR code again.' }, 410)
      }

      const { data: study } = await db
        .from('studies')
        .select('id, name, public_title, reply_to_email, exclusion_group, screener')
        .eq('id', link.study_id)
        .single()

      // Only studies that HAVE a screener can require one to be passed. This
      // used to be unconditional, so a screener-free study refused every
      // address with "Please complete the eligibility questions first" — an
      // instruction nobody could follow, because there are no questions to
      // complete. screenerState returns 'none' there, never 'passed', so the
      // gate could not be cleared by any means.
      if (study?.screener) {
        const state = await screenerState(db, link.participant_id, link.study_id)
        if (state !== 'passed') {
          return json({ error: 'Please complete the eligibility questions first.' }, 409)
        }
      }

      // Hard gates (CLAUDE.md "Hard gates"): this step emails a session link
      // outside send_message, so it asks the same question first. In practice
      // that is the enrollment cap -- a sign-up after the study filled is told
      // so here rather than emailed a link that would only say it.
      const { data: blockReason, error: gateErr } = await db
        .rpc('schedule_row_block_reason', { p_schedule_id: link.schedule_id })
      if (gateErr) {
        console.error('open-join: gate check failed:', gateErr.message)
        return json({ error: 'Something went wrong. Please try again in a few minutes.' }, 500)
      }
      if (blockReason === 'enrollment_full') {
        return json({ error: 'Sorry, but study enrollment is now full, thanks for your interest!' }, 409)
      }
      if (blockReason) {
        return json({ error: 'This study is not available to you at the moment. Please contact the research team if you have any questions.' }, 409)
      }

      if (!STUDENT_EMAIL.test(email) || email.length > 254) {
        return json({ error: 'Please enter your U of T student email address — it ends in @mail.utoronto.ca.' }, 422)
      }

      // One sign-up per address per study family (this study and its SONA
      // original), whatever the earlier enrollment's status.
      const { data: registered, error: regErr } = await db.rpc('email_registered_in_family', {
        p_study: link.study_id, p_email: email, p_except_profile: link.participant_id,
      })
      if (regErr) {
        console.error('open-join: email_registered_in_family failed:', regErr.message)
        return json({ error: 'Something went wrong. Please try again.' }, 500)
      }
      if (registered) {
        return json({ error: 'This email address has already been used to sign up for this study, so it can’t be used again. If you think this is a mistake, please contact the research team.' }, 409)
      }

      // Not while actively in another study of the exclusion group (e.g. Zerin):
      // consented, still enrolled, with a session still to come.
      if (study?.exclusion_group) {
        const { data: others } = await db
          .from('study_enrollments')
          .select('profile_id, study_id, studies!inner(exclusion_group, active, parent_study_id)')
          // ilike for case-insensitivity; escape its wildcards ('_' is common in addresses).
          .ilike('contact_email', email.replace(/[\\%_]/g, (c) => '\\' + c))
          .neq('study_id', link.study_id)
          .in('status', ['enrolled', 'in_progress'])
          .not('consent_date', 'is', null)
          .eq('studies.exclusion_group', study.exclusion_group)
          .eq('studies.active', true)
        for (const o of others ?? []) {
          const { count } = await db
            .from('participant_schedule')
            .select('id', { count: 'exact', head: true })
            .eq('participant_id', o.profile_id)
            .eq('study_id', o.study_id)
            .in('status', ['pending', 'link_sent', 'unlocked'])
          if ((count ?? 0) > 0) {
            return json({ error: "You're currently taking part in another of our multi-week studies. These run one at a time, so you can't join this one until that study has finished. Please contact the research team if you have questions." }, 409)
          }
        }
      }

      const { error: setErr } = await db
        .from('study_enrollments')
        .update({ contact_email: email, contact_email_set_at: new Date().toISOString() })
        .eq('id', enrollment.id)
        .is('contact_email', null)
      if (setErr) {
        // The unique index on the open route: a second tab raced this one.
        console.error('open-join: contact_email update failed:', setErr.message)
        return json({ error: 'This email address has already been used to sign up for this study, so it can’t be used again.' }, 409)
      }

      // Retire the in-browser link and issue the entry link fresh, for the inbox.
      const { data: entrySched } = await db
        .from('participant_schedule')
        .select('id, study_session_id')
        .eq('id', link.schedule_id)
        .single()
      const hours = await entryLinkHours(db, entrySched?.study_session_id ?? null)
      const fresh = await issueLink(db, {
        scheduleId: link.schedule_id,
        participantId: link.participant_id,
        studyId: link.study_id,
        linkExpiresHours: hours,
      })
      // issueLink supersedes the participant's other active links for this
      // study; make sure the one this page holds is closed either way.
      await db.from('participant_links')
        .update({ status: 'expired', ended_reason: 'superseded', ended_at: new Date().toISOString() })
        .eq('id', link.id)
        .eq('status', 'active')

      const siteUrl = Deno.env.get('SITE_URL') ?? 'https://radlab.zone'
      const replyTo = study?.reply_to_email || RESEARCH_REPLY_TO
      const mail = renderOpenJoinEmail({
        study_title:   study?.public_title || study?.name || 'our study',
        link_url:      `${siteUrl}/s/${fresh.token}`,
        expires_hours: hours,
        contact_email: replyTo,
      })
      const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)
      const { error: sendErr } = await resend.emails.send({
        from:    Deno.env.get('FROM_EMAIL') ?? 'RADlab <research@radlab.zone>',
        to:      email,
        replyTo: replyTo,
        subject: mail.subject,
        html:    mail.html,
        text:    mail.text,
      })
      await db.from('message_log').insert({
        participant_id: link.participant_id,
        sent_at:        new Date().toISOString(),
        channel:        'email',
        status:         sendErr ? 'failed' : 'sent',
        kind:           'open_join_link',
        is_test:        false,
      })
      if (sendErr) {
        console.error('open-join: Resend error:', sendErr.message)
        // Undo the address so the person can try again: rescanning the QR code
        // on this device resumes at the email step (start -> prior attempt with
        // no contact_email -> the fresh, still-active entry link).
        await db.from('study_enrollments').update({ contact_email: null, contact_email_set_at: null }).eq('id', enrollment.id)
        return json({ error: `We couldn't send the email. Please write to ${replyTo} and we'll send your link.` }, 502)
      }
      return json({ status: 'sent' })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (err) {
    console.error('open-join unhandled error:', err)
    return json({ error: 'An unexpected error occurred.' }, 500)
  }
})
