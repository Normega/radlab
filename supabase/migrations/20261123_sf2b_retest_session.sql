-- Sense Foraging Study 2b follow-up (retest) session. Applied 2026-11-23 (see README.md manifest).
-- Proposal of 2026-11-21 (read-only investigation), approved by Norm 2026-11-23 with these
-- decisions: (1) the no-vignette arm gets the vignettes' introduction alone, and "Begin" finishes
-- it; (2) no consent or information page for returners; (3) the retest's debrief is a COPY of
-- Study 2b's with one sentence added, and 2b's own debrief is not edited.
--
-- Option B (Norm, 20 Nov 2026): a second session, "Retest", inside the existing Study 2b study
-- 1864d663-d01c-5d82-91f0-3047462470c3, reached by a new Prolific study (Custom Allowlist) whose URL
-- is the same /study/join link. Same Prolific id, same study -> same surrogate
-- (external_identity_surrogate is keyed on (study_id, external_id)), so a returning participant
-- lands in their existing 2b enrollment, and auto-enroll's multi-session path (same commit) routes
-- them to the first session they have not completed.
--
-- What this file does (all of it additive; no response, schedule, link or enrollment row changes):
--   1. session_template_nodes.show_if: a step that runs only for one arm of an assignment slot.
--   2. session_template_nodes.debrief_form_id: a debrief node may name its own debrief form, which
--      replaces the study's for that session only.
--   3. get_session_by_token returns show_if with each node, and the session's own debrief form when
--      a node names one (live body otherwise unchanged; live md5 of pg_get_functiondef before this
--      change: c948cabb28bccac43dead1a672b67750).
--   4. Four new composable definitions, built by SQL from the LIVE rows where wording is copied, so
--      the copy is byte-identical, and equal to the reference copies in the analysis repo
--      (sense-foraging-scale/study2b/materials/): sf2b-retest-intro, sf2b-retest-candidates,
--      sf2b-ffmq-observing, sf2b-retest-practice.
--   5. The retest debrief form: Study 2b's debrief (dc7c2c8f-...) copied by SQL with one sentence
--      added. 2b's form row and the studies.active_debrief_form_id pointer are not touched.
--   6. The retest session template (7 nodes) and the study_sessions row (day 15, order 1, "Retest").
--   7. Study 2b settings: the arm slot, its seed, baseline_cap = baselines completed now (723), and
--      retain_identities_until so nobody de-identifies 2b before the retest is paid.
-- Study 2b stays active = false, allow_external_enrollment = false. Launch and close are separate,
-- later migrations (not in this file).
--
-- Hard gates: nothing here opens a gate. The decision stays in schedule_row_block_reason (not
-- redefined). baseline_cap closes the entry session to anyone without a completed 2b session
-- (enrollment_full); the retest session is day 15, so it is not the entry session and a person
-- without consent gets no_consent. Arm conditions decide which steps run, never whether the
-- session may open.
--
-- Grants: no new table or view (CLAUDE.md, 2026-10-30 rule). New columns on an existing table keep
-- that table's grants.

BEGIN;

