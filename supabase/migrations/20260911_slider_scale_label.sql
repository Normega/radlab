-- Numeric sliders get a name of their own.
--
-- WHY. Every other instrument family carries a human-readable label beside its
-- slug (`composable_instruments.label`), and the session-builder picker, the
-- instrument library and the admin lists all show that label. `slider_scales`
-- has only `prompt` — the question itself — and its slug is slugify(prompt).
-- So a numeric slider reads, everywhere a researcher meets it, as the entire
-- question wording joined by underscores:
--
--   slider_to_what_extent_would_constraints_in_your_life_make_it_difficult_to_
--   do_what_is_needed_to_improve_your_future_performance_constraints_limited_
--   time_energy_work_or_family_responsibilities_course_rules_lack_of_access...
--
-- Reported by Norm, 2026-09-11, building Dana's CHM135 and PHL245 sessions.
--
-- Additive and nullable on purpose: a row without a name still displays its
-- prompt, exactly as today, and nothing has to be backfilled.
--
-- The slug is NOT touched, here or by the rename UI this migration supports.
-- It is the key a session step resolves (`activities.subcategory` =
-- 'slider_<slug>'), and slider answers record it at write time as
-- `questionnaire_responses.questionnaire_slug` = 'slider_<slug>'. Changing a
-- slug would strand live session steps AND split one variable across two
-- export columns — the recorded-fact rule (CLAUDE.md, participant data #3).
-- Renaming therefore changes only what humans read.

ALTER TABLE public.slider_scales
  ADD COLUMN IF NOT EXISTS label text;

COMMENT ON COLUMN public.slider_scales.label IS
  'Human-readable name for the library and the session-builder picker. NULL falls back to the prompt. Never used to name an export column — that comes from the slug recorded on each response.';
