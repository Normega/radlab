-- ============================================================
-- RADlab · Debrief Forms Migration
-- Apply once in the Supabase SQL Editor
--
-- Also create a 'debrief-forms' Storage bucket in the
-- Supabase dashboard (Storage → New bucket, private).
-- ============================================================

-- ─── 1. Debrief forms table (mirrors study_consent_forms) ────────────────────

CREATE TABLE IF NOT EXISTS study_debrief_forms (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id      uuid REFERENCES studies(id) ON DELETE CASCADE,
  docx_url      text,
  html_content  text,
  uploaded_by   uuid REFERENCES profiles(id),
  uploaded_at   timestamptz DEFAULT now()
);

ALTER TABLE study_debrief_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_debrief_forms: lab read/write"
  ON study_debrief_forms FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('lab', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('lab', 'admin')));

-- ─── 2. Active debrief form pointer on studies ────────────────────────────────

ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS active_debrief_form_id uuid REFERENCES study_debrief_forms(id) ON DELETE SET NULL;
