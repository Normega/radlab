CREATE TABLE demographics (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES profiles(id),
  enrollment_id uuid        REFERENCES study_enrollments(id),
  schedule_id   uuid        REFERENCES participant_schedule(id),
  age           integer,
  gender        text,
  racialized    text        CHECK (racialized IN ('yes', 'no', 'prefer_not_to_answer')),
  ses_ladder    integer     CHECK (ses_ladder BETWEEN 1 AND 10),
  completed_at  timestamptz DEFAULT now()
);

ALTER TABLE demographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demographics: own all"
  ON demographics FOR ALL TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "demographics: lab read all"
  ON demographics FOR SELECT TO authenticated
  USING (my_role() = 'lab');

CREATE POLICY "demographics: lab insert"
  ON demographics FOR INSERT TO authenticated
  WITH CHECK (my_role() = 'lab');