-- ── 0. Preconditions: fail the whole migration if the world is not as read on 2026-11-21/23 ──────
DO $$
DECLARE v int;
BEGIN
  IF (SELECT count(*) FROM study_sessions WHERE study_id = '1864d663-d01c-5d82-91f0-3047462470c3') <> 1 THEN
    RAISE EXCEPTION 'Study 2b already has more than one session';
  END IF;
  IF (SELECT active OR allow_external_enrollment FROM studies WHERE id = '1864d663-d01c-5d82-91f0-3047462470c3') THEN
    RAISE EXCEPTION 'Study 2b is active or open to external enrollment; apply this only while it is off';
  END IF;
  IF EXISTS (SELECT 1 FROM participant_links WHERE study_id = '1864d663-d01c-5d82-91f0-3047462470c3' AND status = 'active') THEN
    RAISE EXCEPTION 'Study 2b has an active link';
  END IF;
  IF EXISTS (SELECT 1 FROM participant_schedule WHERE study_id = '1864d663-d01c-5d82-91f0-3047462470c3'
              AND status IN ('pending', 'link_sent', 'unlocked', 'awaiting_date')) THEN
    RAISE EXCEPTION 'Study 2b has a schedule row still in flight';
  END IF;
  IF EXISTS (SELECT 1 FROM participant_assignments WHERE study_id = '1864d663-d01c-5d82-91f0-3047462470c3') THEN
    RAISE EXCEPTION 'Study 2b already has assignment draws';
  END IF;
  IF EXISTS (SELECT 1 FROM study_enrollments WHERE study_id = '1864d663-d01c-5d82-91f0-3047462470c3' AND deidentified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Study 2b has de-identified enrollments: returning participants could not be matched';
  END IF;
  IF (SELECT external_identity_retention_days IS NOT NULL OR baseline_cap IS NOT NULL OR assignment_slots IS NOT NULL
        FROM studies WHERE id = '1864d663-d01c-5d82-91f0-3047462470c3') THEN
    RAISE EXCEPTION 'Study 2b settings changed since 2026-11-21 (retention days, cap or slots already set)';
  END IF;
  IF (SELECT active_debrief_form_id FROM studies WHERE id = '1864d663-d01c-5d82-91f0-3047462470c3')
       IS DISTINCT FROM 'dc7c2c8f-d1fc-4a66-9f6a-2143b6371c31' THEN
    RAISE EXCEPTION 'Study 2b debrief form changed';
  END IF;
  v := public.study_baselines_completed('1864d663-d01c-5d82-91f0-3047462470c3');
  IF v <> 723 THEN
    RAISE EXCEPTION 'Study 2b baselines completed is %, expected 723 (re-check before setting the cap)', v;
  END IF;
  IF md5(pg_get_functiondef('public.get_session_by_token(text)'::regprocedure)) <> 'c948cabb28bccac43dead1a672b67750' THEN
    RAISE EXCEPTION 'get_session_by_token changed since this was written; rebase section 3 on the live body';
  END IF;
END $$;

-- ── 1. Arm-conditional steps ─────────────────────────────────────────────────────────────────────
-- { "slot": "<studies.assignment_slots key>", "in": ["<arm>", ...] }: the step runs only when the
-- participant's drawn arm for that slot is listed (same shape as a display block's showIf).
-- NULL = every participant (every existing node). SessionEntry draws the slot before the first
-- step and fails closed if the draw cannot be made (src/lib/armSteps.js).
ALTER TABLE public.session_template_nodes ADD COLUMN IF NOT EXISTS show_if jsonb;
ALTER TABLE public.session_template_nodes DROP CONSTRAINT IF EXISTS session_template_nodes_show_if_shape;
ALTER TABLE public.session_template_nodes ADD CONSTRAINT session_template_nodes_show_if_shape CHECK (
  show_if IS NULL OR (
    jsonb_typeof(show_if) = 'object'
    AND jsonb_typeof(show_if -> 'slot') = 'string'
    AND jsonb_typeof(show_if -> 'in') = 'array'
    AND jsonb_array_length(show_if -> 'in') > 0
  )
);
COMMENT ON COLUMN public.session_template_nodes.show_if IS
  'Arm condition: {"slot": key of studies.assignment_slots, "in": [arms]}. The step runs only for participants whose drawn arm is listed; NULL = everyone. Decides which steps run, never whether a session may open (that is schedule_row_block_reason). 20261123_sf2b_retest_session.sql.';

