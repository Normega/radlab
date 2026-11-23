-- Breath Attention and Emotional Recovery (Maya Alves's honours thesis, in person): the task's
-- two response tables and the RA PIN. Plan: I:\Shared drives\Maya\Design\Study_Design_and_Build_Plan.md
-- §9–§11 (WP-G5, C1, C2); website.md §26d.
--
--   bre_events   every timed event of the sensor step and the two coded tasks, and every physiology
--                marker the browser asked for (sent or not), with its performance.now() time, so the
--                platform's log and the AcqKnowledge file can be cross-checked and a lost marker shows.
--   bre_ratings  every in-task rating, one row per answer.
--
-- Both are response tables (participant data rule 5), guarded like foggy_valleys_*: the client makes
-- each row's id (an event's when it happens, a rating's when the rating screen appears), so a retry of
-- an insert that did land hits the primary key (23505) and nothing is written twice; a genuine second
-- answer (after an RA pause, say) is a new screen, a new id, its own row, and _r2 on export.
-- forbid_response_overwrite_trg refuses UPDATE. note_response_trg has nothing to flag. Both tables
-- are in RESPONSE_TABLES (src/lib/responsesAppendOnly.test.mjs).
--
-- Export column names come from recorded facts (rule 3): `position` (upset_b1_m2) and `block_emotion`
-- are written by the task when the participant answers, never derived from row order.

-- ── 1. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bre_events (
  id            uuid PRIMARY KEY,                -- client-made
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_id      uuid REFERENCES public.studies(id) ON DELETE SET NULL,
  schedule_id   uuid REFERENCES public.participant_schedule(id) ON DELETE SET NULL,  -- rule 1
  is_test       boolean NOT NULL DEFAULT false,
  run_id        uuid NOT NULL,                   -- one per mount of a step; a reload starts a new run
  step          text NOT NULL CHECK (step IN ('physio_setup', 'bre_baseline', 'bre_main')),
  seq           integer NOT NULL CHECK (seq >= 0),
  event         text NOT NULL,                   -- 'clip_on', 'rating_shown', 'ra_pause', 'marker', ...
  marker        smallint CHECK (marker BETWEEN 0 AND 255),
  marker_sent   boolean,                         -- false: asked for, but no device connected or the write failed
  marker_device text,
  t_ms          double precision NOT NULL,       -- performance.now() at the event, ms
  t_wall        timestamptz NOT NULL,            -- participant's clock
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);
CREATE INDEX IF NOT EXISTS bre_events_user_study ON public.bre_events (user_id, study_id);

CREATE TABLE IF NOT EXISTS public.bre_ratings (
  id            uuid PRIMARY KEY,                -- client-made when the rating screen appears
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_id      uuid REFERENCES public.studies(id) ON DELETE SET NULL,
  schedule_id   uuid REFERENCES public.participant_schedule(id) ON DELETE SET NULL,  -- rule 1
  is_test       boolean NOT NULL DEFAULT false,
  run_id        uuid NOT NULL,
  step          text NOT NULL CHECK (step IN ('bre_baseline', 'bre_main')),
  item_id       text NOT NULL,                   -- 'upset', 'strat_explore', 'emo_sad', 'breath_depth', ...
  position      text NOT NULL,                   -- recorded label: 'upset_b1_m2', 'emo_neutral', 'practice'
  value         smallint NOT NULL CHECK (value BETWEEN 1 AND 7),
  is_practice   boolean NOT NULL DEFAULT false,
  onset_ms      double precision NOT NULL,       -- performance.now() when the screen appeared
  rt_ms         double precision NOT NULL CHECK (rt_ms >= 0),
  version       text,                            -- 'main' | 'neutral' (slot version)
  condition     text,                            -- 'sf' | 'em'
  block         text,                            -- 'neutral', 'b1', 'washout', 'b2', or null
  block_emotion text,                            -- 'sad' | 'anger' | 'neutral', recorded at answer time
  clip_ids      text[],                          -- the clip(s) this rating follows
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  answered_at   timestamptz NOT NULL,            -- participant's clock
  received_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bre_ratings_user_study ON public.bre_ratings (user_id, study_id);

-- ── 2. RLS: participants insert and read their own rows; the lab reads all ────

ALTER TABLE public.bre_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bre_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rows: insert" ON public.bre_events;
CREATE POLICY "own rows: insert" ON public.bre_events
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "own rows: read" ON public.bre_events;
CREATE POLICY "own rows: read" ON public.bre_events
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "bre_events: lab read" ON public.bre_events;
CREATE POLICY "bre_events: lab read" ON public.bre_events
  FOR SELECT TO authenticated USING ((select public.my_role()) = 'lab');

DROP POLICY IF EXISTS "own rows: insert" ON public.bre_ratings;
CREATE POLICY "own rows: insert" ON public.bre_ratings
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "own rows: read" ON public.bre_ratings;
CREATE POLICY "own rows: read" ON public.bre_ratings
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "bre_ratings: lab read" ON public.bre_ratings;
CREATE POLICY "bre_ratings: lab read" ON public.bre_ratings
  FOR SELECT TO authenticated USING ((select public.my_role()) = 'lab');

-- ── 3. Grants (new tables get none by default from 2026-10-30) ────────────────
-- Append-only: SELECT and INSERT only, nothing for anon. Clear any default grants first.

REVOKE ALL ON public.bre_events, public.bre_ratings FROM anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.bre_events  TO authenticated;
GRANT SELECT, INSERT ON public.bre_ratings TO authenticated;
GRANT SELECT, INSERT ON public.bre_events  TO service_role;
GRANT SELECT, INSERT ON public.bre_ratings TO service_role;

-- ── 4. Never overwrite (rule 5) ────────────────────────────────────────────────

DROP TRIGGER IF EXISTS forbid_response_overwrite_trg ON public.bre_events;
CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.bre_events
  FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite();
DROP TRIGGER IF EXISTS forbid_response_overwrite_trg ON public.bre_ratings;
CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.bre_ratings
  FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite();

-- ── 5. RA PIN (plan §10) ────────────────────────────────────────────────────────
-- The RA unlocks the sensor hold and the task's pause / skip / stop controls with a short PIN.
-- Only a bcrypt hash is stored, and it never reaches the browser: check_ra_pin answers yes or no.
-- No hash set means no PIN can match (fail closed). A wrong PIN costs half a second, so guessing
-- one from the participant's seat is slow and every attempt reaches the API log.
--   UPDATE studies SET ra_pin_hash = extensions.crypt('<pin>', extensions.gen_salt('bf')) WHERE id = '…';

ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS ra_pin_hash text;
COMMENT ON COLUMN public.studies.ra_pin_hash IS
  'bcrypt hash of the RA PIN for in-person studies (check_ra_pin). Never returned to the browser. 20261123_bre_task_tables.sql.';

CREATE OR REPLACE FUNCTION public.check_ra_pin(p_study_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM study_enrollments WHERE study_id = p_study_id AND profile_id = v_uid)
     AND public.my_role() IS DISTINCT FROM 'lab' THEN
    RETURN false;
  END IF;
  SELECT ra_pin_hash INTO v_hash FROM studies WHERE id = p_study_id;
  IF v_hash IS NOT NULL AND p_pin IS NOT NULL AND extensions.crypt(p_pin, v_hash) = v_hash THEN
    RETURN true;
  END IF;
  PERFORM pg_sleep(0.5);
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.check_ra_pin(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_ra_pin(uuid, text) TO authenticated;

-- ── 6. Session-builder entry for the sensor hold (the tasks are added with WP-C1/C2) ──

INSERT INTO public.activities (category, subcategory, label, description, estimated_minutes, is_active)
SELECT 'physio', 'bre_physio_setup', 'Sensor set-up (RA hold, markers)',
       'Breath Attention and Emotional Recovery. Holds the participant at "Please let the research assistant know you have finished" until the RA unlocks with the study''s RA PIN (Ctrl+Alt+R), connects the marker box, sends a test pulse and confirms AcqKnowledge is recording, which sends marker 1.', 5, true
 WHERE NOT EXISTS (SELECT 1 FROM public.activities WHERE subcategory = 'bre_physio_setup');
