-- Expand activities_category_check to include 'physio', then insert the
-- Physio Setup step so it appears in the session template builder.

ALTER TABLE activities DROP CONSTRAINT activities_category_check;
ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category = ANY (ARRAY['form', 'game', 'questionnaire', 'physio']));

INSERT INTO activities (category, subcategory, label, description, estimated_minutes)
VALUES (
  'physio',
  'belt_setup',
  'Physio Setup (Belt + Triggers)',
  'Connect and calibrate the Polar H10 belt and trigger device before the study begins.',
  10
)
ON CONFLICT DO NOTHING;
