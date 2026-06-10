-- Fix bare NO ACTION FKs so deleting a study cascades to all participant data.
-- Affected tables: liliana_participants, participant_compensation, participant_links, participant_schedule.

ALTER TABLE liliana_participants
  DROP CONSTRAINT liliana_participants_study_id_fkey,
  ADD CONSTRAINT liliana_participants_study_id_fkey
    FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE;

ALTER TABLE participant_compensation
  DROP CONSTRAINT participant_compensation_study_id_fkey,
  ADD CONSTRAINT participant_compensation_study_id_fkey
    FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE;

ALTER TABLE participant_links
  DROP CONSTRAINT participant_links_study_id_fkey,
  ADD CONSTRAINT participant_links_study_id_fkey
    FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE;

ALTER TABLE participant_schedule
  DROP CONSTRAINT participant_schedule_study_id_fkey,
  ADD CONSTRAINT participant_schedule_study_id_fkey
    FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE;
