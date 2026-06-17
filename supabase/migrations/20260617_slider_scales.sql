-- Reusable named slider configurations for training modules
CREATE TABLE IF NOT EXISTS slider_scales (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        text        NOT NULL UNIQUE,
  prompt      text        NOT NULL,
  min         int         NOT NULL DEFAULT 1,
  max         int         NOT NULL DEFAULT 6,
  min_label   text        NOT NULL DEFAULT '',
  max_label   text        NOT NULL DEFAULT '',
  created_by  uuid        REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE slider_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read" ON slider_scales
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lab write" ON slider_scales
  FOR ALL TO authenticated
  USING  (my_role() IN ('lab','admin'))
  WITH CHECK (my_role() IN ('lab','admin'));

-- Allow slider responses in intervention_responses.
-- response_text is no longer required for non-text block types.
ALTER TABLE intervention_responses
  ALTER COLUMN response_text DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS block_type     text,
  ADD COLUMN IF NOT EXISTS response_value jsonb;
