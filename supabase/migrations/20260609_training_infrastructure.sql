-- Intervention modules: imported JSON training definitions
CREATE TABLE IF NOT EXISTS intervention_modules (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id   text        NOT NULL UNIQUE,
  condition   text        NOT NULL,
  phase       text        NOT NULL,
  lesson      int         NOT NULL,
  title       text        NOT NULL,
  subtitle    text,
  definition  jsonb       NOT NULL,
  created_by  uuid        REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE intervention_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read" ON intervention_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "lab insert"        ON intervention_modules FOR INSERT TO authenticated WITH CHECK (my_role() IN ('lab','admin'));
CREATE POLICY "lab update"        ON intervention_modules FOR UPDATE TO authenticated USING (my_role() IN ('lab','admin'));
CREATE POLICY "lab delete"        ON intervention_modules FOR DELETE TO authenticated USING (my_role() IN ('lab','admin'));

-- Liliana study participant table (study-specific)
CREATE TABLE IF NOT EXISTS liliana_participants (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id            uuid        REFERENCES profiles(id),
  study_id              uuid        REFERENCES studies(id),
  condition             text,
  randomization_arm     text,
  phase                 text        DEFAULT 'phase1',
  current_day           int         DEFAULT 1,
  midpoint_completed_at timestamptz,
  dropped_out           bool        DEFAULT false,
  dropout_reason        text,
  enrolled_at           timestamptz DEFAULT now()
);
ALTER TABLE liliana_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab all"  ON liliana_participants FOR ALL TO authenticated USING (my_role() IN ('lab','admin'));
CREATE POLICY "own read" ON liliana_participants FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- Per-day session data: structured timing + JSONB blob for variable content
CREATE TABLE IF NOT EXISTS liliana_day_data (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id uuid        NOT NULL REFERENCES liliana_participants(id),
  study_day      int         NOT NULL,
  session_name   text,
  started_at     timestamptz,
  completed_at   timestamptz,
  data           jsonb       DEFAULT '{}',
  UNIQUE(participant_id, study_day)
);
ALTER TABLE liliana_day_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab all" ON liliana_day_data FOR ALL TO authenticated USING (my_role() IN ('lab','admin'));
CREATE POLICY "own rows" ON liliana_day_data FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM liliana_participants WHERE id = liliana_day_data.participant_id AND profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM liliana_participants WHERE id = liliana_day_data.participant_id AND profile_id = auth.uid()));

-- Intervention prompt responses (saved per-step as participant advances)
CREATE TABLE IF NOT EXISTS intervention_responses (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id uuid        NOT NULL REFERENCES liliana_participants(id),
  schedule_id    uuid,
  module_id      text        NOT NULL,
  study_day      int         NOT NULL,
  response_index int         NOT NULL,
  response_text  text        NOT NULL,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE intervention_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab all" ON intervention_responses FOR ALL TO authenticated USING (my_role() IN ('lab','admin'));
CREATE POLICY "own rows" ON intervention_responses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM liliana_participants WHERE id = intervention_responses.participant_id AND profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM liliana_participants WHERE id = intervention_responses.participant_id AND profile_id = auth.uid()));

-- Add module_id to session_template_nodes for training steps
ALTER TABLE session_template_nodes
  ADD COLUMN IF NOT EXISTS module_id text REFERENCES intervention_modules(module_id);
