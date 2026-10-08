-- Repository consent: an optional, separate consent to deposit de-identified
-- data in the University of Toronto Dataverse (Borealis).
--
-- WHY. The REB now expects consent to take part and consent to deposit data for
-- future use to be two separate decisions (TCPS 2 (2022) Article 3.13(i)). It
-- asked for this on the Sense Foraging protocol (#00051180), together with the
-- move off OSF, which stops accepting new projects on 2026-11-16 and becomes
-- read-only on 2027-02-19. UTMAP 2026 adopts the same design. Until now the
-- platform recorded one consent, so a deposit could not be limited to the
-- people who agreed to it.
--
-- The answer is stored beside the consent timestamp as `repository_consent`:
--
--   true   agreed to the deposit
--   false  declined it; takes part exactly as everyone else does
--   NULL   never asked: a study that does not offer it, consent recorded before
--          this existed, a credit-only participant, or a consent path that does
--          not ask it (the in-lab runner and the self-enrollment signup page do
--          not, yet). NULL means NOT deposited. Only an explicit true counts.
--
-- The question is off unless a study turns it on (`offer_repository_consent`),
-- following the one-boolean-per-study-option convention of
-- allow_credit_only_consent. A study with the flag off behaves exactly as
-- before, and the database refuses an answer for it.
--
-- Nothing here touches RLS. As with consent_scope, the first answer stands:
-- record_consent writes it only together with consent_date, and only while
-- consent_date is null, and participants have no UPDATE policy on enrollments.
-- A participant who later withdraws the deposit consent does so by contacting
-- the team, as the consent form says, and staff edit the row.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS offer_repository_consent boolean NOT NULL DEFAULT false;

ALTER TABLE public.study_enrollments
  ADD COLUMN IF NOT EXISTS repository_consent boolean;

COMMENT ON COLUMN public.studies.offer_repository_consent IS
  'Ask a separate, optional consent to deposit de-identified data in the U of T Dataverse (Borealis).';
COMMENT ON COLUMN public.study_enrollments.repository_consent IS
  'true = agreed to the Borealis deposit; false = declined; NULL = not asked. Only true may be deposited.';

-- ── 2. record_consent takes the answer ───────────────────────────────────────
-- Live definition (20260911_credit_only_consent.sql, verified identical to the
-- database on 2026-10-08) plus one parameter. Adding a parameter makes a new
-- signature, so the two-argument version is DROPPED first: left in place,
-- PostgREST would see two candidates for a call naming only p_study_id and
-- p_scope and refuse it as ambiguous. The DEFAULT keeps every existing call
-- working and meaning exactly what it meant.
--
-- An unanswered question does not block consent. ConsentGate falls back to the
-- plain form if it cannot read the study's options, and consent must never fail
-- because of that; the participant is then simply not deposited (NULL).
DROP FUNCTION IF EXISTS public.record_consent(uuid, text);

CREATE FUNCTION public.record_consent(
  p_study_id           uuid,
  p_scope              text    DEFAULT 'research',
  p_repository_consent boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile    uuid := auth.uid();
  v_scope      text := COALESCE(p_scope, 'research');
  v_repository boolean;
  v_enrollment public.study_enrollments%ROWTYPE;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'record_consent: not authenticated';
  END IF;

  IF v_scope NOT IN ('research', 'credit_only') THEN
    RAISE EXCEPTION 'record_consent: unknown consent scope %', v_scope;
  END IF;

  IF v_scope = 'credit_only' AND NOT EXISTS (
    SELECT 1 FROM public.studies
     WHERE id = p_study_id AND allow_credit_only_consent IS TRUE
  ) THEN
    RAISE EXCEPTION 'record_consent: this study does not offer credit-only consent';
  END IF;

  -- An answer to a question the study never asked would put a participant into
  -- a deposit their protocol does not describe.
  IF p_repository_consent IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.studies
     WHERE id = p_study_id AND offer_repository_consent IS TRUE
  ) THEN
    RAISE EXCEPTION 'record_consent: this study does not offer repository consent';
  END IF;

  -- Credit-only participants allow no research use at all, so a deposit answer
  -- has nothing to apply to.
  v_repository := CASE WHEN v_scope = 'research' THEN p_repository_consent END;

  SELECT * INTO v_enrollment
  FROM public.study_enrollments
  WHERE profile_id = v_profile AND study_id = p_study_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_consent: no enrollment found for this study';
  END IF;

  IF v_enrollment.consent_date IS NULL THEN
    UPDATE public.study_enrollments
    SET consent_date       = now(),
        consent_scope      = v_scope,
        repository_consent = v_repository
    WHERE id = v_enrollment.id
    RETURNING consent_date, consent_scope, repository_consent
      INTO v_enrollment.consent_date, v_enrollment.consent_scope, v_enrollment.repository_consent;
  END IF;

  RETURN jsonb_build_object(
    'consent_date',       v_enrollment.consent_date,
    'consent_scope',      v_enrollment.consent_scope,
    'repository_consent', v_enrollment.repository_consent
  );
END;
$$;

-- Exactly the grants the two-argument function held live (proacl on 2026-10-08:
-- PUBLIC, anon, authenticated, service_role). auth.uid() is the real gate.
GRANT EXECUTE ON FUNCTION public.record_consent(uuid, text, boolean) TO PUBLIC, anon, authenticated, service_role;
