-- ── BreathBelt schema ────────────────────────────────────────────────────
-- Run in Supabase SQL editor.
-- Also create a private Storage bucket named 'belt-sessions' in
-- Supabase dashboard → Storage before first session.

-- Session-level metadata (one row per session)
CREATE TABLE belt_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    uuid REFERENCES game_sessions(id),
  user_id       uuid REFERENCES profiles(id),
  calib_state   jsonb,          -- CalibState: selectedAxis, polarity, baseline, normFloor, normCeiling
  storage_path  text,           -- path in belt-sessions Storage bucket (userId/sessionId_raw.csv)
  quest_state   jsonb,          -- serialised 2-staircase posteriors; null if session ended before Phase 3
  created_at    timestamptz DEFAULT now()
);

-- One row per trial (both Phase 2 fixed trials and Phase 3 QUEST trials)
CREATE TABLE belt_trials (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id       uuid REFERENCES game_sessions(id),
  user_id          uuid REFERENCES profiles(id),
  phase            int            NOT NULL,  -- 2 or 3
  trial_number     int            NOT NULL,  -- 1-indexed within phase
  condition        text           NOT NULL,  -- 'same' | 'faster' | 'slower'
  breath_period_ms int            NOT NULL,  -- actual condition period used (ms)
  log10_mag        float,                   -- log10(delta_seconds); null for Phase 2
  response         text,                    -- '3AFC response: same' | 'faster' | 'slower'; null for Phase 2
  correct          boolean,                 -- null for Phase 2
  confidence       int,                     -- 1–7; null for Phase 2
  arousal          int,                     -- 1–7; null for Phase 2
  belt_sync_mean   float,                   -- mean breathValue (0–1) during condition breaths
  created_at       timestamptz DEFAULT now()
);

-- RLS: lab members can read all rows; participants can read only their own
ALTER TABLE belt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE belt_trials   ENABLE ROW LEVEL SECURITY;

-- Users can insert their own rows
CREATE POLICY "belt_sessions insert own"
  ON belt_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "belt_trials insert own"
  ON belt_trials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Lab members can read all; others read only their own
CREATE POLICY "belt_sessions select"
  ON belt_sessions FOR SELECT
  USING (
    auth.uid() = user_id
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'lab'
  );

CREATE POLICY "belt_trials select"
  ON belt_trials FOR SELECT
  USING (
    auth.uid() = user_id
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'lab'
  );
