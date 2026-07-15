-- record_consent — fixes ConsentPage.jsx, which has been silently broken since
-- 20260602_study_admin_redesign.sql dropped participant_consents (and its
-- singular sibling participant_consent) without updating the page that reads/
-- writes it. Found live 2026-07-15 testing the new Liliana "Live Test" study:
-- a SONA/Prolific self-enrolled participant (the one auto-enroll path that
-- never stamps study_enrollments.consent_date at enrollment time — admin-added
-- participants get it stamped immediately) hits SessionEntry.jsx's consent
-- gate, is routed to /study/:id/consent, and gets a hard Supabase error
-- ("Could not find the table 'public.participant_consents'").
--
-- The real, live record of consent is study_enrollments.consent_date (already
-- used by SessionEntry.jsx's gate and set directly by every admin-driven
-- enrollment path) — there is no separate consent-log table anymore. But
-- study_enrollments has no participant-facing UPDATE policy (only "lab all"
-- and "own read" — confirmed via pg_policies), and it carries fields a
-- participant must never self-write (status, withdrawal_reason,
-- email_unsubscribed_at, ...), so this is a narrow SECURITY DEFINER RPC
-- rather than a broad RLS UPDATE policy — same pattern as
-- ensure_liliana_participant/record_practice_decision.

CREATE OR REPLACE FUNCTION public.record_consent(p_study_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile    uuid := auth.uid();
  v_enrollment public.study_enrollments%ROWTYPE;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'record_consent: not authenticated';
  END IF;

  SELECT * INTO v_enrollment
  FROM public.study_enrollments
  WHERE profile_id = v_profile AND study_id = p_study_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_consent: no enrollment found for this study';
  END IF;

  IF v_enrollment.consent_date IS NULL THEN
    UPDATE public.study_enrollments
    SET consent_date = now()
    WHERE id = v_enrollment.id
    RETURNING consent_date INTO v_enrollment.consent_date;
  END IF;

  RETURN jsonb_build_object('consent_date', v_enrollment.consent_date);
END;
$$;
