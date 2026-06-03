-- ============================================================
-- RADlab · Study Admin Redesign Migration
-- Run once in the Supabase SQL Editor
-- ============================================================

-- ── 1. Wipe old protocol/schedule machinery ───────────────────────────────────
-- No live participant data; CASCADE clears dependent rows.
TRUNCATE TABLE
  protocol_day_contacts,
  protocol_study_days,
  study_protocol_assignments,
  participant_schedule,
  participant_links,
  study_protocols
CASCADE;

-- ── 2. Update studies table ───────────────────────────────────────────────────
-- Drop the old check constraint so we can rename delivery_mode values.
ALTER TABLE studies DROP CONSTRAINT IF EXISTS studies_delivery_mode_check;

-- Rename legacy 'remote' → 'online_single'; add email-preference columns.
UPDATE studies SET delivery_mode = 'online_single' WHERE delivery_mode = 'remote';

ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS allow_restart          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminders_enabled      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_interval_days integer,
  ADD COLUMN IF NOT EXISTS reminder_max           integer,
  ADD COLUMN IF NOT EXISTS email_subject          text,
  ADD COLUMN IF NOT EXISTS email_body             text;

-- delivery_mode valid values going forward: 'in_person' | 'online_single' | 'online_longitudinal'

-- ── 3. New study_sessions table ───────────────────────────────────────────────
-- Joins a study to a session template with scheduling metadata.
CREATE TABLE IF NOT EXISTS study_sessions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id            uuid        NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  session_template_id uuid        NOT NULL REFERENCES session_templates(id),
  day_number          integer     NOT NULL DEFAULT 1,
  send_time           time        NOT NULL DEFAULT '09:00',
  link_expires_hours  integer     NOT NULL DEFAULT 48,
  label               text,
  order_index         integer     NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_sessions_study_id ON study_sessions(study_id);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_sessions: lab read"
  ON study_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab'));

CREATE POLICY "study_sessions: lab write"
  ON study_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab'));

-- ── 4. Recreate participant_schedule ──────────────────────────────────────────
DROP TABLE IF EXISTS participant_schedule CASCADE;

CREATE TABLE participant_schedule (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id   uuid        NOT NULL REFERENCES profiles(id),
  study_id         uuid        NOT NULL REFERENCES studies(id),
  study_session_id uuid        NOT NULL REFERENCES study_sessions(id),
  scheduled_date   date,
  send_time        time        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending',
  link_id          uuid,       -- FK to participant_links added below after that table exists
  attempts         integer     NOT NULL DEFAULT 0,
  completed_at     timestamptz,
  created_at       timestamptz DEFAULT now()
);
-- status valid values: 'pending' | 'link_sent' | 'unlocked' | 'completed' | 'expired'

CREATE INDEX IF NOT EXISTS participant_schedule_participant ON participant_schedule(participant_id);
CREATE INDEX IF NOT EXISTS participant_schedule_study       ON participant_schedule(study_id);

ALTER TABLE participant_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participant_schedule: lab all"
  ON participant_schedule FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab'));

CREATE POLICY "participant_schedule: own read"
  ON participant_schedule FOR SELECT
  USING (participant_id = auth.uid());

-- ── 5. Recreate participant_links ─────────────────────────────────────────────
DROP TABLE IF EXISTS participant_links CASCADE;

CREATE TABLE participant_links (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id    uuid        NOT NULL REFERENCES participant_schedule(id),
  participant_id uuid        NOT NULL REFERENCES profiles(id),
  study_id       uuid        NOT NULL REFERENCES studies(id),
  token          text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status         text        NOT NULL DEFAULT 'active',  -- 'active' | 'used' | 'expired' | 'revoked'
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS participant_links_token ON participant_links(token);

ALTER TABLE participant_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participant_links: lab all"
  ON participant_links FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab'));

CREATE POLICY "participant_links: own read"
  ON participant_links FOR SELECT
  USING (participant_id = auth.uid());

-- ── 6. Deferred FK: participant_schedule.link_id → participant_links ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'participant_schedule_link_id_fkey'
      AND table_name = 'participant_schedule'
  ) THEN
    ALTER TABLE participant_schedule
      ADD CONSTRAINT participant_schedule_link_id_fkey
      FOREIGN KEY (link_id) REFERENCES participant_links(id);
  END IF;
END $$;

-- ── 7. Profile additions ──────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sona_id      text,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false;

-- ── 8. Unified study_enrollments ─────────────────────────────────────────────
-- Replaces old study_enrollments (in-person schema) and participant_consent.
DROP TABLE IF EXISTS study_enrollments  CASCADE;
DROP TABLE IF EXISTS participant_consent CASCADE;

-- Drop the 'participant_consents' (with 's') table that some older queries reference.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'participant_consents'
  ) THEN
    DROP TABLE public.participant_consents CASCADE;
  END IF;
END $$;

CREATE TABLE study_enrollments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id     uuid        NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  profile_id   uuid        REFERENCES profiles(id),
  external_id  text,
  enrolled_by  uuid        REFERENCES profiles(id),
  enrolled_at  timestamptz DEFAULT now(),
  consent_date timestamptz,
  status       text        NOT NULL DEFAULT 'enrolled',  -- enrolled | in_progress | completed | withdrawn
  notes        text
);

-- Prevent double-enrollment of the same external ID in one study.
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_external
  ON study_enrollments(study_id, external_id)
  WHERE external_id IS NOT NULL;

-- Prevent the same Supabase profile from being enrolled twice in one study.
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_profile
  ON study_enrollments(study_id, profile_id)
  WHERE profile_id IS NOT NULL;

ALTER TABLE study_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_enrollments: lab all"
  ON study_enrollments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'lab'));

CREATE POLICY "study_enrollments: own read"
  ON study_enrollments FOR SELECT
  USING (profile_id = auth.uid());
