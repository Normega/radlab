-- Breath Attention and Emotional Recovery (Maya Alves's honours thesis, in person): the study row, its
-- one session template and its one session (plan WP-S1, §4, §5, §7; website.md §26d).
--
-- Not in this file, on purpose:
--   * the consent form HTML: it names the student researcher and her contact details, and this repo is
--     public. scripts/bre/load_consent.mjs reads 03_Consent_Form.md from the shared drive and sets
--     active_consent_form_id. Until the REB protocol number is in (O7) the form carries an INTERNAL PILOT
--     banner and "[PROTOCOL NUMBER]".
--   * the RA PIN: only its bcrypt hash is stored (studies.ra_pin_hash), set by hand, never committed.
--   * debrief: on paper, by the RA (plan §4), so no debrief node.
--
-- Settings: in person; consent required with the optional repository question; v2 questionnaire layout;
-- no reminders, no external or self enrollment (the RA makes each link); SONA IDs kept apart from the
-- data and deleted 7 days after the session, the participant known by an MB-xxxxx study code (G4);
-- baseline_cap 300 (study_baselines_completed excludes is_test enrollments, so dry runs and pilots
-- flagged as tests use up no places).
--
-- Assignment: `version` is set by rule after PHQ-8 (route_by_score: GAD-7 >= 15 or PHQ-8 >= 15 ->
-- neutral, else main; anything that cannot be scored -> neutral, recorded as 'fallback'); then exactly
-- one of `cell_main` (2 conditions x 8 sequences, blocks of 16) or `cell_neutral` (condition, listed
-- twice: blocks of 4) is drawn, by draw_if on version. Routing closes no gate (plan §7).

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM studies WHERE id = 'a227145d-a66b-4053-be1f-169c825081ab') THEN
    RAISE EXCEPTION 'study already exists';
  END IF;
END $$;

INSERT INTO public.studies (
  id, name, public_title, created_by, active, consent_required, delivery_mode, allow_restart,
  reminders_enabled, allow_external_enrollment, allow_self_enrollment, require_student_number, max_attempts,
  compensation_kind, baseline_cap, offer_repository_consent, questionnaire_layout,
  separate_external_identity, study_code_prefix, external_identity_retention_days,
  design_seed, assignment_slots, assignment_slot_rules)
VALUES (
  'a227145d-a66b-4053-be1f-169c825081ab',
  'Breath Attention and Emotional Recovery (honours thesis, in person)',
  'Breath Attention and Emotional Recovery',
  '0097e364-e11c-40b9-81f3-622831f39bc2',
  true, true, 'in_person', false,
  false, false, false, false, 1,
  'credit', 300, true, 'stacked',
  true, 'MB', 7,
  'bre-2026-11',
  jsonb_build_object(
    'version', jsonb_build_array('main', 'neutral'),
    'cell_main', (SELECT jsonb_agg(jsonb_build_object('condition', c, 'sequence', q) ORDER BY c DESC, q)
                    FROM unnest(ARRAY['sf', 'em']) c, generate_series(1, 8) q),
    'cell_neutral', '[{"condition":"sf"},{"condition":"em"},{"condition":"sf"},{"condition":"em"}]'::jsonb),
  '{
     "version": {"assign": "rule", "fallback": "neutral",
                 "rule": {"any": [{"instrument": "gad-7", "sum_gte": 15}, {"instrument": "phq-8", "sum_gte": 15}],
                          "then": "neutral", "else": "main"}},
     "cell_main":    {"assign": "node", "draw_if": {"slot": "version", "in": ["main"]}},
     "cell_neutral": {"assign": "node", "draw_if": {"slot": "version", "in": ["neutral"]}}
   }'::jsonb);

INSERT INTO public.session_templates (id, label, folder, description)
VALUES ('31af220c-e230-4648-b785-982c16928de0', 'BreathAttention_ER_single_session', 'Maya Alves',
        'Breath Attention and Emotional Recovery, the one in-person session (plan §4). 20261123_bre_study.sql.');

INSERT INTO public.session_template_nodes (session_template_id, order_index, activity_id, questionnaire_id, label)
SELECT '31af220c-e230-4648-b785-982c16928de0', n.i,
       (SELECT id FROM activities WHERE category = n.cat AND subcategory = n.sub),
       (SELECT id FROM questionnaires WHERE slug = n.q),
       n.label
  FROM (VALUES
    ( 0, 'display',    'bre_screen_1_welcome',    NULL,              'Screen 1: Welcome'),
    ( 1, NULL,          NULL,                     'gad-7',           'GAD-7'),
    ( 2, NULL,          NULL,                     'phq-8',           'PHQ-8'),
    ( 3, 'assignment', 'version',                 NULL,              'Route by score (version)'),
    ( 4, 'display',    'bre_screen_2_background', NULL,              'Screen 2: Background questionnaires'),
    ( 5, 'form',       'student_demographics',    NULL,              'Demographics'),
    ( 6, NULL,          NULL,                     'bfi2-ne-om',      'BFI-2 NE + OM'),
    ( 7, NULL,          NULL,                     'asi-3',           'ASI-3'),
    ( 8, NULL,          NULL,                     'sf-short-20',     'SF-20'),
    ( 9, 'physio',     'bre_physio_setup',        NULL,              'Sensor set-up (RA hold)'),
    (10, 'bre_task',   'bre_baseline',            NULL,              'Baseline task'),
    (11, 'assignment', 'cell_main',               NULL,              'Draw cell (main)'),
    (12, 'assignment', 'cell_neutral',            NULL,              'Draw cell (neutral)'),
    (13, 'bre_task',   'bre_main',                NULL,              'Training and clip task'),
    (14, NULL,          NULL,                     'bre-helpfulness', 'Screen 11: Strategy helpfulness'),
    (15, 'bre_task',   'bre_end',                 NULL,              'Screen 12: End of tasks')
  ) AS n(i, cat, sub, q, label);

DO $$
BEGIN
  IF (SELECT count(*) FROM session_template_nodes
       WHERE session_template_id = '31af220c-e230-4648-b785-982c16928de0'
         AND (activity_id IS NOT NULL) <> (questionnaire_id IS NOT NULL)) <> 16 THEN
    RAISE EXCEPTION 'a template node did not resolve to exactly one activity or questionnaire';
  END IF;
END $$;

INSERT INTO public.study_sessions (id, study_id, session_template_id, day_number, send_time, label, order_index, node_key, link_expires_hours)
VALUES ('8eba7ebf-1d60-45e3-929a-2a1dfa214c80', 'a227145d-a66b-4053-be1f-169c825081ab', '31af220c-e230-4648-b785-982c16928de0',
        1, '09:00', 'Single session', 0, 'bre_single', 48);

COMMIT;
