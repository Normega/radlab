-- ============================================================
-- RADlab · Study Infrastructure Migration
-- Apply once in the Supabase SQL Editor
-- ============================================================

-- ─── 1.1 Activities Registry ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activities (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category          text NOT NULL CHECK (category IN ('form', 'game', 'questionnaire')),
  subcategory       text NOT NULL,
  label             text NOT NULL,
  description       text,
  estimated_minutes int,
  config_schema     jsonb,
  is_active         bool DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

INSERT INTO activities (category, subcategory, label) VALUES
  ('form',          'consent',      'Consent Form'),
  ('form',          'debrief',      'Debrief Form'),
  ('questionnaire', 'panas',        'PANAS'),
  ('questionnaire', 'ders',         'DERS'),
  ('game',          'pond_watch',   'Pond Watch'),
  ('game',          'ebb_and_flow', 'Ebb and Flow'),
  ('game',          'farm_joy',     'Farm Joy')
ON CONFLICT DO NOTHING;

-- ─── 1.2 Session Templates ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_templates (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id      uuid REFERENCES profiles(id),
  label       text NOT NULL,
  description text,
  cloned_from uuid REFERENCES session_templates(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS session_template_nodes (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_template_id uuid REFERENCES session_templates(id) ON DELETE CASCADE,
  order_index         int NOT NULL,
  activity_id         uuid REFERENCES activities(id),
  label               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE session_template_nodes ENABLE ROW LEVEL SECURITY;

-- ─── 1.3 Study Protocols ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS study_protocols (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lab_id                  uuid REFERENCES profiles(id),
  label                   text NOT NULL,
  created_by              uuid REFERENCES profiles(id),
  is_template             bool DEFAULT false,
  cloned_from             uuid REFERENCES study_protocols(id),
  visibility              text DEFAULT 'private' CHECK (visibility IN ('private', 'platform')),
  protocol_type           text DEFAULT 'scheduled' CHECK (protocol_type IN ('single_shot', 'scheduled')),
  enrollment_protocol_id  uuid REFERENCES study_protocols(id),
  session_template_id     uuid,  -- used for single_shot protocols; FK added after session_templates exists
  allow_restart           bool DEFAULT false,
  max_attempts            int DEFAULT 1,
  reminders_enabled       bool DEFAULT false,
  reminder_interval_hours int,
  reminder_max            int,
  created_at              timestamptz DEFAULT now()
);

-- Deferred FK: study_protocols.session_template_id → session_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'study_protocols_session_template_id_fkey'
      AND table_name = 'study_protocols'
  ) THEN
    ALTER TABLE study_protocols
      ADD CONSTRAINT study_protocols_session_template_id_fkey
      FOREIGN KEY (session_template_id) REFERENCES session_templates(id);
  END IF;
END $$;

ALTER TABLE study_protocols ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS study_protocol_assignments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id    uuid REFERENCES studies(id),
  protocol_id uuid REFERENCES study_protocols(id),
  assigned_at timestamptz DEFAULT now(),
  notes       text
);

ALTER TABLE study_protocol_assignments ENABLE ROW LEVEL SECURITY;

-- ─── 1.4 Protocol Nodes ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS protocol_nodes (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id    uuid REFERENCES study_protocols(id) ON DELETE CASCADE,
  parent_node_id uuid REFERENCES protocol_nodes(id),
  order_index    int NOT NULL,
  node_type      text DEFAULT 'activity' CHECK (node_type IN ('activity', 'branch')),
  activity_id    uuid REFERENCES activities(id),
  branch_config  jsonb,
  label          text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE protocol_nodes ENABLE ROW LEVEL SECURITY;

-- ─── 1.5 Studies additions ───────────────────────────────────────────────────

ALTER TABLE studies
  ADD COLUMN IF NOT EXISTS messaging_required bool NOT NULL DEFAULT false;

-- ─── 1.6 Study Tasks ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS study_tasks (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id          uuid REFERENCES studies(id),
  protocol_id       uuid REFERENCES study_protocols(id),
  order_index       int NOT NULL,
  task_type         text CHECK (task_type IN ('game', 'questionnaire', 'form')),
  task_ref_id       uuid REFERENCES activities(id),
  repeatable        bool DEFAULT false,
  unlock_conditions jsonb DEFAULT '[]',
  window_hours      int DEFAULT 48,
  label             text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;

-- ─── 1.7 Protocol Study Days & Contacts ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS protocol_study_days (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id uuid REFERENCES study_protocols(id) ON DELETE CASCADE,
  day_number  int NOT NULL,
  day_of_week text CHECK (day_of_week IN ('mon','tue','wed','thu','fri','sat','sun')),
  label       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE protocol_study_days ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS protocol_day_contacts (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  study_day_id        uuid REFERENCES protocol_study_days(id) ON DELETE CASCADE,
  contact_order       int NOT NULL,
  send_time           time NOT NULL,
  session_template_id uuid REFERENCES session_templates(id),
  link_expires_hours  int DEFAULT 48,
  label               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE protocol_day_contacts ENABLE ROW LEVEL SECURITY;

-- ─── 1.8 Participant Consent ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS participant_consent (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id  uuid REFERENCES profiles(id),
  study_id        uuid REFERENCES studies(id),
  consented_at    timestamptz DEFAULT now(),
  email_reminders bool DEFAULT false,
  sms_reminders   bool DEFAULT false,
  esm_prompts     bool DEFAULT false,
  messaging_basis text CHECK (messaging_basis IN ('research_exemption', 'explicit_consent')),
  consent_version text,
  withdrawn_at    timestamptz
);

ALTER TABLE participant_consent ENABLE ROW LEVEL SECURITY;

-- ─── 1.9 Participant Links ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS participant_links (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token                text UNIQUE NOT NULL,
  participant_id       uuid REFERENCES profiles(id),
  protocol_id          uuid REFERENCES study_protocols(id),
  schedule_instance_id uuid,  -- FK to participant_schedule added below
  attempt_number       int DEFAULT 1,
  created_at           timestamptz DEFAULT now(),
  expires_at           timestamptz,
  used_at              timestamptz,
  status               text DEFAULT 'active' CHECK (status IN ('active','expired','completed','revoked'))
);

ALTER TABLE participant_links ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_link_per_participant
  ON participant_links (participant_id)
  WHERE status = 'active';

-- ─── 1.10 Participant Schedule ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS participant_schedule (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id      uuid REFERENCES profiles(id),
  study_id            uuid REFERENCES studies(id),
  protocol_id         uuid REFERENCES study_protocols(id),
  study_task_id       uuid REFERENCES study_tasks(id),
  study_day_id        uuid REFERENCES protocol_study_days(id),
  day_contact_id      uuid REFERENCES protocol_day_contacts(id),
  session_template_id uuid REFERENCES session_templates(id),
  study_day           int,
  study_week          int,
  period_of_day       text CHECK (period_of_day IN ('morning','afternoon','evening')),
  rep_index           int DEFAULT 1,
  contact_order       int,
  condition_arm       text,
  scheduled_for       timestamptz,
  unlocked_at         timestamptz,
  completed_at        timestamptz,
  expired_at          timestamptz,
  attempts            int DEFAULT 0,
  status              text DEFAULT 'pending' CHECK (status IN ('pending','link_sent','unlocked','completed','expired','blocked')),
  link_id             uuid REFERENCES participant_links(id),
  enrolled_at         timestamptz,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE participant_schedule ENABLE ROW LEVEL SECURITY;

-- Deferred FK: participant_links.schedule_instance_id → participant_schedule
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_schedule_instance'
      AND table_name = 'participant_links'
  ) THEN
    ALTER TABLE participant_links
      ADD CONSTRAINT fk_schedule_instance
      FOREIGN KEY (schedule_instance_id) REFERENCES participant_schedule(id);
  END IF;
END $$;

-- ─── 1.11 Message Log ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_log (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id    uuid REFERENCES profiles(id),
  study_message_id  uuid,
  sent_at           timestamptz DEFAULT now(),
  channel           text CHECK (channel IN ('email','sms')),
  status            text CHECK (status IN ('sent','delivered','failed','opted_out','suppressed')),
  suppressed_reason text
);

ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;

-- ─── 1.12 Participant Activity Log ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS participant_activity_log (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id       uuid REFERENCES profiles(id),
  schedule_instance_id uuid REFERENCES participant_schedule(id),
  protocol_node_id     uuid REFERENCES protocol_nodes(id),
  activity_id          uuid REFERENCES activities(id),
  started_at           timestamptz,
  completed_at         timestamptz,
  order_index          int,
  result_table         text,
  result_id            uuid
);

ALTER TABLE participant_activity_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS activity_log_id uuid REFERENCES participant_activity_log(id),
  ADD COLUMN IF NOT EXISTS study_id        uuid REFERENCES studies(id);

-- ─── 1.13 RLS Policies ───────────────────────────────────────────────────────

-- activities: authenticated read, lab write
CREATE POLICY "activities: authenticated read"
  ON activities FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "activities: lab write"
  ON activities FOR ALL
  USING (public.my_role() = 'lab')
  WITH CHECK (public.my_role() = 'lab');

-- session_templates
CREATE POLICY "session_templates: authenticated read"
  ON session_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "session_templates: lab write"
  ON session_templates FOR ALL
  USING (public.my_role() = 'lab')
  WITH CHECK (public.my_role() = 'lab');

-- session_template_nodes
CREATE POLICY "session_template_nodes: authenticated read"
  ON session_template_nodes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "session_template_nodes: lab write"
  ON session_template_nodes FOR ALL
  USING (public.my_role() = 'lab')
  WITH CHECK (public.my_role() = 'lab');

-- study_protocols
CREATE POLICY "study_protocols: authenticated read"
  ON study_protocols FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "study_protocols: lab write"
  ON study_protocols FOR ALL
  USING (public.my_role() = 'lab')
  WITH CHECK (public.my_role() = 'lab');

-- study_protocol_assignments
CREATE POLICY "study_protocol_assignments: authenticated read"
  ON study_protocol_assignments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "study_protocol_assignments: lab write"
  ON study_protocol_assignments FOR ALL
  USING (public.my_role() = 'lab')
  WITH CHECK (public.my_role() = 'lab');

-- protocol_nodes
CREATE POLICY "protocol_nodes: authenticated read"
  ON protocol_nodes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "protocol_nodes: lab write"
  ON protocol_nodes FOR ALL
  USING (public.my_role() = 'lab')
  WITH CHECK (public.my_role() = 'lab');

-- study_tasks
CREATE POLICY "study_tasks: authenticated read"
  ON study_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "study_tasks: lab write"
  ON study_tasks FOR ALL
  USING (public.my_role() = 'lab')
  WITH CHECK (public.my_role() = 'lab');

-- protocol_study_days
CREATE POLICY "protocol_study_days: authenticated read"
  ON protocol_study_days FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "protocol_study_days: lab write"
  ON protocol_study_days FOR ALL
  USING (public.my_role() = 'lab')
  WITH CHECK (public.my_role() = 'lab');

-- protocol_day_contacts
CREATE POLICY "protocol_day_contacts: authenticated read"
  ON protocol_day_contacts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "protocol_day_contacts: lab write"
  ON protocol_day_contacts FOR ALL
  USING (public.my_role() = 'lab')
  WITH CHECK (public.my_role() = 'lab');

-- participant_consent
CREATE POLICY "participant_consent: own read/write"
  ON participant_consent FOR ALL
  USING (participant_id = auth.uid())
  WITH CHECK (participant_id = auth.uid());

CREATE POLICY "participant_consent: lab read"
  ON participant_consent FOR SELECT
  USING (public.my_role() = 'lab');

-- participant_schedule
CREATE POLICY "participant_schedule: own read/write"
  ON participant_schedule FOR ALL
  USING (participant_id = auth.uid())
  WITH CHECK (participant_id = auth.uid());

CREATE POLICY "participant_schedule: lab read"
  ON participant_schedule FOR SELECT
  USING (public.my_role() = 'lab');

-- participant_links
CREATE POLICY "participant_links: own read/write"
  ON participant_links FOR ALL
  USING (participant_id = auth.uid())
  WITH CHECK (participant_id = auth.uid());

CREATE POLICY "participant_links: lab read"
  ON participant_links FOR SELECT
  USING (public.my_role() = 'lab');

-- participant_activity_log
CREATE POLICY "participant_activity_log: own read/write"
  ON participant_activity_log FOR ALL
  USING (participant_id = auth.uid())
  WITH CHECK (participant_id = auth.uid());

CREATE POLICY "participant_activity_log: lab read"
  ON participant_activity_log FOR SELECT
  USING (public.my_role() = 'lab');

-- message_log
CREATE POLICY "message_log: own read"
  ON message_log FOR SELECT
  USING (participant_id = auth.uid());

CREATE POLICY "message_log: lab read"
  ON message_log FOR SELECT
  USING (public.my_role() = 'lab');

CREATE POLICY "message_log: lab write"
  ON message_log FOR INSERT
  WITH CHECK (public.my_role() = 'lab');
