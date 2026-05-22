-- ── BreathBelt correspondence study migration ────────────────────────────
-- Run in Supabase SQL editor AFTER the original belt_schema.sql.
-- Adds per-trial BT belt period estimates and session-level metadata
-- needed for pre/post baseline comparison and belt correspondence analysis.

-- ── belt_trials — BT belt period estimates per trial window ──────────────
--
-- bt_baseline_period_ms:  BT belt estimated breath period during baseline breaths (1–2)
-- bt_condition_period_ms: BT belt estimated breath period during condition breaths (3–4)
--
-- Both may be null when < 2 respiratory peaks were detected in the window
-- (expected at low QUEST magnitudes). Store as null, not 0. Do not drop
-- null-period trials — response and sync data are still valid.
--
-- Correspondence analysis:
--   bt_condition_period_ms vs breath_period_ms → avatar compliance (BT belt)
--   bt_condition_period_ms vs offline lab belt period → belt correspondence
--   COM trigger timestamps in raw CSV provide alignment for lab belt offline.

ALTER TABLE belt_trials
  ADD COLUMN IF NOT EXISTS bt_baseline_period_ms  float,
  ADD COLUMN IF NOT EXISTS bt_condition_period_ms float;

COMMENT ON COLUMN belt_trials.bt_baseline_period_ms  IS
  'BT belt mean inter-peak interval (ms) during baseline breaths 1–2. Null if < 2 peaks detected.';
COMMENT ON COLUMN belt_trials.bt_condition_period_ms IS
  'BT belt mean inter-peak interval (ms) during condition breaths 3–4. Null if < 2 peaks detected.';

-- ── belt_sessions — session number and baseline period estimates ──────────
--
-- session_number:          1-indexed visit count for this participant
-- baseline_period_ms:      BT belt mean breath period from 120 s pre-session baseline
-- post_baseline_period_ms: BT belt mean breath period from 120 s post-session baseline
--
-- Drift analysis: compare baseline_period_ms vs post_baseline_period_ms
-- Resting rate: use raw CSV from both baseline epochs for full variability estimate

ALTER TABLE belt_sessions
  ADD COLUMN IF NOT EXISTS session_number          int     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS baseline_period_ms      float,
  ADD COLUMN IF NOT EXISTS post_baseline_period_ms float;

COMMENT ON COLUMN belt_sessions.session_number          IS
  '1-indexed session count for this participant (increment per lab visit).';
COMMENT ON COLUMN belt_sessions.baseline_period_ms      IS
  'BT belt estimated breath period (ms) from 120 s pre-session free breathing.';
COMMENT ON COLUMN belt_sessions.post_baseline_period_ms IS
  'BT belt estimated breath period (ms) from 120 s post-session free breathing.';
