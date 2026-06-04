-- Lab users upload raw signal CSVs on behalf of participants.
-- The existing "own belt session data" policy checks the folder name matches
-- auth.uid(), which fails when the folder is the participant's UUID.
CREATE POLICY "belt-sessions: lab full access"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING     (bucket_id = 'belt-sessions' AND my_role() = 'lab')
  WITH CHECK (bucket_id = 'belt-sessions' AND my_role() = 'lab');
