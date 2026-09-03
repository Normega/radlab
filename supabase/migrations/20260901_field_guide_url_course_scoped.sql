-- Project: MAIN radlab
--
-- Phase 4: classes.field_guide_url stops pointing at the shared legacy join
-- door and points at each class's own course-scoped one. The value is served
-- to anon via class_public_info and rendered as the class page's Field Guide
-- card for visitors without a Field Guide session, so this was gated on the
-- /academic/:courseCode routes reaching production (promoted 2026-09-01).
--
-- Slug-based on purpose: classes.slug IS the lowercase course code by
-- convention, and a class created later gets the right URL from the same
-- rule. Rows with a NULL field_guide_url (no Field Guide for that class)
-- stay NULL.

update classes
set field_guide_url = 'https://radlab.zone/academic/' || slug || '/join'
where field_guide_url is not null;
