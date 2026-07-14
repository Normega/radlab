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
| `20260709_ensure_liliana_participant.sql` | history: `ensure_liliana_participant`; live: `ensure_liliana_participant/1` — exercised via real participant link 2026-07-09 |
| `20260709_session_token_training_nodes.sql` | history: `session_token_training_nodes`; live: `get_session_by_token` returns `module_id` + synthesized training activities — exercised via real participant link 2026-07-09 |
| `20260710_lecture_lounge_schema.sql` | history: `lecture_lounge_schema`; live: `classes`, `class_admins`, `class_members`, `lectures`, `checkins`, `checkin_responses`, `class_questions`, `question_votes` (all RLS-enabled, all with policies), `checkin_responses` added to `supabase_realtime` publication, `verify_class_email/1`, `award_checkin_points/1`, `get_checkin_mood_results/1` — full RLS verified live 2026-07-10 by impersonating a lab admin, a per-class admin, a member, and a non-member via `request.jwt.claim.sub` (own-row join, admin-gated lecture/checkin writes, open-only response writes, cross-member read isolation on `checkin_responses`, anonymized RPC results, idempotent points award, post-close write lock); test rows created and cascade-deleted, table row counts confirmed zero after cleanup |
| `20260710_lecture_lounge_email_verify_lockdown.sql` | history: `lecture_lounge_email_verify_lockdown`; live: tightened `class_members: own update pre-verify` WITH CHECK (client update can no longer leave a non-null `email_verify_token`/`email_verify_expires_at`), `verify_class_email/1` now also returns the class `slug`. Caught during WP2 design: the original policy let a client set its own verification token via direct UPDATE and self-verify without ever receiving the email — reproduced live pre-fix, confirmed rejected post-fix |
| `20260711_lecture_lounge_lab_admin_parity.sql` | history: `lecture_lounge_lab_admin_parity`; live: `lectures: admins all`, `checkins: admins all`, `checkin_responses: admins read all`, `class_questions: admins read all`/`admins update`, `get_checkin_mood_results/1` all widened to accept `my_role() = 'lab' OR is_super_admin()` alongside `class_admins` membership, matching the `classes: admins update` policy from the WP1 migration. Caught live 2026-07-11: Norm's lab-role account passed `ClassAdminRoute`'s UI gate (which already allowed lab/super_admin) but every write on `lectures` silently failed RLS since that policy only ever checked `class_admins` — reproduced pre-fix (`42501`), confirmed fixed post-fix, non-admin still correctly rejected |
| `20260711_list_class_admins.sql` | history: `list_class_admins`; live: `list_class_admins/1` (lab-only SECURITY DEFINER, joins `class_admins` to `auth.users` for email display — `profiles` carries no email column). Backs the new `/admin/classes` screen (create class, add/remove instructor by email via the existing `get_user_id_by_email`) closing the gap that Phase 1 had no UI for either action. Verified live end-to-end: create class → email lookup → add admin → list shows correct email → cascade-delete cleans up |
| `20260711_utoronto_verification_account_level.sql` | history: `utoronto_verification_account_level`; live: `utoronto_email`/`utoronto_verified_at`/`email_verify_token`/`email_verify_expires_at` moved from `class_members` to `profiles` (verification is per-account now, not per-class-membership — proving ownership once carries to every class joined afterward), protected by a new `protect_utoronto_verification` BEFORE UPDATE trigger (any write arriving as the `authenticated` role has these 4 columns forced back to their old values — RLS's broad `profiles: own update safe` policy can't do column-level restriction without breaking every other profile edit, e.g. avatar/points, so this uses a trigger instead; SECURITY DEFINER functions and the `service_role` Edge Function both run as a different `current_user` and bypass it). `verify_class_email` replaced by `verify_utoronto_email/1` (no longer resolves a class slug — the initiating class's slug now travels as its own query param on the emailed link instead). Verified live: raw client UPDATE attempt to spoof `utoronto_verified_at` silently reverted by the trigger; legitimate RPC path sets it correctly; cross-class carryover confirmed (verify via class A, `profiles.utoronto_verified_at` reads true independent of which class's membership row is queried) |
| `20260711_lecture_lounge_remote_guards.sql` | history: `lecture_lounge_remote_guards`; live: `enforce_single_live_checkin` BEFORE UPDATE trigger on `checkins` (DB-level, not UI-only — rejects setting a checkin to `staged`/`open` while another checkin in the same class already is), and `checkin_responses: own write/update while open` widened to independently check the auto-close deadline (`opened_at + auto_close_seconds`) so a late submission is rejected even if the client-side countdown never got the chance to flip `checkins.status` to `closed` itself. Both per the WP3b brief's explicit language ("guard on state transitions", "not client timers alone"). Verified live: opening a second checkin while one is already open in the same class raises `P0001` and is rejected |
| `20260712_checkin_mood_results_emotion_zone.sql` | history: `checkin_mood_results_emotion_zone` (superseded a same-session `checkin_mood_results_drop_unused_neutral_field` iteration, folded into this file before commit); live: `get_checkin_mood_results/1` now also returns `emotion_id`/`zone` (previously only `valence`/`arousal`). Fixes a real display bug: `WheelSVG` draws each emotion's wedge at a fixed angular slot that doesn't correspond to that emotion's actual stored valence/arousal (confirmed numerically — e.g. Alert's wedge points straight up, its valence/arousal would plot up-and-left), so `ResultsView` was plotting dots in the wrong wedge relative to the background grid. Frontend now positions dots via the wedge's own angle+zone geometry instead. Verified live: RPC returns `emotion_id`/`zone` correctly for a real response; `jsonb ->> 'emotion_id'` on a neutral tap's `{"emotion_id":null,...}` confirmed returns true SQL NULL (not the string `"null"`), matching the frontend's `emotion_id == null` neutral check |
| `20260712_class_participation.sql` | history: `class_participation`; live: `get_class_participation/1` (lab/super_admin/that class's `class_admins` only) — returns members (with `profiles.utoronto_email`/`utoronto_verified_at`), lectures, and per-(member, lecture) response counts for the Phase 2 participation matrix + CSV export, per website.md §29's original design. Needed since no `profiles` RLS policy lets a non-lab class admin read another student's `utoronto_email` — same narrow-RPC pattern as `list_class_admins`/`get_checkin_mood_results` rather than a broader policy that would also expose unrelated profile data. Verified live against real data on class `n2`: correct member/lecture/count shape for an authorized class admin, `forbidden` for an outsider |
| `20260712_question_lifecycle.sql` | history: `question_lifecycle`; live: `question_votes: members read` widened to accept `my_role() = 'lab' OR is_super_admin() OR class_admins` alongside `class_members` — the brief requires the instructor's live question feed to sort published questions by upvotes, but the original WP1 policy only let actual class *members* (students) read vote counts, missing the same lab-admin-parity gap already fixed once for lectures/checkins/class_questions (this table was overlooked then since no UI needed it yet). `class_questions` added to the `supabase_realtime` publication for the remote's live feed. Verified live: a non-lab `class_admins` account (not also a `class_members` row) can now read a vote row that previously returned empty under RLS |
| `20260712_admin_user_management.sql` | live: `admin_list_users`, `admin_set_user_role`, `admin_delete_user` confirmed working 2026-07-12 — delete was callable (returned FK error, not "function not found"), confirming the RPC exists; role toggle also functional per admin UI |
| `20260712_ripple_wp1.sql` | live: `ripples`, `ripple_checkins`, `consents` all confirmed in `information_schema.tables` 2026-07-12 |
| `20260712_admin_delete_cascade.sql` | live: `admin_delete_user` replaced with comprehensive version that explicitly deletes all user-owned data tables before profiles (demographics, ripples, consents, belt/face_read/farm_joy/drift/stillwater/vas game data, lecture lounge rows, avatars) — applied 2026-07-12 via MCP after FK constraint blocked deletion of a test user who had no demographics row from incomplete onboarding |
| `20260713_lecture_lounge_quiz.sql` | history: `lecture_lounge_quiz`; live: `checkin_responses.quiz_answers` (jsonb), `checkins.quiz_revealed_at` (timestamptz), new `checkin_quiz_keys` table (PK+FK `checkin_id`, `answer_key` jsonb) with an admins-only RLS policy and deliberately **no student-facing policy at all** — correct answers can't live in `checkins.config` (students already read that column directly today) or any row students can SELECT, so they get their own table with zero direct student access. `get_checkin_quiz_results/1` (SECURITY DEFINER) is the only path to them: always returns `items`/server-aggregated `counts` (safe), but `answer_key` only once `quiz_revealed_at IS NOT NULL` or the caller is an admin. `checkins` added to the `supabase_realtime` publication so `ResultsView` can pick up a reveal live via `postgres_changes` without a new broadcast event. Verified live end-to-end on class `n2` with real accounts (a non-lab `class_admins` account as instructor, a real student profile added/removed from `class_members` for the test): instructor created a checkin + `checkin_quiz_keys` row, student submitted `quiz_answers`, RPC returned counts with `answer_key: null` and `revealed: false` pre-reveal (confirmed direct `SELECT * FROM checkin_quiz_keys` as the student returns zero rows), instructor closed → results_ready → set `quiz_revealed_at`, RPC then returned the real `answer_key` to the student. All test rows cascade-deleted afterward, confirmed via count queries |
| `20260713_checkin_dismiss.sql` | history: `checkin_dismiss`; live: `checkins.dismissed_at` (timestamptz). Found live testing the avatar wall feature: `ClassRoom`/`ClassScreen` restore their state on load by picking the most-recently-touched non-planned checkin with no time cutoff, so a checkin left in `results_ready` (nothing else ever resets it) restores as "the live one" on every reload forever — the true idle/lobby view, and the avatar wall which only renders there, becomes unreachable after the first check-in of a term. No RLS change needed (the existing `checkins: admins all` whole-row policy already covers writing this column). `ClassRemote` gained a "Back to lobby" button on `results_ready` checkins that sets `dismissed_at` and broadcasts a new `dismissed` event (not a checkin status — `ClassRoom`/`ClassScreen` treat it as a distinct signal that goes straight to `liveCheckin = null`); the restore queries in both now filter `.is('dismissed_at', null)`. Verified live on class `n3`: found 3 real stale `results_ready` checkins from Norm's own earlier "testing it out" session blocking the lobby view exactly as described above; dismissed all three, confirmed the restore query then returns zero rows for that class |
| `20260714_ripple_settings.sql` | live: `ripples.check_in_enabled boolean NOT NULL DEFAULT true` — applied 2026-07-14 via Supabase SQL editor; confirmed by user |
| `20260714_ripple_wp4_intentions.sql` | **not yet applied** — adds `ripple_checkins.intention`, `ripple_checkins.prev_intention_outcome`, `ripples.prompt_cadence`; apply before micro-intention + cadence features are live |
| `20260713_session_template_folder.sql` | live: `session_templates.folder text` (nullable) — applied 2026-07-13 via MCP; verified via `information_schema.columns` |
| `20260713_equity_census.sql` | history: `equity_census`; live: `equity_census_responses` table (RLS enabled, 3 policies mirroring `demographics`: own all / lab read / lab insert) + `activities` row `form/equity_census` — applied via MCP 2026-07-13 at merge of the equity-census branch; verified live same day (table in `information_schema.tables`, `pg_policy` count 3, `relrowsecurity` true, activities row present) |

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
