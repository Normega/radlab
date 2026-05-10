-- Farm Joy schema additions
-- Run in Supabase SQL editor

-- 1. farm_joy_trials
CREATE TABLE farm_joy_trials (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      uuid REFERENCES game_sessions(id),
  user_id         uuid REFERENCES profiles(id),
  trial_number    int,
  value_word      text,
  category        text,
  veggie          text,
  round1_choice   text,           -- 'plant' | 'compost'
  round1_rt_ms    int,            -- mound tap → bin tap
  in_greenhouse   boolean,
  in_final        boolean,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE farm_joy_trials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own farm_joy_trials" ON farm_joy_trials
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. farm_joy_performance
CREATE TABLE farm_joy_performance (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id          uuid REFERENCES game_sessions(id),
  user_id             uuid REFERENCES profiles(id),
  values_sampled      jsonb,
  values_planted      jsonb,
  values_greenhouse   jsonb,
  values_final        jsonb,
  ended_early         boolean,
  round1_duration_ms  int,
  round2_duration_ms  int,
  round3_duration_ms  int,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE farm_joy_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own farm_joy_performance" ON farm_joy_performance
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. farm_joy_feedback
CREATE TABLE farm_joy_feedback (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id         uuid REFERENCES game_sessions(id),
  user_id            uuid REFERENCES profiles(id),
  round_triggered    int,
  user_responded     boolean,
  suggested_value    text,
  values_sampled     jsonb,
  created_at         timestamptz DEFAULT now()
);
ALTER TABLE farm_joy_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own farm_joy_feedback" ON farm_joy_feedback
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. farm_joy_value_history (cumulative per user × value)
CREATE TABLE farm_joy_value_history (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES profiles(id),
  value_word       text,
  times_shown      int DEFAULT 0,
  times_planted    int DEFAULT 0,
  times_greenhouse int DEFAULT 0,
  times_final      int DEFAULT 0,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, value_word)
);
ALTER TABLE farm_joy_value_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own farm_joy_value_history" ON farm_joy_value_history
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Profile columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS farm_joy_sessions        int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS farm_joy_last_core_values jsonb;
