-- Mark complete five open entry sessions whose participants finished them but
-- were never recorded as finished.
--
-- Norm's decision, 2026-10-22 ("yes please complete for the student and anyone
-- else stuck"), after a PSY240 class-trial student reported a daily "you
-- haven't completed your baseline" email for a baseline they had finished.
--
-- Two causes, both leaving every answer saved and only the completion mark
-- missing:
--
-- 1. Finish pressed on a link that had expired in the open tab (three rows).
--    A tab keeps running after its link times out or is superseded, saving
--    answers as normal, but complete_session_by_token finds no active or used
--    link for the token and returns {next_contact: null, has_more: null}
--    without an error, so SessionEntry shows the completion card. The PSY240
--    student opened the baseline on Oct 14, left the tab open, and pressed
--    Finish on the support screen on Oct 17, two days after that link
--    expired. Platform-wide, step timings show nine sessions finished this
--    way since August; the six that were dailies are already 'missed' and are
--    not touched here. These three are entry sessions, still open, so each
--    participant has had a re-send email every day since and nothing after
--    the baseline was scheduled (for the Liliana Study 3 row, a baseline
--    catch-up participant who finished Phase 1 and the midpoint, the open
--    baseline kept check_schedule's advance pass from reaching the Phase 2
--    fork).
--
-- 2. UTMAP baselines answered in full on the pre-fix client (two rows),
--    12:49 and 12:52 ET today, minutes after 207368cb and
--    20261022_utmap_completion_backfill.sql: the same Done-button case that
--    backfill completed, on tabs loaded before the client fix deployed.
--
-- Criterion, recorded facts only. Each row is non-test, enrolled, consented,
-- open (not completed or missed), and schedule_row_block_reason() returns
-- NULL for it. For cause 1, participant_step_timings records an exit from the
-- session's last step, which SessionEntry writes only when that step's button
-- is pressed; completed_at is that first exit. For cause 2, completed_at is
-- the utmap-results-optin response's received_at, as in the UTMAP backfill.
--
-- Mirrors complete_session_by_token: the schedule row is completed and its
-- active link marked used. No trigger fires on either table and nothing is
-- emailed here. check_schedule's next tick stops the daily re-sends and its
-- advance pass materializes what follows, never dated before today
-- (materializeSchedule: start = max(gate + 1, today)).
--
-- Idempotent: rows already completed are left alone.

DO $$
DECLARE
  v_rows  integer;
  v_links integer;
BEGIN
  CREATE TEMP TABLE lost_done ON COMMIT DROP AS
  WITH picked(schedule_id, cause) AS (VALUES
    ('aecd6243-565d-4e43-bc55-7ed60d51e367'::uuid, 'expired_link'),  -- PSY240 class trial, baseline
    ('8aacfc82-78e2-4cf2-9d59-6dd41257e42f'::uuid, 'expired_link'),  -- Liliana Study 3 — Paid, baseline
    ('0b5a4f4f-6146-418a-b36a-f128128ae810'::uuid, 'expired_link'),  -- Liliana Study 3, baseline (catch-up)
    ('6e2d1d2f-cde0-435b-9c6f-8fd67caf1a39'::uuid, 'utmap_optin'),   -- UTMAP 2026, baseline
    ('c5b8b757-040d-4d57-b9d9-b07937fae6cd'::uuid, 'utmap_optin')    -- UTMAP 2026, baseline
  )
  SELECT p.schedule_id,
         CASE p.cause
           WHEN 'expired_link' THEN (
             SELECT min(t.exited_at)
               FROM participant_step_timings t
               JOIN study_sessions ss ON ss.id = ps.study_session_id
              WHERE t.participant_schedule_id = ps.id
                AND t.step_index = (SELECT count(*) - 1 FROM session_template_nodes n
                                     WHERE n.session_template_id = ss.session_template_id))
           WHEN 'utmap_optin' THEN (
             SELECT min(q.received_at) FROM questionnaire_responses q
              WHERE q.schedule_id = ps.id AND q.questionnaire_slug = 'utmap-results-optin')
         END AS done_at
    FROM picked p
    JOIN participant_schedule ps ON ps.id = p.schedule_id
    JOIN study_enrollments e ON e.profile_id = ps.participant_id AND e.study_id = ps.study_id
   WHERE ps.status NOT IN ('completed', 'missed')
     AND NOT e.is_test
     AND e.status = 'enrolled'
     AND public.schedule_row_block_reason(ps.id) IS NULL;

  IF EXISTS (SELECT 1 FROM lost_done WHERE done_at IS NULL) THEN
    RAISE EXCEPTION 'lost completion backfill: a row has no recorded finish time';
  END IF;

  UPDATE participant_links l
     SET status = 'used'
    FROM lost_done d
   WHERE l.schedule_id = d.schedule_id AND l.status = 'active';
  GET DIAGNOSTICS v_links = ROW_COUNT;

  UPDATE participant_schedule ps
     SET status = 'completed', completed_at = d.done_at
    FROM lost_done d
   WHERE ps.id = d.schedule_id AND ps.status <> 'completed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RAISE NOTICE 'lost completion backfill: % sessions completed, % links marked used', v_rows, v_links;
END $$;
