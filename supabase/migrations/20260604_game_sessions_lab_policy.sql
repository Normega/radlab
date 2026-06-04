-- Lab users run sessions on behalf of participants: they need to INSERT rows
-- with the participant's user_id and UPDATE ended_at at session close.
CREATE POLICY "game_sessions: lab write"
  ON game_sessions
  FOR ALL
  TO authenticated
  USING (my_role() = 'lab')
  WITH CHECK (my_role() = 'lab');
