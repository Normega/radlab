# Migration manifest — applied status

> **All migration files in this directory are applied to the live Supabase project**, verified
> 2026-07-08 by cross-checking `supabase_migrations.schema_migrations` and, for files with no
> history record, by confirming their effects (tables/columns/functions/triggers/policies/seed
> rows) exist in the live database. **Future sessions: trust this manifest — only migrations
> dated after 2026-07-08 need checking.** When you apply a new migration, add it to the table
> below with its evidence.

## How to read this

Migrations were applied through a mix of the Supabase SQL editor (manual — leaves **no** history
record) and the MCP `apply_migration` tool (records into `supabase_migrations.schema_migrations`,
often under a **different name** than the file). So the history table alone is not the ground
truth — the live schema is. Evidence below is either `history: <recorded name>` or
`live: <object(s) confirmed 2026-07-08>`.

## Dated migrations

| File | Applied — evidence |
|---|---|
| `20260510_study_infrastructure.sql` | live: `activities`, `session_templates`, `session_template_nodes`, `study_protocols` family, `participant_schedule`, `participant_links`, `message_log`, `participant_activity_log` all exist. (`participant_consent` was created here then deliberately dropped by `20260602_study_admin_redesign` — its absence is correct.) |
| `20260512_get_user_by_email.sql` | live: `get_user_id_by_email/1` (later hardened by `20260611_get_user_by_email_lab_only`) |
| `20260512_super_admin.sql` | live: `profiles.super_admin` |
| `20260513_message_log_test_flag.sql` | live: `message_log.is_test` |
| `20260515_protocol_email_fields.sql` | history: `protocol_email_fields` |
| `20260515_unsubscribe_tokens.sql` | history: `unsubscribe_tokens` |
| `20260525_activities_questionnaire_nodes.sql` | live: `session_template_nodes.questionnaire_id` |
| `20260525_debrief_forms.sql` | live: `study_debrief_forms` table, `studies.active_debrief_form_id` (history follow-ups: `fix_debrief_forms_rls_policy`, `add_debrief_forms_storage_policy`) |
| `20260526_videos_bucket_storage_policies.sql` | history: `videos_bucket_storage_policies` |
| `20260529_belt_trigger_device.sql` | live: `belt_sessions.trigger_device` |
| `20260602_session_entry_rpc.sql` | live: `get_session_by_token/1`, `complete_session_by_token/1` (function body since superseded by `20260623_screener.sql`) |
| `20260602_study_admin_redesign.sql` | live: `studies.delivery_mode`, `study_sessions`, rebuilt `participant_schedule`/`participant_links`, `study_enrollments`; `participant_consent` dropped |
| `20260603_belt_participant_external_id.sql` | history: `belt_participant_external_id` |
| `20260604_activities_demographics.sql` | history: `activities_demographics` |
| `20260604_belt_sessions_storage_lab_policy.sql` | history: `belt_sessions_storage_lab_policy` |
| `20260604_belt_timing_fields.sql` | history: `belt_timing_fields` |
| `20260604_belt_trial_onset_and_thresholds.sql` | history: `belt_trial_onset_and_thresholds` |
| `20260604_cascade_study_session_delete.sql` | history: `cascade_study_session_delete` |
| `20260604_demographics.sql` | history: `demographics` |
| `20260604_game_sessions_lab_policy.sql` | history: `game_sessions_lab_policy` |
| `20260604_lab_write_policies_all_game_tables.sql` | history: `lab_write_policies_all_game_tables` |
| `20260604_lab_write_policies_performance_trials.sql` | history: `lab_write_policies_performance_trials` |
| `20260604_session_nodes_questionnaires.sql` | live: `get_session_by_token` returns questionnaire nodes (body since superseded by `20260623_screener.sql`) |
| `20260606_activities_physio_belt_setup.sql` | history: `20260606_activities_add_physio_category`; live: `activities` row `physio/belt_setup` |
| `20260606_activities_unique_category_subcategory.sql` | history: `20260606_activities_unique_category_subcategory` |
| `20260606_compensation_form.sql` | live: `participant_compensation` table, `activities` row `form/compensation` |
| `20260609_intervention_responses_day_fk.sql` | history: `intervention_responses_day_data_fk` |
| `20260609_lexical_sessions.sql` | history: `word_max_sessions`; live: `word_max_sessions` table |
| `20260609_training_infrastructure.sql` | history: `training_infrastructure` |
| `20260609_video_library.sql` | history: `video_library` |
| `20260610_audio_rls_fix.sql` | history: `audio_fix_rls_lab_role` |
| `20260610_audio_schema.sql` | live: `study_audios`, `participant_audio_sessions`, `participant_audio_events`, `complete_audio_session/3` (history follow-up: `audio_add_folder_and_file_meta`) |
| `20260610_cascade_game_and_liliana_fks.sql` | history: `cascade_game_and_liliana_fks` |
| `20260610_colormax.sql` | history: `colormax_schema` |
| `20260610_enrollment_delete_cascade.sql` | history: `enrollment_delete_cascade` |
| `20260610_set_null_creator_and_self_ref_fks.sql` | history: `set_null_creator_and_self_ref_fks` |
| `20260610_study_delete_cascade.sql` | history: `study_delete_cascade` |
| `20260611_audios_storage_bucket.sql` | history: `audios_storage_bucket` |
| `20260611_cleanup_admin_role_policies.sql` | history: `cleanup_admin_role_policies` |
| `20260611_get_user_by_email_lab_only.sql` | history: `get_user_by_email_lab_only` |
| `20260611_medium_security_fixes.sql` | history: `medium_security_fixes` |
| `20260611_session_token_expiry_enforcement.sql` | history: `session_token_expiry_enforcement` |
| `20260611_super_admin_profiles_lockdown.sql` | history: `super_admin_profiles_lockdown` |
| `20260616_activities_category_add_vas.sql` | history: `activities_category_add_vas_training` |
| `20260616_public_assets_bucket.sql` | history: `public_assets_bucket` |
| `20260616_vas_packages.sql` | history: `vas_packages` |
| `20260616_vas_scales.sql` | history: `vas_scales` |
| `20260616_word_max_color_max_activities.sql` | history: `word_max_color_max_activities` |
| `20260617_external_enrollment.sql` | history: `20260617_external_enrollment` |
| `20260617_fix_audio_storage_paths.sql` | data-only fix (storage path strings); audio library functional since — no independent schema object to verify |
| `20260617_slider_scales.sql` | history: `slider_scales` |
| `20260618_profiles_study_id_guard.sql` | live: `my_study_id/0`, policy `profiles: own update safe` |
| `20260618_vas_activities_four_scales.sql` | live: `activities` rows `vas/vas_sleep`, `vas_stress`, `vas_enjoyment`, `vas_helpful`, `vas_effort` |
| `20260618_vas_emoji_url_placeholder_fix.sql` | live: zero `vas_scales` rows with placeholder anchor URLs |
| `20260619_vas_confidence_satisfaction_activities.sql` | live: `activities` rows `vas/vas_confidence`, `vas_task-satisfaction`, `vas_life-satisfaction` |
| `20260619_vas_confidence_satisfaction_seed.sql` | live: `vas_scales` rows `confidence`, `task-satisfaction`, `life-satisfaction` |
| `20260623_screener.sql` | live: `screener_results` + own-rows policy, `studies.screener`/`screener_id`, current `get_session_by_token` |
| `20260623_screeners_table.sql` | live: `screeners` table, policy `lab manage screeners`, seed row `emotion-regulation-v1` |
| `20260623_vas_packages_items.sql` | live: `vas_packages.items` |
| `20260624_experiment_builder.sql` | history: `experiment_builder` (recorded 2026-06-25) |
| `20260705_assignment_randomizer.sql` | live: `draw_assignment`, `studies.assignment_slots`, `assignment_balance` view; pilot-verified 2026-07-05 (website.md §28) |
| `20260705_displays.sql` | history: `20260705_displays` |
| `20260705_session_token_assignment_slots.sql` | history: `20260705_session_token_assignment_slots` |
| `20260707_activities_category_add_display.sql` | history: `activities_category_add_display` |
| `20260707_profiles_prevent_privilege_escalation.sql` | live: `prevent_self_privilege_escalation/0`, trigger `profiles_prevent_privesc` |
| `20260708_phase2_draw_assignment.sql` | live: `draw_assignment/3` (3-arg service-role variant); verified live 2026-07-08 (website.md §28 Phase 2 Pass 1) |
| `20260708_vas_schedule_linkage.sql` | history: `vas_schedule_linkage`; live: `vas_responses.schedule_id`/`package_slug`, `liliana_day_data.module_id` |
| `20260709_liliana_feedback_backend.sql` | history: `liliana_feedback_backend` (+ three follow-up statements applied directly and folded into the file: schedule FK → ON DELETE SET NULL, kind CHECK gains 'choice'); live: `liliana_session_metrics` view, `liliana_midpoint_feedback` table, `get_liliana_midpoint_summary/1`, `record_practice_decision/3`, patched `draw_assignment/3` — full synthetic-data verification 2026-07-09 |
| `20260709_liliana_midpoint_choice_rework.sql` | history: `liliana_midpoint_choice_rework`; live: `liliana_midpoint_feedback.stated_preference`, `phase2_source` CHECK ('choice','anti_preference'), `participant_assignments.kind` gains 'anti_preference', reworked `record_practice_decision` (node auto-detect + server-side anti-preference 50/50), activities category CHECK gains 'midpoint' + `midpoint/liliana_midpoint` row — synthetic-data verification 2026-07-09 |