-- ── 2. A debrief node's own form ─────────────────────────────────────────────────────────────────
-- The debrief step (activities form/debrief) shows the study's active debrief form. A node that
-- names a form here shows that one instead, for its session only, so a later session can carry its
-- own debrief without editing the one an earlier session administered.
ALTER TABLE public.session_template_nodes
  ADD COLUMN IF NOT EXISTS debrief_form_id uuid REFERENCES public.study_debrief_forms(id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.session_template_nodes.debrief_form_id IS
  'Debrief node only: the study_debrief_forms row this session shows instead of studies.active_debrief_form_id. NULL = the study''s form. 20261123_sf2b_retest_session.sql.';

-- ── 3. get_session_by_token: the live body, plus 'show_if' on each node and the node debrief ─────
CREATE OR REPLACE FUNCTION public.get_session_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link         participant_links%ROWTYPE;
  v_sched        participant_schedule%ROWTYPE;
  v_sess         study_sessions%ROWTYPE;
  v_study        studies%ROWTYPE;
  v_enroll       study_enrollments%ROWTYPE;
  v_nodes        jsonb;
  v_consent_html text;
  v_debrief_html text;
  v_node_debrief text;
BEGIN
  SELECT * INTO v_link
    FROM participant_links
    WHERE token = p_token
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_link.status = 'revoked' THEN
    RETURN jsonb_build_object('error', 'revoked');
  END IF;

  SELECT * INTO v_sched FROM participant_schedule WHERE id = v_link.schedule_id;

  IF v_link.status IN ('used', 'completed')
     OR v_sched.status = 'completed'
     OR v_sched.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error', 'completed',
      'next_session', public.next_pending_session(v_link.participant_id, v_link.study_id)
    );
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    UPDATE participant_links
       SET status = 'expired'
     WHERE id = v_link.id AND status = 'active';

    RETURN jsonb_build_object(
      'error', 'expired',
      'next_session', public.next_pending_session(v_link.participant_id, v_link.study_id)
    );
  END IF;

  SELECT * INTO v_sess  FROM study_sessions WHERE id = v_sched.study_session_id;
  SELECT * INTO v_study FROM studies        WHERE id = v_link.study_id;

  SELECT * INTO v_enroll
    FROM study_enrollments
    WHERE profile_id = v_link.participant_id
      AND study_id   = v_link.study_id
    LIMIT 1;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          n.id,
      'order_index', n.order_index,
      'label',       n.label,
      'activity_id', n.activity_id,
      'module_id',   n.module_id,
      'shuffle_group', n.shuffle_group,
      'show_if',     n.show_if,
      'activities',  CASE
        WHEN a.id IS NOT NULL THEN jsonb_build_object(
          'id',          a.id,
          'category',    a.category,
          'subcategory', a.subcategory,
          'label',       a.label
        )
        WHEN q.id IS NOT NULL THEN jsonb_build_object(
          'id',          q.id,
          'category',    'questionnaire',
          'subcategory', q.slug,
          'label',       q.name
        )
        WHEN n.module_id IS NOT NULL THEN jsonb_build_object(
          'id',          NULL,
          'category',    'training',
          'subcategory', n.module_id,
          'label',       n.label
        )
        ELSE NULL
      END
    ) ORDER BY n.order_index
  )
  INTO v_nodes
  FROM session_template_nodes n
  LEFT JOIN activities     a ON a.id = n.activity_id
  LEFT JOIN questionnaires q ON q.id = n.questionnaire_id
  WHERE n.session_template_id = v_sess.session_template_id;

  IF v_study.active_consent_form_id IS NOT NULL THEN
    SELECT html_content INTO v_consent_html
      FROM study_consent_forms WHERE id = v_study.active_consent_form_id;
  END IF;
  IF v_study.active_debrief_form_id IS NOT NULL THEN
    SELECT html_content INTO v_debrief_html
      FROM study_debrief_forms WHERE id = v_study.active_debrief_form_id;
  END IF;
  -- A debrief node that names its own form (session_template_nodes.debrief_form_id) replaces the
  -- study's form for this session only (20261123_sf2b_retest_session.sql).
  SELECT f.html_content INTO v_node_debrief
    FROM session_template_nodes n
    JOIN study_debrief_forms f ON f.id = n.debrief_form_id
   WHERE n.session_template_id = v_sess.session_template_id
   ORDER BY n.order_index
   LIMIT 1;
  IF FOUND THEN
    v_debrief_html := v_node_debrief;
  END IF;

  IF v_sched.status IN ('pending', 'link_sent') THEN
    UPDATE participant_schedule SET status = 'unlocked' WHERE id = v_sched.id;
  END IF;

  RETURN jsonb_build_object(
    'link', jsonb_build_object(
      'id',             v_link.id,
      'status',         v_link.status,
      'expires_at',     v_link.expires_at,
      'participant_id', v_link.participant_id,
      'study_id',       v_link.study_id
    ),
    'schedule', jsonb_build_object(
      'id',               v_sched.id,
      'status',           v_sched.status,
      'study_id',         v_sched.study_id,
      'study_session_id', v_sched.study_session_id,
      'scheduled_date',   v_sched.scheduled_date,
      'study_day',        v_sched.study_day,
      'send_time',        v_sched.send_time::text,
      'completed_at',     v_sched.completed_at
    ),
    'study', jsonb_build_object(
      'consent_required',        v_study.consent_required,
      'active_consent_form_id',  v_study.active_consent_form_id,
      'completion_redirect_url', v_study.completion_redirect_url,
      'screener',                v_study.screener,
      'assignment_slots',        v_study.assignment_slots,
      'longitudinal',            (v_study.design_graph IS NOT NULL),
      'open_email_after_consent', v_study.open_email_after_consent
    ),
    'enrollment', jsonb_build_object(
      'id',              v_enroll.id,
      'consent_date',    v_enroll.consent_date,
      'external_source', v_enroll.external_source,
      'contact_email',   v_enroll.contact_email
    ),
    'nodes',        COALESCE(v_nodes, '[]'::jsonb),
    'consent_html', v_consent_html,
    'debrief_html', v_debrief_html
  );
