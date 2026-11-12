-- Sandy Study 4: rating wording and scales (Norm and Sandy, 2026-11-12).
-- Study 4 is inactive and has no real participants. Items Study 3 also uses
-- (the 6-face stress item, predicted_efficacy, post_efficacy) are left as they
-- are, because Study 3 is running; Study 4 gets its own new items instead.
--
-- 1. Stress becomes a 0-100 slider, like the other ratings.
-- 2. "How alert or energetic do you feel right now?" comes out of every bundle.
-- 3. Predicted performance, asked after each task's instructions and before the
--    task (Aptitude Suite, ColourMax, Foggy Valleys): "How well do you think you
--    will perform on this task relative to other people?"
-- 4. After each task and each valley: "How well do you think you performed on
--    this task relative to other people?" Same 0-100 scale and anchors as (3),
--    so the before and after ratings can be compared directly.
-- 5. After each task and each valley, motivation is in the past tense: "How
--    motivated were you to do well on this task?" T0, T2 and T6 keep "How
--    motivated are you to do well in today's tasks?"
-- 6. Valley enjoyment: "How much did you enjoy looking for differences in this
--    valley?", with face labels that fit the question.

BEGIN;

INSERT INTO slider_scales (slug, label, prompt, min, max, min_label, max_label, step, created_by) VALUES
  ('stress_slider', 'Stress (0–100)',
   'Right now, how stressed are you feeling?', 0, 100, 'Not At All Stressed', 'Extremely Stressed', 1,
   '0097e364-e11c-40b9-81f3-622831f39bc2'),
  ('predicted_performance', 'Predicted performance relative to other people',
   'How well do you think you will perform on this task relative to other people?', 0, 100,
   'Much Worse Than Others', 'Much Better Than Others', 1, '0097e364-e11c-40b9-81f3-622831f39bc2'),
  ('post_performance', 'Performance relative to other people, after the task',
   'How well do you think you performed on this task relative to other people?', 0, 100,
   'Much Worse Than Others', 'Much Better Than Others', 1, '0097e364-e11c-40b9-81f3-622831f39bc2'),
  ('task_motivation_after', 'Motivation for the task just done',
   'How motivated were you to do well on this task?', 0, 100,
   'Not At All Motivated', 'Extremely Motivated', 1, '0097e364-e11c-40b9-81f3-622831f39bc2');

-- the predicted-performance step, as its own session step
INSERT INTO activities (category, subcategory, label, description, is_active) VALUES
  ('numeric_slider', 'slider_predicted_performance',
   'Slider – Predicted performance relative to other people',
   'Much Worse Than Others → Much Better Than Others (0–100)', true);

-- the three prediction steps in Study 4's session now ask the new item
UPDATE session_template_nodes n
   SET activity_id = (SELECT id FROM activities WHERE subcategory = 'slider_predicted_performance'),
       label       = 'Slider – Predicted performance relative to other people'
 WHERE n.session_template_id = 'df38cbf4-8013-4aaf-9587-325cab660714'
   AND n.activity_id = (SELECT id FROM activities WHERE subcategory = 'slider_predicted_efficacy');

-- the bundles
CREATE TEMP TABLE s4_item ON COMMIT DROP AS
SELECT slug, jsonb_build_object('id', id::text, 'type', 'slider') AS it FROM slider_scales
 WHERE slug IN ('stress_slider', 'negative_emotionality', 'positive_emotionality', 'calm_relaxed',
                'task_motivation', 'task_motivation_after', 'post_performance', 'bother_moving_on')
UNION ALL
SELECT slug, jsonb_build_object('id', id::text, 'type', 'vas') FROM vas_scales WHERE slug = 'valley_enjoyment';

UPDATE vas_packages SET
  items = (SELECT jsonb_agg(it ORDER BY array_position(ARRAY['stress_slider','negative_emotionality','positive_emotionality','calm_relaxed','task_motivation'], slug))
             FROM s4_item WHERE slug = ANY (ARRAY['stress_slider','negative_emotionality','positive_emotionality','calm_relaxed','task_motivation'])),
  scale_ids = '[]'::jsonb,
  description = 'Sandy Study 4, T0, T2 and T6: stress, negative and positive emotionality, calm, motivation for today''s tasks (all 0–100).'
 WHERE slug = 's4_ratings';

UPDATE vas_packages SET
  items = (SELECT jsonb_agg(it ORDER BY array_position(ARRAY['stress_slider','negative_emotionality','positive_emotionality','calm_relaxed','task_motivation_after','post_performance'], slug))
             FROM s4_item WHERE slug = ANY (ARRAY['stress_slider','negative_emotionality','positive_emotionality','calm_relaxed','task_motivation_after','post_performance'])),
  scale_ids = '[]'::jsonb,
  description = 'Sandy Study 4, T1 and T3: the ratings (motivation for this task) plus performance relative to other people.'
 WHERE slug = 's4_ratings_after_task';

UPDATE vas_packages SET
  items = (SELECT jsonb_agg(it ORDER BY array_position(ARRAY['stress_slider','negative_emotionality','positive_emotionality','calm_relaxed','task_motivation_after','post_performance','bother_moving_on','valley_enjoyment'], slug))
             FROM s4_item WHERE slug = ANY (ARRAY['stress_slider','negative_emotionality','positive_emotionality','calm_relaxed','task_motivation_after','post_performance','bother_moving_on','valley_enjoyment'])),
  scale_ids = (SELECT jsonb_build_array(id::text) FROM vas_scales WHERE slug = 'valley_enjoyment'),
  description = 'Sandy Study 4, T4 and T5: the after-task ratings, being bothered by moving on, enjoyment of looking for differences in the valley.'
 WHERE slug = 's4_ratings_after_valley';

-- valley enjoyment: Study 4's own item (only test rows so far)
UPDATE vas_scales SET
  question = 'How much did you enjoy looking for differences in this valley?',
  anchors = (SELECT jsonb_agg(jsonb_set(a, '{label}', to_jsonb((ARRAY['Not at all','Slightly','Somewhat','Moderately','Very much','Extremely'])[(a->>'value')::int])) ORDER BY (a->>'value')::int)
               FROM jsonb_array_elements(anchors) a)
 WHERE slug = 'valley_enjoyment';

UPDATE activities SET description = 'Sandy Study 4: stress, emotionality, calm, motivation (0–100).'
 WHERE subcategory = 'vas_pkg_s4_ratings';

COMMIT;
