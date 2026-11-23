-- A throwaway, staff-only DRY-RUN study for reviewing the Sense Foraging Study 2b retest on
-- dev.radlab.zone. Applied 2026-11-23, after 20261123_sf2b_retest_session.sql (it reuses that file's
-- retest template, definitions and debrief copy) and after auto-enroll v41 and the frontend were on
-- main and deployed.
--
-- Why a separate study: the real Study 2b cannot be used to test the returning path. Its only staff
-- test enrollment has no completed 2b session, and with baseline_cap set nobody new can complete
-- one. The dry run mirrors 2b's settings, but its entry session is a short stub (the scale + 2b's
-- debrief) standing in for "a completed Study 2b session", and its second session is the REAL retest
-- template. Draws land in the dry run's own participant_assignments (separate study, separate seed),
-- so the real study's block sequence starts untouched.
--
-- The dev site writes to the production database: every row this study collects is real, so it is
-- a separate study, every join uses test=1 (is_test), and it is switched off after the review
-- (teardown below). No new table, so no grants are needed.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM studies WHERE id = '365bf0af-5bf1-54e9-9011-fd4aa5427c02') THEN
    RAISE EXCEPTION 'dry-run study already exists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM session_templates WHERE id = '366911b8-5dff-584f-97bf-cbe7151c2df3') THEN
    RAISE EXCEPTION 'apply 20261123_sf2b_retest_session.sql first';
  END IF;
END $$;

INSERT INTO public.studies (
  id, name, public_title, created_by, protocol, active, messaging_required, consent_required,
  active_consent_form_id, active_debrief_form_id, delivery_mode, allow_restart, reminders_enabled,
  allow_external_enrollment, external_enrollment_source, completion_redirect_url, max_attempts,
  assignment_slots, design_seed, compensation_kind, reply_to_email, baseline_cap, offer_repository_consent,
  open_email_after_consent, decline_message, separate_external_identity, questionnaire_layout, ratings_allow_pna,
  consent_title, study_consent_text)
SELECT '365bf0af-5bf1-54e9-9011-fd4aa5427c02', 'Sense Foraging Study 2b retest (DRY RUN, staff only)', s.public_title,
       s.created_by, s.protocol, true, s.messaging_required, s.consent_required,
       s.active_consent_form_id, s.active_debrief_form_id, s.delivery_mode, s.allow_restart, false,
       true, s.external_enrollment_source, NULL, s.max_attempts,
       '{"sf2b_retest_vignettes": ["vignettes", "no_vignettes", "vignettes", "no_vignettes"]}'::jsonb,
       'sf2b-retest-DRYRUN', s.compensation_kind, s.reply_to_email, NULL, s.offer_repository_consent,
       s.open_email_after_consent, s.decline_message, s.separate_external_identity, s.questionnaire_layout, s.ratings_allow_pna,
       s.consent_title, s.study_consent_text
  FROM public.studies s WHERE s.id = '1864d663-d01c-5d82-91f0-3047462470c3';

-- Stub entry session: label "Single session", day 1, as 2b's, so the export's labels match 2b's.
INSERT INTO public.session_templates (id, label, folder, description)
VALUES ('4d6dedb3-e660-563b-909e-5d3ee3b2b790', 'SenseForaging_Study2b_retest_DRYRUN_entry', 'Sense Foraging',
        'DRY RUN only: stands in for a completed Study 2b session (the scale, 2b''s debrief). 20261123_sf2b_retest_dryrun.sql.');
INSERT INTO public.session_template_nodes (session_template_id, order_index, questionnaire_id, activity_id, label) VALUES
  ('4d6dedb3-e660-563b-909e-5d3ee3b2b790', 0, (SELECT id FROM questionnaires WHERE slug = 'sf2b-scale'), NULL, 'Sense Foraging Scale (stub entry)'),
  ('4d6dedb3-e660-563b-909e-5d3ee3b2b790', 1, NULL, 'f79f90f7-9f59-44a6-8cf7-4ca45a76298a', 'Debrief');

INSERT INTO public.study_sessions (id, study_id, session_template_id, day_number, send_time, label, order_index, node_key, link_expires_hours) VALUES
  ('117455e8-95b0-5352-871c-ddf49a9b14cc', '365bf0af-5bf1-54e9-9011-fd4aa5427c02', '4d6dedb3-e660-563b-909e-5d3ee3b2b790',  1, '09:00', 'Single session', 0, 'sf_single', 48),
  ('471fe9f1-282b-5695-910a-e1e7d015cb45', '365bf0af-5bf1-54e9-9011-fd4aa5427c02', '366911b8-5dff-584f-97bf-cbe7151c2df3', 15, '09:00', 'Retest',         1, 'sf_retest', 48);

COMMIT;

-- Between test steps (website.md §26c "Study 2b follow-up", dry run):
--   close new entry after testers A0-A4 have done the stub:
--     UPDATE studies SET baseline_cap = 1 WHERE id = '365bf0af-5bf1-54e9-9011-fd4aa5427c02';
--   baseline_cap must be > 0 (studies_baseline_cap_check), and study_baselines_completed excludes
--   is_test enrollments, so one tester (A0) joins WITHOUT test=1: their completed stub makes the count
--   1, and 1 >= 1 closes the entry session to anyone who has not completed it.
--
-- Applied 2026-11-23 as written. A join smoke test the same day (id SF2BRT-CLAUDE-SMOKE1, test=1)
-- left one is_test enrollment and one unstarted stub row; its link was expired (admin_revoked).
--
-- Teardown, after the review (CLAUDE.md "Disabling a study"):
-- UPDATE studies SET active = false, allow_external_enrollment = false, name = name || ' (RETIRED)'
--  WHERE id = '365bf0af-5bf1-54e9-9011-fd4aa5427c02';
-- UPDATE participant_schedule SET status = 'missed'
--  WHERE study_id = '365bf0af-5bf1-54e9-9011-fd4aa5427c02' AND completed_at IS NULL AND status NOT IN ('missed', 'blocked');
-- UPDATE participant_links SET status = 'expired', ended_reason = 'admin_revoked', ended_at = now()
--  WHERE study_id = '365bf0af-5bf1-54e9-9011-fd4aa5427c02' AND status = 'active';