END;
$function$;

-- ── 4. The new definitions (copied wording taken from the live rows by SQL, never retyped) ───────

-- 4a. The introduction alone, for the no-vignette arm: sf2b-vignettes' own name and instructions
--     (the three paragraphs), shown on the same instructions card, and one empty page. "Begin"
--     finishes the step (ComposableQuestionnaireRenderer + src/lib/introductionOnly.js); the
--     validator accepts exactly this shape.
INSERT INTO public.questionnaires (id, slug, name, definition)
SELECT 'eb5c6870-b047-54de-b951-e4be00d50769', 'sf2b-retest-intro', q.name,
       jsonb_build_object(
         'slug',               'sf2b-retest-intro',
         'name',               q.definition -> 'name',
         'questionnaire_type', 'composable',
         'instructions',       q.definition -> 'instructions',
         'pages',              '[{"id": "intro_p1", "components": []}]'::jsonb,
         'source',             jsonb_build_object(
           'from_slug', 'sf2b-vignettes',
           'note', 'The introduction of sf2b-vignettes alone (name and instructions copied unchanged), for the retest no-vignette arm, shown on the same instructions card. Collects nothing; "Begin" finishes the step (renderer change of 23 Nov 2026).'))
  FROM public.questionnaires q WHERE q.slug = 'sf2b-vignettes';

