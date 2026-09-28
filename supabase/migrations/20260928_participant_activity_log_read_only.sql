-- participant_activity_log: participants may read their own rows, not write them.
--
-- 20260510_study_infrastructure.sql gave participants FOR ALL on their own
-- rows of four study tables. Later migrations replaced three of them with
-- read-only policies; this one was missed (confirmed live 2026-09-27: it is the
-- only "own read/write" policy left). No client or Edge Function code writes
-- this table as a participant, so the write grant served nothing and let a
-- signed-in participant insert, edit or delete their own activity history.
--
-- Lab read ("participant_activity_log: lab read") is unchanged. Service-role
-- writers bypass RLS and are unaffected.

DROP POLICY IF EXISTS "participant_activity_log: own read/write" ON participant_activity_log;

DROP POLICY IF EXISTS "participant_activity_log: own read" ON participant_activity_log;
CREATE POLICY "participant_activity_log: own read"
  ON participant_activity_log
  FOR SELECT
  TO authenticated
  USING (participant_id = auth.uid());

-- Verify (expect one row, cmd = SELECT):
--   SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'participant_activity_log' AND policyname LIKE '%own%';
