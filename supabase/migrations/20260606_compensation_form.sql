-- Compensation Form
-- Adds the "Compensation Form" step type for studies with mixed pay/credit participants.
--
-- 1. Inserts the activity row so the step appears in the session template builder.
-- 2. Creates participant_compensation to store each participant's compensation
--    choice along with their email (pay) or SONA ID (credit).

-- ── Activity row ──────────────────────────────────────────────────────────────
INSERT INTO activities (category, subcategory, label, estimated_minutes)
SELECT 'form', 'compensation', 'Compensation Form', 2
WHERE NOT EXISTS (
  SELECT 1 FROM activities WHERE category = 'form' AND subcategory = 'compensation'
);

-- ── participant_compensation table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participant_compensation (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id     uuid        REFERENCES study_enrollments(id),
  participant_id    text,       -- external_id from study_enrollments (RA-assigned label)
  study_id          uuid        REFERENCES studies(id),
  compensation_type text        NOT NULL CHECK (compensation_type IN ('pay', 'credit')),
  email             text,       -- set when compensation_type = 'pay'
  sona_id           text,       -- set when compensation_type = 'credit'
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE participant_compensation ENABLE ROW LEVEL SECURITY;

-- Lab members can read and write all compensation records
CREATE POLICY "lab full access" ON participant_compensation
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('lab', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('lab', 'admin')
  ));

-- Participants (secondary client) can insert their own record
CREATE POLICY "participant insert own" ON participant_compensation
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM study_enrollments
      WHERE id = enrollment_id AND profile_id = auth.uid()
    )
  );
