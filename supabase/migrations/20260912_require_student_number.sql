-- A student number is required to self-enrol, by default.
--
-- WHY. Self-enrolment exists for course studies, and a course study assigns
-- credit by student number. Norm (2026-09-12): "I think a student number is
-- critical at baseline for Dana's study, or else it won't be possible to assign
-- credit. It shouldn't be optional in any of her authored studies this term."
-- Until now the sign-up page asked for it but accepted a blank: only consent and
-- a U of T address were required, so a student could enrol, sit every session,
-- and be impossible to credit.
--
-- It is also the only fallback identity. One U of T address is one account
-- (normalize_uoft_email folds case, +tags and mail.utoronto.ca), but a student
-- with two genuinely different addresses would be two participants, and only the
-- student number on the enrolment could reunite them.
--
-- DEFAULT true, deliberately, against the usual default-off convention for study
-- options. Every study that has ever used self-enrolment is Dana's (all four are
-- created_by her account), and "any of her authored studies this term" includes
-- ones she has not made yet — a default-off flag would silently make the number
-- optional again on the next study she creates. The flag is read only by the
-- self-enrolment path; SONA, Prolific and admin-enrolled studies are unaffected.
-- A study that genuinely does not need it can turn it off on its study page.
--
-- The rule lives here, once. study-signup calls normalize_student_number rather
-- than keeping its own copy (the precedent normalize_uoft_email set), and a
-- trigger makes it an invariant of the table rather than of one caller.

-- ── 1. The setting ───────────────────────────────────────────────────────────
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS require_student_number boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.studies.require_student_number IS
  'Self-enrolment refuses a sign-up without a valid U of T student number (9 or 10 digits). Default true: course studies assign credit by it.';

-- ── 2. The format, in one place ──────────────────────────────────────────────
-- U of T student numbers are 10 digits for current students (9 for some older
-- ones). Spaces and hyphens a student types are removed; anything else that is
-- not 9-10 digits is refused rather than guessed at. Returns the cleaned digits,
-- or NULL when the input is not a student number.
CREATE OR REPLACE FUNCTION public.normalize_student_number(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN regexp_replace(coalesce(p_value, ''), '[[:space:]-]', '', 'g') ~ '^[0-9]{9,10}$'
    THEN regexp_replace(p_value, '[[:space:]-]', '', 'g')
  END
$$;

GRANT EXECUTE ON FUNCTION public.normalize_student_number(text) TO anon, authenticated, service_role;

-- ── 3. The invariant ─────────────────────────────────────────────────────────
-- INSERT only: finalize_signup_request and purge_expired_signup_pii clear
-- student_number with UPDATEs, and must keep doing so.
CREATE OR REPLACE FUNCTION public.enforce_signup_student_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM studies WHERE id = NEW.study_id AND require_student_number) THEN
    NEW.student_number := normalize_student_number(NEW.student_number);
    IF NEW.student_number IS NULL THEN
      RAISE EXCEPTION 'student_number_required'
        USING ERRCODE = 'check_violation',
              HINT = 'This study requires a 9- or 10-digit U of T student number.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS study_signup_requests_student_number ON public.study_signup_requests;
CREATE TRIGGER study_signup_requests_student_number
  BEFORE INSERT ON public.study_signup_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_signup_student_number();

-- ── 4. The sign-up page learns the setting ───────────────────────────────────
-- Live definition (20260911_credit_only_consent.sql; md5 of the live prosrc
-- matched that file before this was written) plus one field.
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
    'allow_credit_only_consent', v_study.allow_credit_only_consent,
    'require_student_number',    v_study.require_student_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_self_enrollment_study(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_self_enrollment_study(uuid) TO anon, authenticated, service_role;
