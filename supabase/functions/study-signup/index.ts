// study-signup — step one of self-enrollment: record the request, email a
// verification link. Creates NOTHING durable about the participant.
//
// Called unauthenticated from the public signup page (verify_jwt = false in
// config.toml). The account, enrollment and schedule are created only by
// study-signup-verify, when the emailed token comes back — so a typo costs one
// dead request row rather than a ghost account with a materialised schedule.
//
// POST body: { study_id, email, student_number, consented, consent_scope? }
//   student_number is required unless the study has turned
//   require_student_number off.
// Returns:   { ok: true } | { error }
//
// consent_scope is 'research' (the default when absent) or 'credit_only' — the
// latter only for a study that offers it (studies.allow_credit_only_consent;
// see 20260911_credit_only_consent.sql).
//
// The token is NEVER in the response. If it were, anything that could POST here
// could "verify" an address it does not control, which is the whole point of
// the step.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'
import { RESEARCH_REPLY_TO } from '../_shared/replyTo.ts'
import { renderSelfEnrollEmail } from '../_shared/selfEnrollEmail.ts'
import { selfEnrollExternalId } from '../_shared/selfEnrollId.ts'

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

const EXPIRES_HOURS = 24

// A six-digit code the student can TYPE instead of clicking the emailed link.
// University mail runs Defender Safe Links, which opens every link in a real
// browser first; the confirm page is inert until pressed, and this code is the
// independent second path — a scanner that presses buttons still cannot type a
// code nobody typed. Same design as the academic side's sign-in doors.
//
// Rejection sampling rather than `% 1_000_000`, so every code is equally
// likely. (The modulo bias would be negligible, but there is no reason to have
// any in something whose whole value is being unguessable.)
function sixDigitCode(): string {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000
  let n: number
  do { crypto.getRandomValues(buf); n = buf[0] } while (n >= limit)
  return String(n % 1_000_000).padStart(6, '0')
}
const COOLDOWN_S    = 120
const RATE_MAX      = Number(Deno.env.get('ENROLL_RATE_MAX')      ?? '1')
const RATE_WINDOW_S = Number(Deno.env.get('ENROLL_RATE_WINDOW_S') ?? '60')

