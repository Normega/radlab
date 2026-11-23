-- Assignment slots set partway through a session: by a rule on questionnaire scores
-- ("route by score") or by a draw at a step ("lazy, conditional draw"). Plan WP-G1 + WP-G2 of
-- the Breath Attention and Emotional Recovery study (website.md §26d).
--
-- WHY. SessionEntry draws every key of studies.assignment_slots before step 1. That study
-- needs three slots that cannot be drawn there:
--   version       main / neutral, set by a rule on that session's GAD-7 and PHQ-8
--                 (either sum >= 15 -> neutral). Not random, and not a screener: nobody is
--                 blocked, so it must never touch screened_out (CLAUDE.md "Hard gates").
--   cell_main     condition x clip sequence (16 crossed arms), drawn only for version = main
--   cell_neutral  condition (blocks of 4), drawn only for version = neutral
-- Drawn up front, every participant would use up a draw in both cell slots, and neither
-- stratum would stay balanced on its own.
--
-- HOW. studies.assignment_slot_rules, keyed like assignment_slots (data, not code):
--   { "version":      { "assign": "rule", "fallback": "neutral",
--                       "rule": { "any": [ {"instrument": "gad-7", "sum_gte": 15},
--                                          {"instrument": "phq-8", "sum_gte": 15} ],
--                                 "then": "neutral", "else": "main" } },
--     "cell_main":    { "assign": "node", "draw_if": {"slot": "version", "in": ["main"]} },
--     "cell_neutral": { "assign": "node", "draw_if": {"slot": "version", "in": ["neutral"]} } }
-- A slot listed here is not drawn up front. It is set when the session reaches a step whose
-- activity is category 'assignment', subcategory = the slot key (src/components/study/
-- AssignmentStep.jsx):
--   assign = rule  route_by_score() sums the instruments answered in THIS session (schedule
--                  row) and records the arm with kind 'rule'. If it cannot score (an item
--                  missing, anything unexpected) it records the fallback arm with kind
--                  'fallback'. The browser gets the arm, never the scores.
--   assign = node  draw_assignment() as before, but it now refuses a draw whose draw_if the
--                  participant does not meet, and refuses to draw a rule slot at all.
-- Studies without assignment_slot_rules are untouched: draw_assignment's new checks read a
-- NULL and do nothing, and get_session_by_token returns one extra NULL key.
--
-- The two existing functions are patched in place, from their live bodies, with md5 guards,
-- so nothing else in them can drift (get_session_by_token was last changed today by
-- 20261123_sf2b_retest_session.sql).

-- ── 0. Guards ─────────────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF md5(pg_get_functiondef('public.get_session_by_token(text)'::regprocedure)) <> '8e713b18d4da45882c9429a45f68c9f6' THEN
    RAISE EXCEPTION 'get_session_by_token changed since this was written; rebase section 4';
  END IF;
  IF md5(pg_get_functiondef('public.draw_assignment(uuid,text,uuid)'::regprocedure)) <> 'ccc487808a77d6e20e97f5aa0db4cb88' THEN
    RAISE EXCEPTION 'draw_assignment changed since this was written; rebase section 3';
  END IF;
END $$;

-- ── 1. Settings and the assignment kinds ─────────────────────────────────────────────────────────
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS assignment_slot_rules jsonb
  CHECK (assignment_slot_rules IS NULL OR jsonb_typeof(assignment_slot_rules) = 'object');
COMMENT ON COLUMN public.studies.assignment_slot_rules IS
  'Slots (keys of assignment_slots) set mid-session instead of before step 1: {"assign":"rule","rule":{...},"fallback":arm} (route_by_score) or {"assign":"node","draw_if":{"slot":..,"in":[..]}} (draw_assignment at an assignment step). 20261123_route_by_score_lazy_draws.sql.';

ALTER TABLE public.participant_assignments DROP CONSTRAINT IF EXISTS participant_assignments_kind_check;
ALTER TABLE public.participant_assignments ADD CONSTRAINT participant_assignments_kind_check
  CHECK (kind = ANY (ARRAY['randomize','counterbalance','choice','anti_preference','rule','fallback']));

