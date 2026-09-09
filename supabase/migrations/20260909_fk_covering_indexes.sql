-- main radlab. Performance advisor: 123 FKs without covering indexes.
-- Indexed the 63 on tables with real traffic (>2000 scans or writes in
-- pg_stat) plus every classroom-path table regardless -- the RLS EXISTS
-- joins (class_members user_id, checkins lecture_id, checkin_responses
-- profile_id ...) walk these exact columns per row. The remaining ~60 sit
-- on dormant study tables where an index is write overhead and catalog
-- noise for zero read benefit; deferred deliberately, not forgotten.
create index if not exists idx_aptitude_events_session_id on aptitude_events (session_id);
create index if not exists idx_aptitude_sessions_study_id on aptitude_sessions (study_id);
create index if not exists idx_aptitude_sessions_user_id on aptitude_sessions (user_id);
create index if not exists idx_board_replies_author_id on board_replies (author_id);
create index if not exists idx_board_threads_author_id on board_threads (author_id);
create index if not exists idx_checkin_responses_profile_id on checkin_responses (profile_id);
create index if not exists idx_checkins_lecture_id on checkins (lecture_id);
create index if not exists idx_class_admins_user_id on class_admins (user_id);
create index if not exists idx_class_members_user_id on class_members (user_id);
create index if not exists idx_class_questions_checkin_id on class_questions (checkin_id);
create index if not exists idx_class_questions_profile_id on class_questions (profile_id);
create index if not exists idx_classes_created_by on classes (created_by);
create index if not exists idx_claude_project_shares_shared_by on claude_project_shares (shared_by);
create index if not exists idx_claude_session_shares_shared_by on claude_session_shares (shared_by);
create index if not exists idx_demographics_enrollment_id on demographics (enrollment_id);
create index if not exists idx_demographics_schedule_id on demographics (schedule_id);
create index if not exists idx_demographics_user_id on demographics (user_id);
create index if not exists idx_displays_created_by on displays (created_by);
create index if not exists idx_farm_joy_performance_session_id on farm_joy_performance (session_id);
create index if not exists idx_farm_joy_performance_user_id on farm_joy_performance (user_id);
create index if not exists idx_farm_joy_trials_session_id on farm_joy_trials (session_id);
create index if not exists idx_farm_joy_trials_user_id on farm_joy_trials (user_id);
create index if not exists idx_game_sessions_activity_log_id on game_sessions (activity_log_id);
create index if not exists idx_game_sessions_study_id on game_sessions (study_id);
create index if not exists idx_game_sessions_user_id on game_sessions (user_id);
create index if not exists idx_intervention_modules_created_by on intervention_modules (created_by);
create index if not exists idx_lectures_class_id on lectures (class_id);
create index if not exists idx_liliana_participants_profile_id on liliana_participants (profile_id);
create index if not exists idx_liliana_participants_study_id on liliana_participants (study_id);
create index if not exists idx_participant_assignments_participant_id on participant_assignments (participant_id);
create index if not exists idx_participant_links_participant_id on participant_links (participant_id);
create index if not exists idx_participant_links_schedule_id on participant_links (schedule_id);
create index if not exists idx_participant_links_study_id on participant_links (study_id);
create index if not exists idx_participant_schedule_link_id on participant_schedule (link_id);
create index if not exists idx_participant_schedule_study_session_id on participant_schedule (study_session_id);
create index if not exists idx_profiles_study_id on profiles (study_id);
create index if not exists idx_question_votes_profile_id on question_votes (profile_id);
create index if not exists idx_questionnaire_responses_session_id on questionnaire_responses (session_id);
create index if not exists idx_questionnaires_created_by on questionnaires (created_by);
create index if not exists idx_ripple_unsubscribe_tokens_user_id on ripple_unsubscribe_tokens (user_id);
create index if not exists idx_session_template_nodes_activity_id on session_template_nodes (activity_id);
create index if not exists idx_session_template_nodes_module_id on session_template_nodes (module_id);
create index if not exists idx_session_template_nodes_questionnaire_id on session_template_nodes (questionnaire_id);
create index if not exists idx_session_template_nodes_session_template_id on session_template_nodes (session_template_id);
create index if not exists idx_session_templates_cloned_from on session_templates (cloned_from);
create index if not exists idx_session_templates_lab_id on session_templates (lab_id);
create index if not exists idx_slider_scales_created_by on slider_scales (created_by);
create index if not exists idx_studies_active_consent_form_id on studies (active_consent_form_id);
create index if not exists idx_studies_active_debrief_form_id on studies (active_debrief_form_id);
create index if not exists idx_studies_created_by on studies (created_by);
create index if not exists idx_studies_screener_id on studies (screener_id);
create index if not exists idx_study_consent_forms_study_id on study_consent_forms (study_id);
create index if not exists idx_study_consent_forms_uploaded_by on study_consent_forms (uploaded_by);
create index if not exists idx_study_debrief_forms_study_id on study_debrief_forms (study_id);
create index if not exists idx_study_debrief_forms_uploaded_by on study_debrief_forms (uploaded_by);
create index if not exists idx_study_enrollments_enrolled_by on study_enrollments (enrolled_by);
create index if not exists idx_study_enrollments_profile_id on study_enrollments (profile_id);
create index if not exists idx_study_sessions_session_template_id on study_sessions (session_template_id);
create index if not exists idx_trials_session_id on trials (session_id);
create index if not exists idx_vas_responses_scale_id on vas_responses (scale_id);
create index if not exists idx_vas_responses_schedule_id on vas_responses (schedule_id);
create index if not exists idx_vas_responses_session_id on vas_responses (session_id);
create index if not exists idx_vas_scales_created_by on vas_scales (created_by);
