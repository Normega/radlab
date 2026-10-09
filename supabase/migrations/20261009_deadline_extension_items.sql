-- radlab-academic. The Extensions page for PSY309 (Norm, 2026-10-09): widen the
-- items an extension can be for, so a course whose assessments are not the
-- PSY240 contribution/quiz/midterm/final set can record its own.
--
-- PSY309's assessments (2026 syllabus): Term Test 1 and 2, five Practical
-- assignments, a research poster with its recording, poster peer review, and a
-- final paper. Which practical goes in item_detail ("Practical 3"), the same way
-- a weekly quiz's number does. Which items a course OFFERS is a frontend registry
-- (courseFeatures.js extensionItems); this constraint is only the union of every
-- course's vocabulary, so a row can never carry an item nobody can label.

ALTER TABLE public.deadline_extensions DROP CONSTRAINT IF EXISTS deadline_extensions_item_check;
ALTER TABLE public.deadline_extensions ADD CONSTRAINT deadline_extensions_item_check
  CHECK (item IN ('contribution_1', 'contribution_2', 'contribution_3',
                  'weekly_quiz', 'midterm', 'final_exam',
                  'term_test_1', 'term_test_2', 'practical', 'poster', 'peer_review', 'final_paper',
                  'other'));
