-- Foggy Valleys, Sandy Study 4's spot-the-difference outcome task (Norm, 2026-11-05).
--
-- The game (src/games/FoggyValleys/FoggyValleys.jsx) writes two tables, append-only:
--   foggy_valleys_runs      one row when a valley starts (client-made id, so a retry
--                           of a run that did save hits the primary key: 23505)
--   foggy_valleys_pictures  one row as each picture ends; unique (run_id, picture_number)
--                           makes a resubmission impossible to insert
-- Both are response tables (participant data rule 5), guarded like buddy_goals:
-- forbid_response_overwrite_trg only, because the unique keys leave note_response_trg
-- nothing to flag. Both are listed in src/lib/responsesAppendOnly.test.mjs.
--
-- Two session-builder entries, one per valley. A game step has no per-step config,
-- so the slug carries the position; the fog level comes from the assignment slot
-- valley_order ('thin_first' | 'thick_first'), drawn by the server.

-- ── 1. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.foggy_valleys_runs (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_id      uuid REFERENCES public.studies(id) ON DELETE SET NULL,
  -- rule 1: where the response came from; deleting a schedule row never deletes data
  schedule_id   uuid REFERENCES public.participant_schedule(id) ON DELETE SET NULL,
  is_test       boolean NOT NULL DEFAULT false,
  game_version  text    NOT NULL,
  valley_number integer NOT NULL CHECK (valley_number >= 1),
  fog           text    NOT NULL CHECK (fog IN ('thin', 'thick')),
  mean_fog_ms   integer NOT NULL,
  valley_ms     integer NOT NULL,
  deck_seed     bigint  NOT NULL,
  deck_start    integer NOT NULL,
  settings      jsonb   NOT NULL,
  started_at    timestamptz NOT NULL,   -- participant's clock
  received_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS foggy_valleys_runs_user_study
  ON public.foggy_valleys_runs (user_id, study_id);

CREATE TABLE IF NOT EXISTS public.foggy_valleys_pictures (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                  uuid NOT NULL REFERENCES public.foggy_valleys_runs(id) ON DELETE CASCADE,
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_id                uuid REFERENCES public.studies(id) ON DELETE SET NULL,
  schedule_id             uuid REFERENCES public.participant_schedule(id) ON DELETE SET NULL,
  is_test                 boolean NOT NULL DEFAULT false,
  picture_number          integer NOT NULL,   -- position in the participant's deck, across both valleys
  valley_number           integer NOT NULL,
  fog                     text    NOT NULL CHECK (fog IN ('thin', 'thick')),
  scene                   integer,
  extra_scene             boolean,
  total_differences       integer,
  found                   integer,
  fog_ms                  integer,
  fog_cleared             boolean,
  search_ms               integer,
  time_after_last_find_ms integer,
  wrong_clicks            integer,
  ended_by                text,
  ended_after_warning     boolean,
  record                  jsonb NOT NULL,     -- the whole picture record, events included
  received_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, picture_number)
);

CREATE INDEX IF NOT EXISTS foggy_valleys_pictures_user_study
  ON public.foggy_valleys_pictures (user_id, study_id);

-- ── 2. RLS: participants insert and read their own rows; the lab reads all ────
-- Reading own rows is needed: a run insert returns its id, and the second valley
-- step reads where the first left off in the participant's picture deck.

ALTER TABLE public.foggy_valleys_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foggy_valleys_pictures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rows: insert" ON public.foggy_valleys_runs;
CREATE POLICY "own rows: insert" ON public.foggy_valleys_runs
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "own rows: read" ON public.foggy_valleys_runs;
CREATE POLICY "own rows: read" ON public.foggy_valleys_runs
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "foggy_valleys_runs: lab read" ON public.foggy_valleys_runs;
CREATE POLICY "foggy_valleys_runs: lab read" ON public.foggy_valleys_runs
  FOR SELECT TO authenticated USING ((select public.my_role()) = 'lab');

DROP POLICY IF EXISTS "own rows: insert" ON public.foggy_valleys_pictures;
CREATE POLICY "own rows: insert" ON public.foggy_valleys_pictures
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.foggy_valleys_runs r
                 WHERE r.id = foggy_valleys_pictures.run_id AND r.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "own rows: read" ON public.foggy_valleys_pictures;
CREATE POLICY "own rows: read" ON public.foggy_valleys_pictures
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "foggy_valleys_pictures: lab read" ON public.foggy_valleys_pictures;
CREATE POLICY "foggy_valleys_pictures: lab read" ON public.foggy_valleys_pictures
  FOR SELECT TO authenticated USING ((select public.my_role()) = 'lab');

-- ── 3. Grants (new tables get none by default from 2026-10-30) ────────────────
-- Append-only: no UPDATE or DELETE for anyone through the API, and nothing for anon.
-- The project was still adding its default grants on 2026-11-05 (every privilege,
-- anon included), so clear those first.

REVOKE ALL ON public.foggy_valleys_runs, public.foggy_valleys_pictures FROM anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.foggy_valleys_runs     TO authenticated;
GRANT SELECT, INSERT ON public.foggy_valleys_pictures TO authenticated;
GRANT SELECT, INSERT ON public.foggy_valleys_runs     TO service_role;
GRANT SELECT, INSERT ON public.foggy_valleys_pictures TO service_role;

-- ── 4. Never overwrite (rule 5) ────────────────────────────────────────────────

DROP TRIGGER IF EXISTS forbid_response_overwrite_trg ON public.foggy_valleys_runs;
CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.foggy_valleys_runs
  FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite();
DROP TRIGGER IF EXISTS forbid_response_overwrite_trg ON public.foggy_valleys_pictures;
CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.foggy_valleys_pictures
  FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite();

-- ── 5. Session-builder entries ─────────────────────────────────────────────────

INSERT INTO public.activities (category, subcategory, label, description, estimated_minutes, is_active)
SELECT v.category, v.subcategory, v.label, v.description, v.estimated_minutes, true
  FROM (VALUES
    ('game', 'foggy_valleys_1', 'Foggy Valleys – first valley',
     'Sandy Study 4. Four minutes of spot the difference in fog; the fog level (light mist or heavy fog) comes from the assignment slot valley_order. Includes the instructions.', 5),
    ('game', 'foggy_valleys_2', 'Foggy Valleys – second valley',
     'Sandy Study 4. The other fog level, continuing the same picture deck. Must follow Foggy Valleys – first valley in the same study.', 4)
  ) AS v(category, subcategory, label, description, estimated_minutes)
 WHERE NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.subcategory = v.subcategory);