-- 4b. The ten candidates + one check, one page, constrained seeded order (src/lib/interleaveOrder.js):
--     C9 and C10 at least four positions apart (pair_min_gap 4); the check never first or last
--     (not_page_edge). The order is recorded in responses._order.positions, seeded by
--     `${schedule_id}:sf2b-retest-candidates`, so a reload shows the same order. The written order
--     of the components (the fallback if no seeded order can be drawn) is itself a valid order, as in
--     the reference file. Response scale copied from sf2b-scale's sf2b_01 (1-6, no midpoint);
--     "Prefer not to answer" via allow_pna on every statement; the check has none, as sf2b-scale's.
WITH s AS (
  SELECT q.definition AS d,
         (SELECT c -> 'scale'
            FROM jsonb_array_elements(q.definition -> 'pages') p,
                 jsonb_array_elements(p -> 'components') c
           WHERE c ->> 'id' = 'sf2b_01') AS scale
    FROM public.questionnaires q WHERE q.slug = 'sf2b-scale'
), comps(pos, id, statement, pna) AS (VALUES
  (1,  'sfr_01',            'Ordinary sights and sounds hold little interest for me',                                                      true),
  (2,  'sfr_02',            'Stopping to look at or listen to my surroundings tends to bore me',                                           true),
  (3,  'sfr_03',            'I find it dull to pay attention to how ordinary things smell, taste or feel',                                 true),
  (4,  'sfr_04',            'How my body feels from moment to moment doesn’t interest me much',                                            true),
  (5,  'sfr_09',            'When I notice sounds around me or sensations in my body, it is usually because I am checking for a problem', true),
  (6,  'sfr_05',            'Once I know what something looks or sounds like, I stop paying attention to it',                              true),
  (7,  'sfr_attn_disagree', 'To show that you are reading each statement, please select “Disagree” for this one.',                         false),
  (8,  'sfr_06',            'Familiar places have nothing new to offer my senses',                                                         true),
  (9,  'sfr_07',            'Spending time in the sensing mode does little for me',                                                        true),
  (10, 'sfr_10',            'When I notice sounds around me or sensations in my body, it is usually because they interest me',            true),
  (11, 'sfr_08',            'When I have a spare moment, I use it to get something done',                                                  true)
), items(ord, id, reversed, eligible, tests) AS (VALUES
  (1,  'sfr_01', true,  true,  'interest'),
  (2,  'sfr_02', true,  true,  'enjoyment'),
  (3,  'sfr_03', true,  true,  'enjoyment, the other senses'),
  (4,  'sfr_04', true,  true,  'interest in the body'),
  (5,  'sfr_05', true,  true,  'updating'),
  (6,  'sfr_06', true,  true,  'exploring the ordinary'),
  (7,  'sfr_07', true,  true,  'valuing; names the mode'),
  (8,  'sfr_08', true,  true,  'the doing pole'),
  (9,  'sfr_09', true,  true,  'vigilant noticing (Observing''s other strand)'),
  (10, 'sfr_10', false, false, 'curious noticing (C9''s partner)')
)
INSERT INTO public.questionnaires (id, slug, name, definition)
SELECT '3a84c131-79e9-5a6d-b6bd-cda7dadd51de', 'sf2b-retest-candidates', s.d ->> 'name',
       jsonb_build_object(
         'slug',               'sf2b-retest-candidates',
         'name',               s.d -> 'name',
         'questionnaire_type', 'composable',
         'instructions',       s.d -> 'instructions',
         'pages', jsonb_build_array(jsonb_build_object(
           'id', 'sfr_p1',
           'components',
             (SELECT jsonb_agg(
                       jsonb_build_object('id', c.id, 'type', 'likert', 'question', c.statement,
                                          'scale', s.scale, 'required', true)
                       || CASE WHEN c.pna THEN '{"allow_pna": true}'::jsonb ELSE '{}'::jsonb END
                       ORDER BY c.pos)
                FROM comps c))),
         'interleave', jsonb_build_object(
           'items',        '["sfr_01","sfr_02","sfr_03","sfr_04","sfr_05","sfr_06","sfr_07","sfr_08","sfr_09","sfr_10","sfr_attn_disagree"]'::jsonb,
           'page_sizes',   '[11]'::jsonb,
           'pairs',        '[["sfr_09","sfr_10"]]'::jsonb,
           'pair_min_gap', 4,
           'anchored',     '{"sfr_attn_disagree": {"not_page_edge": true}}'::jsonb),
         'items', (SELECT jsonb_agg(jsonb_build_object('id', i.id, 'source', 'C' || i.ord, 'role', 'candidate',
                                                      'reverse_keyed', i.reversed, 'eligible_to_replace_u4', i.eligible,
                                                      'tests', i.tests) ORDER BY i.ord)
                     FROM items i),
         'attention_checks', '{"sfr_attn_disagree": 2}'::jsonb,
         'scoring', jsonb_build_object(
           'method', 'mean',
           'reverse', '7 - x',
           'reverse_items', '["sfr_01","sfr_02","sfr_03","sfr_04","sfr_05","sfr_06","sfr_07","sfr_08","sfr_09"]'::jsonb,
           'note', 'Not a scale. Ten candidate statements for the Study 2b follow-up (preregistration Appendix A): C1-C9 are eligible to replace U4 (sf2b_07) under rule R3; C10 is forward-keyed and tests motive with C9 (R4). Order per participant by `interleave`, seeded by schedule row and slug, recorded with the answers as _order.positions; C9 and C10 at least four positions apart, the check never first or last. "Prefer not to answer" is missing.'))
  FROM s;

