-- The PSY240 teaching trial's instruments (Norm's decisions D2, D4, Oct 8 2026;
-- plan of record in the private repo Normega/psy240internal2026).
--
-- 1. An embedded practice step. The Sense Foraging arm runs one day of the
--    course's light version (senseforaging.com/embed/day/N) in a frame inside
--    the radlab session, between the before and after ratings, so all three arms
--    are one radlab link a day. New step category `embedded_practice`
--    (EmbeddedPracticeStep.jsx) and composable instrument type of the same name,
--    so the day is recorded in instrument_responses -- which already carries
--    schedule_id and the append-only guards (CLAUDE.md rules 1 and 5) -- as
--    { day, completed, practice, sense, practice_ms, quiet, via }.
-- 2. Mood, before and after, every arm: a new six-face VAS item beside Study 3's
--    `stress` (reused as it is). The faces are the life-satisfaction set
--    (unhappy -> delighted). Two packages, so the export names the side of the
--    practice: vas_stress_pre_d7, vas_mood_post_d7.
-- 3. Each arm's own measure. The MPoD-t is live in Liliana Study 3, so the trial
--    gets a copy, items and response format identical, with neutral instructions
--    (the original's "the following questions will ask about your mindfulness
--    levels" names the arm it belongs to). The Stress Mindset Measure (Crum,
--    Salovey & Achor, 2013) is new: 8 items, 0-4, items 1, 3, 5, 7 reversed,
--    scored as the mean; its instruction and items verbatim from the published
--    measure (psy240internal2026/survey/).
--
-- Nothing here changes an existing row; the two check constraints only widen.

-- 1 ── the embedded practice ─────────────────────────────────────────────────

alter table activities drop constraint activities_category_check;
alter table activities add constraint activities_category_check check (category = any (array[
  'form', 'game', 'questionnaire', 'physio', 'training', 'vas', 'display', 'midpoint', 'video',
  'assessment_leadin', 'daily_welcome', 'daily_farewell', 'likert_slider', 'numeric_slider',
  'multiple_choice', 'open_list', 'open_text', 'hierarchy', 'assessment', 'embedded_practice'
]));

alter table composable_instruments drop constraint composable_instruments_type_check;
alter table composable_instruments add constraint composable_instruments_type_check check (type = any (array[
  'likert_slider', 'multiple_choice', 'open_list', 'open_text', 'hierarchy', 'embedded_practice'
]));

insert into activities (category, subcategory, label, description, estimated_minutes, is_active)
values ('embedded_practice', 'sense_foraging', 'Today’s practice',
        'One day of Sense Foraging Foundations in its light version (senseforaging.com/embed/day/N, N = the schedule row''s study day), run full-screen in a frame. Records whether it finished and the practice time; a link out is the fallback.',
        4, true);

insert into composable_instruments (slug, type, label, config)
values ('sense-foraging-day', 'embedded_practice', 'Sense Foraging day (embedded)',
        '{"origins": ["https://senseforaging.com", "https://www.senseforaging.com"], "path": "/embed/day/"}');

-- 2 ── mood, and the before and after packages ───────────────────────────────

insert into vas_scales (slug, question, scale_type, label, anchors, created_by)
select 'mood', 'Right now, how is your mood?', 'emoji_6', 'Mood',
  jsonb_build_array(
    jsonb_build_object('label', 'Very bad',      'value', 1, 'emoji_url', u || 'satisfaction_1.png'),
    jsonb_build_object('label', 'Bad',           'value', 2, 'emoji_url', u || 'satisfaction_2.png'),
    jsonb_build_object('label', 'Somewhat bad',  'value', 3, 'emoji_url', u || 'satisfaction_3.png'),
    jsonb_build_object('label', 'Somewhat good', 'value', 4, 'emoji_url', u || 'satisfaction_4.png'),
    jsonb_build_object('label', 'Good',          'value', 5, 'emoji_url', u || 'satisfaction_5.png'),
    jsonb_build_object('label', 'Very good',     'value', 6, 'emoji_url', u || 'satisfaction_6.png')),
  (select id from auth.users where email = 'norman@radlab.zone')
from (select 'https://qajrlfqoicfcfhthsfay.supabase.co/storage/v1/object/public/public-assets/vas-emojis/satisfaction/' u) x;

insert into vas_packages (slug, name, description, scale_ids, items, created_by)
select p.slug, p.name, p.descr,
  jsonb_build_array(st.id, md.id),
  jsonb_build_array(jsonb_build_object('id', st.id, 'type', 'vas'), jsonb_build_object('id', md.id, 'type', 'vas')),
  (select id from auth.users where email = 'norman@radlab.zone')
