-- Staff-granted screener retake.
--
-- WHY. Students who were screened out write in saying they answered without
-- reading -- the Zerin study screened out 46 of 71 sign-ups in its first days.
-- There was no way back in: SessionEntry blocks anyone whose latest screening
-- attempt failed, and their session link has long expired, so the recruitment
-- link lands on "this study is not the right fit for you at this time".
--
-- Norm's call (2026-09-15): the team may grant a retake to anyone, at its
-- discretion. This is deliberately NOT self-serve -- a student asks, a person
-- decides -- because the outcome screens name the criterion they missed ("you
-- appear to be coping well", "a particularly difficult time"), so a second
-- attempt is never an independent measurement, and course credit rides on the
-- result. The admin UI warns when the person was screened out for one of the
-- two safety reasons (PHQ-8 above 9, or saying participation could cause them
-- excessive distress), which is a protection the REB approved rather than a
-- mis-click; it does not refuse, per Norm.
--
-- The grant is a TIMESTAMP, not a boolean: SessionEntry re-opens the screener
-- only while the grant is NEWER than the participant's latest attempt, so one
-- grant buys exactly one attempt and the gate closes again behind it.
-- Attempts are already append-only (20260911_screener_results_append_only.sql),
-- so both the original and the retake are kept and the export gives the second
-- its own `_r2` columns -- a retaken participant is always visible in analysis.

ALTER TABLE public.study_enrollments
  ADD COLUMN IF NOT EXISTS screener_retake_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS screener_retake_granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.study_enrollments.screener_retake_granted_at IS
  'When staff last granted this participant another screening attempt. SessionEntry re-opens the screener only while this is newer than their latest screener_results row, so one grant = one attempt.';
COMMENT ON COLUMN public.study_enrollments.screener_retake_granted_by IS
  'Lab member who granted the retake.';

-- Grant a retake and hand back a usable link.
--
-- Re-opening the gate alone is not enough: these participants hold no live
-- link, and auto-enroll refuses to mint one for an existing enrollment whose
-- schedule is already materialised ("a new link will be sent when your next
-- session is due"). So this also reopens their entry row and issues a fresh
-- link, mirroring _shared/issueLink.ts -- including closing any other live link
-- for the same participant in the same study, which is the one-live-link rule
-- the scheduler depends on. The token comes back so the RA can send it.
CREATE OR REPLACE FUNCTION public.grant_screener_retake(p_enrollment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile   uuid;
  v_study     uuid;
  v_status    text;
  v_attempt   timestamptz;
  v_passed    boolean;
  v_row       uuid;
  v_hours     int;
  v_token     text;
  v_expires   timestamptz;
  v_link      uuid;
BEGIN
  IF NOT (public.my_role() = 'lab' OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'forbidden: lab only';
  END IF;

  SELECT profile_id, study_id, status INTO v_profile, v_study, v_status
    FROM study_enrollments WHERE id = p_enrollment_id;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'no such enrollment';
  END IF;
  IF v_status = 'withdrawn' THEN
    RAISE EXCEPTION 'participant has withdrawn -- re-enrol them rather than granting a retake';
  END IF;

  SELECT sr.screened_at, (sr.phase1_passed AND COALESCE(sr.phase2_passed, false))
    INTO v_attempt, v_passed
    FROM screener_results sr
   WHERE sr.participant_id = v_profile AND sr.study_id = v_study
   ORDER BY sr.screened_at DESC LIMIT 1;

  IF v_attempt IS NULL THEN
    RAISE EXCEPTION 'this participant has not been screened yet -- nothing to retake';
  END IF;
  IF v_passed THEN
    RAISE EXCEPTION 'this participant already passed screening';
  END IF;

  UPDATE study_enrollments
     SET screener_retake_granted_at = now(),
         screener_retake_granted_by = auth.uid()
   WHERE id = p_enrollment_id;

  -- Their entry session: earliest row, and the one the screener gates.
  SELECT ps.id, COALESCE(st.link_expires_hours, 72) INTO v_row, v_hours
    FROM participant_schedule ps
    JOIN study_sessions st ON st.id = ps.study_session_id
   WHERE ps.participant_id = v_profile AND ps.study_id = v_study AND ps.completed_at IS NULL
   ORDER BY ps.scheduled_date NULLS LAST, ps.send_time NULLS LAST
   LIMIT 1;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'no open session row for this participant -- nothing to re-open';
  END IF;

  UPDATE participant_schedule SET status = 'unlocked' WHERE id = v_row;

  UPDATE participant_links
     SET status = 'expired', ended_reason = 'superseded', ended_at = now()
   WHERE participant_id = v_profile AND study_id = v_study AND status = 'active';

  INSERT INTO participant_links (schedule_id, participant_id, study_id, status, expires_at)
  VALUES (v_row, v_profile, v_study, 'active', now() + make_interval(hours => v_hours))
  RETURNING id, token, expires_at INTO v_link, v_token, v_expires;

  UPDATE participant_schedule SET link_id = v_link WHERE id = v_row;

  RETURN jsonb_build_object('token', v_token, 'expires_at', v_expires, 'schedule_id', v_row);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_screener_retake(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.grant_screener_retake(uuid) TO authenticated;
