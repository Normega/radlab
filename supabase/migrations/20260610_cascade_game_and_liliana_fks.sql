-- Group 1: CASCADE — child data is meaningless without the parent

ALTER TABLE belt_sessions
  DROP CONSTRAINT belt_sessions_session_id_fkey,
  ADD CONSTRAINT belt_sessions_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE;

ALTER TABLE belt_trials
  DROP CONSTRAINT belt_trials_session_id_fkey,
  ADD CONSTRAINT belt_trials_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE;

ALTER TABLE face_read_performance
  DROP CONSTRAINT face_read_performance_session_id_fkey,
  ADD CONSTRAINT face_read_performance_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE;

ALTER TABLE face_read_trials
  DROP CONSTRAINT face_read_trials_session_id_fkey,
  ADD CONSTRAINT face_read_trials_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE;

ALTER TABLE farm_joy_feedback
  DROP CONSTRAINT farm_joy_feedback_session_id_fkey,
  ADD CONSTRAINT farm_joy_feedback_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE;

ALTER TABLE farm_joy_performance
  DROP CONSTRAINT farm_joy_performance_session_id_fkey,
  ADD CONSTRAINT farm_joy_performance_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE;

ALTER TABLE farm_joy_trials
  DROP CONSTRAINT farm_joy_trials_session_id_fkey,
  ADD CONSTRAINT farm_joy_trials_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE;

ALTER TABLE questionnaire_responses
  DROP CONSTRAINT questionnaire_responses_session_id_fkey,
  ADD CONSTRAINT questionnaire_responses_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE;

ALTER TABLE liliana_day_data
  DROP CONSTRAINT liliana_day_data_participant_id_fkey,
  ADD CONSTRAINT liliana_day_data_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES liliana_participants(id) ON DELETE CASCADE;

ALTER TABLE intervention_responses
  DROP CONSTRAINT intervention_responses_participant_id_fkey,
  ADD CONSTRAINT intervention_responses_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES liliana_participants(id) ON DELETE CASCADE;

ALTER TABLE intervention_responses
  DROP CONSTRAINT intervention_responses_day_data_id_fkey,
  ADD CONSTRAINT intervention_responses_day_data_id_fkey
    FOREIGN KEY (day_data_id) REFERENCES liliana_day_data(id) ON DELETE CASCADE;

ALTER TABLE study_protocol_assignments
  DROP CONSTRAINT study_protocol_assignments_protocol_id_fkey,
  ADD CONSTRAINT study_protocol_assignments_protocol_id_fkey
    FOREIGN KEY (protocol_id) REFERENCES study_protocols(id) ON DELETE CASCADE;
