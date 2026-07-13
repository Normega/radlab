-- U of T Student Equity Census (2025-2026 wording) — bespoke form instrument.
-- Component: src/components/study/EquityCensusStep.jsx
-- Registry:  src/components/study/advancedInstruments.js
-- Responses stored as one jsonb blob per completion; the question set is
-- versioned in the component, so the blob is self-describing snake_case keys
-- (gender_identity, trans_identity, sexual_orientation, disability, ...).

CREATE TABLE equity_census_responses (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES profiles(id),
  enrollment_id uuid        REFERENCES study_enrollments(id),
  schedule_id   uuid        REFERENCES participant_schedule(id),
  responses     jsonb       NOT NULL,
  completed_at  timestamptz DEFAULT now()
);

ALTER TABLE equity_census_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equity_census: own all"
  ON equity_census_responses FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "equity_census: lab read all"
  ON equity_census_responses FOR SELECT TO authenticated
  USING (my_role() = 'lab');

CREATE POLICY "equity_census: lab insert"
  ON equity_census_responses FOR INSERT TO authenticated
  WITH CHECK (my_role() = 'lab');

-- Session Builder picker entry (Forms category)
INSERT INTO activities (category, subcategory, label, description, estimated_minutes)
VALUES ('form', 'equity_census', 'U of T Student Equity Census',
        'Full U of T Student Equity Census (2025-2026): gender identity, trans identity, sexual orientation, disability, Indigenous identity, racial/ethnocultural identity, religion, parental education. Every question offers "Prefer not to answer".',
        10);
