-- Ripple WP4: settings + disable path.
-- Defaults true so all existing rows remain active with no data touch needed.
ALTER TABLE ripples ADD COLUMN IF NOT EXISTS check_in_enabled boolean NOT NULL DEFAULT true;
