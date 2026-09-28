-- Night Safari — per-exhibit session capture (docs/markdowns/safari_build_plan.md §6).
--
-- One table for every Safari exhibit rather than one per game: the exhibits share a
-- shape (a score, a tier, how the cue was delivered, and a versioned research payload),
-- and the hub reads progress across all of them. The parent `game_sessions` row
-- (game_name = 'safari_<exhibit>') is inserted by the client when the exhibit starts;
-- this detail row is inserted the moment the exhibit is finished — BEFORE the reflective
-- pause, so a player who closes the tab during the pause loses nothing.
--
-- The pause is recorded separately (safari_pause_events): it is invited, never scored,
-- and only visible-tab time counts.
--
-- Both tables are insert-only for players (select + insert policies, no update or
-- delete): a finished session is a record, not a draft. Rows cascade from auth.users,
-- so delete_own_account / admin_delete_user (which delete the auth.users row) remove
-- them without edits to those functions.

CREATE TABLE IF NOT EXISTS public.safari_exhibit_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exhibit          text NOT NULL,     -- 'owl_barn' | 'bat_cave' | 'opossum_hut' | 'raccoon_trash' | 'skunk_den' | 'firefly_field'
  -- CLAUDE.md rule 1: a record says where it came from. Null outside a study.
  study_id         uuid REFERENCES public.studies(id) ON DELETE SET NULL,
  schedule_id      uuid REFERENCES public.participant_schedule(id) ON DELETE SET NULL,
  raw_score        numeric,           -- the exhibit's primary measure, in its own units (owl_barn: crossing ms)
  tier             text,              -- the tier name shown to the player, null if the exhibit was not finished
  cue_modality     text,              -- 'both' | 'audio' | 'visual' — how the cue reached the player (sound check result)
  dataset_version  integer NOT NULL DEFAULT 1,
  dataset          jsonb NOT NULL,    -- calibration, schedule, every window/trial, device, latency, layout, summary
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safari_exhibit_sessions_user_idx    ON public.safari_exhibit_sessions (user_id, exhibit);
CREATE INDEX IF NOT EXISTS safari_exhibit_sessions_session_idx ON public.safari_exhibit_sessions (session_id);

CREATE TABLE IF NOT EXISTS public.safari_pause_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exhibit      text NOT NULL,
  visible_ms   integer NOT NULL CHECK (visible_ms >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safari_pause_events_session_idx ON public.safari_pause_events (session_id);

ALTER TABLE public.safari_exhibit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safari_pause_events     ENABLE ROW LEVEL SECURITY;

-- Players: read and add their own rows. No update / delete policy on purpose.
CREATE POLICY "safari_exhibit_sessions: own read" ON public.safari_exhibit_sessions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "safari_exhibit_sessions: own insert" ON public.safari_exhibit_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "safari_pause_events: own read" ON public.safari_pause_events
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "safari_pause_events: own insert" ON public.safari_pause_events
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- Lab: read everything (analysis, Study Data Export).
CREATE POLICY "safari_exhibit_sessions: lab read" ON public.safari_exhibit_sessions
  FOR SELECT TO authenticated USING (my_role() = 'lab');
CREATE POLICY "safari_pause_events: lab read" ON public.safari_pause_events
  FOR SELECT TO authenticated USING (my_role() = 'lab');
