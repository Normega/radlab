-- Expand the activities category check constraint to include 'vas' and 'training'
ALTER TABLE activities DROP CONSTRAINT activities_category_check;
ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category = ANY (ARRAY['form','game','questionnaire','physio','training','vas']));

-- Seed: stress scale activity row
INSERT INTO activities (category, subcategory, label, description)
VALUES ('vas', 'vas_stress', 'VAS – Stress', 'Right now, how stressed are you feeling? (6-point emoji scale)');
