-- Self-enrollment: a student opens a link from a course announcement, consents,
-- gives their U of T email and student number, and is enrolled once they click
-- a verification link sent to that address.
--
-- Why this is not the existing external-enrollment path: `/study/join` takes the
-- participant's identity from the URL (`?id=` for SONA, `PROLIFIC_PID` for
-- Prolific). A course announcement has no per-student parameter, so one static
-- link means one shared `external_id` — and because enrollments are uniquely
-- indexed on (study_id, external_id) and auto-enroll returns the existing link
-- on a repeat, every student clicking it would land in ONE shared participant
-- account holding ONE session token. That token is a credential. This path
-- exists so a public link can identify people individually and safely.
--
-- `auto-enroll` is deliberately untouched: it is live for three studies, and a
-- separate `allow_self_enrollment` flag keeps the SONA/Prolific gates exactly
-- as they are. Unifying the two enrollment cores is a follow-up, not launch work.
--
-- ORDER OF OPERATIONS (Norm, 2026-09-03): consent comes before any identifiable
-- data. That is why the consent timestamp is recorded on the request row below
-- and carried onto the enrollment at verification, rather than being collected
-- in-session like every other path — by the time an enrollment exists, consent
-- has already been given.

-- ── 1. U of T email normalisation ────────────────────────────────────────────
-- Mirrors identity.normalize_uoft_email on the academic project, with one
-- deliberate difference: `+tags` are stripped here. On the academic side the
-- roster is the gate, so a tag is harmless; here the normalised address IS the
-- deduplication key, and leaving tags intact would make `me+1@`, `me+2@` a
-- one-line way to enroll repeatedly.
--
-- `alum.utoronto.ca` is NOT accepted (see is_uoft_student_email): these studies
-- recruit current students. Changing that is a one-line edit here.
CREATE OR REPLACE FUNCTION public.normalize_uoft_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
           regexp_replace(lower(btrim(p_email)), '\+[^@]*@', '@'),
           '@(mail\.)?utoronto\.ca$', '@utoronto.ca'
         )
$$;

CREATE OR REPLACE FUNCTION public.is_uoft_student_email(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(p_email)) ~ '^[^@[:space:]]+@(mail\.)?utoronto\.ca$'
$$;

-- ── 2. Study flag and the identifier column ──────────────────────────────────
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS allow_self_enrollment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.studies.allow_self_enrollment IS
  'Master switch for the public self-enrollment page. Default false: a study is '
  'never publicly joinable until someone turns this on.';

-- The identifiers live HERE and nowhere else; everything downstream joins by
-- profile_id. `contact_email` already set that precedent, and studyExport.js
-- omits it from its explicit select — keep student_number out the same way.
ALTER TABLE public.study_enrollments
  ADD COLUMN IF NOT EXISTS student_number text;

-- ── 3. Signup requests ───────────────────────────────────────────────────────
-- The pre-enrollment holding pen. Nothing is created in auth.users,
-- study_enrollments or participant_schedule until the emailed token is clicked,
-- so a typo costs one dead row here rather than a ghost account with a
-- materialised schedule.
--
-- The buffer must be SERVER-side, not sessionStorage like the in-session
-- screener draft: the email round-trip means a student can fill the form on a
-- laptop and click the link on their phone.
CREATE TABLE IF NOT EXISTS public.study_signup_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id        uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,

  -- Cleared on successful consumption: once the identifiers are on the
  -- enrollment row they must not also live here.
  email           text,
  email_match_key text,
  student_number  text,

  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      timestamptz NOT NULL,

  -- When consent was actually given, not when the email link was clicked. The
  -- enrollment's consent_date is copied from this, so the record says when the
  -- person consented rather than when they got round to their inbox.
  consented_at    timestamptz,

  consumed_at     timestamptz,
  enrollment_id   uuid REFERENCES public.study_enrollments(id) ON DELETE SET NULL,
  ip_hash         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_signup_requests_lookup
  ON public.study_signup_requests (study_id, email_match_key, created_at DESC);

ALTER TABLE public.study_signup_requests ENABLE ROW LEVEL SECURITY;
-- No policies, deliberately: this table holds identifiers before any consent
-- record exists to scope them. Service role (the Edge Functions) bypasses RLS;
-- nothing client-side may read it. Same posture as enrollment_attempts and the
-- academic identity.roster.

