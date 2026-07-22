-- Delve — sense-foraging attention game (slug: delve)
-- 1. delve_backgrounds content table (rotating background images, no admin UI in v1)
-- 2. delve_-prefixed session metrics on the shared performance table
--    (prefix-by-game-slug convention per delve_handoff_spec.md)

-- ============================================================
-- delve_backgrounds

CREATE TABLE delve_backgrounds (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text        NOT NULL,  -- path inside the public-assets bucket, e.g. delve-backgrounds/<slug>/<slug>.jpg
  title        text        NOT NULL,
  active       boolean     NOT NULL DEFAULT true,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delve_backgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read backgrounds"
  ON delve_backgrounds FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "lab write backgrounds"
  ON delve_backgrounds FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

-- ============================================================
-- performance: Delve session metrics
-- delve_duration_ms mirrors ended_at - started_at on game_sessions;
-- delve_avg_dwell_ms = mean duration of contiguous dwelling episodes
-- (pointer active AND velocity < DWELL_VELOCITY_PX_S), null if no episodes;
-- delve_background_id = background actually shown (null when the bundled
-- fallback image was used).

ALTER TABLE performance
  ADD COLUMN delve_duration_ms   integer,
  ADD COLUMN delve_avg_dwell_ms  float,
  ADD COLUMN delve_background_id uuid REFERENCES delve_backgrounds(id) ON DELETE SET NULL;

-- ============================================================
-- Seed: the prototype background (upload the file to Storage manually:
-- public-assets/delve-backgrounds/prototype-01/prototype-01.jpg)

INSERT INTO delve_backgrounds (storage_path, title, active, sort_order)
VALUES ('delve-backgrounds/prototype-01/prototype-01.jpg', 'Prototype 01', true, 0);
