-- WP-L5b: reminder cadence anchor. check_schedule stamps last_sent_at on
-- every successful send (initial + reminder); the reminder pass re-sends
-- link_sent rows with a still-active link once last_sent_at is older than the
-- session's cadence (12 h for <= 24 h links, 24 h for assessment windows),
-- capped by studies.max_attempts and gated on studies.reminders_enabled.
ALTER TABLE participant_schedule ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;