-- ── 2. Scoring and routing ───────────────────────────────────────────────────────────────────────
-- Sum of one instrument as answered at one schedule row, or NULL when it cannot be scored:
-- no response, or any scale item missing or not a number (a "Prefer not to answer" is a string).
-- Items are the definition's own (legacy items, or composable likert/slider components), so a
-- response row with extra or renamed keys cannot inflate the sum.
CREATE OR REPLACE FUNCTION public.instrument_sum_at(p_user uuid, p_schedule_id uuid, p_slug text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resp jsonb;
  v_def  jsonb;
  v_ids  text[];
  v_id   text;
  v_val  jsonb;
  v_sum  numeric := 0;
BEGIN
  SELECT responses INTO v_resp
    FROM questionnaire_responses
   WHERE user_id = p_user AND schedule_id = p_schedule_id AND questionnaire_slug = p_slug
     AND resubmission_of IS NULL
   ORDER BY received_at DESC NULLS LAST, completed_at DESC NULLS LAST
   LIMIT 1;
  SELECT definition INTO v_def FROM questionnaires WHERE slug = p_slug;
  IF v_resp IS NULL OR v_def IS NULL THEN RETURN NULL; END IF;

  SELECT array_agg(id) INTO v_ids FROM (
    SELECT i ->> 'id' AS id FROM jsonb_array_elements(COALESCE(v_def -> 'items', '[]'::jsonb)) i
    UNION ALL
    SELECT c ->> 'id' FROM jsonb_array_elements(COALESCE(v_def -> 'pages', '[]'::jsonb)) p,
                           jsonb_array_elements(COALESCE(p -> 'components', '[]'::jsonb)) c
     WHERE c ->> 'type' IN ('likert', 'likert_slider', 'slider')
  ) s WHERE id IS NOT NULL;
  IF v_ids IS NULL THEN RETURN NULL; END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    v_val := v_resp -> v_id;
    IF v_val IS NULL OR jsonb_typeof(v_val) <> 'number' THEN RETURN NULL; END IF;
    v_sum := v_sum + (v_val #>> '{}')::numeric;
  END LOOP;
  RETURN v_sum;
END;
$$;
REVOKE ALL ON FUNCTION public.instrument_sum_at(uuid, uuid, text) FROM public, anon, authenticated;

-- Sets a rule slot for the calling participant from the instruments of one of their own
-- schedule rows. Idempotent: an existing assignment is returned unchanged. Returns
-- {value, method}; never the scores.
CREATE OR REPLACE FUNCTION public.route_by_score(p_study_id uuid, p_slot_key text, p_schedule_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_existing participant_assignments%ROWTYPE;
  v_spec     jsonb;
  v_arms     jsonb;
  v_cond     jsonb;
  v_sum      numeric;
  v_hit      boolean := false;
  v_value    jsonb;
  v_kind     text := 'rule';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'route_by_score: not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM participant_schedule
                  WHERE id = p_schedule_id AND participant_id = v_uid AND study_id = p_study_id) THEN
    RAISE EXCEPTION 'route_by_score: that session is not yours in this study';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_study_id::text || ':' || p_slot_key || ':' || v_uid::text, 0));
  SELECT * INTO v_existing FROM participant_assignments
   WHERE study_id = p_study_id AND participant_id = v_uid AND node_id = p_slot_key;
  IF FOUND THEN
    RETURN jsonb_build_object('value', v_existing.value, 'method', v_existing.kind);
  END IF;

  SELECT assignment_slot_rules -> p_slot_key, assignment_slots -> p_slot_key
    INTO v_spec, v_arms FROM studies WHERE id = p_study_id;
  IF v_spec IS NULL OR v_spec ->> 'assign' IS DISTINCT FROM 'rule' THEN
    RAISE EXCEPTION 'route_by_score: slot "%" is not set by a rule', p_slot_key;
  END IF;
  IF v_arms IS NULL OR NOT (v_arms @> jsonb_build_array(v_spec -> 'fallback')) THEN
    RAISE EXCEPTION 'route_by_score: slot "%" has no valid fallback arm', p_slot_key;
  END IF;

  -- Any failure to score falls back; it never leaves the participant without an arm.
  BEGIN
    FOR v_cond IN SELECT * FROM jsonb_array_elements(v_spec -> 'rule' -> 'any') LOOP
      v_sum := public.instrument_sum_at(v_uid, p_schedule_id, v_cond ->> 'instrument');
      IF v_sum IS NULL THEN
        RAISE EXCEPTION 'cannot score %', v_cond ->> 'instrument';
      END IF;
      IF v_sum >= (v_cond ->> 'sum_gte')::numeric THEN v_hit := true; END IF;
    END LOOP;
    IF NOT FOUND THEN RAISE EXCEPTION 'rule has no conditions'; END IF;
    v_value := CASE WHEN v_hit THEN v_spec -> 'rule' -> 'then' ELSE v_spec -> 'rule' -> 'else' END;
    IF v_value IS NULL OR NOT (v_arms @> jsonb_build_array(v_value)) THEN
      RAISE EXCEPTION 'rule arm is not an arm of the slot';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_value := v_spec -> 'fallback';
    v_kind  := 'fallback';
  END;

  INSERT INTO participant_assignments (participant_id, study_id, node_id, kind, value, draw_index)
  VALUES (v_uid, p_study_id, p_slot_key, v_kind, v_value, NULL);
  RETURN jsonb_build_object('value', v_value, 'method', v_kind);
