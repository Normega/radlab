-- Tune — auditory sense-foraging game (sibling to Delve).
-- Follows Delve's pattern: summary metrics as tune_* columns on the shared
-- `performance` table (no new table, no new RLS — performance is already governed).
-- Sessions are recorded in the existing `game_sessions` table with game_name='tune'.
-- Additive + nullable: safe to apply to the live project.

ALTER TABLE performance
  ADD COLUMN IF NOT EXISTS tune_duration_ms    integer,
  ADD COLUMN IF NOT EXISTS tune_avg_dwell_ms   float,
  ADD COLUMN IF NOT EXISTS tune_scenes_visited integer;
