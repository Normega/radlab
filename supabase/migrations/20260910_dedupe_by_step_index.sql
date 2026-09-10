-- Repeated administrations inside ONE session are not duplicates.
--
-- 20260818_questionnaire_dedupe_by_schedule.sql keyed the duplicate guard on
-- (user, instrument, session) with no time window, on the stated premise that
-- "one session collects an instrument once". That premise is false. Sandy
-- Study 3 asks the same five sliders 2-3 times inside a single session
-- (baseline -> post-Aptitude -> post-ColourMax), and every one of those shares
-- a schedule_id, so each administration was read as a double-fire of the last:
-- the trigger UPDATEd the earlier row and dropped the insert.
--
-- It went unnoticed because sliders did not record schedule_id until
-- 2026-08-25 (c881966) and so took the harmless time-window branch. That commit
-- added schedule_id -- correctly, per the CLAUDE.md provenance rule -- and in
-- doing so moved every slider into the branch that collapses. 283 participants
-- ran on 2026-08-26/27 and 1,895 of their 3,290 slider values were discarded
-- at insert time. Only the LAST administration each participant reached
-- survived. The rows are not recoverable.
--
-- The sibling table got this right on the same day: instrument_responses_dedupe
-- (20260825_composable_instruments.sql) keys on step_index precisely because
-- "a legitimate pre/post repeat of the same instrument in one session differs
-- in step_index". questionnaire_responses had no such column. This adds it,
-- backfills it from the step log, and keys the guard on it.
--
-- Failure direction is deliberate: where the step is unknown the trigger falls
-- back to the 10-second window rather than the exact key. Keeping a surplus row
-- is recoverable in the export; discarding a real one is not.

-- ── 1. The missing coordinate ────────────────────────────────────────────────

ALTER TABLE questionnaire_responses ADD COLUMN IF NOT EXISTS step_index integer;
ALTER TABLE vas_responses           ADD COLUMN IF NOT EXISTS step_index integer;

COMMENT ON COLUMN questionnaire_responses.step_index IS
  'Position of the delivering step within its session. With schedule_id this is '
  'the natural key of an administration: one session may administer an instrument '
  'more than once, and the step is what tells those apart.';
COMMENT ON COLUMN vas_responses.step_index IS
  'Position of the delivering step within its session. Disambiguates scales '
  'administered more than once per session (e.g. stress at pre / mid / post).';

-- ── 2. Backfill from participant_step_timings ────────────────────────────────
--
-- The step log records entered_at/exited_at per delivered step, so an existing
-- response can be placed on the step that collected it by when it was answered.
-- Applied ONLY where exactly one step window contains the response: an ambiguous
-- match leaves NULL, which the export renders as an explicitly non-committal
-- column rather than a plausible-looking wrong one.

WITH m AS (
  SELECT qr.id AS resp_id,
         t.step_index,
         count(*) OVER (PARTITION BY qr.id) AS n_match
    FROM questionnaire_responses qr
    JOIN participant_step_timings t
      ON t.participant_id = qr.user_id
     AND t.subcategory    = qr.questionnaire_slug
     AND t.exited_at IS NOT NULL
     AND qr.completed_at >= t.entered_at - interval '2 seconds'
     AND qr.completed_at <= t.exited_at  + interval '5 seconds'
   WHERE qr.step_index IS NULL
)
UPDATE questionnaire_responses qr
   SET step_index = m.step_index
  FROM m
 WHERE m.resp_id = qr.id
   AND m.n_match = 1;

WITH m AS (
  SELECT v.id AS resp_id,
         t.step_index,
         count(*) OVER (PARTITION BY v.id) AS n_match
    FROM vas_responses v
    JOIN vas_scales vs ON vs.id = v.scale_id
    JOIN participant_step_timings t
      ON t.participant_id = v.user_id
     AND t.exited_at IS NOT NULL
     -- A scale is delivered either on its own step or inside a package step.
     AND (t.subcategory = 'vas_' || vs.slug
          OR (v.package_slug IS NOT NULL AND t.subcategory = 'vas_pkg_' || v.package_slug))
     AND v.responded_at >= t.entered_at - interval '2 seconds'
     AND v.responded_at <= t.exited_at  + interval '5 seconds'
   WHERE v.step_index IS NULL
)
UPDATE vas_responses v
   SET step_index = m.step_index
  FROM m
 WHERE m.resp_id = v.id
   AND m.n_match = 1;

-- ── 3. The guard, keyed on the step ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION questionnaire_responses_dedupe()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_id uuid;
  v_window      constant interval := interval '10 seconds';
BEGIN
  IF NEW.schedule_id IS NOT NULL AND NEW.step_index IS NOT NULL THEN
    -- Exact natural key: (participant, instrument, session, step). A resubmit
    -- of the SAME step in the same session collapses however long the gap --
    -- that is the re-entry case 20260818 was written for -- while a genuine
    -- re-administration at a different step is always kept.
    SELECT id INTO v_existing_id
      FROM questionnaire_responses
     WHERE user_id            = NEW.user_id
       AND questionnaire_slug = NEW.questionnaire_slug
       AND schedule_id        = NEW.schedule_id
       AND step_index         = NEW.step_index
     ORDER BY completed_at DESC
     LIMIT 1;
  ELSE
    -- No step recorded -- a screener response (pre-consent, unscheduled), or a
    -- write path that does not yet pass one. Time is then the only signal, so
    -- use the window, scoped to whatever session the row does carry.
    SELECT id INTO v_existing_id
      FROM questionnaire_responses
     WHERE user_id            = NEW.user_id
       AND questionnaire_slug = NEW.questionnaire_slug
       AND schedule_id IS NOT DISTINCT FROM NEW.schedule_id
       AND completed_at >  COALESCE(NEW.completed_at, now()) - v_window
       AND completed_at <= COALESCE(NEW.completed_at, now())
     ORDER BY completed_at DESC
     LIMIT 1;
  END IF;

  IF v_existing_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE questionnaire_responses
     SET responses    = NEW.responses,
         completed_at = COALESCE(NEW.completed_at, now())
   WHERE id = v_existing_id;

  RAISE NOTICE 'questionnaire_responses: collapsed duplicate % for user % (step %)',
    NEW.questionnaire_slug, NEW.user_id, NEW.step_index;

  RETURN NULL;  -- BEFORE INSERT + NULL = skip the insert
END;
$$;
