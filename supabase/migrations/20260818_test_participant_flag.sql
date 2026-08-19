-- Mark test participants, and repair session_name on seeded rows.
--
-- TWO PROBLEMS, ONE CAUSE.
--
-- Liliana reported that `liliana_day_data.session_name` "looks a little odd".
-- It is not: all 218 rows written by the app read `Phase 1 · Day 2`, exactly as
-- `TrainingStepWrapper` composes them. The 58 odd rows — reading
-- `reappraisal-phase1-day1`, i.e. the module id — were **seeded by Claude**
-- while building test participants for her midpoint review and Norm's Day 12
-- gate check. The seeding scripts set `session_name` to the module id because
-- nothing was reading it; that assumption was wrong the moment the study was
-- exported for analysis.
--
-- The deeper issue is that those test participants are indistinguishable from
-- real ones in the export. They carry fabricated ratings, day rows and
-- assignments, and they inflate every `_n` participation count. An analyst
-- filtering by `status = 'withdrawn'` would not catch them either — real
-- participants withdraw too.
--
-- So: an explicit flag, exported as a column, rather than a naming convention
-- that only whoever created the accounts would recognise.
--
-- WHY A FLAG AND NOT A DELETE. Some of these accounts hold BOTH fabricated rows
-- and genuine click-through data from real browser testing (909101 and 909102
-- appear in both sets). Deleting by participant would destroy evidence that the
-- session flow works; deleting by row would need a judgement per row. Marking
-- the enrollment is honest, reversible, and lets the export carry the
-- distinction instead of hiding it.

ALTER TABLE study_enrollments
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN study_enrollments.is_test IS
  'Participant created for testing, not recruitment. Their data is fabricated or exercised by staff and must be excluded from analysis. Surfaced in the study export as is_test.';

-- Flag the known test accounts on Liliana Study 3 (both studies).
-- Matched by the naming conventions actually used: dryrun-*, SIM_*, the
-- 9090xx/9091xx block Norm and Claude created, and the 1000xx accounts from the
-- July dry run. Deliberately explicit rather than a LIKE sweep over all studies.
UPDATE study_enrollments e
   SET is_test = true
  FROM studies s
 WHERE s.id = e.study_id
   AND s.name LIKE 'Liliana Study 3%'
   AND (
        e.external_id LIKE 'dryrun-%'
     OR e.external_id LIKE 'SIM\_%'
     OR e.external_id LIKE '9090%'
     OR e.external_id LIKE '9091%'
     OR e.external_id LIKE '1000%'
     OR e.external_id = '%survey_code%'
   );

-- Repair the seeded session_name values so the column is consistent everywhere.
-- `data ? 'seeded'` is the marker the seeding scripts wrote, so this touches
-- only rows Claude fabricated — never a row written by a participant.
UPDATE liliana_day_data ldd
   SET session_name = CASE
         WHEN im.phase = 'phase1' THEN 'Phase 1 · Day ' || ldd.study_day
         WHEN im.phase = 'phase2' THEN 'Phase 2 · Day ' || ldd.study_day
         ELSE ldd.session_name
       END
  FROM intervention_modules im
 WHERE im.module_id = ldd.module_id
   AND ldd.data ? 'seeded'
   AND ldd.session_name LIKE '%-phase%-day%';
