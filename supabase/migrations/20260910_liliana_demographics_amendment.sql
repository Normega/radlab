-- Liliana Study 3 demographics — September 2026 ethics amendment
--
-- Ethics approved four additional baseline covariates. The instrument goes
-- from 7 sections / 23 questions to 8 / 27:
--
--   Academic Life  + commutes_to_campus        (yes/no)
--                  + commute_time_one_way      (4 bands; asked only if commuting)
--   Mental Health   (new section)
--                  + receiving_therapy         (yes/no/prefer not to say)
--                  + mental_health_medication  (multi-select, 5 classes + other + PNA)
--                  + mental_health_medication_other
--
-- NO SCHEMA CHANGE. `liliana_demographics.responses` is a jsonb blob and
-- `studyExport.js` walks its keys generically (mergeJsonResponses), so the new
-- fields export as ldem_* columns with no exporter change either. This
-- migration exists only to keep the Session Builder picker description honest —
-- it is the one place in the database that describes the instrument's contents,
-- and a stale description there is how the wrong instrument gets picked.
--
-- The Baseline session template already points at this activity
-- (20260819_liliana_baseline_demographics_swap.sql), so no template edit is
-- needed: the new questions appear as soon as the frontend deploys.

UPDATE activities
   SET description = 'Full demographic battery for Liliana Study 3 (8 sections, 27 questions): '
                     'age, gender identity, trans identity, sexual orientation, '
                     'race/ethnocultural identity, religion and religiosity, disability, '
                     'Academic Life (student status, domestic/international, residence, '
                     'living arrangement, campus, commute and commute time, faculty, '
                     'parental education), Work & Finances (paid work hours, country of birth, '
                     'primary language, household income, marital status, employment) and '
                     'Mental Health (current talk therapy, current psychiatric medication). '
                     'Identity questions reuse the U of T Equity Census wording.',
       estimated_minutes = 9
 WHERE category = 'form'
   AND subcategory = 'liliana_demographics';
