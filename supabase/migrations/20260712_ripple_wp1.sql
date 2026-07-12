-- Ripple (Wellness Buddy v2) — WP1 schema
-- Spec: docs/markdowns/ripple_spec.md §7. Three tables:
--   ripples          — companion identity + interaction settings + streak state (1/user)
--   ripple_checkins  — one row per completed daily check-in
--   consents         — append-only versioned consent/ToS records (public tier)

-- ── ripples ──────────────────────────────────────────────────────────────────
CREATE TABLE ripples (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name               text,                     -- user-given; null until WP2 naming beat
  enabled            boolean     NOT NULL DEFAULT true,
  prompt_cadence     text        NOT NULL DEFAULT 'daily'
                     CHECK (prompt_cadence IN ('every_login', 'daily', 'weekly', 'never')),
  mood_mirror_header boolean     NOT NULL DEFAULT false,  -- guardrail 6: mood never public by default
  streak_current     integer     NOT NULL DEFAULT 0,
  streak_best        integer     NOT NULL DEFAULT 0,
  last_checkin_on    date,                     -- local-day anchor; streaks derive at write time, no cron
  last_greeted_on    date,                     -- prevents double-greeting in a day
  item_state         jsonb,                    -- rotating-item engine: {pool_id: {remaining: [], cycle: n}}
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ripples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ripples: own rows"
  ON ripples FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── ripple_checkins ──────────────────────────────────────────────────────────
-- Circumplex columns mirror stillwater_responses; stillwater_responses is
-- untouched and remains the standalone game's table.
CREATE TABLE ripple_checkins (
  id                     uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at             timestamptz NOT NULL DEFAULT now(),
  local_date             date        NOT NULL,  -- user-local day; one scoring check-in per day
  context                text        NOT NULL DEFAULT 'manual'
                         CHECK (context IN ('onboarding', 'login_prompt', 'manual')),
  pos_rating             integer,               -- 1–7, Sad↔Excited diagonal
  pos_x                  double precision,
  pos_y                  double precision,
  neg_rating             integer,               -- 1–7, Calm↔Tense diagonal
  neg_x                  double precision,
  neg_y                  double precision,
  composite_x            double precision,
  composite_y            double precision,
  composite_label        text,
  ambivalence_x          double precision,
  ambivalence_y          double precision,
  ambivalence_mag        double precision,
  items                  jsonb,                 -- rotating-item responses: [{item_id, bank_version, value}]
  intention              text,                  -- optional "one small thing for tomorrow" (spec §4.3)
  prev_intention_outcome text
                         CHECK (prev_intention_outcome IN ('did', 'partly', 'not_today')),
  UNIQUE (user_id, local_date)
);

ALTER TABLE ripple_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ripple_checkins: own rows"
  ON ripple_checkins FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ripple_checkins: lab read all"
  ON ripple_checkins FOR SELECT TO authenticated
  USING (public.my_role() = 'lab');

-- ── consents ─────────────────────────────────────────────────────────────────
-- Append-only by construction: INSERT + SELECT policies only; no UPDATE/DELETE
-- for authenticated. Versioning supports later re-consent under study protocols.
CREATE TABLE consents (
  id        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type  text        NOT NULL CHECK (doc_type IN ('consent', 'tos')),
  version   text        NOT NULL,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, doc_type, version)
);

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents: own insert"
  ON consents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "consents: own read"
  ON consents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "consents: lab read all"
  ON consents FOR SELECT TO authenticated
  USING (public.my_role() = 'lab');
