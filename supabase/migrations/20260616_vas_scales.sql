-- ============================================================
-- VAS Scales — reusable visual analogue scale objects
-- ============================================================

CREATE TABLE vas_scales (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        NOT NULL UNIQUE,
  question    text        NOT NULL,
  scale_type  text        NOT NULL DEFAULT 'emoji_6',
  anchors     jsonb       NOT NULL,
  created_by  uuid        NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vas_scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab members manage own scales"
  ON vas_scales FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "authenticated read scales"
  ON vas_scales FOR SELECT TO authenticated
  USING (true);

-- ============================================================

CREATE TABLE vas_responses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES profiles(id),
  scale_id      uuid        NOT NULL REFERENCES vas_scales(id),
  session_id    uuid        REFERENCES game_sessions(id),
  value         smallint    NOT NULL CHECK (value >= 1 AND value <= 100),
  responded_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vas_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows"
  ON vas_responses FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Seed: stress scale
-- Replace <SUPABASE_PROJECT_URL> before running manually.

INSERT INTO vas_scales (slug, question, scale_type, anchors, created_by)
VALUES (
  'stress',
  'Right now, how stressed are you feeling?',
  'emoji_6',
  '[
    {"value": 1, "label": "Not at all stressed", "emoji_url": "<SUPABASE_PROJECT_URL>/storage/v1/object/public/public-assets/vas-emojis/stress/stress_1.png"},
    {"value": 2, "label": "Slightly stressed",   "emoji_url": "<SUPABASE_PROJECT_URL>/storage/v1/object/public/public-assets/vas-emojis/stress/stress_2.png"},
    {"value": 3, "label": "Somewhat stressed",   "emoji_url": "<SUPABASE_PROJECT_URL>/storage/v1/object/public/public-assets/vas-emojis/stress/stress_3.png"},
    {"value": 4, "label": "Moderately stressed", "emoji_url": "<SUPABASE_PROJECT_URL>/storage/v1/object/public/public-assets/vas-emojis/stress/stress_4.png"},
    {"value": 5, "label": "Very stressed",        "emoji_url": "<SUPABASE_PROJECT_URL>/storage/v1/object/public/public-assets/vas-emojis/stress/stress_5.png"},
    {"value": 6, "label": "Extremely stressed",   "emoji_url": "<SUPABASE_PROJECT_URL>/storage/v1/object/public/public-assets/vas-emojis/stress/stress_6.png"}
  ]'::jsonb,
  (SELECT id FROM profiles WHERE role = 'lab' LIMIT 1)
);
