-- Add items column to vas_packages to support mixed VAS + slider sequences.
-- items is an ordered JSONB array of {type: 'vas'|'slider', id: uuid}.
-- scale_ids is preserved for backward compatibility (VAS-only packages written before this migration).

ALTER TABLE vas_packages
  ADD COLUMN IF NOT EXISTS items jsonb;
