-- The class trial's two text arms: every lead-in now says "About 4 to 5 minutes"
-- (Norm, 2026-10-18).
--
-- Each classrct-* module's lead-in carried an "About N minutes" computed from
-- its own steps, and it undercounted: 25 s per written answer (students take
-- about 50) and nothing for the screens around the practice. On the trial's
-- first two days the whole check-in ran a median of 4 to 5 minutes in all three
-- arms, while the stress-mindset lead-ins said "About 3 minutes" for days that
-- took about 5. src/data/classRct/shared.js now gives every lead-in the measured
-- range (SESSION_LENGTH); this brings the live definitions into line.
--
-- Copy only, and only the lead-in: every classrct-* definition holds exactly one
-- "About N minute(s)", in lead_in.text (checked before applying), and no other
-- module uses the phrase. The rest of each definition is left as it is.

UPDATE intervention_modules
   SET definition = jsonb_set(
         definition, '{lead_in,text}',
         to_jsonb(regexp_replace(definition->'lead_in'->>'text', 'About \d+ minutes?', 'About 4 to 5 minutes')))
 WHERE module_id LIKE 'classrct-%'
   AND definition->'lead_in'->>'text' ~ 'About \d+ minutes?';
