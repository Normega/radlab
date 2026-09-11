-- Credit-only consent: a second consent answer a study can offer.
--
-- WHY. Dana's CHM135 course study runs its surveys as a course activity, so a
-- student must be able to complete every session for credit WITHOUT agreeing to
-- research use of what they submit. The CHM135 consent forms already describe
-- that choice ("complete the surveys but opt to have your data excluded from
-- the research dataset"); the platform had no way to record it, because consent
-- was a single timestamp. The PI's instruction (2026-09-11): "Please don't share
-- data from participants who aren't consenting to share data."
--
-- The participant's answer is stored beside the consent timestamp as
-- `consent_scope`:
--
--   'research'     agreed to take part in the research (what consent meant before)
--   'credit_only'  completes the sessions for course credit; their data must
--                  never leave the platform in a research export
--   NULL           recorded before this option existed. Every such enrollment
--                  consented under the old single-checkbox form, so NULL reads
--                  as 'research'. New consents always write a value.
--
-- Credit-only participants are deliberately NOT treated differently anywhere
-- else: they get the same schedule, reminders and credit as everyone. The choice
-- is enforced where data leaves — the study export (src/lib/creditOnlyExport.js)
-- drops their enrollments and every row they own.
--
-- The option is off unless a study turns it on (`allow_credit_only_consent`),
-- following the one-boolean-per-study-option convention of allow_self_enrollment.
-- A study with the flag off behaves exactly as before, and the database refuses
-- a 'credit_only' answer for it.
--
-- Nothing here touches RLS. study_enrollments still has no participant UPDATE
-- policy, so a participant cannot change their own scope after the fact; the
-- only participant-facing write is record_consent below, which (like the
-- timestamp) keeps the first answer.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS allow_credit_only_consent boolean NOT NULL DEFAULT false;

ALTER TABLE public.study_signup_requests
  ADD COLUMN IF NOT EXISTS consent_scope text
    CONSTRAINT study_signup_requests_consent_scope_check
    CHECK (consent_scope IN ('research', 'credit_only'));

ALTER TABLE public.study_enrollments
  ADD COLUMN IF NOT EXISTS consent_scope text
    CONSTRAINT study_enrollments_consent_scope_check
    CHECK (consent_scope IN ('research', 'credit_only'));

COMMENT ON COLUMN public.study_enrollments.consent_scope IS
  'research | credit_only. NULL = consent recorded before credit-only consent existed (2026-09-11), i.e. research consent. credit_only participants are excluded from every research data export.';
COMMENT ON COLUMN public.studies.allow_credit_only_consent IS
  'Offer "complete for course credit, but do not use my data in research" as a second consent answer.';

-- ── 2. The public signup page learns whether to offer the choice ─────────────
-- Live definition (20260903_self_enrollment.sql) copied unchanged apart from the
-- one added field.
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

  IF v_study.screener_id IS NOT NULL OR v_study.screener IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'screener_unsupported');
  END IF;

  IF v_study.active_consent_form_id IS NOT NULL THEN
    SELECT html_content INTO v_consent_html
      FROM study_consent_forms WHERE id = v_study.active_consent_form_id;
  END IF;

  IF v_study.consent_required IS TRUE AND v_consent_html IS NULL THEN
    RETURN jsonb_build_object('error', 'consent_form_missing');
  END IF;

  RETURN jsonb_build_object(
    'study_id',                  v_study.id,
    'name',                      v_study.name,
    'consent_required',          COALESCE(v_study.consent_required, false),
    'consent_html',              v_consent_html,
    'allow_credit_only_consent', v_study.allow_credit_only_consent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_self_enrollment_study(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_self_enrollment_study(uuid) TO anon, authenticated, service_role;

-- ── 3. The claim carries the answer through to the enrollment ────────────────
-- study-signup-verify builds the enrollment from what the claim returns, so the
-- scope has to travel with the consent timestamp. Live definitions
-- (20260903_self_enrollment.sql, 20260911_signup_typed_code.sql) copied unchanged
-- apart from the one added key in each 'claimed' object.
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
      'consented_at',   v_req.consented_at,
      'consent_scope',  v_req.consent_scope
    );
  END IF;

  SELECT * INTO v_req FROM study_signup_requests WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

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

CREATE OR REPLACE FUNCTION public.claim_signup_request_by_code(p_study_id uuid, p_match_key text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c_max_attempts CONSTANT integer := 5;
  v_req study_signup_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req
    FROM study_signup_requests
   WHERE study_id = p_study_id
     AND email_match_key = p_match_key
     AND consumed_at IS NULL
     AND expires_at > now()
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND OR v_req.code_hash IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_req.code_attempts >= c_max_attempts THEN
    RETURN jsonb_build_object('status', 'locked');
  END IF;

  IF v_req.code_hash IS DISTINCT FROM signup_code_hash(v_req.id, p_code) THEN
    UPDATE study_signup_requests
       SET code_attempts = code_attempts + 1
     WHERE id = v_req.id;
    RETURN jsonb_build_object(
      'status', 'wrong',
      'attempts_left', GREATEST(0, c_max_attempts - v_req.code_attempts - 1)
    );
  END IF;

  UPDATE study_signup_requests
     SET consumed_at = now()
   WHERE id = v_req.id AND consumed_at IS NULL
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'already', 'study_id', p_study_id);
  END IF;

  RETURN jsonb_build_object(
    'status',         'claimed',
    'request_id',     v_req.id,
    'study_id',       v_req.study_id,
    'email',          v_req.email,
    'match_key',      v_req.email_match_key,
    'student_number', v_req.student_number,
    'consented_at',   v_req.consented_at,
    'consent_scope',  v_req.consent_scope
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_signup_request(text)                       FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_signup_request_by_code(uuid, text, text)   FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_signup_request(text)                     TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_signup_request_by_code(uuid, text, text) TO service_role;

-- ── 4. record_consent takes the answer ───────────────────────────────────────
-- The link-based paths (SONA/Prolific/admin links → ConsentGate) consent through
-- this RPC rather than the signup page. Live definition (20260715_record_consent.sql)
-- plus a scope.
--
-- Adding a parameter makes it a new signature, so the one-argument version is
-- DROPPED first: left in place, PostgREST would see two candidates for a call
-- passing only p_study_id and refuse it as ambiguous. The DEFAULT keeps that
-- existing call — rpc('record_consent', { p_study_id }) — working and meaning
-- 'research', which is what it has always meant.
--
-- The first answer stands, exactly as the timestamp does: scope is written only
-- together with consent_date, and only while consent_date is null. A NULL p_scope
-- is read as 'research', matching study-signup's handling of an absent scope.
DROP FUNCTION IF EXISTS public.record_consent(uuid);

CREATE FUNCTION public.record_consent(p_study_id uuid, p_scope text DEFAULT 'research')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile    uuid := auth.uid();
  v_scope      text := COALESCE(p_scope, 'research');
  v_enrollment public.study_enrollments%ROWTYPE;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'record_consent: not authenticated';
  END IF;

  IF v_scope NOT IN ('research', 'credit_only') THEN
    RAISE EXCEPTION 'record_consent: unknown consent scope %', v_scope;
  END IF;

  -- A study that does not offer the choice must not be able to collect it: an
  -- unoffered credit-only answer would silently remove a participant from a
  -- dataset whose protocol has no such exclusion.
  IF v_scope = 'credit_only' AND NOT EXISTS (
    SELECT 1 FROM public.studies
     WHERE id = p_study_id AND allow_credit_only_consent IS TRUE
  ) THEN
    RAISE EXCEPTION 'record_consent: this study does not offer credit-only consent';
  END IF;

  SELECT * INTO v_enrollment
  FROM public.study_enrollments
  WHERE profile_id = v_profile AND study_id = p_study_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_consent: no enrollment found for this study';
  END IF;

  IF v_enrollment.consent_date IS NULL THEN
    UPDATE public.study_enrollments
    SET consent_date  = now(),
        consent_scope = v_scope
    WHERE id = v_enrollment.id
    RETURNING consent_date, consent_scope
      INTO v_enrollment.consent_date, v_enrollment.consent_scope;
  END IF;

  RETURN jsonb_build_object(
    'consent_date',  v_enrollment.consent_date,
    'consent_scope', v_enrollment.consent_scope
  );
END;
$$;

-- Exactly the grants the one-argument function held live (proacl on 2026-09-11:
-- PUBLIC, anon, authenticated, service_role). auth.uid() is the real gate.
GRANT EXECUTE ON FUNCTION public.record_consent(uuid, text) TO PUBLIC, anon, authenticated, service_role;
