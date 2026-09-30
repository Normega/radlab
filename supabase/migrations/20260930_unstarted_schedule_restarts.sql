-- A participant who never started is never scored, and restarts at day 1.
--
-- WHY. Six Liliana Study 3 screen-outs were withdrawn between 2026-09-26 and
-- 09-28 as "Adherence check failed: completed 0/12 daily sessions in phase1".
-- None had consented; all had been screened out. A screen-out's rows are all
-- 'blocked' (20260924_screen_out_stops_schedule), so when they re-opened their
-- SONA link auto-enroll re-walked the graph, found nothing upstream actionable,
-- reached the Phase 1 adherence_check with 0 completed, and withdrew them. The
-- 2026-09-21 fix (20260921_reinstate_unstarted_withdrawals) guarded the
-- missed-GATE rule against never-started participants but not the adherence
-- rule. materializeSchedule now applies the same guard there (same commit).
-- No termination email reached anyone: none had given an address.
--
-- The withdrawal mattered anyway: it records a screen-out as study attrition,
-- and grant_screener_retake refuses a withdrawn enrollment.
--
-- DAY NUMBERS. A schedule is materialized in full at SONA arrival, anchored to
-- that day. Someone who never starts keeps that calendar: return a week later
-- (or be granted a retake) and they re-enter mid-Phase-1, with the days they
-- never had counted as missed. Norm, 2026-09-30: a participant who has not
-- consented restarts at day 1. restart_unstarted_schedule() shifts every
-- uncompleted row by the same number of days so the first lands on today --
-- study_day and the protocol order are unchanged, only dates move -- and
-- returns lapsed rows ('missed', 'link_sent', 'unlocked') to 'pending'. It does
-- nothing for anyone who has consented or completed a session. 'blocked' rows
-- stay blocked, and a screened-out participant's open rows become 'blocked':
-- re-dating a screen-out never makes them emailable or lets them screen again;
-- grant_screener_retake unblocks them first.
--
-- Callers: auto-enroll's late-starter path (a never-started participant
-- returning through SONA) and grant_screener_retake.

