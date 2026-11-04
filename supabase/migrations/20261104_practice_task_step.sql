-- Sandy Study 4, step 6: the breathing practice or the reading task (Norm, 2026-11-04).
--
-- A new step category `practice_task` (PracticeTaskStep.jsx) and composable
-- instrument type of the same name. One session step runs whichever arm the
-- participant was drawn into: it reads the arm from the study's assignment slot
-- (`relaxation_arm` by default; set studies.assignment_slots to
-- {"relaxation_arm": ["breathing", "reading"]}) and never draws one itself.
-- Each run is recorded as ONE instrument_responses row, which already carries
-- schedule_id and the append-only guards (CLAUDE.md rules 1 and 5), so no new
-- table and no new grants.
--
-- The two constraint lists are the live ones as of 2026-11-04 (checked before
-- writing), each with 'practice_task' added. Same pattern as
-- 20261008_class_trial_instruments.sql.

alter table activities drop constraint activities_category_check;
alter table activities add constraint activities_category_check check (category = any (array[
  'form', 'game', 'questionnaire', 'physio', 'training', 'vas', 'display', 'midpoint', 'video',
  'assessment_leadin', 'daily_welcome', 'daily_farewell', 'likert_slider', 'numeric_slider',
  'multiple_choice', 'open_list', 'open_text', 'hierarchy', 'assessment', 'embedded_practice',
  'practice_task'
]));

alter table composable_instruments drop constraint composable_instruments_type_check;
alter table composable_instruments add constraint composable_instruments_type_check check (type = any (array[
  'likert_slider', 'multiple_choice', 'open_list', 'open_text', 'hierarchy', 'embedded_practice',
  'practice_task'
]));

insert into activities (category, subcategory, label, description, estimated_minutes, is_active)
values ('practice_task', 'breathing_or_reading', 'Breathing practice or reading task',
        'Sandy Study 4 step 6: about 4 minutes of paced breathing (4 s in, 6 s out) or the reading task, by the arm drawn into the assignment slot relaxation_arm.',
        4, true);

insert into composable_instruments (slug, type, label, config)
values ('breathing-or-reading', 'practice_task', 'Breathing practice or reading task',
        '{"slot": "relaxation_arm", "breathing_seconds": 240, "inhale_ms": 4000, "exhale_ms": 6000, "passage": "mail_sorting_centre"}');
