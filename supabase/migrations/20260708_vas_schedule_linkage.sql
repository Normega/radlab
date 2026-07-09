-- WP-L1 (Liliana feedback spec, docs/markdowns/liliana_feedback_spec.md):
-- link VAS responses to the participant's schedule row so daily check-in
-- ratings are attributable to a specific study day, and the twice-per-session
-- stress item (pre + post) is disambiguated by which package delivered it.
--
-- RLS: vas_responses already has the "own rows" FOR ALL authenticated policy
-- (user_id = auth.uid()); liliana_day_data has lab-all + own-rows via
-- liliana_participants. No policy changes needed.

ALTER TABLE vas_responses
  ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES participant_schedule(id),
  ADD COLUMN IF NOT EXISTS package_slug text;

CREATE INDEX IF NOT EXISTS vas_responses_user_schedule_idx
  ON vas_responses (user_id, schedule_id);

-- Condition stamp for Liliana day rows: which intervention module ran that
-- day. Derivable via participant_schedule -> study_sessions ->
-- session_template_nodes -> intervention_modules, but stamping it at delivery
-- time is robust to counterbalanced per-participant session orders.
ALTER TABLE liliana_day_data
  ADD COLUMN IF NOT EXISTS module_id text;
