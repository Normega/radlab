-- Submit guard: collapse duplicate questionnaire submissions at the database.
--
-- Observed: participant 909092's BFI-2-S was submitted twice **643 ms apart**
-- (23:30:45.552 and 23:30:46.195), and their Student Stress Scale twice as
-- well. The consequence was not merely an extra row — the export names
-- questionnaire columns by which administration a response is, so one stray
-- double-fire made that participant look like they had three baseline
-- administrations and shifted the timepoint label of every later response they
-- gave.
--
-- WHY THIS IS A DATABASE GUARD AND NOT ONLY A CLIENT ONE.
-- `QuestionnaireRenderer` already refuses to fire `onComplete` twice, but only
-- **per mount** (`finishedRef`), and any React `saving` flag resets on mount
-- too. So every client-side guard is defeated by a remount — which is exactly
-- what a flaky connection, a back-navigation, or a re-render can cause. The
-- 643 ms gap is too long for same-tick double-click batching and too short for
-- a human redoing a questionnaire, which points at a re-entry rather than a
-- double-click. Only a guard below the client closes that.
--
-- BEHAVIOUR: an insert that repeats (user_id, questionnaire_slug) within the
-- window does not create a row. Instead the existing row is UPDATED with the
-- newer responses and timestamp, and the insert is skipped. Keeping the LATER
-- copy matches the export's own de-duplication, and is the right choice if the
-- participant corrected something and resubmitted — the newer answers are the
-- ones they meant.
--
-- WINDOW: 10 seconds. Deliberately far tighter than the export's 120 s
-- analysis-time window. This one silently discards a row, so it must only ever
-- fire on submissions no human could have made deliberately; the export's
-- window can afford to be generous because it changes nothing on disk.
--
-- Existing duplicates are NOT touched. Deleting collected research rows is not
-- something a migration should decide on its own — the export already collapses
-- them at analysis time, and the raw rows stay available for audit.

CREATE OR REPLACE FUNCTION questionnaire_responses_dedupe()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_id uuid;
  v_window      constant interval := interval '10 seconds';
BEGIN
  SELECT id INTO v_existing_id
    FROM questionnaire_responses
   WHERE user_id = NEW.user_id
     AND questionnaire_slug = NEW.questionnaire_slug
     AND completed_at > COALESCE(NEW.completed_at, now()) - v_window
     AND completed_at <= COALESCE(NEW.completed_at, now())
   ORDER BY completed_at DESC
   LIMIT 1;

  IF v_existing_id IS NULL THEN
    RETURN NEW;                      -- not a duplicate; insert normally
  END IF;

  UPDATE questionnaire_responses
     SET responses    = NEW.responses,
         completed_at = COALESCE(NEW.completed_at, now())
   WHERE id = v_existing_id;

  RAISE NOTICE 'questionnaire_responses: collapsed duplicate % for user %',
    NEW.questionnaire_slug, NEW.user_id;

  RETURN NULL;                       -- BEFORE INSERT + NULL = skip the insert
END;
$$;

DROP TRIGGER IF EXISTS questionnaire_responses_dedupe_trg ON questionnaire_responses;

CREATE TRIGGER questionnaire_responses_dedupe_trg
  BEFORE INSERT ON questionnaire_responses
  FOR EACH ROW
  EXECUTE FUNCTION questionnaire_responses_dedupe();
