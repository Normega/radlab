-- Lexical Perfectionism game sessions table.
-- set_results JSONB: array of 5 objects {set_id, letters, word, score, dwell_ms}.
-- word and score are null for sets not reached due to timeout.

CREATE TABLE lexical_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES auth.users NOT NULL,
  created_at     timestamptz DEFAULT now(),
  completed      boolean     DEFAULT false,
  timed_out      boolean     DEFAULT false,
  total_score    int         DEFAULT 0,
  sets_completed int         DEFAULT 0,
  duration_ms    int,
  set_results    jsonb
);

ALTER TABLE lexical_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON lexical_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
