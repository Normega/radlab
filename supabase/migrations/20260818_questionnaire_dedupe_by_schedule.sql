-- Tighten the questionnaire submit guard now that responses carry the session
-- that collected them (20260818_questionnaire_schedule_link.sql).
--
-- The original guard (20260818_questionnaire_submit_guard.sql) had to use a
-- 10-second time window, because a time gap was the only signal available for
-- telling a double-fire apart from a genuine re-administration. With a
-- schedule_id the test is exact: (user, instrument, session) is the natural key,
-- and one session collects an instrument once.
--
-- Strictly better than the window it replaces, in both directions:
--   * a re-entry into the SAME session collapses however long the gap — the old
--     window would have let a resubmission 11 seconds later through;
--   * a genuine re-administration in a LATER session is kept however short the
--     gap — the old window would have silently swallowed a midpoint response
--     submitted seconds after a screener one, which is exactly the shape of
--     Liliana's study (screener → midpoint → final on GAD-7 and PHQ-8).
--
-- The window survives only for rows with no session: screener responses, which
-- run pre-consent and are not scheduled. There a time heuristic is still the
-- best available signal.

CREATE OR REPLACE FUNCTION questionnaire_responses_dedupe()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_id uuid;
  v_window      constant interval := interval '10 seconds';
BEGIN
  IF NEW.schedule_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
      FROM questionnaire_responses
     WHERE user_id            = NEW.user_id
       AND questionnaire_slug = NEW.questionnaire_slug
       AND schedule_id        = NEW.schedule_id
     ORDER BY completed_at DESC
     LIMIT 1;
  ELSE
    SELECT id INTO v_existing_id
      FROM questionnaire_responses
     WHERE user_id            = NEW.user_id
       AND questionnaire_slug = NEW.questionnaire_slug
       AND schedule_id IS NULL
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

  RETURN NULL;
END;
$$;
