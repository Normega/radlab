-- Aptitude Suite tables
-- Apply in Supabase SQL editor

CREATE TABLE aptitude_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES profiles(id) ON DELETE CASCADE,
  study_id         uuid REFERENCES studies(id) ON DELETE SET NULL,
  is_test          boolean DEFAULT false,
  session_start    timestamptz NOT NULL,
  session_end      timestamptz,
  category_assigned text NOT NULL,
  anagram_score    integer DEFAULT 0,
  fluency_score    integer DEFAULT 0,
  wordprobe_score  integer DEFAULT 0,
  anagram_pct      integer DEFAULT 0,
  fluency_pct      integer DEFAULT 0,
  wordprobe_pct    integer DEFAULT 0,
  avg_pct          numeric(5,2) DEFAULT 0,
  task_switch_count integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE aptitude_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid REFERENCES aptitude_sessions(id) ON DELETE CASCADE,
  task           text NOT NULL CHECK (task IN ('anagram','fluency','wordprobe')),
  event_type     text NOT NULL,
  -- anagram: 'solve' | 'skip' | 'wrong_guess'
  -- fluency: 'submit_valid' | 'submit_invalid' | 'submit_duplicate'
  -- wordprobe: 'guess_valid' | 'guess_invalid' | 'round_solve' | 'round_fail'
  value          text,
  score_at_time  integer,
  pct_at_time    integer,
  elapsed_ms     integer,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE aptitude_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aptitude_events   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own sessions"
  ON aptitude_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own sessions"
  ON aptitude_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own sessions"
  ON aptitude_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users see own events"
  ON aptitude_events FOR SELECT
  USING (
    session_id IN (SELECT id FROM aptitude_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "users insert own events"
  ON aptitude_events FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM aptitude_sessions WHERE user_id = auth.uid())
  );
