-- Add Physio Setup (Belt + Triggers) to the activities registry so it appears
-- in the session template builder at /admin/sessions/new under the Forms category.
INSERT INTO activities (category, subcategory, label, description, estimated_minutes)
VALUES (
  'physio',
  'belt_setup',
  'Physio Setup (Belt + Triggers)',
  'Connect and calibrate the Polar H10 belt and trigger device before the study begins.',
  10
)
ON CONFLICT DO NOTHING;