-- 4c. FFMQ Observing alone: ffmq_01, ffmq_06, ffmq_11 (study2b/analysis/config.R) copied whole from
--     sf2-ffmq15, with its name and instructions, on one page. Same item ids, values and order, so
--     the analysis matches them to the first occasion by id.
INSERT INTO public.questionnaires (id, slug, name, definition)
SELECT '75f9a975-bfdf-56d0-8256-aa16ad26dfa5', 'sf2b-ffmq-observing', q.name,
       jsonb_build_object(
         'slug',               'sf2b-ffmq-observing',
         'name',               q.definition -> 'name',
         'questionnaire_type', 'composable',
         'instructions',       q.definition -> 'instructions',
         'pages', jsonb_build_array(jsonb_build_object(
           'id', 'ffmq_obs_p1',
           'components', (SELECT jsonb_agg(c ORDER BY c ->> 'id')
                            FROM jsonb_array_elements(q.definition -> 'pages') p,
                                 jsonb_array_elements(p -> 'components') c
                           WHERE c ->> 'id' IN ('ffmq_01', 'ffmq_06', 'ffmq_11')))),
         'scoring', jsonb_build_object(
           'method', 'mean',
           'range', '1-5',
           'reverse_items', '[]'::jsonb,
           'subscales', '{"Observing": ["ffmq_01", "ffmq_06", "ffmq_11"]}'::jsonb,
           'source', 'FFMQ-15 Observing (items 1, 6, 11): Gu et al. (2016). The three items of sf2-ffmq15, same ids, values and order. The platform copy is built from the live sf2-ffmq15 definition (instructions, item wording and labels copied from it), so the wording is unchanged; only the other twelve items are left out. Study 2b follow-up stability benchmark (plan D4).'))
  FROM public.questionnaires q WHERE q.slug = 'sf2-ffmq15';

-- 4d. Change since the first session (plan step 6). "Prefer not to answer" is the component's own
--     allow_pna button (stored 'pna').
INSERT INTO public.questionnaires (id, slug, name, definition)
VALUES ('cdeb0772-f017-56c5-b4d0-0fcdeda5171b', 'sf2b-retest-practice', 'Since the last study', $json$
{
  "slug": "sf2b-retest-practice",
  "name": "Since the last study",
  "questionnaire_type": "composable",
  "instructions": "",
  "pages": [{
    "id": "sfrp_p1",
    "components": [{
      "id": "sfrp_change",
      "type": "multiple_choice",
      "question": "Since the last study (about two weeks ago), have you started, stopped or changed a regular practice such as meditation, yoga, prayer or spending time in nature?",
      "options": [
        {"id": "no",           "label": "No",                "value": "no"},
        {"id": "started",      "label": "Started",           "value": "started"},
        {"id": "stopped",      "label": "Stopped",           "value": "stopped"},
        {"id": "changed_freq", "label": "Changed how often", "value": "changed_freq"}
      ],
      "required": true,
      "allow_pna": true
    }]
  }]
}
$json$::jsonb);

-- Read-back: every copied part arrived and is what it was copied from.
DO $$
BEGIN
  IF (SELECT definition -> 'instructions' FROM questionnaires WHERE slug = 'sf2b-retest-intro')
     IS DISTINCT FROM (SELECT definition -> 'instructions' FROM questionnaires WHERE slug = 'sf2b-vignettes')
     OR (SELECT definition ->> 'instructions' FROM questionnaires WHERE slug = 'sf2b-retest-intro') IS NULL THEN
    RAISE EXCEPTION 'intro text did not copy';
  END IF;
  IF (SELECT jsonb_array_length(definition -> 'pages' -> 0 -> 'components') FROM questionnaires WHERE slug = 'sf2b-ffmq-observing') <> 3 THEN
    RAISE EXCEPTION 'FFMQ Observing: expected 3 items';
  END IF;
  IF (SELECT jsonb_array_length(definition -> 'pages' -> 0 -> 'components') FROM questionnaires WHERE slug = 'sf2b-retest-candidates') <> 11
     OR EXISTS (SELECT 1 FROM questionnaires q, jsonb_array_elements(q.definition -> 'pages' -> 0 -> 'components') c
                 WHERE q.slug = 'sf2b-retest-candidates' AND jsonb_array_length(c -> 'scale') <> 6) THEN
    RAISE EXCEPTION 'candidates: expected 11 components on a 6-point scale';
  END IF;
END $$;

