-- ── Belt MLR calibration migration ──────────────────────────────────────
-- Run after the original belt_schema.sql and belt_correspondence_migration.sql.
-- Adds columns for the MLR calibration quality metrics produced by fitBestModel().

ALTER TABLE belt_sessions
  ADD COLUMN IF NOT EXISTS calib_model_label  text,    -- 'mlr-wide' | 'mlr-tight' | 'mlr-wide-lp' | 'mlr-tight-lp' | 'pca-wide' | 'pca-tight'
  ADD COLUMN IF NOT EXISTS calib_fit_r        float,   -- Pearson R of best-fit model against pacer (0–1)
  ADD COLUMN IF NOT EXISTS calib_lag_ms       float;   -- estimated physical belt lag in ms (positive = belt lags pacer)

COMMENT ON COLUMN belt_sessions.calib_model_label IS
  'Winning model variant from fitBestModel(): one of the 6 MLR/PCA × wide/tight combinations.';
COMMENT ON COLUMN belt_sessions.calib_fit_r IS
  'Pearson R of belt model prediction vs pacer reference during calibration. Threshold: good ≥ 0.70, fair ≥ 0.40.';
COMMENT ON COLUMN belt_sessions.calib_lag_ms IS
  'Estimated physical lag: belt signal lags pacer by this many ms. Typical range 200–600 ms.';

-- The full MLR weights are stored in belt_sessions.calib_state (existing jsonb column):
-- { bias: number, weights: [wx, wy, wz], modelLabel: string, lagMs: number, fitR: number }
