-- Link every questionnaire response to the session that collected it.
--
-- `questionnaire_responses.session_id` is null on every row in the database —
-- it was never populated, because `QuestionnaireStepWrapper` was never passed a
-- schedule id. So nothing recorded WHEN a response was collected, only when it
-- was submitted, and the export had to *infer* the timepoint: the nth response
-- to instrument X was assumed to be the nth session in the protocol that
-- administers X.
--
-- That inference is sound only while a participant's responses arrive in
-- protocol order and exactly once. Both assumptions have already broken in the
-- live test:
--   * a double-submitted BFI-2-S shifted every later label for that participant
--     (fixed at source by 20260818_questionnaire_submit_guard.sql, but the
--     inference stays fragile by construction);
--   * the screener administers GAD-7 and PHQ-8 *before any session exists*, so
--     the design list had to be special-cased to prepend it — and until it was,
--     a participant who never sat a final assessment exported `gad7_final_*`
--     values anyway.
--
-- This replaces derivation with a recorded fact. `schedule_id` mirrors what
-- `vas_responses` has carried since WP-L1, which is why VAS could be named by
-- real study day while questionnaires could not.
--
-- Screener responses keep `schedule_id` null and that is CORRECT, not missing:
-- the screener runs at intake, pre-consent, and is not a scheduled session.
-- Null therefore means "collected outside the schedule", which the export reads
-- as the screener when the slug is one the study screens on.

ALTER TABLE questionnaire_responses
  ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES participant_schedule(id) ON DELETE SET NULL;

-- ON DELETE SET NULL, not CASCADE: deleting a schedule row must never delete a
-- participant's collected answers. The same trap was caught on
-- vas_responses.schedule_id during WP-L3 (it lacked ON DELETE entirely and
-- would have blocked the study-delete cascade).

CREATE INDEX IF NOT EXISTS questionnaire_responses_schedule_idx
  ON questionnaire_responses (schedule_id);

CREATE INDEX IF NOT EXISTS questionnaire_responses_user_slug_idx
  ON questionnaire_responses (user_id, questionnaire_slug);

-- ── Backfill ─────────────────────────────────────────────────────────────────
--
-- Existing rows can be attributed with reasonable confidence, because a
-- response is written DURING a session and the session's own completed_at is
-- stamped when its last step finishes. So the owning session is the nearest
-- schedule row that (a) belongs to this participant, (b) runs a template
-- containing this very questionnaire, and (c) completed at or after the
-- response, within a session-length window.
--
-- Deliberately conservative: a candidate must satisfy all three. Anything that
-- does not match is left null rather than guessed — a wrong link is worse than
-- an absent one, since the export trusts this column over its own inference.

WITH candidate AS (
  SELECT DISTINCT
         qr.id AS response_id,
         ps.id AS schedule_id,
         ps.completed_at - qr.completed_at AS gap
    FROM questionnaire_responses qr
    JOIN participant_schedule ps
      ON ps.participant_id = qr.user_id
     AND ps.completed_at IS NOT NULL
     AND ps.completed_at >= qr.completed_at
     AND ps.completed_at <= qr.completed_at + interval '6 hours'
    JOIN study_sessions ss           ON ss.id  = ps.study_session_id
    JOIN session_template_nodes stn  ON stn.session_template_id = ss.session_template_id
    JOIN questionnaires q            ON q.id   = stn.questionnaire_id
                                    AND q.slug = qr.questionnaire_slug
   WHERE qr.schedule_id IS NULL
),
best AS (
  SELECT DISTINCT ON (response_id) response_id, schedule_id
    FROM candidate
   ORDER BY response_id, gap ASC
)
UPDATE questionnaire_responses qr
   SET schedule_id = best.schedule_id
  FROM best
 WHERE qr.id = best.response_id;
