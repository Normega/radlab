-- Add participant_external_id to belt_sessions and belt_trials so every
-- session/trial is labelled with the human-readable participant ID regardless
-- of which lab account was authenticated when the data was collected.
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS participant_external_id text;
ALTER TABLE belt_trials   ADD COLUMN IF NOT EXISTS participant_external_id text;

CREATE INDEX IF NOT EXISTS belt_sessions_participant_eid_idx ON belt_sessions(participant_external_id);
CREATE INDEX IF NOT EXISTS belt_trials_participant_eid_idx   ON belt_trials(participant_external_id);

-- Lab users run sessions on behalf of participants. The existing "insert own"
-- policies require auth.uid() = user_id, which blocks a lab user from writing
-- a row with the participant's profile_id. Add permissive lab INSERT policies
-- (same pattern already applied to questionnaire_responses).
CREATE POLICY "belt_sessions insert lab"
  ON belt_sessions FOR INSERT TO authenticated
  WITH CHECK (my_role() = 'lab');

CREATE POLICY "belt_trials insert lab"
  ON belt_trials FOR INSERT TO authenticated
  WITH CHECK (my_role() = 'lab');
