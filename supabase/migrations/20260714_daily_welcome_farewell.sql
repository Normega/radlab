-- Daily session welcome/farewell: every Liliana Study 3 daily training
-- session (Phase 1 + Phase 2, 48 templates) currently jumps straight from
-- the link into a bare pre-check-in slider with no greeting, and ends on a
-- generic platform-wide "Session complete" box with no sign-off and no
-- mental-health-resources safety content. Per trainingSKILL.md: "The
-- platform handles ... session wrapping (greeting, pre check-in, post
-- check-in, farewell)" — that wrapping was never actually built for real
-- sessions (wrapperElements.js/WrapperElementPage.jsx only ever rendered in
-- the /admin/training preview). Copy is Liliana's canonical wording
-- (Study3/interventions/JSON/landing_page_farewell/, 2026-07-14).
--
-- Welcome is a single node (subcategory 'liliana') attached identically to
-- all 48 daily templates — DailyWelcomeStep.jsx decides first_session vs
-- returning copy at render time (Phase 1's condition-block order is
-- counterbalanced, so which template is literally "first" varies by
-- participant; it can't be pinned statically per template).
--
-- Farewell varies by condition only (subcategory = non_reactivity |
-- reappraisal | self_compassion), so it's attached per-template based on
-- that template's training node's module_id -> intervention_modules.condition.

ALTER TABLE activities DROP CONSTRAINT activities_category_check;
ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category = ANY (ARRAY['form'::text, 'game'::text, 'questionnaire'::text, 'physio'::text, 'training'::text, 'vas'::text, 'display'::text, 'midpoint'::text, 'video'::text, 'assessment_leadin'::text, 'daily_welcome'::text, 'daily_farewell'::text]));

INSERT INTO activities (category, subcategory, label, description)
VALUES
  ('daily_welcome',  'liliana',         'Daily Session Welcome',                  'Owl "Begin" greeting shown before the pre-check-in of every Liliana daily training session; first_session vs returning copy chosen at render time.'),
  ('daily_farewell', 'non_reactivity',  'Daily Session Farewell — Non-Reactivity',  'Owl sign-off + mental health resources shown after the post-check-in of every Non-Reactivity daily training session.'),
  ('daily_farewell', 'reappraisal',     'Daily Session Farewell — Reappraisal',     'Owl sign-off + mental health resources shown after the post-check-in of every Reappraisal daily training session.'),
  ('daily_farewell', 'self_compassion', 'Daily Session Farewell — Self-Compassion', 'Owl sign-off + mental health resources shown after the post-check-in of every Self-Compassion daily training session.')
ON CONFLICT (category, subcategory) DO NOTHING;

-- Prepend Welcome as node 0 of every daily template, shifting existing nodes.
WITH daily_templates AS (
  SELECT id FROM session_templates
  WHERE folder = 'Liliana' AND (label LIKE '%Phase 1%' OR label LIKE '%Phase 2%')
)
UPDATE session_template_nodes
SET order_index = order_index + 1
WHERE session_template_id IN (SELECT id FROM daily_templates);

INSERT INTO session_template_nodes (session_template_id, order_index, activity_id, label)
SELECT dt.id, 0, a.id, 'Welcome'
FROM (
  SELECT id FROM session_templates
  WHERE folder = 'Liliana' AND (label LIKE '%Phase 1%' OR label LIKE '%Phase 2%')
) dt
CROSS JOIN (SELECT id FROM activities WHERE category = 'daily_welcome' AND subcategory = 'liliana') a
WHERE NOT EXISTS (
  SELECT 1 FROM session_template_nodes n WHERE n.session_template_id = dt.id AND n.activity_id = a.id
);

-- Append Farewell as the last node of every daily template, matched by
-- condition via that template's training node.
INSERT INTO session_template_nodes (session_template_id, order_index, activity_id, label)
SELECT
  stn.session_template_id,
  (SELECT COALESCE(MAX(order_index), -1) + 1 FROM session_template_nodes WHERE session_template_id = stn.session_template_id),
  a.id,
  'Farewell'
FROM session_template_nodes stn
JOIN session_templates st       ON st.id = stn.session_template_id
JOIN intervention_modules im    ON im.module_id = stn.module_id
JOIN activities a               ON a.category = 'daily_farewell' AND a.subcategory = im.condition
WHERE st.folder = 'Liliana' AND (st.label LIKE '%Phase 1%' OR st.label LIKE '%Phase 2%')
  AND stn.module_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM session_template_nodes n2
    WHERE n2.session_template_id = stn.session_template_id AND n2.activity_id = a.id
  );
