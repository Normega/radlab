-- Liliana Study 3: put existing participants on the baseline hold.
-- Apply AFTER 20261007_hard_gates.sql and AFTER check_schedule / send_message /
-- auto-enroll / open-join / materialize_participant_schedule are redeployed
-- with hold support -- the old scheduler would mark the re-armed rows missed
-- again and the old advance pass would not know to wait.
--
-- Norm's decisions (2026-10-07):
--   1. Participants already doing Phase 1 without a baseline keep going, and are
--      sent the baseline now with an apology ("we didn't get your baseline data
--      yet, we need this to complete the study"); include/exclude is a
--      sensitivity analysis. They are marked resend_note = 'baseline_catchup',
--      the recorded exception to the gate_incomplete hard gate.
--   2. Everyone else who has not completed baseline starts over on the hold:
--      nothing after baseline is scheduled until it is done, and baseline is
--      re-sent daily until it is completed or they withdraw.
--
-- Only the two real arms; the Live Test study is left alone.

-- ─── 1. Catch-up: already in Phase 1 without a baseline ──────────────────────
-- "Already in Phase 1" = completed any later session, or left data in one
-- (two of them had only opened a practice and stopped part-way). 27 when
-- applied.
WITH base AS (
  SELECT ps.id, ps.participant_id, ps.study_id
    FROM participant_schedule ps
    JOIN study_sessions ss ON ss.id = ps.study_session_id
    JOIN study_enrollments e ON e.study_id = ps.study_id AND e.profile_id = ps.participant_id
   WHERE ps.study_id IN ('958150a9-7821-4daf-8d83-e9325369d91d', 'ee542d3b-c0da-4a5f-ac34-6b981f153298')
     AND ss.node_key = 's_baseline'
     AND ps.status <> 'completed'
     AND e.status <> 'withdrawn'
),
started AS (
  SELECT b.* FROM base b
   WHERE EXISTS (
     SELECT 1 FROM participant_schedule o
      WHERE o.participant_id = b.participant_id AND o.study_id = b.study_id AND o.id <> b.id
        AND (o.status = 'completed'
             OR EXISTS (SELECT 1 FROM participant_step_timings t WHERE t.participant_schedule_id = o.id)
             OR EXISTS (SELECT 1 FROM vas_responses v WHERE v.schedule_id = o.id)
             OR EXISTS (SELECT 1 FROM questionnaire_responses q WHERE q.schedule_id = o.id)))
)
UPDATE participant_schedule ps
   SET status = 'link_sent',          -- dead link + past date: check_schedule 0b/0e re-sends it next tick
       attempts = 0,
       last_sent_at = NULL,
       final_notice_sent_at = NULL,
       resend_note = 'baseline_catchup'
  FROM started s
 WHERE ps.id = s.id;

-- ─── 2. Not started: back to the hold ────────────────────────────────────────
-- Participants with nothing completed and no data anywhere past baseline.
-- Their Phase 1 rows were scheduled before the hold existed; delete them (no
-- collected answer references them -- checked in the WHERE) so the walk
-- re-creates Phase 1 the day after baseline is completed. Links cascade.
WITH reset AS (
  SELECT e.study_id, e.profile_id
    FROM study_enrollments e
   WHERE e.study_id IN ('958150a9-7821-4daf-8d83-e9325369d91d', 'ee542d3b-c0da-4a5f-ac34-6b981f153298')
     AND e.status <> 'withdrawn'
     AND NOT EXISTS (SELECT 1 FROM participant_schedule c
                      WHERE c.study_id = e.study_id AND c.participant_id = e.profile_id
                        AND (c.status = 'completed' OR c.resend_note IS NOT NULL))
)
DELETE FROM participant_schedule ps
 USING reset r, study_sessions ss
 WHERE ps.study_id = r.study_id AND ps.participant_id = r.profile_id
   AND ss.id = ps.study_session_id AND ss.node_key <> 's_baseline'
   AND ps.status <> 'completed'
   AND NOT EXISTS (SELECT 1 FROM participant_step_timings t WHERE t.participant_schedule_id = ps.id)
   AND NOT EXISTS (SELECT 1 FROM questionnaire_responses q WHERE q.schedule_id = ps.id)
   AND NOT EXISTS (SELECT 1 FROM vas_responses v WHERE v.schedule_id = ps.id)
   AND NOT EXISTS (SELECT 1 FROM instrument_responses i WHERE i.schedule_id = ps.id)
   AND NOT EXISTS (SELECT 1 FROM demographics d WHERE d.schedule_id = ps.id)
   AND NOT EXISTS (SELECT 1 FROM liliana_demographics d WHERE d.schedule_id = ps.id)
   AND NOT EXISTS (SELECT 1 FROM student_demographics d WHERE d.schedule_id = ps.id)
   AND NOT EXISTS (SELECT 1 FROM equity_census_responses d WHERE d.schedule_id = ps.id)
   AND NOT EXISTS (SELECT 1 FROM session_diagnostics d WHERE d.schedule_id = ps.id);

-- Their baseline, where it lapsed as 'missed', is re-armed for the daily
-- re-send. send_message's hard gates then decide: screened out, no deliverable
-- address, or (paid arm) enrollment full -> suppressed and blocked; everyone
-- else gets one baseline email a day. 'blocked' rows (already suppressed) and
-- 'unlocked' rows (a live entry link; 0e takes them when it lapses) are left.
UPDATE participant_schedule ps
   SET status = 'link_sent',
       attempts = 0,
       last_sent_at = NULL,
       final_notice_sent_at = NULL
  FROM study_sessions ss, study_enrollments e
 WHERE ss.id = ps.study_session_id AND ss.node_key = 's_baseline'
   AND e.study_id = ps.study_id AND e.profile_id = ps.participant_id
   AND ps.study_id IN ('958150a9-7821-4daf-8d83-e9325369d91d', 'ee542d3b-c0da-4a5f-ac34-6b981f153298')
   AND ps.status = 'missed'
   AND ps.resend_note IS NULL
   AND e.status <> 'withdrawn'
   AND NOT EXISTS (SELECT 1 FROM participant_schedule c
                    WHERE c.study_id = ps.study_id AND c.participant_id = ps.participant_id
                      AND c.status = 'completed');
