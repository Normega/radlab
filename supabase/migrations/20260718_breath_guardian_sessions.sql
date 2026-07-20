-- Breath Guardian — per-session research capture.
--
-- One row per completed session. Flat summary columns (skin / input_mode /
-- final_score / health / self_phase_cycle_sd) support quick SQL filtering; the
-- full research payload (session / trials[] / events[] / trace) lands in the
-- `dataset` JSONB column for later analysis (switch cost, error asymmetry,
-- latency, breath variability — see the game's data-schema doc).
--
-- A parent `game_sessions` row (game_name = 'breath_guardian') is inserted
-- separately by the client and referenced via `session_id`, keeping this game
-- in the platform's shared session catalog alongside the others.

CREATE TABLE IF NOT EXISTS public.breath_guardian_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  skin                 text,          -- 'fantasy' | 'medical'
  input_mode           text,          -- 'touch' | 'key'
  final_score          integer,       -- 0–100, additive
  health               integer,       -- 0–100, grossness proxy (not score)
  self_phase_cycle_sd  numeric,       -- breath-cycle SD in self-directed phase (self-regulation proxy)
  dataset              jsonb,          -- full { session, trials, events, trace }
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS breath_guardian_sessions_user_id_idx
  ON public.breath_guardian_sessions (user_id);
CREATE INDEX IF NOT EXISTS breath_guardian_sessions_session_id_idx
  ON public.breath_guardian_sessions (session_id);

ALTER TABLE public.breath_guardian_sessions ENABLE ROW LEVEL SECURITY;

-- Players read/write their own rows.
CREATE POLICY "own rows"
  ON public.breath_guardian_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Lab members read/write all rows (analysis, admin-run sessions).
CREATE POLICY "breath_guardian_sessions: lab write"
  ON public.breath_guardian_sessions FOR ALL TO authenticated
  USING (my_role() = 'lab')
  WITH CHECK (my_role() = 'lab');