## Undated files in this directory

| File | Applied — evidence |
|---|---|
| `belt_correspondence_migration.sql` | live: `belt_trials.bt_baseline_period_ms`/`bt_condition_period_ms`, `belt_sessions.session_number`/`baseline_period_ms`/`post_baseline_period_ms` |
| `belt_mlr_migration.sql` | history: `belt_mlr_calibration_columns`; live: `belt_sessions.calib_model_label`/`calib_fit_r`/`calib_lag_ms`. (Duplicate of `src/games/BreathBelt/belt_mlr_migration.sql`.) |
| `questionnaires_schema.sql` | live: `questionnaires` table, trigger `questionnaires_updated_at`, lab-all + auth-read policies |

## SQL files outside this directory (`src/games/BreathBelt/`)

All applied: `belt_schema.sql` (live: `belt_sessions`, `belt_trials`), `belt_proportion_migration.sql`
(history: `belt_proportion_mag`; live: `belt_trials.proportion_mag`), `belt_sync_metrics_migration.sql`
(live: `belt_trials.belt_sync_mean`), `belt_mlr_migration.sql` (duplicate, see above).

## History entries with no repo file

These were applied directly (dashboard SQL editor / MCP) without a saved migration file — listed so
nobody hunts for missing files: `add_created_at_to_studies`, `studies_fk_on_delete_cascade`,
`grant_authenticated_access_all_tables`, `fix_schedule_instance_fk_set_null_on_delete`,
`stillwater_rls_authenticated`, `drift_rls_own_rows`, `add_reb_consent_forms`,
`consent_forms_storage_rls`, `fix_unsubscribe_tokens_study_fk_cascade`, `add_hair_columns_to_avatars`,
`fix_debrief_forms_rls_policy`, `add_debrief_forms_storage_policy`, `create_aptitude_suite_tables`,
`inperson_study_infrastructure`, `questionnaire_responses_lab_insert_policy`,
`stillwater_responses_user_id`, `stillwater_responses_rls_fix`, `audio_add_folder_and_file_meta`,
`drop_public_assets_broad_select_policy`.
