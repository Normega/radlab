-- ── BreathBelt proportion_mag migration ──────────────────────────────────
-- Adds proportion_mag to belt_trials: the signed proportion change in breath
-- period relative to the base pace.
--
--   proportion_mag = (breath_period_ms - BASE_MS) / BASE_MS
--
-- Phase 2 fixed conditions: faster = -0.25, slower = +0.25, same = 0
-- Phase 3 QUEST:            continuously varying, same sign convention
-- Always computable from breath_period_ms; never null.

ALTER TABLE belt_trials
  ADD COLUMN IF NOT EXISTS proportion_mag float;

COMMENT ON COLUMN belt_trials.proportion_mag IS
  'Signed proportion change in breath period vs. base (4 s): (breath_period_ms - 4000) / 4000. Negative = faster, positive = slower, zero = same.';
