-- The class trial's smoke test (2026-10-09) showed students UTMAP's internal
-- titles: "Flourishing Scale (UTMAP, two pages)", "PHQ-4 self-report (UTMAP, single
-- page)", "UTMAP self-rated physical and mental health" (participants see
-- definition.name). As with the arm measures (20261008_class_trial_neutral_titles),
-- the trial gets copies with plain titles, items and scales identical, and its two
-- survey templates use them. UTMAP's own questionnaires are untouched.

insert into questionnaires (slug, name, definition, locked)
select 'psy240-' || q.slug, q.name || ' — class trial copy',
  q.definition || jsonb_build_object('slug', 'psy240-' || q.slug, 'name', t.title),
  false
from questionnaires q
join (values
  ('spane-2w',                'Your past two weeks'),
  ('utmap-flourishing',       'How things are going'),
  ('utmap-phq4-self',         'Over the last two weeks'),
  ('utmap-self-rated-health', 'Your health')
) as t(slug, title) on t.slug = q.slug;

update session_template_nodes n
   set questionnaire_id = (select c.id from questionnaires c where c.slug = 'psy240-' || o.slug)
  from questionnaires o, session_templates t
 where n.questionnaire_id = o.id
   and n.session_template_id = t.id
   and t.folder = 'Class trial'
   and o.slug in ('spane-2w', 'utmap-flourishing', 'utmap-phq4-self', 'utmap-self-rated-health');
