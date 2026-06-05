-- Replace FKs in the study_sessions → participant_schedule → participant_links
-- chain with CASCADE / SET NULL so a single DELETE on study_sessions cleans up
-- all child rows without requiring multi-step client-side deletion.

-- 1. study_sessions → participant_schedule: CASCADE (delete schedules with session)
ALTER TABLE participant_schedule
  DROP CONSTRAINT participant_schedule_study_session_id_fkey,
  ADD CONSTRAINT participant_schedule_study_session_id_fkey
    FOREIGN KEY (study_session_id) REFERENCES study_sessions(id) ON DELETE CASCADE;

-- 2. participant_schedule → participant_links: CASCADE (delete links with schedule)
ALTER TABLE participant_links
  DROP CONSTRAINT participant_links_schedule_id_fkey,
  ADD CONSTRAINT participant_links_schedule_id_fkey
    FOREIGN KEY (schedule_id) REFERENCES participant_schedule(id) ON DELETE CASCADE;

-- 3. participant_links → participant_schedule.link_id: SET NULL (breaks circular ref)
ALTER TABLE participant_schedule
  DROP CONSTRAINT participant_schedule_link_id_fkey,
  ADD CONSTRAINT participant_schedule_link_id_fkey
    FOREIGN KEY (link_id) REFERENCES participant_links(id) ON DELETE SET NULL;

-- 4. participant_schedule → demographics.schedule_id: SET NULL (preserve demographics row)
ALTER TABLE demographics
  DROP CONSTRAINT demographics_schedule_id_fkey,
  ADD CONSTRAINT demographics_schedule_id_fkey
    FOREIGN KEY (schedule_id) REFERENCES participant_schedule(id) ON DELETE SET NULL;
