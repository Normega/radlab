ALTER TABLE demographics
  DROP CONSTRAINT demographics_enrollment_id_fkey,
  ADD CONSTRAINT demographics_enrollment_id_fkey
    FOREIGN KEY (enrollment_id) REFERENCES study_enrollments(id) ON DELETE CASCADE;

ALTER TABLE participant_compensation
  DROP CONSTRAINT participant_compensation_enrollment_id_fkey,
  ADD CONSTRAINT participant_compensation_enrollment_id_fkey
    FOREIGN KEY (enrollment_id) REFERENCES study_enrollments(id) ON DELETE CASCADE;
