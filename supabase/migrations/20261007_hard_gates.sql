-- Hard gates: one database decision for whether a session may reach a
-- participant, enforced by every path that sends or opens one.
--
-- WHY. Liliana Study 3, 2026-10-07. A study day's link went out on the
-- calendar regardless of what came before it, because every gate was enforced
-- -- if at all -- by whichever piece of code happened to be doing the sending:
--   * failing the screener closed nothing: three SONA sign-ups who were
--     screened out had been emailed three study links a day, one since
--     2026-09-26, because they happened to have real RADlab account addresses;
--   * consent was enforced only in the browser, at the entry session: 96
--     people who never consented held scheduled Phase 1 sessions, and those
--     with a deliverable address were being emailed them;
--   * the baseline gated nothing: Phase 1 was materialized at enrollment, so
--     27 participants were doing the intervention with no baseline.
-- Norm (2026-10-07): "these need to be hard gates -- other code cannot
-- override a hard gate". See CLAUDE.md "Hard gates".
--
-- WHAT.
--   schedule_row_block_reason(schedule_id) -- THE decision. NULL = may be sent
--     or opened; otherwise the reason it may not. service_role only.
--   session_entry_block(token)  -- the same decision for the participant who
--     owns the link, for SessionEntry. Fails closed in the client.
--   send_message calls the first before issuing a link or sending anything;
--   SessionEntry calls the second before the screener, consent or any step.
--
-- The gates, in order:
--   study_inactive   studies.active = false
--   withdrawn        the enrollment is withdrawn
--   screened_out     latest screener attempt failed, no newer retake grant
--                    (mirrors SessionEntry's screener gate exactly)
--   no_consent       consent required, not given, and this is not the entry
--                    session (the entry session is where consent is taken)
--   enrollment_full  studies.baseline_cap reached and this participant has not
--                    completed the entry session
--   gate_incomplete  an earlier GATE session for this participant is not
--                    completed. Gate sessions: any session marked `hold` in the
--                    design graph (Liliana's baseline), and any session that
--                    leads straight into a randomize fork (Liliana's midpoint).
--
-- The one exception is recorded in the data, not written into code: a hold row
-- with resend_note = 'baseline_catchup' does not hold back the sessions after
-- it. That marks the 27 participants who were let into Phase 1 without a
-- baseline before this existed; Norm chose to keep their daily sessions going
-- and send them the baseline as a catch-up (20261007_liliana_baseline_catchup.sql).
--
-- Also here: the columns behind hold sessions (materializeSchedule `hold`,
-- check_schedule's daily hold re-send) and parallel links (issueLink), the
-- enrollment cap, and complete_session_by_token's next-contact estimate
-- treating a hold like a fork gate.

-- ─── Columns ─────────────────────────────────────────────────────────────────

ALTER TABLE public.participant_links
  ADD COLUMN IF NOT EXISTS parallel boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.participant_links.parallel IS
  'A hold session''s catch-up link that lives alongside routine links: issuing it supersedes nothing and nothing supersedes it (issueLink, check_schedule 2b).';

ALTER TABLE public.participant_schedule
  ADD COLUMN IF NOT EXISTS hold_resends integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resend_note  text;
ALTER TABLE public.participant_schedule
  DROP CONSTRAINT IF EXISTS participant_schedule_resend_note_check;
ALTER TABLE public.participant_schedule
  ADD CONSTRAINT participant_schedule_resend_note_check
  CHECK (resend_note IS NULL OR resend_note IN ('baseline_catchup'));
COMMENT ON COLUMN public.participant_schedule.hold_resends IS
  'Times check_schedule has re-sent this hold session after its link lapsed uncompleted (one a day).';
COMMENT ON COLUMN public.participant_schedule.resend_note IS
  '''baseline_catchup'': a hold session caught up AFTER the sessions that follow it were already delivered. The recorded exception to gate_incomplete -- see schedule_row_block_reason.';

ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS baseline_cap integer CHECK (baseline_cap IS NULL OR baseline_cap > 0);
COMMENT ON COLUMN public.studies.baseline_cap IS
  'Enrollment cap: once this many (non-test) participants have completed the entry session, nobody else may start it (schedule_row_block_reason: enrollment_full).';

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- Gate sessions of a design graph: sessions marked hold, and sessions whose
-- outgoing edge goes straight into a randomize fork (the materializer's fork
-- gate, and complete_session_by_token's).
CREATE OR REPLACE FUNCTION public.study_gate_node_keys(p_graph jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT n.value->>'id'), '{}')
    FROM jsonb_array_elements(COALESCE(p_graph->'nodes', '[]'::jsonb)) n
   WHERE n.value->>'type' = 'session'
     AND (
       COALESCE((n.value->>'hold')::boolean, false)
       OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements(COALESCE(p_graph->'edges', '[]'::jsonb)) e
           JOIN jsonb_array_elements(p_graph->'nodes') t ON t.value->>'id' = e.value->>'to'
          WHERE e.value->>'from' = n.value->>'id'
            AND t.value->>'type' = 'randomize'
       )
     )
$$;

-- Non-test participants who have completed the study's entry session (its
-- lowest day_number).
CREATE OR REPLACE FUNCTION public.study_baselines_completed(p_study_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(DISTINCT ps.participant_id)::int
    FROM participant_schedule ps
    JOIN study_sessions ss ON ss.id = ps.study_session_id
    JOIN study_enrollments e ON e.study_id = ps.study_id AND e.profile_id = ps.participant_id
   WHERE ps.study_id = p_study_id
     AND ps.status = 'completed'
     AND NOT COALESCE(e.is_test, false)
     AND ss.day_number = (SELECT min(day_number) FROM study_sessions WHERE study_id = p_study_id)
$$;

-- ─── The decision ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.schedule_row_block_reason(p_schedule_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          record;
  st         record;
  en         record;
  sr         record;
  v_entry    integer;
  v_is_entry boolean;
  v_gates    text[];
BEGIN
  SELECT ps.id, ps.participant_id, ps.study_id, ss.day_number, ss.node_key
    INTO r
    FROM participant_schedule ps
    LEFT JOIN study_sessions ss ON ss.id = ps.study_session_id
   WHERE ps.id = p_schedule_id;
  IF NOT FOUND THEN RETURN 'no_such_session'; END IF;

  SELECT s.active, s.consent_required, s.active_consent_form_id, s.screener,
         s.screener_id, s.baseline_cap, s.design_graph
    INTO st
    FROM studies s WHERE s.id = r.study_id;

  IF st.active IS FALSE THEN RETURN 'study_inactive'; END IF;

  SELECT e.status, e.consent_date, e.screener_retake_granted_at
    INTO en
    FROM study_enrollments e
   WHERE e.study_id = r.study_id AND e.profile_id = r.participant_id;

  IF en.status = 'withdrawn' THEN RETURN 'withdrawn'; END IF;

  -- Screened out. Same rule as SessionEntry: the latest attempt must have
  -- passed both phases, unless staff granted a retake after it.
  IF st.screener IS NOT NULL OR st.screener_id IS NOT NULL THEN
    SELECT x.phase1_passed, x.phase2_passed, x.screened_at
      INTO sr
      FROM screener_results x
     WHERE x.participant_id = r.participant_id AND x.study_id = r.study_id
     ORDER BY x.screened_at DESC
     LIMIT 1;
    IF FOUND
       AND NOT (COALESCE(sr.phase1_passed, false) AND COALESCE(sr.phase2_passed, false))
       AND NOT (en.screener_retake_granted_at IS NOT NULL AND en.screener_retake_granted_at > sr.screened_at)
    THEN
      RETURN 'screened_out';
    END IF;
  END IF;

  -- A row with no compiled session (a hand-built legacy schedule) has no
  -- position in a design, so the positional gates below cannot apply to it.
  IF r.day_number IS NULL THEN RETURN NULL; END IF;

  SELECT min(day_number) INTO v_entry FROM study_sessions WHERE study_id = r.study_id;
  v_is_entry := r.day_number = v_entry;

  -- Consent. The entry session is where it is taken, so only that may be sent
  -- or opened without it. Mirrors SessionEntry's condition for showing the form.
  IF st.consent_required AND st.active_consent_form_id IS NOT NULL
     AND en.consent_date IS NULL AND NOT v_is_entry THEN
    RETURN 'no_consent';
  END IF;

  -- Enrollment cap: closes the entry session to anyone who has not completed it.
  IF st.baseline_cap IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM participant_schedule ps
         JOIN study_sessions ss ON ss.id = ps.study_session_id
        WHERE ps.participant_id = r.participant_id AND ps.study_id = r.study_id
          AND ps.status = 'completed' AND ss.day_number = v_entry)
     AND public.study_baselines_completed(r.study_id) >= st.baseline_cap THEN
    RETURN 'enrollment_full';
  END IF;

  -- An earlier gate session not completed. resend_note = 'baseline_catchup' is
  -- the recorded exception (see the header).
  v_gates := public.study_gate_node_keys(st.design_graph);
  IF array_length(v_gates, 1) > 0 AND EXISTS (
       SELECT 1 FROM participant_schedule g
         JOIN study_sessions gs ON gs.id = g.study_session_id
        WHERE g.participant_id = r.participant_id AND g.study_id = r.study_id
          AND g.id <> r.id
          AND gs.node_key = ANY (v_gates)
          AND gs.day_number < r.day_number
          AND g.status <> 'completed'
          AND g.resend_note IS DISTINCT FROM 'baseline_catchup')
  THEN
    RETURN 'gate_incomplete';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_row_block_reason(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_row_block_reason(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.study_baselines_completed(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.study_baselines_completed(uuid) TO service_role;

-- The participant-facing form: only for the link's own participant, so it
-- reveals nothing about anyone else's session.
CREATE OR REPLACE FUNCTION public.session_entry_block(p_token text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule uuid;
BEGIN
  SELECT pl.schedule_id INTO v_schedule
    FROM participant_links pl
   WHERE pl.token = p_token AND pl.participant_id = auth.uid()
   LIMIT 1;
  IF v_schedule IS NULL THEN RETURN 'no_such_session'; END IF;
  RETURN public.schedule_row_block_reason(v_schedule);
END;
$$;

REVOKE ALL ON FUNCTION public.session_entry_block(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_entry_block(text) TO authenticated;

-- ─── complete_session_by_token: a hold is a gate for the next-contact estimate
-- Copied from the live definition; the only change is the hold check after the
-- fork-gate loop. Completing a held baseline late used to estimate the next
-- contact from the design's nominal day, i.e. a date already past; the segment
-- after a hold starts the day after completion, exactly as after a fork gate.

CREATE OR REPLACE FUNCTION public.complete_session_by_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link         participant_links%ROWTYPE;
  v_now          timestamptz := now();
  v_next_date    date;
  v_next_time    time;
  v_next_contact jsonb   := NULL;
  v_graph        jsonb;
  v_node_key     text;
  v_has_more     boolean := NULL;
  v_block        jsonb;
  v_block_id     text;
  v_cb_id        text;
  -- design-based estimate fallback
  v_done_day     integer;
  v_done_time    time;
  v_done_date    date;
  v_est_day      integer;
  v_est_time     time;
  v_est_date     date;
  -- fork-gate detection
  v_hop          text;
  v_hop_type     text;
  v_gates_fork   boolean := false;
BEGIN
  SELECT * INTO v_link
    FROM participant_links
    WHERE token = p_token AND status IN ('active', 'used')
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('next_contact', NULL, 'has_more', NULL);
  END IF;

  UPDATE participant_links
    SET status = 'used'
    WHERE id = v_link.id;

  UPDATE participant_schedule
    SET status = 'completed', completed_at = v_now
    WHERE id = v_link.schedule_id AND status != 'completed';

  -- Earliest upcoming contact already materialized for this participant.
  -- The time filter is load-bearing: without it a missed same-day slot (still
  -- 'link_sent' until the next day) sorts first and is reported as "next".
  SELECT ps.scheduled_date, ps.send_time
    INTO v_next_date, v_next_time
    FROM participant_schedule ps
    WHERE ps.participant_id = v_link.participant_id
      AND ps.study_id       = v_link.study_id
      AND ps.id            != v_link.schedule_id
      AND ps.status IN ('pending', 'link_sent', 'unlocked')
      AND (ps.scheduled_date + COALESCE(ps.send_time, '00:00'::time))
            > (now() AT TIME ZONE 'America/Toronto')
    ORDER BY ps.scheduled_date, ps.send_time
    LIMIT 1;
  IF FOUND THEN
    v_next_contact := jsonb_build_object(
      'scheduled_date', v_next_date,
      'send_time',      v_next_time
    );
  END IF;

  -- Does the design graph continue past this session's node?
  SELECT s.design_graph INTO v_graph
    FROM studies s WHERE s.id = v_link.study_id;

  IF v_graph IS NOT NULL THEN
    SELECT ss.node_key INTO v_node_key
      FROM participant_schedule ps
      JOIN study_sessions ss ON ss.id = ps.study_session_id
      WHERE ps.id = v_link.schedule_id;

    IF v_node_key IS NOT NULL THEN
      -- 1. Direct outgoing edge from the session's own node.
      SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_graph->'edges') e
        WHERE e.value->>'from' = v_node_key
      ) INTO v_has_more;

      -- 2. Session owned by a block: more follows if it isn't the
      --    block's last child, or the block has an outgoing edge.
      IF NOT v_has_more THEN
        SELECT n.value INTO v_block
          FROM jsonb_array_elements(v_graph->'nodes') n
          WHERE n.value->>'type' = 'block'
            AND n.value->'children' ? v_node_key
          LIMIT 1;

        IF v_block IS NOT NULL THEN
          v_block_id := v_block->>'id';
          IF v_block->'children'->>(jsonb_array_length(v_block->'children') - 1)
             IS DISTINCT FROM v_node_key THEN
            v_has_more := true;
          ELSE
            SELECT EXISTS (
              SELECT 1 FROM jsonb_array_elements(v_graph->'edges') e
              WHERE e.value->>'from' = v_block_id
            ) INTO v_has_more;
          END IF;

          -- 3. Block owned by a counterbalance: more follows if the
          --    counterbalance itself has an outgoing edge.
          IF NOT v_has_more THEN
            SELECT n.value->>'id' INTO v_cb_id
              FROM jsonb_array_elements(v_graph->'nodes') n
              WHERE n.value->>'type' = 'counterbalance'
                AND n.value->'block_ids' ? v_block_id
              LIMIT 1;
            IF v_cb_id IS NOT NULL THEN
              SELECT EXISTS (
                SELECT 1 FROM jsonb_array_elements(v_graph->'edges') e
                WHERE e.value->>'from' = v_cb_id
              ) INTO v_has_more;
            END IF;
          END IF;
        END IF;
      END IF;

      -- 4. Is this session the assessment that gates a randomize fork? Follow
      --    outgoing edges from its node; only adherence_check nodes are
      --    transparent (they are zero-duration structural gates), anything
      --    else ends the search. Mirrors the materializer, which treats the
      --    session immediately before a fork as that fork's gate.
      v_hop := v_node_key;
      FOR i IN 1..8 LOOP
        SELECT e.value->>'to' INTO v_hop
          FROM jsonb_array_elements(v_graph->'edges') e
          WHERE e.value->>'from' = v_hop
          LIMIT 1;
        EXIT WHEN v_hop IS NULL;

        SELECT n.value->>'type' INTO v_hop_type
          FROM jsonb_array_elements(v_graph->'nodes') n
          WHERE n.value->>'id' = v_hop
          LIMIT 1;

        IF v_hop_type = 'randomize' THEN
          v_gates_fork := true;
          EXIT;
        END IF;
        EXIT WHEN v_hop_type IS DISTINCT FROM 'adherence_check';
      END LOOP;

      -- 5. A hold session (20261007_hard_gates.sql) gates what follows it the
      --    same way: the next segment starts the day after it is completed.
      IF NOT v_gates_fork AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_graph->'nodes') n
        WHERE n.value->>'id' = v_node_key
          AND COALESCE((n.value->>'hold')::boolean, false)
      ) THEN
        v_gates_fork := true;
      END IF;
    END IF;
  END IF;

  -- Fallback: graph continues but nothing materialized yet (fork gate).
  -- Estimate the next interaction's date/time from the study design so the
  -- completion screen can still name it. All parallel arms share the same
  -- day_number/send_time cadence, so min-by-(day,time) after the just-completed
  -- session is the same date/time regardless of which arm gets drawn.
  --
  -- Not when a later session is waiting for its calendar date (status
  -- 'awaiting_date', 20260911): the design's day_number would name a date
  -- nobody has chosen yet. The completion screen falls back to its soft copy.
  IF v_next_contact IS NULL AND v_has_more IS TRUE
     AND NOT EXISTS (
       SELECT 1 FROM participant_schedule ps
        WHERE ps.participant_id = v_link.participant_id
          AND ps.study_id       = v_link.study_id
          AND ps.status         = 'awaiting_date'
     ) THEN
    SELECT ss.day_number, ss.send_time, ps.scheduled_date
      INTO v_done_day, v_done_time, v_done_date
      FROM participant_schedule ps
      JOIN study_sessions ss ON ss.id = ps.study_session_id
      WHERE ps.id = v_link.schedule_id;

    IF v_done_day IS NOT NULL AND v_done_date IS NOT NULL THEN
      SELECT ss.day_number, ss.send_time
        INTO v_est_day, v_est_time
        FROM study_sessions ss
        WHERE ss.study_id = v_link.study_id
          AND ss.day_number IS NOT NULL
          AND ROW(ss.day_number, ss.send_time) > ROW(v_done_day, v_done_time)
        ORDER BY ss.day_number, ss.send_time
        LIMIT 1;

      IF v_est_day IS NOT NULL THEN
        v_est_date := v_done_date - (v_done_day - 1) + (v_est_day - 1);

        -- Gate-relative: a segment behind a fork's gating assessment starts the
        -- day after that assessment was completed, in both directions. The gate
        -- was just completed, so the next contact is tomorrow — full stop. Not
        -- LEAST(): that only pulled the estimate in, and left a late completion
        -- reporting a date in the past (see this file's header).
        IF v_gates_fork THEN
          v_est_date := (v_now AT TIME ZONE 'America/Toronto')::date + 1;
        END IF;

        v_next_contact := jsonb_build_object(
          'scheduled_date', v_est_date,
          'send_time',      v_est_time,
          'estimated',      true
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'next_contact', v_next_contact,
    'has_more',     v_has_more
  );
END;
$function$;

-- ─── Liliana Study 3: baseline holds both arms; the paid arm is capped ───────
-- (Norm, 2026-10-07: phase 1 waits for baseline; 257 completed baselines, paid
-- arm only.) The builder round-trips node properties, and shows the hold.

UPDATE public.studies s
   SET design_graph = jsonb_set(
         s.design_graph, '{nodes}',
         (SELECT jsonb_agg(CASE WHEN n->>'id' = 's_baseline'
                                THEN n || '{"hold": true}'::jsonb ELSE n END
                           ORDER BY i)
            FROM jsonb_array_elements(s.design_graph->'nodes') WITH ORDINALITY AS t(n, i)))
 WHERE s.id IN ('958150a9-7821-4daf-8d83-e9325369d91d',   -- Liliana Study 3 (credit)
                'ee542d3b-c0da-4a5f-ac34-6b981f153298');  -- Liliana Study 3 — Paid

UPDATE public.studies SET baseline_cap = 257
 WHERE id = 'ee542d3b-c0da-4a5f-ac34-6b981f153298';