-- ── 5. The retest debrief: Study 2b's debrief, copied by SQL, with one sentence added ─────────────
-- Norm, 23 Nov: 2b's debrief stays as administered (its form row and the study's pointer are not
-- touched); the retest session's debrief node names this copy (debrief_form_id, section 2). The
-- sentence goes in "About This Study", after the description of what the study measures and
-- before the paragraph's explanation of the vignette ratings. The apostrophe is written &#x27;, as
-- every apostrophe in 2b's debrief HTML is.
INSERT INTO public.study_debrief_forms (id, study_id, docx_url, html_content, uploaded_by)
SELECT '3421c988-1eac-57a8-8cf5-0ba932776605', f.study_id, NULL,
       replace(f.html_content,
               'a tendency to describe oneself favourably (BIDR-16). ',
               'a tendency to describe oneself favourably (BIDR-16). In this follow-up session, you answered some of the same statements again about two weeks after your first session, so we can see how stable people&#x27;s answers are over time, along with some new statements we are testing. '),
       NULL
  FROM public.study_debrief_forms f WHERE f.id = 'dc7c2c8f-d1fc-4a66-9f6a-2143b6371c31';

DO $$
DECLARE v_old text; v_new text;
  v_sentence text := 'In this follow-up session, you answered some of the same statements again about two weeks after your first session, so we can see how stable people&#x27;s answers are over time, along with some new statements we are testing. ';
BEGIN
  SELECT html_content INTO v_old FROM study_debrief_forms WHERE id = 'dc7c2c8f-d1fc-4a66-9f6a-2143b6371c31';
  SELECT html_content INTO v_new FROM study_debrief_forms WHERE id = '3421c988-1eac-57a8-8cf5-0ba932776605';
  IF (length(v_old) - length(replace(v_old, 'a tendency to describe oneself favourably (BIDR-16). ', ''))) <> length('a tendency to describe oneself favourably (BIDR-16). ') THEN
    RAISE EXCEPTION 'debrief anchor sentence is not in 2b''s debrief exactly once';
  END IF;
  IF v_new IS NULL OR length(v_new) <> length(v_old) + length(v_sentence)
     OR replace(v_new, v_sentence, '') IS DISTINCT FROM v_old THEN
    RAISE EXCEPTION 'retest debrief is not 2b''s debrief plus the one sentence';
  END IF;
END $$;

-- ── 6. The retest session ────────────────────────────────────────────────────────────────────────
-- Ids are uuid5(NAMESPACE_URL, 'radlab:sf-study2b-retest:<k>'), as build_study2b.py does for 2b.
-- Steps 0 and 1 are the two arms' alternatives, so after filtering each arm has six steps and the
-- first step is step_index 0 in both: vignette arm = sf2b-vignettes (the introduction on its own
-- card, the nine vignettes, vig_self), unchanged and the same row as in 2b; no-vignette arm = the
-- introduction alone.
INSERT INTO public.session_templates (id, label, folder, description)
VALUES ('366911b8-5dff-584f-97bf-cbe7151c2df3', 'SenseForaging_Study2b_retest', 'Sense Foraging',
        'Study 2b follow-up (retest): introduction with the nine vignettes (vignette arm) or the introduction alone (no-vignette arm), the scale, the ten candidates, FFMQ Observing, practice change, debrief (the retest copy of 2b''s debrief). Generated by 20261123_sf2b_retest_session.sql; steps 0 and 1 carry arm conditions (show_if).');

INSERT INTO public.session_template_nodes (session_template_id, order_index, questionnaire_id, activity_id, label, show_if, debrief_form_id) VALUES
  ('366911b8-5dff-584f-97bf-cbe7151c2df3', 0, (SELECT id FROM questionnaires WHERE slug = 'sf2b-vignettes'),          NULL,
   'The two modes: introduction and vignettes (vignette arm)', '{"slot": "sf2b_retest_vignettes", "in": ["vignettes"]}', NULL),
  ('366911b8-5dff-584f-97bf-cbe7151c2df3', 1, (SELECT id FROM questionnaires WHERE slug = 'sf2b-retest-intro'),       NULL,
   'The two modes: introduction only (no-vignette arm)',      '{"slot": "sf2b_retest_vignettes", "in": ["no_vignettes"]}', NULL),
  ('366911b8-5dff-584f-97bf-cbe7151c2df3', 2, (SELECT id FROM questionnaires WHERE slug = 'sf2b-scale'),              NULL,
   'Sense Foraging Scale: the 10 + 3 exploratory + check', NULL, NULL),
  ('366911b8-5dff-584f-97bf-cbe7151c2df3', 3, (SELECT id FROM questionnaires WHERE slug = 'sf2b-retest-candidates'),  NULL,
   'U4 replacement candidates (C1-C10) + check', NULL, NULL),
  ('366911b8-5dff-584f-97bf-cbe7151c2df3', 4, (SELECT id FROM questionnaires WHERE slug = 'sf2b-ffmq-observing'),     NULL,
   'FFMQ Observing (3 items)', NULL, NULL),
  ('366911b8-5dff-584f-97bf-cbe7151c2df3', 5, (SELECT id FROM questionnaires WHERE slug = 'sf2b-retest-practice'),    NULL,
   'Practice change since the first session', NULL, NULL),
  ('366911b8-5dff-584f-97bf-cbe7151c2df3', 6, NULL, 'f79f90f7-9f59-44a6-8cf7-4ca45a76298a',
   'Debrief (retest)', NULL, '3421c988-1eac-57a8-8cf5-0ba932776605');

