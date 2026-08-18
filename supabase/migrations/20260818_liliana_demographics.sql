-- Liliana Study 3 — full demographics instrument.
-- Component: src/components/study/LilianaDemographicsStep.jsx
-- Registry:  src/components/study/advancedInstruments.js
--
-- WHY A THIRD DEMOGRAPHICS TABLE. The platform already had two instruments and
-- neither matched Liliana's approved design (`demographics-preview.html`,
-- 18 June 2026 — 7 sections, 23 questions):
--
--   * `demographics` collects four items (age, gender free-text, racialized,
--     SES ladder). Liliana's Study 3 baseline was authored against THIS one,
--     which is why the live-test export carried only four demographic columns
--     and most of the designed battery was never collected.
--   * `equity_census_responses` covers the identity half thoroughly, but the
--     U of T census has no Academic Life or Work & Finances section: no student
--     status, campus, faculty, living arrangement, household income, country of
--     birth, primary language, marital status or employment.
--
-- Rather than widen the census (which is a faithful reproduction of a published
-- instrument and should stay that way) or bolt columns onto the four-item step,
-- this is one reviewable module for the study, with the identity questions
-- REUSING the census's exported option sets so the shared wording cannot drift.
--
-- Shape mirrors equity_census_responses exactly: one jsonb blob per completion,
-- self-describing snake_case keys, question set versioned in the component.

CREATE TABLE liliana_demographics (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES profiles(id),
  enrollment_id uuid        REFERENCES study_enrollments(id),
  schedule_id   uuid        REFERENCES participant_schedule(id),
  responses     jsonb       NOT NULL,
  completed_at  timestamptz DEFAULT now()
);

ALTER TABLE liliana_demographics ENABLE ROW LEVEL SECURITY;

-- Per CLAUDE.md: a table with RLS enabled and no matching policy silently
-- blocks every write with no client-side error. Policies mirror
-- equity_census_responses.
CREATE POLICY "liliana_demographics: own all"
  ON liliana_demographics FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "liliana_demographics: lab read all"
  ON liliana_demographics FOR SELECT TO authenticated
  USING (my_role() = 'lab');

CREATE POLICY "liliana_demographics: lab insert"
  ON liliana_demographics FOR INSERT TO authenticated
  WITH CHECK (my_role() = 'lab');

-- Session Builder picker entry (Forms category)
INSERT INTO activities (category, subcategory, label, description, estimated_minutes)
VALUES ('form', 'liliana_demographics', 'Liliana Study 3 Demographics',
        'Full demographic battery for Liliana Study 3 (7 sections, 23 questions): age, gender identity, trans identity, sexual orientation, race/ethnocultural identity, religion and religiosity, disability, Academic Life (student status, domestic/international, residence, living arrangement, campus, faculty, parental education) and Work & Finances (paid work hours, country of birth, primary language, household income, marital status, employment). Identity questions reuse the U of T Equity Census wording.',
        8);
