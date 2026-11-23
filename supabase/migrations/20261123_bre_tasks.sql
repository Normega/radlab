-- Breath Attention and Emotional Recovery: the coded task steps (plan WP-C1, C2, I3 Screen 12).
-- Category 'bre_task' (src/components/study/bre/BreTask.jsx, BreEndStep.jsx), one activity each.
-- bre_events also takes step 'bre_end' (Screen 12 sends end marker 255). Applied while bre_events was
-- empty. The clip assignment of the main task is in src/components/study/bre/breClips.js, versioned in
-- code and recorded on every event (clip_plan).

-- activities.category is a closed list: add 'assignment' (WP-G1/G2, AssignmentStep.jsx; one activity
-- per slot, subcategory = the slot key) and 'bre_task'.
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_category_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_category_check CHECK (category = ANY (ARRAY[
  'form','game','questionnaire','physio','training','vas','display','midpoint','video','assessment_leadin',
  'daily_welcome','daily_farewell','likert_slider','numeric_slider','multiple_choice','open_list','open_text',
  'hierarchy','assessment','embedded_practice','practice_task','assignment','bre_task']));

INSERT INTO public.activities (category, subcategory, label, description, estimated_minutes, is_active)
SELECT 'assignment', v.subcategory, v.label, v.description, 0, true
  FROM (VALUES
    ('version', 'Assignment – set slot "version"',
     'Invisible step. Sets the slot version as the study''s assignment_slot_rules say: by rule on this session''s questionnaire scores (route_by_score) or by a draw. Breath Attention: after GAD-7 and PHQ-8.'),
    ('cell_main', 'Assignment – draw slot "cell_main"',
     'Invisible step. Draws cell_main if the study''s draw_if is met (Breath Attention: version = main), otherwise passes without drawing.'),
    ('cell_neutral', 'Assignment – draw slot "cell_neutral"',
     'Invisible step. Draws cell_neutral if the study''s draw_if is met (Breath Attention: version = neutral), otherwise passes without drawing.')
  ) AS v(subcategory, label, description)
 WHERE NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.category = 'assignment' AND a.subcategory = v.subcategory);

ALTER TABLE public.bre_events DROP CONSTRAINT IF EXISTS bre_events_step_check;
ALTER TABLE public.bre_events ADD CONSTRAINT bre_events_step_check
  CHECK (step IN ('physio_setup', 'bre_baseline', 'bre_main', 'bre_end'));

INSERT INTO public.activities (category, subcategory, label, description, estimated_minutes, is_active)
SELECT 'bre_task', v.subcategory, v.label, v.description, v.minutes, true
  FROM (VALUES
    ('bre_baseline', 'Breath Attention – baseline task',
     'Rating practice (Screen 4), Screen 3, 180 s fixation (markers 2/3), baseline upset, emotion check. Needs the sensor set-up step before it.', 5),
    ('bre_main', 'Breath Attention – training and clip task',
     'Training audio, guided practice, strategy check, practice ratings, neutral clips, two clip blocks with 3-minute recoveries and the washout. Reads slots version, condition and sequence (draw cell_main / cell_neutral before it).', 24),
    ('bre_end', 'Breath Attention – Screen 12 (end of tasks)',
     'Verbatim Screen 12 with the study code for the RA; sends end marker 255.', 1)
  ) AS v(subcategory, label, description, minutes)
 WHERE NOT EXISTS (SELECT 1 FROM public.activities a WHERE a.subcategory = v.subcategory);