END;
$$;
REVOKE ALL ON FUNCTION public.route_by_score(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.route_by_score(uuid, text, uuid) TO authenticated;

-- ── 3. draw_assignment: refuse rule slots and unmet draw_if ──────────────────────────────────────
-- Inserted after the existing-assignment checks (so a participant re-reading their own arm is
-- never refused) and before the arms are read. A study without rules reads NULL and skips it.
DO $$
DECLARE
  v_def text := pg_get_functiondef('public.draw_assignment(uuid,text,uuid)'::regprocedure);
  v_anchor text := E'  select assignment_slots -> p_slot_key into v_arms\n';
  v_guard text := $g$  -- Slots set mid-session (studies.assignment_slot_rules, 20261123_route_by_score_lazy_draws.sql).
  declare
    v_rule jsonb;
    v_cond jsonb;
  begin
    select assignment_slot_rules -> p_slot_key into v_rule from studies where id = p_study_id;
    if v_rule ->> 'assign' = 'rule' then
      raise exception 'draw_assignment: slot "%" is set by a rule (route_by_score), not drawn', p_slot_key;
    end if;
    if v_rule ? 'draw_if' then
      select value into v_cond from participant_assignments
       where study_id = p_study_id and participant_id = v_participant
         and node_id = v_rule -> 'draw_if' ->> 'slot';
      if v_cond is null or not ((v_rule -> 'draw_if' -> 'in') @> jsonb_build_array(v_cond)) then
        raise exception 'draw_assignment: slot "%" is not drawn for this participant (draw_if)', p_slot_key;
      end if;
    end if;
  end;

$g$;
BEGIN
  IF (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 THEN
    RAISE EXCEPTION 'draw_assignment: anchor not found exactly once';
  END IF;
  EXECUTE replace(v_def, v_anchor, v_guard || v_anchor);
END $$;

-- ── 4. get_session_by_token: the slot rules (without thresholds) and the study code ──────────────
-- The client needs to know which slots it must not draw up front and each one's draw_if; the
-- rule itself (instruments, thresholds) stays in the database. study_code is the enrollment's
-- surrogate, returned only for studies with a study_code_prefix (20261121), for the end screen.
DO $$
DECLARE
  v_def text := pg_get_functiondef('public.get_session_by_token(text)'::regprocedure);
  a1 text := E'      ''open_email_after_consent'', v_study.open_email_after_consent\n    ),';
  b1 text := E'      ''open_email_after_consent'', v_study.open_email_after_consent,\n'
          || E'      ''assignment_slot_rules'',   (SELECT jsonb_object_agg(k, jsonb_build_object(''assign'', r ->> ''assign'', ''draw_if'', r -> ''draw_if''))\n'
          || E'                                    FROM jsonb_each(v_study.assignment_slot_rules) e(k, r))\n    ),';
  a2 text := E'      ''contact_email'',   v_enroll.contact_email\n    ),';
  b2 text := E'      ''contact_email'',   v_enroll.contact_email,\n'
          || E'      ''study_code'',      CASE WHEN v_study.study_code_prefix IS NOT NULL THEN v_enroll.external_id END\n    ),';
BEGIN
  IF (length(v_def) - length(replace(v_def, a1, ''))) / length(a1) <> 1
     OR (length(v_def) - length(replace(v_def, a2, ''))) / length(a2) <> 1 THEN
    RAISE EXCEPTION 'get_session_by_token: anchors not found exactly once';
  END IF;
  EXECUTE replace(replace(v_def, a1, b1), a2, b2);
END $$;
