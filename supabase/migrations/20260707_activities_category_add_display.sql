-- Expand the activities category check constraint to include 'display'.
-- Display elements (§24a) were shipped without this, so DisplayEditorPage's
-- activities insert silently failed the CHECK constraint (caught + console.warn'd)
-- and no display ever appeared in SessionBuilder's picker.
ALTER TABLE activities DROP CONSTRAINT activities_category_check;
ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category = ANY (ARRAY['form','game','questionnaire','physio','training','vas','display']));

-- Backfill activities rows for displays created before this fix.
INSERT INTO activities (category, subcategory, label)
SELECT 'display', d.slug, 'Display – ' || left(d.name, 60)
FROM displays d
WHERE NOT EXISTS (
  SELECT 1 FROM activities a WHERE a.category = 'display' AND a.subcategory = d.slug
);
