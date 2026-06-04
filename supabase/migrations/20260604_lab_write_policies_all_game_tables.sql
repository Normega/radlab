-- ── AptitudeSuite (in GameStepWrapper — immediately needed) ─────────────────
CREATE POLICY "aptitude_sessions: lab write"
  ON aptitude_sessions FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

CREATE POLICY "aptitude_events: lab write"
  ON aptitude_events FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

-- ── Other game tables (not yet in GameStepWrapper but same risk if added) ───
CREATE POLICY "drift_performance: lab write"
  ON drift_performance FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

CREATE POLICY "drift_trials: lab write"
  ON drift_trials FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

CREATE POLICY "face_read_performance: lab write"
  ON face_read_performance FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

CREATE POLICY "face_read_trials: lab write"
  ON face_read_trials FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

CREATE POLICY "farm_joy_feedback: lab write"
  ON farm_joy_feedback FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

CREATE POLICY "farm_joy_performance: lab write"
  ON farm_joy_performance FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

CREATE POLICY "farm_joy_trials: lab write"
  ON farm_joy_trials FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

CREATE POLICY "farm_joy_value_history: lab write"
  ON farm_joy_value_history FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

-- ── Participant video (if video studies are run by lab) ──────────────────────
CREATE POLICY "participant_video_sessions: lab write"
  ON participant_video_sessions FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

CREATE POLICY "participant_video_events: lab write"
  ON participant_video_events FOR ALL TO authenticated
  USING (my_role() = 'lab') WITH CHECK (my_role() = 'lab');

-- ── Fix broken table: RLS on but zero policies (blocks everyone) ─────────────
-- participant_unsubscribe_tokens is written by email pipeline (service role)
-- and read by participants via their token. Participants don't need direct
-- table access (the unsubscribe edge function uses service role), so a
-- select-own policy is sufficient to unblock the table while keeping it safe.
CREATE POLICY "participant_unsubscribe_tokens: own read"
  ON participant_unsubscribe_tokens FOR SELECT TO authenticated
  USING (participant_id = auth.uid());
