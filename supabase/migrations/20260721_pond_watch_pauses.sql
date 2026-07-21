-- Pond Watch off-screen pause count (2026-07-21).
-- The game pauses whenever the participant leaves the screen (tab hidden /
-- window blurred); the client counts those pauses per session as a
-- data-quality flag and now persists it alongside the other session metrics.
-- Default 0 keeps rows from clients deployed before this column valid.

ALTER TABLE pond_watch_results
  ADD COLUMN IF NOT EXISTS pauses integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN pond_watch_results.pauses IS
  'Number of off-screen pauses (tab hidden / window blurred) during the session; data-quality flag';
