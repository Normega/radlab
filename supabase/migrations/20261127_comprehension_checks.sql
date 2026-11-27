-- Comprehension checks on game start screens (Norm, 2026-11-27, Sandy Study 4 pilot).
-- Before each game the participant answers multiple-choice questions about its
-- instructions; Begin stays disabled until every answer is correct. Wrong answers
-- are logged (how many per question, and which), never scored.
--
-- A study setting: studies.comprehension_checks maps a game key to a composable
-- instrument of the new type 'comprehension_check', whose config holds the
-- questions. Default '{}' = no checks, so Sandy Study 3 (which shares the Aptitude
-- Suite and ColourMax and still takes Prolific joins) is unchanged. Read by
-- src/components/study/useComprehensionCheck.js; saved as one instrument_responses
-- row per check (existing table, grants and append-only triggers unchanged).
-- The frontend is on dev for review; until it reaches main this does nothing.
--
-- Draft questions, for Norm's approval: options are kept to similar length and the
-- correct one moves between positions. Editing them later is an UPDATE of the
-- config, before anyone real answers.

BEGIN;

alter table public.composable_instruments drop constraint composable_instruments_type_check;
alter table public.composable_instruments add constraint composable_instruments_type_check
  check (type = any (array['likert_slider', 'multiple_choice', 'open_list', 'open_text', 'hierarchy',
                           'embedded_practice', 'practice_task', 'comprehension_check']));

alter table public.studies add column comprehension_checks jsonb not null default '{}'::jsonb;

comment on column public.studies.comprehension_checks is
  'Game key (aptitude_suite, color_max, foggy_valleys) -> slug of a comprehension_check composable instrument shown on that game''s start screen; Begin waits until every answer is correct. Set before anyone plays; never change it mid-study.';

insert into public.composable_instruments (slug, type, label, config) values
('s4_check_aptitude', 'comprehension_check', 'Study 4 comprehension check: Aptitude Suite', $json$
{
  "title": "Check your understanding",
  "intro": "Before you begin, answer these three questions about the instructions above. You can read them again while you answer.",
  "questions": [
    { "id": "time", "text": "How do the 8 minutes work?", "correct": "b", "options": [
      { "id": "a", "text": "You work on one task at a time and move on when its time ends." },
      { "id": "b", "text": "You have 8 minutes in all and can switch between the tasks freely." },
      { "id": "c", "text": "You have 8 minutes for each task, so 24 minutes altogether." } ] },
    { "id": "grey", "text": "In Word Probe, what does a grey letter mean?", "correct": "c", "options": [
      { "id": "a", "text": "The letter is in the hidden word, but in a different position." },
      { "id": "b", "text": "The letter is in the hidden word, and in the right position." },
      { "id": "c", "text": "The letter is not in the hidden word at all." } ] },
    { "id": "score", "text": "How is your overall score worked out?", "correct": "a", "options": [
      { "id": "a", "text": "It is the average of your three percentile ranks against other participants." },
      { "id": "b", "text": "It is the number of words you got right, added up across all three tasks." },
      { "id": "c", "text": "It is your score on whichever one of the three tasks you did best." } ] }
  ]
}
$json$::jsonb),
('s4_check_colourmax', 'comprehension_check', 'Study 4 comprehension check: ColourMax', $json$
{
  "title": "Check your understanding",
  "intro": "Before you start, answer these three questions about the instructions above. You can read them again while you answer.",
  "questions": [
    { "id": "images", "text": "How do the 5 images and 5 minutes work?", "correct": "c", "options": [
      { "id": "a", "text": "You must finish each image before the next one opens." },
      { "id": "b", "text": "You have 1 minute for each image, and then it moves on." },
      { "id": "c", "text": "You can switch between the 5 images at any time." } ] },
    { "id": "colour", "text": "How do you know which colour goes in a region?", "correct": "b", "options": [
      { "id": "a", "text": "Any colour you like; every colour scores the same." },
      { "id": "b", "text": "Use the colour that matches the number in the region." },
      { "id": "c", "text": "Copy the colours from a finished picture shown first." } ] },
    { "id": "score", "text": "What are you scored on?", "correct": "a", "options": [
      { "id": "a", "text": "How completely and how precisely you colour the regions." },
      { "id": "b", "text": "How quickly you finish colouring the first of the images." },
      { "id": "c", "text": "How many different brushes and colours you make use of." } ] }
  ]
}
$json$::jsonb),
('s4_check_foggy_valleys', 'comprehension_check', 'Study 4 comprehension check: Foggy Valleys', $json$
{
  "title": "Check your understanding",
  "intro": "Before you begin, answer these three questions about the instructions above. You can read them again while you answer.",
  "questions": [
    { "id": "click", "text": "Where do you click?", "correct": "a", "options": [
      { "id": "a", "text": "Anywhere the two pictures differ, on either picture." },
      { "id": "b", "text": "Only on the left picture, wherever something is missing." },
      { "id": "c", "text": "On the fog itself, to make the picture clear faster." } ] },
    { "id": "wrong", "text": "What happens when you click somewhere that is not a difference?", "correct": "b", "options": [
      { "id": "a", "text": "Each wrong click takes away one of your points, starting with the very first one you make." },
      { "id": "b", "text": "The first one in each picture is free; after that, each pauses both pictures for 3 seconds." },
      { "id": "c", "text": "The picture is swapped for a new one, which then arrives covered in fog all over again." } ] },
    { "id": "next", "text": "Can you move on before you have found every difference?", "correct": "c", "options": [
      { "id": "a", "text": "No. Each picture stays until you have found all of its differences." },
      { "id": "b", "text": "Only after the fog has cleared and you have searched for a minute." },
      { "id": "c", "text": "Yes. Press Next picture at any time; the new one has to clear first." } ] }
  ]
}
$json$::jsonb);

update public.studies
   set comprehension_checks = '{"aptitude_suite": "s4_check_aptitude", "color_max": "s4_check_colourmax", "foggy_valleys": "s4_check_foggy_valleys"}'::jsonb
 where id = '0ba55341-0931-4ee3-9c44-f7d31af758da';  -- Sandy Study 4

COMMIT;
