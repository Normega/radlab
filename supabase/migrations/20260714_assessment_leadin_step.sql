-- Assessment lead-in step category: an owl "Begin Check-in" screen shown
-- before the midpoint and final/post assessment sessions start, so
-- participants aren't dropped directly into the first questionnaire.
-- subcategory selects which copy variant to render ('midpoint' | 'post');
-- the copy itself is hardcoded in AssessmentLeadInStep.jsx (Liliana's
-- canonical wording, Study3/Questionnaires_logic/Leadins/, 2026-07-14),
-- same convention as MidpointStep.jsx's hardcoded PRACTICES copy.

ALTER TABLE activities DROP CONSTRAINT activities_category_check;
ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category = ANY (ARRAY['form'::text, 'game'::text, 'questionnaire'::text, 'physio'::text, 'training'::text, 'vas'::text, 'display'::text, 'midpoint'::text, 'video'::text, 'assessment_leadin'::text]));

INSERT INTO activities (category, subcategory, label, description)
VALUES
  ('assessment_leadin', 'midpoint', 'Midpoint Assessment Lead-in', 'Owl "Begin Check-in" screen shown before the midpoint questionnaire block.'),
  ('assessment_leadin', 'post',     'Final Assessment Lead-in',    'Owl "Begin Check-in" screen shown before the final/post questionnaire block.')
ON CONFLICT (category, subcategory) DO NOTHING;

-- Prepend as node 0 of the Midpoint session template, shifting existing nodes.
UPDATE session_template_nodes
SET order_index = order_index + 1
WHERE session_template_id = 'cc839191-cb69-4d63-9df6-9c37e73c31ce';

INSERT INTO session_template_nodes (session_template_id, order_index, activity_id, label)
SELECT 'cc839191-cb69-4d63-9df6-9c37e73c31ce', 0, a.id, 'Midpoint Assessment Lead-in'
FROM activities a
WHERE a.category = 'assessment_leadin' AND a.subcategory = 'midpoint'
  AND NOT EXISTS (
    SELECT 1 FROM session_template_nodes n
    WHERE n.session_template_id = 'cc839191-cb69-4d63-9df6-9c37e73c31ce' AND n.activity_id = a.id
  );

-- Prepend as node 0 of the Final Assessment session template.
UPDATE session_template_nodes
SET order_index = order_index + 1
WHERE session_template_id = '3d1a1593-d23a-454f-8db8-f8a0b0158167';

INSERT INTO session_template_nodes (session_template_id, order_index, activity_id, label)
SELECT '3d1a1593-d23a-454f-8db8-f8a0b0158167', 0, a.id, 'Final Assessment Lead-in'
FROM activities a
WHERE a.category = 'assessment_leadin' AND a.subcategory = 'post'
  AND NOT EXISTS (
    SELECT 1 FROM session_template_nodes n
    WHERE n.session_template_id = '3d1a1593-d23a-454f-8db8-f8a0b0158167' AND n.activity_id = a.id
  );
