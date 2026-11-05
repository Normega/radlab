-- Foggy Valleys: the questions after each picture, and the end-of-session review
-- (Sandy Study 4, Norm's decisions D3, D4 and D7, 2026-11-05).
--
-- After each picture that cleared, the participant says why they moved on (only
-- when they pressed Next picture) and estimates the share of its differences they
-- found; only then is the true share shown, with what they missed marked
-- (src/games/FoggyValleys/FoggyValleys.jsx). One row per picture, inserted when
-- the answers are submitted, before the feedback appears. Guarded like
-- foggy_valleys_pictures (20261105_foggy_valleys_tables.sql): append-only, unique
-- (run_id, picture_number), forbid_response_overwrite_trg, listed in
-- src/lib/responsesAppendOnly.test.mjs.
--
-- How long the feedback stayed on screen is the next picture's record.dealtAt
-- minus this row's submitted_at (both the participant's clock).
--
-- Also the session-builder entry for the review of all searched pictures, shown
-- once after the task debrief (FoggyValleysReview.jsx). It reads the
-- participant's own picture rows and writes nothing.

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.foggy_valleys_picture_ratings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              uuid NOT NULL REFERENCES public.foggy_valleys_runs(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_id            uuid REFERENCES public.studies(id) ON DELETE SET NULL,
  -- rule 1: where the response came from; deleting a schedule row never deletes data
  schedule_id         uuid REFERENCES public.participant_schedule(id) ON DELETE SET NULL,
  is_test             boolean NOT NULL DEFAULT false,
  picture_number      integer NOT NULL,
  valley_number       integer NOT NULL,
  -- null when the clock ended the picture, so they did not choose to move on
  move_on_reason      text CHECK (move_on_reason IN ('found_all', 'no_more', 'better_use', 'tired_bored', 'other')),
  estimated_found_pct integer NOT NULL CHECK (estimated_found_pct BETWEEN 0 AND 100),
  -- what the feedback screen then showed
  found               integer NOT NULL,
  total_differences   integer NOT NULL,
  answer_ms           integer,
  shown_at            timestamptz,   -- participant's clock
  submitted_at        timestamptz,   -- participant's clock
  record              jsonb NOT NULL,
  received_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, picture_number)
);

CREATE INDEX IF NOT EXISTS foggy_valleys_picture_ratings_user_study
  ON public.foggy_valleys_picture_ratings (user_id, study_id);

-- ── 2. RLS: participants insert and read their own rows; the lab reads all ────

ALTER TABLE public.foggy_valleys_picture_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rows: insert" ON public.foggy_valleys_picture_ratings;
CREATE POLICY "own rows: insert" ON public.foggy_valleys_picture_ratings
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.foggy_valleys_runs r
                 WHERE r.id = foggy_valleys_picture_ratings.run_id AND r.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "own rows: read" ON public.foggy_valleys_picture_ratings;
CREATE POLICY "own rows: read" ON public.foggy_valleys_picture_ratings
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "foggy_valleys_picture_ratings: lab read" ON public.foggy_valleys_picture_ratings;
CREATE POLICY "foggy_valleys_picture_ratings: lab read" ON public.foggy_valleys_picture_ratings
  FOR SELECT TO authenticated USING ((select public.my_role()) = 'lab');

-- ── 3. Grants: append-only, nothing for anon; clear the project's defaults first ─

REVOKE ALL ON public.foggy_valleys_picture_ratings FROM anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.foggy_valleys_picture_ratings TO authenticated;
GRANT SELECT, INSERT ON public.foggy_valleys_picture_ratings TO service_role;

-- ── 4. Never overwrite (rule 5) ────────────────────────────────────────────────

DROP TRIGGER IF EXISTS forbid_response_overwrite_trg ON public.foggy_valleys_picture_ratings;
CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.foggy_valleys_picture_ratings
  FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite();

-- ── 5. Session-builder entry: the end-of-session review ────────────────────────

INSERT INTO public.activities (category, subcategory, label, description, estimated_minutes, is_active)
SELECT 'game', 'foggy_valleys_review', 'Foggy Valleys – review of what was missed',
       'Sandy Study 4. Every picture searched in both valleys again, with found and missed differences and wrong clicks marked. Place after both valleys in the same study.', 2, true
 WHERE NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.subcategory = 'foggy_valleys_review');
