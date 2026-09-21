-- Reinstate Zerin participants withdrawn for "missing" a baseline they never began.
--
-- The missed-gate rule in materializeSchedule (2026-07-15) withdraws a
-- participant when the session gating a randomisation fork expires unfinished.
-- It was written for Liliana's midpoint. In the Zerin study the BASELINE gates
-- the randomisation, so every student who signed up and did not start within the
-- baseline's 72 h link was withdrawn -- at the moment they came back through the
-- SONA link, since auto-enroll re-walks the graph -- and shown "your participation
-- in this study has ended".
--
-- Eight were, between 2026-09-18 and 2026-09-21. One (SONA 19930) had never
-- answered a question and emailed the study team; he was reinstated by hand on
-- 2026-09-21 with a fresh baseline link. The other seven had all been screened
-- out earlier, so their withdrawal changed little except that it made them
-- ineligible for a staff-granted retake (grant_screener_retake refuses withdrawn
-- enrollments). Norm, 2026-09-21: reinstate them to 'enrolled' -- which is where
-- a screened-out participant normally sits -- but they must NOT be able to screen
-- again without a manual reset. That holds without further work: SessionEntry
-- reads their latest failed screener attempt and blocks unless staff have granted
-- a retake; reinstatement does not touch screener_results or the grant.
--
-- The rule itself is fixed in the same commit (a missed gate withdraws only
-- someone who has completed a session), and deployed before this runs, so a
-- reinstated participant who re-clicks the SONA link cannot be withdrawn again.
--
-- No termination email reached any of them: none had given an address, and
-- resolveParticipantEmail resolves per study, so there was nowhere to send it.
--
-- Scoped to the Zerin study, to withdrawals with exactly this reason, and to
-- participants with no completed session. Asserts the count before writing and
-- keeps the original withdrawal time in the enrollment notes. Re-running is a
-- no-op.

DO $$
DECLARE
  v_study constant uuid := '6d3c38ce-d1da-42ea-9bb4-c9450054065f';
  v_n int;
BEGIN
  SELECT count(*) INTO v_n
    FROM study_enrollments e
   WHERE e.study_id = v_study AND e.status = 'withdrawn' AND NOT e.is_test
     AND e.withdrawal_reason LIKE 'Assessment window missed%'
     AND NOT EXISTS (SELECT 1 FROM participant_schedule ps
                      WHERE ps.participant_id = e.profile_id AND ps.study_id = e.study_id
                        AND ps.status = 'completed');

  IF v_n = 0 THEN
    RAISE NOTICE 'reinstate unstarted withdrawals: nothing to do (already applied)';
    RETURN;
  END IF;
  IF v_n <> 7 THEN
    RAISE EXCEPTION 'reinstate unstarted withdrawals: expected 7, found % -- inspect before proceeding', v_n;
  END IF;

  UPDATE study_enrollments e
     SET status = 'enrolled',
         notes = concat_ws(E'\n', e.notes,
           'Auto-withdrawn ' || to_char(e.withdrawn_at AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD HH24:MI')
           || ' ("' || e.withdrawal_reason || '") having never completed a session. Reinstated 2026-09-21: '
           || 'the missed-gate rule now applies only to participants who have started. Screened out, so '
           || 'cannot re-screen without a staff-granted retake.'),
         withdrawal_reason = NULL,
         withdrawn_at = NULL
   WHERE e.study_id = v_study AND e.status = 'withdrawn' AND NOT e.is_test
     AND e.withdrawal_reason LIKE 'Assessment window missed%'
     AND NOT EXISTS (SELECT 1 FROM participant_schedule ps
                      WHERE ps.participant_id = e.profile_id AND ps.study_id = e.study_id
                        AND ps.status = 'completed');

  RAISE NOTICE 'reinstate unstarted withdrawals: % reinstated', v_n;
END $$;
