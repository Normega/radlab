-- Add an optional folder label to session_templates for UI grouping.
-- The table stays flat; folder is a plain text tag used by the admin list view.
ALTER TABLE session_templates ADD COLUMN IF NOT EXISTS folder text;
