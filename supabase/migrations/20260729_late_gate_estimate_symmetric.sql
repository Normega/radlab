-- complete_session_by_token: the fork-gate "next contact" estimate must follow
-- the gate shift in BOTH directions.
--
-- Bug: yesterday's `20260729_early_gate_advance_next_contact.sql` capped the
-- design estimate with LEAST(est, tomorrow), which can only pull it in. The
-- materializer's shift became symmetric hours later (`materializeSchedule`'s
-- `dayShift` — a segment behind a gate starts the day after the gate was
-- actually completed, early OR late), so the estimate is now half-fixed: a gate
-- completed AFTER its arm's nominal start reports a date in the PAST.
--
-- Live and reachable on Zerin: baseline is day 1 09:00 with a 72 h link, and the
-- arm timepoints start day 2 (09:00/14:00/20:00). The link therefore outlives
-- the arm's nominal start by two days — "I'll do the intake this weekend" is all
-- it takes. Completing the baseline on day 3:
--
--   est = scheduled_date(day 1) + (2 - 1)  = day 2   <- yesterday
--   LEAST(day 2, tomorrow = day 4)         = day 2   <- reported
--   materializer: max(completed day 3 + 1, today) = day 4 09:00   <- truth
--
-- So the completion screen names an already-past date minutes before the cron
-- pass schedules the participant for tomorrow morning. (Liliana can't hit this:
-- her midpoint's 72 h window closes at the end of day 16, before Phase 2's
-- nominal day 17, so that gate is early or missed, never late.)
--
-- Fix: for a fork gate the estimate simply IS tomorrow. This RPC runs at the
-- moment of completion, and the materializer's rule is
-- `start = max(gate_completion_day + 1, today)`, which for a gate completed
-- right now always resolves to tomorrow — there is no other answer to give.
-- Assignment rather than a second clamp, and strictly a bug fix: every case
-- LEAST already got right returns the identical date (Liliana finishing day 14
-- -> LEAST(17, 15) = 15 = tomorrow; day 16 -> LEAST(17, 17) = 17 = tomorrow).
-- Only the late cases change.
--
-- `v_est_time` is untouched — it stays the design send_time of the next node,
-- which is what the materializer preserves. Zerin therefore reads "tomorrow at
-- 9:00 AM".
--
-- Unchanged by design: non-fork gates (Liliana's `ac_p2` adherence_check) still
-- project from their own already-shifted scheduled_date and land correctly, and
-- the materialized-row branch above still wins whenever a real row exists.
--
-- Not addressed here, both pre-existing: a fork's first arm timepoint can never
-- land same-day (the materializer floors at gate+1 — nothing live wants that),
-- and a fork that blocks on an adherence_check materializes nothing, so any
-- date is wrong in that case.
--
-- Signature/return type unchanged -> CREATE OR REPLACE is sufficient. Otherwise
-- byte-identical to the 20260729_early_gate_advance_next_contact.sql definition
-- (this file was generated from it, with only the estimate line changed).

CREATE OR REPLACE FUNCTION complete_session_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    END IF;
  END IF;

  -- Fallback: graph continues but nothing materialized yet (fork gate).
  -- Estimate the next interaction's date/time from the study design so the
  -- completion screen can still name it. All parallel arms share the same
  -- day_number/send_time cadence, so min-by-(day,time) after the just-completed
  -- session is the same date/time regardless of which arm gets drawn.
  IF v_next_contact IS NULL AND v_has_more IS TRUE THEN
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
$$;

GRANT EXECUTE ON FUNCTION complete_session_by_token(text) TO anon, authenticated;
