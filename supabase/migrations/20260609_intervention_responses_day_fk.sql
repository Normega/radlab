-- Link intervention_responses to the liliana_day_data row for the session.
-- The day row is created on first attempt (started_at stamped then),
-- so this FK is always satisfiable before any prompt response is saved.
ALTER TABLE intervention_responses
  ADD COLUMN IF NOT EXISTS day_data_id uuid REFERENCES liliana_day_data(id);
