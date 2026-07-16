-- ============================================================
-- Completion screen: tell the participant when their next
-- contact will happen instead of a bare "thank you".
--
-- complete_session_by_token previously RETURNS void. It now
-- returns jsonb:
--   {
--     "next_contact": { "scheduled_date": "YYYY-MM-DD",
--                       "send_time": "HH:MM:SS" } | null,
--     "has_more": true | false | null
--   }
--
-- next_contact: the participant's earliest still-upcoming
--   participant_schedule row (pending/link_sent/unlocked) for
--   this study — present for every linear stretch of a
--   longitudinal study, since the materializer bulk-inserts
--   all rows up to the first unreached fork.
-- has_more: whether the design graph continues past the
--   just-completed session's node. Distinguishes "you're at a
--   fork gate, the next segment materializes on the next cron
--   tick" (true, next_contact null) from "that was the final
--   session" (false). null when the study has no design_graph
--   (legacy single-shot / in-person) or the node can't be
--   resolved — the client falls back to the old generic text.
--
-- Return-type change requires DROP + CREATE (CREATE OR REPLACE
-- cannot change a function's return type). The old client
-- ignored the void result, so returning jsonb is backward
-- compatible with any not-yet-refreshed browser tab.
-- ============================================================

DROP FUNCTION IF EXISTS complete_session_by_token(text);

CREATE FUNCTION complete_session_by_token(p_token text)
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
          --    counterbalance itself has an outgoing edge. (Other
          --    still-incomplete member blocks would have shown up as
          --    a next_contact row already — counterbalances
          --    materialize all member sessions eagerly.)
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

  RETURN jsonb_build_object(
    'next_contact', v_next_contact,
    'has_more',     v_has_more
  );
END;
$$;

GRANT EXECUTE ON FUNCTION complete_session_by_token(text) TO anon, authenticated;
