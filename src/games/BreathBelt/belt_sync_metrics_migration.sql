-- ── Belt trial sync metrics migration ───────────────────────────────────
-- Run after belt_schema.sql, belt_correspondence_migration.sql,
-- and belt_mlr_migration.sql.
-- Adds offline MLR-based sync quality metrics computed per trial.

ALTER TABLE belt_trials
  ADD COLUMN IF NOT EXISTS trial_r_baseline  float,
  ADD COLUMN IF NOT EXISTS trial_r_condition float,
  ADD COLUMN IF NOT EXISTS peak_error_ms     float;

COMMENT ON COLUMN belt_trials.trial_r_baseline IS
  'Offline Pearson R, baseline breaths (1–2) vs pacer reference. Null if < 20 samples.';
COMMENT ON COLUMN belt_trials.trial_r_condition IS
  'Offline Pearson R, condition breaths (3–4) vs pacer reference, lag-corrected. Null if < 20 samples.';
COMMENT ON COLUMN belt_trials.peak_error_ms IS
  'Median belt peak timing error vs pacer peaks (ms), lag-corrected. Good < 300 ms, fair < 600 ms.';

-- period_compliance (bt_condition_period_ms / breath_period_ms) is derivable
-- from existing columns — not stored separately.