CREATE OR REPLACE FUNCTION public.restart_unstarted_schedule(p_participant uuid, p_study uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_first date;
  v_delta integer;
  v_screened_out boolean;
  n       integer;
BEGIN
  IF EXISTS (SELECT 1 FROM study_enrollments
              WHERE profile_id = p_participant AND study_id = p_study
                AND consent_date IS NOT NULL) THEN
    RETURN 0;
  END IF;
  IF EXISTS (SELECT 1 FROM participant_schedule
              WHERE participant_id = p_participant AND study_id = p_study
                AND (status = 'completed' OR completed_at IS NOT NULL)) THEN
    RETURN 0;
  END IF;

  SELECT min(scheduled_date) INTO v_first
    FROM participant_schedule
   WHERE participant_id = p_participant AND study_id = p_study;
  IF v_first IS NULL OR v_first >= v_today THEN
    RETURN 0;
  END IF;
  v_delta := v_today - v_first;

  -- Screened out (latest real attempt failed, no retake granted since): lapsed
  -- rows become 'blocked', never 'pending', or the scheduler would start
  -- sending sessions to someone the screener turned away. grant_screener_retake
  -- stamps its grant before calling this, so a retake reads as not screened out.
  SELECT EXISTS (
    SELECT 1
      FROM (SELECT phase1_passed, phase2_passed, screened_at
              FROM screener_results
             WHERE participant_id = p_participant AND study_id = p_study
               AND resubmission_of IS NULL
             ORDER BY screened_at DESC LIMIT 1) l
      JOIN study_enrollments e ON e.profile_id = p_participant AND e.study_id = p_study
     WHERE (l.phase1_passed = false OR l.phase2_passed = false)
       AND (e.screener_retake_granted_at IS NULL OR e.screener_retake_granted_at < l.screened_at)
  ) INTO v_screened_out;

  UPDATE participant_schedule
     SET scheduled_date       = scheduled_date + v_delta,
         status               = CASE
                                  WHEN status IN ('missed', 'link_sent', 'unlocked', 'pending') AND v_screened_out THEN 'blocked'
                                  WHEN status IN ('missed', 'link_sent', 'unlocked') THEN 'pending'
                                  ELSE status
                                END,
         attempts             = 0,
         last_sent_at         = NULL,
         final_notice_sent_at = NULL,
         link_id              = NULL
   WHERE participant_id = p_participant AND study_id = p_study
     AND completed_at IS NULL
     AND scheduled_date IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Links point at the old calendar. The caller issues a fresh one.
  UPDATE participant_links
     SET status = 'expired', ended_reason = 'superseded', ended_at = now()
   WHERE participant_id = p_participant AND study_id = p_study AND status = 'active';

  RETURN n;
END;
$$;

-- Server-side only (auto-enroll runs as service role; grant_screener_retake is
-- SECURITY DEFINER). A participant able to call it could move their own dates.
REVOKE EXECUTE ON FUNCTION public.restart_unstarted_schedule(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.restart_unstarted_schedule(uuid, uuid) TO service_role;

-- grant_screener_retake: unchanged from 20260924_screen_out_stops_schedule.sql
-- except the marked block. A screen-out has not consented, so a retake now
-- restarts them at day 1 instead of re-opening only today-and-later rows (which
-- dropped them into the middle of Phase 1 with the earlier days blocked).
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
  v_consent   timestamptz;
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

  SELECT profile_id, study_id, status, consent_date INTO v_profile, v_study, v_status, v_consent
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

  -- ── 20260930: a participant who has not started restarts at day 1 ─────────
  IF v_consent IS NULL AND NOT EXISTS (
       SELECT 1 FROM participant_schedule
        WHERE participant_id = v_profile AND study_id = v_study AND completed_at IS NOT NULL) THEN
    UPDATE participant_schedule
       SET status = 'pending'
     WHERE participant_id = v_profile AND study_id = v_study
       AND status = 'blocked' AND completed_at IS NULL;
    PERFORM public.restart_unstarted_schedule(v_profile, v_study);
  ELSE
    -- 20260924 behaviour: re-open today and later only; past-dated rows stay
    -- blocked rather than going out as a backlog.
    UPDATE participant_schedule
       SET status = 'pending'
     WHERE participant_id = v_profile AND study_id = v_study
       AND status = 'blocked' AND completed_at IS NULL
       AND scheduled_date >= (now() AT TIME ZONE 'America/Toronto')::date;
  END IF;
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

-- ── One-time: reinstate the six (Norm, 2026-09-30) ────────────────────────────
-- Liliana Study 3, withdrawn by the adherence rule, never consented, nothing
-- completed. Back to 'enrolled' (where a screen-out normally sits), original
-- withdrawal kept in notes, and their calendars restarted so a later retake or
-- return begins at day 1. Their rows stay 'blocked': they still cannot be
-- emailed or re-screen without a staff-granted retake. Asserts the count;
-- re-running is a no-op.
DO $$
DECLARE
  v_study constant uuid := '958150a9-7821-4daf-8d83-e9325369d91d';
  v_n int;
  r record;
BEGIN
  SELECT count(*) INTO v_n
    FROM study_enrollments e
   WHERE e.study_id = v_study AND e.status = 'withdrawn' AND NOT coalesce(e.is_test, false)
     AND e.consent_date IS NULL
     AND e.withdrawal_reason LIKE 'Adherence check failed: completed 0/%'
     AND NOT EXISTS (SELECT 1 FROM participant_schedule ps
                      WHERE ps.participant_id = e.profile_id AND ps.study_id = e.study_id
                        AND ps.completed_at IS NOT NULL);

  IF v_n = 0 THEN
    RAISE NOTICE 'reinstate unstarted adherence withdrawals: nothing to do (already applied)';
    RETURN;
  END IF;
  IF v_n <> 6 THEN
    RAISE EXCEPTION 'reinstate unstarted adherence withdrawals: expected 6, found % -- inspect before proceeding', v_n;
  END IF;

  FOR r IN
    SELECT e.id, e.profile_id
      FROM study_enrollments e
     WHERE e.study_id = v_study AND e.status = 'withdrawn' AND NOT coalesce(e.is_test, false)
       AND e.consent_date IS NULL
       AND e.withdrawal_reason LIKE 'Adherence check failed: completed 0/%'
       AND NOT EXISTS (SELECT 1 FROM participant_schedule ps
                        WHERE ps.participant_id = e.profile_id AND ps.study_id = e.study_id
                          AND ps.completed_at IS NOT NULL)
  LOOP
    UPDATE study_enrollments e
       SET status = 'enrolled',
           notes = concat_ws(E'\n', e.notes,
             'Auto-withdrawn ' || to_char(e.withdrawn_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD HH24:MI')
             || ' ("' || e.withdrawal_reason || '") having never consented or completed a session. '
             || 'Reinstated 2026-09-30: the adherence rule now applies only to participants who have started. '
             || 'Schedule restarted to begin 2026-09-30. Screened out, so cannot re-screen without a staff-granted retake.'),
           withdrawal_reason = NULL,
           withdrawn_at = NULL
     WHERE e.id = r.id;

    PERFORM public.restart_unstarted_schedule(r.profile_id, v_study);
  END LOOP;

  RAISE NOTICE 'reinstate unstarted adherence withdrawals: % reinstated', v_n;
END $$;