-- day_number 15 (nominal; the session is never sent, so it only has to be after the entry session's
-- day 1, which makes it a non-entry session for schedule_row_block_reason). Label "Retest": the
-- export names its columns <slug>_retest_<item> (timepointToken), beside 2b's <slug>_single_session_*.
INSERT INTO public.study_sessions (id, study_id, session_template_id, day_number, send_time, label, order_index, node_key, link_expires_hours)
VALUES ('8cadd1cd-06be-527a-b3d8-f651d9930832', '1864d663-d01c-5d82-91f0-3047462470c3', '366911b8-5dff-584f-97bf-cbe7151c2df3',
        15, '09:00', 'Retest', 1, 'sf_retest', 48);

-- ── 7. Study 2b settings ─────────────────────────────────────────────────────────────────────────
-- Arm: draw_assignment's seeded permuted blocks. Listing each arm twice makes blocks of four (two of
-- each) in the order participants reach their first retest step; the draw is recorded in
-- participant_assignments (node_id = slot, value, draw_index, created_at) and returned unchanged on
-- every reload.
-- Cap: the number of completed 2b sessions now (asserted = 723 above), so the entry session is
-- closed to everyone who has not completed it (enrollment_full), as Liliana 3 was closed on
-- 2026-11-20. Returning completers are unaffected by the cap.
-- Identities: deidentify_external_enrollments refuses to delete Study 2b's Prolific ids before this
-- date; deleting them would make every returning participant a newcomer (and refused).
UPDATE public.studies
   SET assignment_slots        = '{"sf2b_retest_vignettes": ["vignettes", "no_vignettes", "vignettes", "no_vignettes"]}'::jsonb,
       design_seed             = 'sf2b-retest-2026-11-21',
       baseline_cap            = public.study_baselines_completed('1864d663-d01c-5d82-91f0-3047462470c3'),
       retain_identities_until = '2027-01-31 23:59:59-05'
 WHERE id = '1864d663-d01c-5d82-91f0-3047462470c3';

COMMIT;

-- ── Read-back (SELECTs; run after COMMIT) ────────────────────────────────────────────────────────
-- SELECT order_index, label, show_if, debrief_form_id FROM session_template_nodes
--  WHERE session_template_id = '366911b8-5dff-584f-97bf-cbe7151c2df3' ORDER BY order_index;
-- SELECT label, day_number, order_index, node_key FROM study_sessions
--  WHERE study_id = '1864d663-d01c-5d82-91f0-3047462470c3' ORDER BY order_index;
-- SELECT active, allow_external_enrollment, baseline_cap, assignment_slots, design_seed, retain_identities_until,
--        completion_redirect_url, active_debrief_form_id FROM studies WHERE id = '1864d663-d01c-5d82-91f0-3047462470c3';
-- Unchanged (same counts as before applying: 743 enrollments, 723 completed + 25 missed rows, 13,879
-- responses with a 2b schedule_id):
-- SELECT status, count(*) FROM participant_schedule WHERE study_id = '1864d663-d01c-5d82-91f0-3047462470c3' GROUP BY 1;
--
-- Launch and close: separate migrations, written when they are applied (launch needs the new
-- Prolific study's completion code).