from (values
  ('class_trial_pre_ratings',  'Class trial — before the practice', 'Stress and mood, before the day''s practice (all three arms).'),
  ('class_trial_post_ratings', 'Class trial — after the practice',  'Stress and mood, after the day''s practice (all three arms).')
) as p(slug, name, descr),
(select id from vas_scales where slug = 'stress') st,
(select id from vas_scales where slug = 'mood') md;

insert into activities (category, subcategory, label, description, estimated_minutes, is_active) values
  ('assessment', 'vas_pkg_class_trial_pre_ratings',  'VAS Bundle – Class trial, before', 'Stress and mood before the practice.', 1, true),
  ('assessment', 'vas_pkg_class_trial_post_ratings', 'VAS Bundle – Class trial, after',  'Stress and mood after the practice.',  1, true);

-- 3 ── each arm's own measure ────────────────────────────────────────────────

insert into questionnaires (slug, name, definition, locked)
select 'psy240-mpod-t', name,
  definition
    || jsonb_build_object('slug', 'psy240-mpod-t')
    || jsonb_build_object('instructions', 'How much do you agree or disagree with each statement? Answer from 1 (strongly disagree) to 7 (strongly agree). There are no right or wrong answers.'),
  false
from questionnaires where slug = 'mpod-t';

insert into questionnaires (slug, name, definition, locked) values ('smm-8', 'Stress Mindset Measure (SMM)', $def${
  "name": "Stress Mindset Measure (SMM)",
  "slug": "smm-8",
  "instructions": "Rate the extent to which you agree or disagree with the following questions.",
  "auto_advance": true,
  "scale_min": 0,
  "scale_max": 4,
  "scale_labels": [
    {"image": null, "label": "Strongly Disagree", "value": 0},
    {"image": null, "label": "Disagree", "value": 1},
    {"image": null, "label": "Neither Agree nor Disagree", "value": 2},
    {"image": null, "label": "Agree", "value": 3},
    {"image": null, "label": "Strongly Agree", "value": 4}
  ],
  "items": [
    {"id": "smm_1", "text": "The effects of stress are negative and should be avoided.", "type": "likert", "required": true, "subscale": "Stress mindset", "reverse_score": true, "scale_min": null, "scale_max": null, "scale_labels_override": null},
    {"id": "smm_2", "text": "Experiencing stress facilitates my learning and growth.", "type": "likert", "required": true, "subscale": "Stress mindset", "reverse_score": false, "scale_min": null, "scale_max": null, "scale_labels_override": null},
    {"id": "smm_3", "text": "Experiencing stress depletes my health and vitality.", "type": "likert", "required": true, "subscale": "Stress mindset", "reverse_score": true, "scale_min": null, "scale_max": null, "scale_labels_override": null},
    {"id": "smm_4", "text": "Experiencing stress enhances my performance and productivity.", "type": "likert", "required": true, "subscale": "Stress mindset", "reverse_score": false, "scale_min": null, "scale_max": null, "scale_labels_override": null},
    {"id": "smm_5", "text": "Experiencing stress inhibits my learning and growth.", "type": "likert", "required": true, "subscale": "Stress mindset", "reverse_score": true, "scale_min": null, "scale_max": null, "scale_labels_override": null},
    {"id": "smm_6", "text": "Experiencing stress improves my health and vitality.", "type": "likert", "required": true, "subscale": "Stress mindset", "reverse_score": false, "scale_min": null, "scale_max": null, "scale_labels_override": null},
    {"id": "smm_7", "text": "Experiencing stress debilitates my performance and productivity.", "type": "likert", "required": true, "subscale": "Stress mindset", "reverse_score": true, "scale_min": null, "scale_max": null, "scale_labels_override": null},
    {"id": "smm_8", "text": "The effects of stress are positive and should be utilized.", "type": "likert", "required": true, "subscale": "Stress mindset", "reverse_score": false, "scale_min": null, "scale_max": null, "scale_labels_override": null}
  ],
  "scoring": {
    "method": "mean",
    "subscales": [
      {"name": "Stress mindset", "item_ids": ["smm_1", "smm_2", "smm_3", "smm_4", "smm_5", "smm_6", "smm_7", "smm_8"], "reverse_items": ["smm_1", "smm_3", "smm_5", "smm_7"]}
    ]
  }
}$def$::jsonb, false);
