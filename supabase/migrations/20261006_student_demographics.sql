-- RADlab Standard Student Demographic Survey.
--
-- Successor to liliana_demographics, which it deliberately leaves alone.
-- `20260818_liliana_demographics.sql` created that instrument, and it was in
-- active collection when this was written (25 completions that week, 57 the
-- week before, 292 enrollments on the Paid arm inside 14 days). Merging two of
-- its questions and deleting a third would have put a before/after
-- discontinuity inside a live dataset, and the three added questions would have
-- needed cover under that study's protocol rather than the new one's. So
-- Liliana's study keeps pointing at `form/liliana_demographics` and adopts this
-- instrument after her wave closes.
--
-- Shape mirrors liliana_demographics and equity_census_responses exactly: one
-- jsonb blob per completion, self-describing snake_case keys, question set
-- versioned in the component (StudentDemographicsStep.jsx).
--
-- The component writes `uoft_residence`, `has_job` and `job_type` even though
-- those questions no longer exist, deriving them from the merged living-
-- arrangement question and from paid work hours. That is what lets this table
-- and liliana_demographics be pooled on the same keys without a translation
-- step, and it is why dropping the questions cost no data.

CREATE TABLE student_demographics (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES profiles(id),
  enrollment_id uuid        REFERENCES study_enrollments(id),
  schedule_id   uuid        REFERENCES participant_schedule(id),
  responses     jsonb       NOT NULL,
  completed_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE student_demographics IS
  'RADlab standard student demographics, 8 sections / 28 questions. Successor to liliana_demographics; both are kept because that study was mid-collection. Pools with it on shared keys.';

ALTER TABLE student_demographics ENABLE ROW LEVEL SECURITY;

-- Per CLAUDE.md: a table with RLS enabled and no matching policy silently
-- blocks every write with no client-side error. Policies mirror
-- liliana_demographics.
CREATE POLICY "student_demographics: own all"
  ON student_demographics FOR ALL TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "student_demographics: lab read all"
  ON student_demographics FOR SELECT TO authenticated
  USING (my_role() = 'lab');

CREATE POLICY "student_demographics: lab insert"
  ON student_demographics FOR INSERT TO authenticated
  WITH CHECK (my_role() = 'lab');

-- Session Builder picker entry (Forms category). StepDispatcher dispatches on
-- `subcategory`, so this string is the contract between the builder and the
-- component.
INSERT INTO activities (category, subcategory, label, description, estimated_minutes)
VALUES ('form', 'student_demographics', 'RADlab Standard Student Demographic Survey',
        'The lab standard demographic battery: 8 sections, 28 questions. Age, year of study, gender identity, trans identity, sexual orientation, race and ethnocultural identity (Equity Census hierarchy, so Indigenous identity branches to First Nations, Inuk, Metis, Native American and Native Hawaiian), religion and religiosity, disability; Academic Life (student status, domestic/international, living arrangement, household size, campus, commute, faculty, parental education); Work and Finances (paid work hours, country of birth, primary language, household income, marital status); Mental Health (therapy in the past 12 months, therapy now, current medication). Six questions are gated, so a typical respondent sees about 23. Identity questions reuse the U of T Equity Census wording. Replaces Liliana Study 3 Demographics for new studies.',
        3);
