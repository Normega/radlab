-- performance and trials: lab users need to write on behalf of participants
-- (same pattern as game_sessions, belt_sessions, questionnaire_responses)
CREATE POLICY "performance: lab write"
  ON performance
  FOR ALL
  TO authenticated
  USING (my_role() = 'lab')
  WITH CHECK (my_role() = 'lab');

CREATE POLICY "trials: lab write"
  ON trials
  FOR ALL
  TO authenticated
  USING (my_role() = 'lab')
  WITH CHECK (my_role() = 'lab');
