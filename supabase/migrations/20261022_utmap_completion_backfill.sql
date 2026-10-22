-- UTMAP 2026: mark complete the baseline sessions whose participants answered
-- everything but never tapped Done on the completion-token screen.
--
-- Norm's decision, 2026-10-22 ("yes fix the done button problem").
--
-- The baseline ends on a debrief and then "Show this screen to the researcher"
-- with the day's token. SessionEntry recorded completion only when Done under
-- the token was tapped, so students showed the token, took a prize and left.
-- Of the first 44 non-test participants who answered every questionnaire
-- (2026-10-20/21), 21 were marked complete and 23 were not; step timings show
-- 20 of the 23 reached the token screen and 3 stopped on the debrief. Their
-- answers were all saved; only the completion mark was missing. The client now
-- records completion as soon as only closing steps remain (SessionEntry
-- `onlyClosingStepsFrom`, same commit as this file).
--
-- Criterion, recorded facts only: a non-test, non-withdrawn UTMAP enrollment
-- whose Baseline row has a `utmap-results-optin` response (the last step that
-- collects anything) and is not yet completed. completed_at is when that
-- response was received, which is the moment the fixed client records it.
-- Mirrors complete_session_by_token: the schedule row is completed and its
-- active link marked used. No trigger fires on either table and nothing is
-- emailed; check_schedule marks the enrollment completed on its next tick.
--
-- Idempotent: it touches only rows still incomplete, so it is safe to run again
-- if sessions from before the client fix reached production turn up later.

DO $$
DECLARE
  v_study   constant uuid := 'f5a2db89-9697-489f-9a16-dea9c64053e0';  -- UTMAP 2026
  v_session constant uuid := 'b4cb31c4-17c9-42f4-8f7d-290db2ba3d4e';  -- its Baseline
  v_rows    integer;
  v_links   integer;
BEGIN
  CREATE TEMP TABLE utmap_done ON COMMIT DROP AS
  SELECT ps.id AS schedule_id, min(q.received_at) AS done_at
    FROM participant_schedule ps
    JOIN study_enrollments e
      ON e.profile_id = ps.participant_id AND e.study_id = ps.study_id
    JOIN questionnaire_responses q
      ON q.schedule_id = ps.id AND q.questionnaire_slug = 'utmap-results-optin'
   WHERE ps.study_id = v_study
     AND ps.study_session_id = v_session
     AND ps.status <> 'completed'
     AND NOT e.is_test
     AND e.status <> 'withdrawn'
   GROUP BY ps.id;

  UPDATE participant_links l
     SET status = 'used'
    FROM utmap_done d
   WHERE l.schedule_id = d.schedule_id AND l.status = 'active';
  GET DIAGNOSTICS v_links = ROW_COUNT;

  UPDATE participant_schedule ps
     SET status = 'completed', completed_at = d.done_at
    FROM utmap_done d
   WHERE ps.id = d.schedule_id AND ps.status <> 'completed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RAISE NOTICE 'UTMAP completion backfill: % sessions completed, % links marked used', v_rows, v_links;
END $$;