-- ── 4. What the public signup page may know ──────────────────────────────────
-- One narrow SECURITY DEFINER read, so the page can render the study name and
-- consent form without widening RLS on studies or study_consent_forms (a
-- prospective participant is by definition not yet enrolled, so the existing
-- participant-read policy cannot reach the form).
--
-- Returns nothing identifying and nothing about studies that have not opted in:
-- a study with the flag off is reported exactly as a nonexistent one.
CREATE OR REPLACE FUNCTION public.get_self_enrollment_study(p_study_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_study        studies%ROWTYPE;
  v_consent_html text;
BEGIN
  SELECT * INTO v_study FROM studies WHERE id = p_study_id;

  IF NOT FOUND OR v_study.allow_self_enrollment IS NOT TRUE OR v_study.active IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'not_open');
  END IF;

  -- Self-enrollment cannot yet administer a screener: eligibility screening
  -- would have to run anonymously and buffer to the request row, which is not
  -- built. Refusing is the safe failure — silently skipping a screener would
  -- enroll people the protocol excludes.
  IF v_study.screener_id IS NOT NULL OR v_study.screener IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'screener_unsupported');
  END IF;

  IF v_study.active_consent_form_id IS NOT NULL THEN
    SELECT html_content INTO v_consent_html
      FROM study_consent_forms WHERE id = v_study.active_consent_form_id;
  END IF;

  -- A study requiring consent with no form attached must not quietly enroll
  -- people with no consent step at all.
  IF v_study.consent_required IS TRUE AND v_consent_html IS NULL THEN
    RETURN jsonb_build_object('error', 'consent_form_missing');
  END IF;

  RETURN jsonb_build_object(
    'study_id',         v_study.id,
    'name',             v_study.name,
    'consent_required', COALESCE(v_study.consent_required, false),
    'consent_html',     v_consent_html
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_self_enrollment_study(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_self_enrollment_study(uuid) TO anon, authenticated;

-- ── 5. Single-use token claim ────────────────────────────────────────────────
-- The atomic half of verification. `consumed_at IS NULL` in the UPDATE's WHERE
-- clause is what makes a double-click impossible to turn into two enrollments —
-- two concurrent calls, only one row updated.
--
-- Released rather than kept on failure (see release_signup_claim): the caller
-- claims, does the enrollment work, and only then finalises. A claim that is
-- never finalised must become retryable, exactly as the client submit lock
-- releases on failure and never on success.
CREATE OR REPLACE FUNCTION public.claim_signup_request(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_req study_signup_requests%ROWTYPE;
BEGIN
  UPDATE study_signup_requests
     SET consumed_at = now()
   WHERE token = p_token
     AND consumed_at IS NULL
     AND expires_at > now()
  RETURNING * INTO v_req;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status',         'claimed',
      'request_id',     v_req.id,
      'study_id',       v_req.study_id,
      'email',          v_req.email,
      'match_key',      v_req.email_match_key,
      'student_number', v_req.student_number,
      'consented_at',   v_req.consented_at
    );
  END IF;

  SELECT * INTO v_req FROM study_signup_requests WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Already used: a refresh or a second click. Not an error — the caller
  -- returns the session link this request already produced.
  IF v_req.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status',        'already',
      'study_id',      v_req.study_id,
      'enrollment_id', v_req.enrollment_id
    );
  END IF;

  RETURN jsonb_build_object('status', 'expired');
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_signup_request(
  p_request_id uuid, p_enrollment_id uuid
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE study_signup_requests
     SET enrollment_id   = p_enrollment_id,
         -- The identifiers now live on the enrollment. Holding a second copy
         -- here would put them in a table with no consent record to scope them.
         email           = NULL,
         email_match_key = NULL,
         student_number  = NULL
   WHERE id = p_request_id;
$$;

CREATE OR REPLACE FUNCTION public.release_signup_claim(p_request_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE study_signup_requests
     SET consumed_at = NULL
   WHERE id = p_request_id AND enrollment_id IS NULL;
$$;

REVOKE ALL ON FUNCTION public.claim_signup_request(text)          FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_signup_request(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_signup_claim(uuid)          FROM public, anon, authenticated;
-- Service role only: these are the Edge Function's own machinery. A browser
-- able to call claim_signup_request could consume someone else's token.
GRANT EXECUTE ON FUNCTION public.claim_signup_request(text)          TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_signup_request(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_signup_claim(uuid)          TO service_role;
