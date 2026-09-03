-- Open text response instrument (composable type `open_text`).
--
-- The package Dana handed over had `open_text_list` — participant-generated
-- factors, each forcing a contribution slider — but nothing for a plain
-- free-response answer, so a study needing one open question had no component
-- at all. Found 2026-09-03 building the CHM135 study; the chemistry course
-- wanted the same thing.
--
-- Two constraints have to admit the new type before anything can be authored:
--
-- 1. composable_instruments.type — the library table's own CHECK.
-- 2. activities.category — the session-builder picker reads `activities`, not
--    the instrument table, so without this an instrument saves fine and is
--    then invisible to every session (exactly the failure mode
--    20260707_activities_category_add_display.sql documents, where the
--    activities insert was caught-and-warned and no display ever appeared).

-- ── 1. composable_instruments.type ───────────────────────────────────────────
ALTER TABLE composable_instruments
  DROP CONSTRAINT IF EXISTS composable_instruments_type_check;

ALTER TABLE composable_instruments
  ADD CONSTRAINT composable_instruments_type_check
  CHECK (type = ANY (ARRAY[
    'likert_slider'::text,
    'multiple_choice'::text,
    'open_list'::text,
    'open_text'::text,
    'hierarchy'::text
  ]));

-- ── 2. activities.category ───────────────────────────────────────────────────
-- Re-stated in full (the constraint enumerates every allowed category, so it
-- has to be dropped and rebuilt rather than extended).
ALTER TABLE activities DROP CONSTRAINT activities_category_check;

ALTER TABLE activities ADD CONSTRAINT activities_category_check
  CHECK (category = ANY (ARRAY[
    'form'::text, 'game'::text, 'questionnaire'::text, 'physio'::text,
    'training'::text, 'vas'::text, 'display'::text, 'midpoint'::text,
    'video'::text, 'assessment_leadin'::text, 'daily_welcome'::text,
    'daily_farewell'::text, 'likert_slider'::text, 'numeric_slider'::text,
    'multiple_choice'::text, 'open_list'::text, 'open_text'::text,
    'hierarchy'::text, 'assessment'::text
  ]));
