-- The class trial's stress-mindset Graduation (classrct-ra-d28): the lead-in no
-- longer ends on a question the session never asks (Norm, 2026-10-18).
--
-- Liliana's Graduation lead-in ends "Please answer the following short
-- questions: 1. Which cognitive reappraisal skills or strategies stood out most
-- to you during these exercises?". The class version dropped that question on
-- 2026-09-30 (it overlaps "most helpful"), but the lead-in kept it, and the
-- session length was appended after its question mark. src/data/classRct/
-- reappraisal.js now cuts it (LEAD_CUT); this brings the live definition into
-- line. The questions that remain follow on their own screens.
--
-- Copy only: one module, the lead-in text only. Liliana's own module
-- (reappraisal-phase2-day12) is untouched.

UPDATE intervention_modules
   SET definition = jsonb_set(
         definition, '{lead_in,text}',
         to_jsonb(replace(definition->'lead_in'->>'text',
           E'\n\nPlease answer the following short questions:\n\n1. Which cognitive reappraisal skills or strategies stood out most to you during these exercises?',
           '')))
 WHERE module_id = 'classrct-ra-d28'
   AND position(E'1. Which cognitive reappraisal skills' in definition->'lead_in'->>'text') > 0;
