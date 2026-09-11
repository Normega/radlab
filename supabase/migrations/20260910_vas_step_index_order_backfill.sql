-- Place the vas_responses rows that 20260910_dedupe_by_step_index could not.
--
-- That backfill matched each rating to the step whose [entered_at - 2 s,
-- exited_at + 5 s] window contained it. But vas_responses.responded_at is stamped
-- by the participant's own device, so a participant whose clock is off by more
-- than a few seconds matches no window at all -- the client-clock problem Sandy
-- Study 3's preregistration §5.6 already describes. In Sandy Study 3 that left 20
-- participants who completed all three stress ratings with no step recorded on
-- any of them, so the export gave them `_xstep1/2/3` columns instead of
-- `_s1/_s7/_s19`, splitting one variable across two sets of columns.
--
-- Order is the recorded fact that survives a skewed clock: within one session, a
-- participant's nth rating of a scale was given at the nth step presenting that
-- scale. Applied only where that pairing is unambiguous:
--
--   * none of the group's rows is already placed, so the two methods never mix;
--   * the number of ratings equals the number of completed steps presenting that
--     scale in that session;
--   * the implied clock offset is CONSTANT across the group (max - min < 30 s).
--     A device clock that is wrong is wrong by the same amount all session, so a
--     constant offset corroborates the pairing. An inconsistent one means the
--     order match cannot be trusted, and those rows stay null.
--
-- Dry run 2026-09-10: stress 19 participants / 56 rows, task satisfaction 20 /
-- 39 rows; every group's offset constant to within 0.5 s. Offsets ranged from
-- -3,576 s (a clock an hour behind) to +505 s, median 7.5 s for stress -- far
-- outside a 5-second window, and exactly the shape a per-device skew takes.
--
-- Scoped to Sandy Study 3, the study the dry run covered. DML only; applied via
-- MCP execute_sql. Idempotent: it touches only groups with no placed row.

WITH r AS (
  SELECT v.id, v.user_id, v.schedule_id, vs.slug, v.responded_at,
         row_number() OVER (PARTITION BY v.user_id, v.schedule_id, vs.slug
                            ORDER BY v.responded_at, v.id)                        AS rn,
         count(*)            OVER (PARTITION BY v.user_id, v.schedule_id, vs.slug) AS n_rows,
         count(v.step_index) OVER (PARTITION BY v.user_id, v.schedule_id, vs.slug) AS n_placed
    FROM vas_responses v
    JOIN vas_scales vs           ON vs.id = v.scale_id
    JOIN participant_schedule ps ON ps.id = v.schedule_id
                                AND ps.study_id = 'f8cbf629-d477-4ada-ae47-23a59c602b13'
), s AS (
  SELECT t.participant_id, t.participant_schedule_id,
         substr(t.subcategory, 5) AS slug, t.step_index, t.exited_at,
         row_number() OVER (PARTITION BY t.participant_id, t.participant_schedule_id, t.subcategory
                            ORDER BY t.step_index)                                         AS rn,
         count(*)     OVER (PARTITION BY t.participant_id, t.participant_schedule_id, t.subcategory) AS n_steps
    FROM participant_step_timings t
   WHERE t.study_id = 'f8cbf629-d477-4ada-ae47-23a59c602b13'
     AND t.subcategory LIKE 'vas\_%'
     AND t.subcategory NOT LIKE 'vas\_pkg\_%'
     AND t.exited_at IS NOT NULL
), m AS (
  SELECT r.id, r.user_id, r.schedule_id, r.slug, s.step_index AS new_step,
         extract(epoch FROM (r.responded_at - s.exited_at)) AS offset_s
    FROM r
    JOIN s ON s.participant_id          = r.user_id
          AND s.participant_schedule_id = r.schedule_id
          AND s.slug                    = r.slug
          AND s.rn                      = r.rn
   WHERE r.n_placed = 0
     AND r.n_rows   = s.n_steps
), ok AS (
  SELECT user_id, schedule_id, slug
    FROM m
   GROUP BY user_id, schedule_id, slug
  HAVING max(offset_s) - min(offset_s) < 30
), upd AS (
  UPDATE vas_responses v
     SET step_index = m.new_step
    FROM m
    JOIN ok ON ok.user_id = m.user_id AND ok.schedule_id = m.schedule_id AND ok.slug = m.slug
   WHERE v.id = m.id
     AND v.step_index IS NULL
  RETURNING v.id
)
SELECT count(*) AS rows_placed FROM upd;
