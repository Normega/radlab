CREATE TABLE vas_packages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  description text,
  scale_ids   jsonb       NOT NULL DEFAULT '[]',
  created_by  uuid        NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vas_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab members manage own packages"
  ON vas_packages FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "authenticated read packages"
  ON vas_packages FOR SELECT TO authenticated
  USING (true);
