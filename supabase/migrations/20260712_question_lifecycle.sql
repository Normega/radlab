-- Question publish/upvote/answered lifecycle. The schema + most RLS for
-- this was already built in WP1 (class_questions, question_votes) even
-- though the UI was Phase 2 scope — QuestionBoxTap already inserts
-- submitted questions. Two gaps found while building the instructor side:
--
-- 1. "question_votes: members read" only checked class_members, not
--    class_admins/lab role — but the brief requires the instructor's live
--    feed to "sort published questions by upvotes", which means the
--    instructor needs to read vote counts too. Same lab-admin-parity gap
--    already fixed once for lectures/checkins/class_questions in
--    20260711_lecture_lounge_lab_admin_parity.sql — this table was missed
--    at the time since Phase 1 didn't build any UI that needed it yet.
--
-- 2. class_questions was never added to the supabase_realtime publication
--    (only checkin_responses was, in WP1) — needed for the remote's live
--    question feed to receive new submissions via Postgres Changes.

DROP POLICY "question_votes: members read" ON question_votes;
CREATE POLICY "question_votes: members read"
  ON question_votes FOR SELECT
  TO authenticated
  USING (
    my_role() = 'lab' OR is_super_admin()
    OR EXISTS (
      SELECT 1 FROM class_questions q JOIN checkins c ON c.id = q.checkin_id
        JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
      WHERE q.id = question_votes.question_id AND ca.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM class_questions q JOIN checkins c ON c.id = q.checkin_id
        JOIN lectures l ON l.id = c.lecture_id JOIN class_members cm ON cm.class_id = l.class_id
      WHERE q.id = question_votes.question_id AND q.status = 'published' AND cm.user_id = auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE class_questions;
