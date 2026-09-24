-- A screen-out stops the participant's schedule.
--
-- WHY. Arriving from SONA enrols the participant and materialises their whole
-- schedule BEFORE the screener runs (auto-enroll), and nothing undid that when
-- they failed it. Found 2026-09-24: Liliana Study 3 had 20 screened-out
-- participants still 'enrolled' with 186 open session rows between them. The
-- scheduler tried to email every one of those rows every day; each send failed
-- ("No recipient email found for participant": the contact-email gate comes
-- after the screener, so they never gave one) and, until send_message was fixed
-- the same day, the row was left 'link_sent' and later marked 'missed'. Nobody
-- was harmed only because nobody could be reached. Zerin had 127 of the same
-- (36 open rows). Across studies no session email has reached a screen-out,
-- but that was luck, not design.
--
-- WHAT. When a failing screener attempt is recorded, the participant's open
-- rows in that study (not completed; pending / link_sent / unlocked) become
-- 'blocked': the scheduler's terminal "never offered" state. check_schedule
-- never sends, reminds, or marks-missed a blocked row, and send_message's
-- adherence scoring excludes blocked rows, so a screen-out can never be
-- scored down or withdrawn for sessions it was never meant to have.
--
-- DELIBERATELY NOT DONE:
--   * The enrollment is NOT set to 'withdrawn'. grant_screener_retake refuses a
--     withdrawn enrollment and auto-enroll turns a withdrawn one away ("Your
--     participation in this study has ended"), so withdrawing would silently
--     remove the staff retake route (20260915_screener_retake.sql). The
--     enrollment stays 'enrolled'; its latest screener_results row already says
--     it was screened out.
--   * Links are NOT revoked. A still-active entry link reloads to the "not the
--     right fit" card (SessionEntry's screener gate runs before anything reads
--     the schedule); a revoked one would say "this link is no longer valid"
--     instead, dropping the fail_high card's framing. It expires on its own.
--
-- RETAKES. grant_screener_retake now also returns the participant's blocked
-- rows dated today or later to 'pending', so someone who passes a retake gets
-- their sessions. Past-dated rows stay blocked: re-opening them would send a
-- backlog of stale sessions. A retake that fails again re-blocks via the same
-- trigger.
--
-- RESPONSE TABLE RULE (CLAUDE.md rule 5). The trigger is AFTER INSERT and
-- never touches screener_results; the row it fires on is kept as inserted. The
-- UPDATEs are on participant_schedule, in a separate function, so the trigger
-- function itself contains no UPDATE and the append-only audit stays exact.

CREATE OR REPLACE FUNCTION public.block_schedule_after_screen_out(p_participant uuid, p_study uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE participant_schedule
     SET status = 'blocked'
   WHERE participant_id = p_participant
     AND study_id = p_study
     AND completed_at IS NULL
     AND status IN ('pending', 'link_sent', 'unlocked');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Only the trigger calls this. A participant able to call it could block
-- anyone's schedule.
REVOKE EXECUTE ON FUNCTION public.block_schedule_after_screen_out(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.screen_out_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.block_schedule_after_screen_out(NEW.participant_id, NEW.study_id);
  RETURN NEW;
END;
$$;

-- A failing attempt: phase 1 failed, or phase 2 ran and failed. A phase-1-only
-- screener's pass leaves phase2_passed NULL and must not fire.
DROP TRIGGER IF EXISTS screen_out_trg ON public.screener_results;
CREATE TRIGGER screen_out_trg
  AFTER INSERT ON public.screener_results
  FOR EACH ROW
  WHEN (NEW.phase1_passed = false OR NEW.phase2_passed = false)
  EXECUTE FUNCTION public.screen_out_trg();

-- grant_screener_retake: unchanged from 20260915_screener_retake.sql except the
-- marked block, which re-opens the rows the screen-out blocked.
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

  -- ── 20260924: re-open what the screen-out blocked ──────────────────────────
  -- Today and later only; past-dated rows stay blocked rather than going out
  -- as a backlog. If the retake fails too, screen_out_trg blocks them again.
  UPDATE participant_schedule
     SET status = 'pending'
   WHERE participant_id = v_profile AND study_id = v_study
     AND status = 'blocked' AND completed_at IS NULL
     AND scheduled_date >= (now() AT TIME ZONE 'America/Toronto')::date;
  -- ───────────────────────────────────────────────────────────────────────────

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

-- ── One-time backfill: Liliana Study 3's current screen-outs (Norm, 2026-09-24)
-- Participants whose latest real attempt failed and who hold no retake grant
-- newer than it. Other studies' existing screen-outs are left for a separate
-- decision; the trigger covers everyone from here on.
SELECT public.block_schedule_after_screen_out(l.participant_id, l.study_id)
  FROM (
    SELECT DISTINCT ON (participant_id, study_id)
           participant_id, study_id, phase1_passed, phase2_passed, screened_at
      FROM screener_results
     WHERE study_id = '958150a9-7821-4daf-8d83-e9325369d91d'
       AND resubmission_of IS NULL
     ORDER BY participant_id, study_id, screened_at DESC
  ) l
  JOIN study_enrollments e ON e.profile_id = l.participant_id AND e.study_id = l.study_id
 WHERE (l.phase1_passed = false OR l.phase2_passed = false)
   AND e.status IN ('enrolled', 'in_progress')
   AND (e.screener_retake_granted_at IS NULL OR e.screener_retake_granted_at < l.screened_at);
