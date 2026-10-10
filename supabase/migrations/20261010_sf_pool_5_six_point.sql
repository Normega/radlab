-- Sense Foraging item pool 5 on the 6-point scale, with "Prefer not to answer".
--
-- Norm, 2026-10-10: pool 5 (the Oct 6 wording, 34 items, which maps onto the
-- course) is the instrument, on the lab's 6-point agree scale with no midpoint
-- and a per-item "Prefer not to answer" (reports/Scale midpoints and forced
-- choice.md). Both copies change: sf-pool-5 (the library master) and
-- psy240-sf-pool-5 (the PSY240 class trial's copy, neutral title "Paying
-- attention"). Neither has a single response, and the trial is inactive with no
-- real enrollments.
--
-- Each becomes a composable definition: the legacy item format cannot offer
-- "Prefer not to answer". Kept exactly: item ids (sf5_*), wording, the fixed
-- facet-rotating order, the instructions, and the facet key (`scoring`, kept as
-- documentation). Pages are 7/7/7/7/6, what the trial already showed under
-- layout v2. Only the scale changes: 7 points with a neutral midpoint become
-- Strongly disagree, Disagree, Mildly disagree, Mildly agree, Agree, Strongly
-- agree (1-6), the wording of the Sense Foraging Study 1 scale.
--
-- Guarded on `definition ? 'items'`, so a second run changes nothing.

UPDATE public.questionnaires q
   SET definition = jsonb_build_object(
         'slug', q.slug,
         'name', q.definition->>'name',
         'questionnaire_type', 'composable',
         'instructions', q.definition->>'instructions',
         'scoring', q.definition->'scoring',
         'pages', (
           SELECT jsonb_agg(jsonb_build_object('id', 'sf5_p' || page, 'components', comps) ORDER BY page)
             FROM (
               SELECT LEAST((n - 1) / 7, 4) + 1 AS page,
                      jsonb_agg(jsonb_build_object(
                        'id', item->>'id',
                        'type', 'likert',
                        'question', item->>'text',
                        'scale', '[{"value":1,"label":"Strongly disagree"},{"value":2,"label":"Disagree"},
                                   {"value":3,"label":"Mildly disagree"},{"value":4,"label":"Mildly agree"},
                                   {"value":5,"label":"Agree"},{"value":6,"label":"Strongly agree"}]'::jsonb,
                        'required', true,
                        'allow_pna', true) ORDER BY n) AS comps
                 FROM jsonb_array_elements(q.definition->'items') WITH ORDINALITY AS t(item, n)
                GROUP BY 1
             ) p)),
       updated_at = now()
 WHERE q.slug IN ('sf-pool-5', 'psy240-sf-pool-5')
   AND q.definition ? 'items';
