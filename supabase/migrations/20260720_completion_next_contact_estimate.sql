-- ============================================================
-- Completion screen: derive the next interaction from the study
-- DESIGN when no schedule row is materialized yet.
--
-- complete_session_by_token already returns { next_contact, has_more }.
-- next_contact was sourced ONLY from materialized participant_schedule
-- rows, so at a fork gate (e.g. Zerin's post-baseline randomization,
-- whose daily rows materialize ~15 min later on the next cron tick) it
-- came back null while has_more was true -> the client showed the vague
-- "you'll receive an email when your next session is ready".
--
-- Fix: when there is no materialized upcoming row but the graph continues,
-- compute the next interaction's date/time from study_sessions.day_number +
-- send_time, anchored to the participant's own start date (the completed
-- session's scheduled_date minus its day_number offset). Every parallel arm
-- of a longitudinal study shares the same day/time cadence, so the date is
-- unambiguous even before the arm is drawn. The result carries
-- "estimated": true so the copy says "watch for" the link rather than
-- promising an already-issued one.
--
-- Signature/return type unchanged -> CREATE OR REPLACE is sufficient.
-- ============================================================

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
  SELECT ps.scheduled_date, ps.send_time
    INTO v_next_date, v_next_time
    FROM participant_schedule ps
    WHERE ps.participant_id = v_link.participant_id
      AND ps.study_id       = v_link.study_id
      AND ps.id            != v_link.schedule_id
      AND ps.status IN ('pending', 'link_sent', 'unlocked')
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
        v_next_contact := jsonb_build_object(
          'scheduled_date', v_done_date - (v_done_day - 1) + (v_est_day - 1),
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
