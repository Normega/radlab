-- ── Questionnaire library ────────────────────────────────────────────────
-- Global questionnaire library. Any study can reference a questionnaire by slug.
-- Run in Supabase SQL editor.

CREATE TABLE questionnaires (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        text UNIQUE NOT NULL,         -- e.g. 'panas', 'ders'
  name        text NOT NULL,                -- display name
  definition  jsonb NOT NULL,              -- full JSON schema (see below)
  locked      boolean DEFAULT false,        -- locked prevents accidental edits
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER questionnaires_updated_at
  BEFORE UPDATE ON questionnaires
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;

-- Lab members: full access
CREATE POLICY "questionnaires_lab_all"
  ON questionnaires
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'lab'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'lab'
  );

-- Authenticated users: read only (for delivery during studies)
CREATE POLICY "questionnaires_auth_read"
  ON questionnaires FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── JSON schema reference ─────────────────────────────────────────────────
--
-- {
--   "slug": "panas",
--   "name": "PANAS",
--   "auto_advance": true,           // optional, default true
--   "instructions": "...",
--   "scale_labels": [               // questionnaire-level default
--     { "value": 1, "label": "Very slightly or not at all", "image": null },
--     { "value": 5, "label": "Extremely", "image": null }
--   ],
--   "items": [
--     {
--       "id": "panas_1",
--       "text": "Interested",
--       "type": "likert",
--       "scale_min": 1,
--       "scale_max": 5,
--       "subscale": "positive",        // optional
--       "reverse_score": false,
--       "required": true,
--       "scale_labels_override": null  // or array of { value, label, image }
--     }
--   ],
--   "scoring": {                       // optional
--     "subscales": {
--       "positive": { "items": ["panas_1"], "method": "sum" }
--     }
--   }
-- }
--
-- Image labels: set "image" to a path relative to /public/,
-- e.g. "scale_images/vas_face_1.png". Falls back to ? if file not found.
