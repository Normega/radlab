-- One participant_schedule row per graph session slot.
--
-- WHY. materializeSchedule reads which nodes are already materialized, then
-- inserts the rest. Two walks for the same participant at once both read
-- "nothing yet" and both insert. Found 2026-09-24 20:34 UTC: one Liliana
-- Study 3 participant's SONA join link loaded twice, 0.4 s apart; both
-- auto-enroll calls inserted the same 13 sessions (80 ms apart), then both
-- failed looking up "the" unlocked row and found two, so the participant saw
-- an error and retried. They were later screened out, so the 26 rows are all
-- 'blocked' and nothing was sent twice -- had they passed, every session
-- would have been emailed twice and exported twice.
--
-- WHY PARTIAL. A plain unique index on (participant, session, date, time) is
-- not safe: the legacy single-session paths (auto-enroll 6b, study-signup-
-- verify 6b) legitimately insert a second row for the same session on the
-- same day when a participant re-enters after their link died. Those paths
-- never set study_day; only the graph walk does (all 454 non-graph rows have
-- it null, and 12,830 of 12,831 graph rows have it set -- the exception is a
-- completed Live Test row from 2026-08-12). So the index covers exactly the
-- rows the graph walk writes. No participant has one graph session on two
-- different dates, so restart_unstarted_schedule's uniform date shift cannot
-- collide with it either.
--
-- The losing walk's insert now fails with 23505 on this index, and
-- materializeSchedule returns it as a re-entry (inserted 0, concurrentWalk)
-- instead of an error -- see isConcurrentWalkConflict.

-- 1. The 13 second copies from 2026-09-24. Checked before writing this: all
--    'blocked', never sent, no link_id, no participant_links, and no rows in
--    any table referencing participant_schedule (questionnaire, vas,
--    instrument, demographics, liliana_demographics, equity_census,
--    session_diagnostics, experience_factory_*, participant_step_timings).
--    The guards repeat that, and the block refuses to run if anything changed.
DO $$
DECLARE
  ids uuid[] := ARRAY[
    '04570f63-598f-47a8-898e-a48937198144', '0a302ded-6b9c-4346-b108-314c2487dd03',
    '1007b1b7-58b3-4623-9c3c-fae9201b4e6e', '10165f07-31ad-4370-8321-bb50de757afb',
    '1566da1a-0f18-49fe-9c1f-55d496c4d55b', '1ab8b8ea-8657-4659-907e-4873a2e62897',
    '416fbbd9-7166-4392-ace6-13c78285b391', '55349e28-9c54-4597-ba97-be8012661d5d',
    '596efc06-162e-4c6c-8b5c-66dde5d12813', 'a913868b-b1d6-496e-ba10-9cc4f5ff5db0',
    'af0f6831-bcc3-49d7-bd0a-f991784608d7', 'c1131a93-98d2-4ca3-a48e-b75d7696a82c',
    'e4f852c7-5f86-405d-bff8-140a54616733'
  ]::uuid[];
  n integer;
BEGIN
  DELETE FROM participant_schedule ps
   WHERE ps.id = ANY(ids)
     AND ps.status = 'blocked'
     AND ps.link_id IS NULL
     AND ps.completed_at IS NULL
     AND ps.last_sent_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM participant_links x WHERE x.schedule_id = ps.id)
     AND NOT EXISTS (SELECT 1 FROM questionnaire_responses x WHERE x.schedule_id = ps.id)
     AND NOT EXISTS (SELECT 1 FROM vas_responses x WHERE x.schedule_id = ps.id)
     AND NOT EXISTS (SELECT 1 FROM instrument_responses x WHERE x.schedule_id = ps.id)
     AND NOT EXISTS (SELECT 1 FROM participant_step_timings x WHERE x.participant_schedule_id = ps.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> array_length(ids, 1) THEN
    RAISE EXCEPTION 'expected to remove % duplicate rows, removed % -- something changed; not applying', array_length(ids, 1), n;
  END IF;
END $$;

-- 2. The rule.
CREATE UNIQUE INDEX participant_schedule_one_graph_row_per_slot
  ON public.participant_schedule (participant_id, study_session_id, scheduled_date, send_time)
  WHERE study_day IS NOT NULL;