// Same salted hasher as auto-enroll, and the same reasoning: the IPv4 space is
// small enough to brute force an unsalted hash.
async function hashClientIp(req: Request): Promise<string | null> {
  const raw = req.headers.get('x-forwarded-for')
    ?? req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-real-ip')
  const ip = raw?.split(',')[0]?.trim()
  if (!ip) return null
  const salt  = Deno.env.get('ENROLL_IP_SALT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const bytes = new TextEncoder().encode(`${salt}:${ip}`)
  const hash  = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST')    return json({ error: 'Method not allowed.' }, 405)

  try {
    const { study_id, email, student_number, consented, consent_scope } = await req.json()

    if (!study_id || !email) {
      return json({ error: 'Enter your U of T email address.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Is this study open to self-enrollment at all? Reuse the same gate the
    //    page renders from, so the two can never disagree about whether a study
    //    is joinable (it also refuses studies with a screener).
    const { data: info, error: infoErr } = await admin
      .rpc('get_self_enrollment_study', { p_study_id: study_id })
    if (infoErr) {
      console.error('get_self_enrollment_study failed:', infoErr.message)
      return json({ error: 'Could not open this study. Please contact the study team.' }, 500)
    }
    if (info?.error) {
      return json({ error: 'This study is not currently accepting sign-ups.' }, 403)
    }

    // 2. Consent precedes identity (Norm, 2026-09-03), so a request without it
    //    is refused rather than stored — the identifiers below must never be
    //    written without a consent timestamp to accompany them.
    if (info.consent_required && consented !== true) {
      return json({ error: 'Please read and agree to the consent form first.' }, 400)
    }

    //    WHICH consent travels with the timestamp (2026-09-11, CHM135). A
    //    credit-only participant does every session but is left out of every
    //    research export, so the answer is checked here, not trusted from the
    //    page: a study that does not offer the choice must never collect it,
    //    or someone would silently vanish from a dataset whose protocol has no
    //    such exclusion. Absent means 'research' — what consent always meant.
    const scope = consent_scope ?? 'research'
    if (info.consent_required) {
      if (scope !== 'research' && scope !== 'credit_only') {
        return json({ error: 'Please choose one of the consent options.' }, 400)
      }
      if (scope === 'credit_only' && info.allow_credit_only_consent !== true) {
        return json({ error: 'This study does not offer that consent option.' }, 400)
      }
    }

    // 3. Address validation and normalisation both go through the DATABASE
    //    functions rather than a second copy of the rule here. The academic
    //    side keeps the same regex in three places and they have to be kept in
    //    step by hand; one definition is worth the round trip.
    const [{ data: ok }, { data: matchKey }] = await Promise.all([
      admin.rpc('is_uoft_student_email', { p_email: email }),
      admin.rpc('normalize_uoft_email',  { p_email: email }),
    ])

    if (ok !== true || !matchKey) {
      return json({
        error: 'Use your U of T email address — it should end in utoronto.ca or mail.utoronto.ca.',
      }, 400)
    }

    //    The student number, when the study requires it (the default since
    //    20260912_require_student_number.sql). A course study credits by it, so
    //    a sign-up without one is refused rather than stored: Norm, 2026-09-12,
    //    "or else it won't be possible to assign credit". Checked HERE, before
    //    the cooldown and before supersede_signup_requests below — an invalid
    //    attempt must never expire a valid request already in the inbox. The
    //    format rule is the database's (normalize_student_number), and a trigger
    //    enforces it again on the insert, so this copy cannot drift from it.
    let studentNumber: string | null = student_number ? String(student_number).trim() : null
    if (info.require_student_number === true) {
      const { data: cleaned, error: snErr } = await admin
        .rpc('normalize_student_number', { p_value: student_number ?? null })
      if (snErr) {
        console.error('normalize_student_number failed:', snErr.message)
        return json({ error: 'Could not start your sign-up. Please try again.' }, 500)
      }
      if (!cleaned) {
        return json({ error: 'Enter your U of T student number — 9 or 10 digits, as on your TCard.' }, 400)
      }
      studentNumber = cleaned as string
    }

    // 4. Cooldown, per ADDRESS: a live unconsumed request means a link is
    //    already sitting in that inbox. Checked before the IP limiter so the
    //    common "did it send?" double-submit gets the accurate message.
    const cooldownSince = new Date(Date.now() - COOLDOWN_S * 1000).toISOString()
    const { data: recent } = await admin
      .from('study_signup_requests')
      .select('id')
      .eq('study_id', study_id)
      .eq('email_match_key', matchKey)
      .is('consumed_at', null)
      .gte('created_at', cooldownSince)
      .limit(1)
      .maybeSingle()

    if (recent) {
      return json({
        error: 'A link was just sent — check your inbox and spam folder, then try again in a couple of minutes.',
      }, 429)
    }

    // 5. IP limiter, on the same ledger auto-enroll uses. Fail-open: a limiter
    //    that errors must never stand between a real participant and a study.
    const ipHash = await hashClientIp(req)
    if (ipHash) {
      const since = new Date(Date.now() - RATE_WINDOW_S * 1000).toISOString()
      const { data: attempts, error: attErr } = await admin
        .from('enrollment_attempts')
        .select('id')
        .eq('study_id', study_id)
        .eq('ip_hash', ipHash)
        .gte('attempted_at', since)
      if (attErr) {
        console.error('rate-limit lookup failed, allowing through:', attErr.message)
      } else if ((attempts?.length ?? 0) >= RATE_MAX) {
        return json({ error: 'Too many sign-up attempts. Please wait a minute and try again.' }, 429)
      }
      await admin.from('enrollment_attempts').insert({ study_id, ip_hash: ipHash })
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      await admin.from('enrollment_attempts').delete().lt('attempted_at', cutoff)
    } else {
      console.warn('study-signup: no client IP header — rate limit skipped')
    }

    // 6. Record the request. An address that is already enrolled still gets one,
    //    and verification resolves it to the existing enrollment — so this
    //    endpoint's response never reveals who is or is not in the study.
    const expiresAt = new Date(Date.now() + EXPIRES_HOURS * 60 * 60 * 1000).toISOString()

    // Clear identifiers from requests that died without being completed — owed
    // since self-enrollment shipped. Opportunistic, the way auto-enroll prunes
    // enrollment_attempts, so no standing cron job is needed. Never blocks.
    const { error: purgeErr } = await admin.rpc('purge_expired_signup_pii')
    if (purgeErr) console.error('purge_expired_signup_pii failed:', purgeErr.message)

    // Only the newest email for an address works: an older link or code is
    // expired the moment a new one is requested. Runs AFTER the cooldown above,
    // so a quick double-submit is refused rather than silently replacing the
    // email already on its way.
    const { error: superErr } = await admin
      .rpc('supersede_signup_requests', { p_study_id: study_id, p_match_key: matchKey })
    if (superErr) console.error('supersede_signup_requests failed:', superErr.message)

    const { data: request, error: reqErr } = await admin
      .from('study_signup_requests')
      .insert({
        study_id,
        email:           String(email).trim(),
        email_match_key: matchKey,
        student_number:  studentNumber,
        expires_at:      expiresAt,
        consented_at:    info.consent_required ? new Date().toISOString() : null,
        consent_scope:   info.consent_required ? scope : null,
        ip_hash:         ipHash,
      })
      .select('id, token')
      .single()

    if (reqErr || !request) {
      console.error('study_signup_requests insert failed:', reqErr?.message)
      return json({ error: 'Could not start your sign-up. Please try again.' }, 500)
    }

    // Hashing happens in the database (salted with the request id), so the
    // plaintext code exists only in this function's memory and in the email.
    const code = sixDigitCode()
    const { error: codeErr } = await admin
      .rpc('set_signup_code', { p_request_id: request.id, p_code: code })
    if (codeErr) {
      console.error('set_signup_code failed:', codeErr.message)
      return json({ error: 'Could not start your sign-up. Please try again.' }, 500)
    }

    // 7. Send to the address as TYPED, not the normalised key: normalisation
    //    folds mail.utoronto.ca and +tags together for matching, but the mail
    //    has to reach the mailbox the student actually gave.
    const siteUrl   = Deno.env.get('SITE_URL') ?? 'https://radlab.zone'
    const verifyUrl = `${siteUrl}/study/verify?token=${encodeURIComponent(request.token)}`
    const { subject, html, text } = renderSelfEnrollEmail({
      study_name:    info.name,
      verify_url:    verifyUrl,
      code,
      expires_hours: EXPIRES_HOURS,
    })

    const resend = new Resend(Deno.env.get('RESEND_API_KEY')!)
    const { error: sendErr } = await resend.emails.send({
      from:    Deno.env.get('FROM_EMAIL') ?? 'RADlab <research@radlab.zone>',
      to:      String(email).trim(),
      // camelCase: the SDK maps replyTo -> reply_to on the wire and drops
      // unrecognised keys silently. See _shared/replyTo.ts.
      replyTo: RESEARCH_REPLY_TO,
      subject,
      html,
      text,
    })

    if (sendErr) {
      console.error('self-enroll verification send failed:', sendErr)
      return json({
        error: 'We could not send the confirmation email. Please check the address and try again.',
      }, 502)
    }

    return json({ ok: true })

  } catch (err) {
    console.error('study-signup unhandled error:', err)
    return json({ error: 'An unexpected error occurred.' }, 500)
  }
})
