-- complete_session_by_token tells the participant when their next session is. When
-- the session just completed gates what follows it (a randomize fork, or a hold such
-- as a baseline), the next rows do not exist yet, so it estimates: "tomorrow". On a
-- fixed calendar that is false. Found in the PSY240 class trial's smoke test
-- (2026-10-09): a student finishing the baseline on Oct 9 was told "Your next session
-- is tomorrow (Saturday, October 10)" when day 1 is Saturday, October 17 for everyone.
--
-- Now, when the graph has fixed-date timepoints, the estimate is the first fixed
-- date, or today for a late joiner who arrives after it (their calendar picks up
-- today). Graphs without fixed dates (Liliana Study 3) keep "tomorrow".
--
-- Copied from the live definition (pg_get_functiondef md5 b1f45b6f6e9c04580f798cbc9f11e13a),
-- with only the v_fixed_first
-- declaration and the block marked "A fixed calendar" added. Verified in a
-- rolled-back transaction with the smoke-test participant: the old definition
-- estimated 2026-10-10, the new one 2026-10-17 07:00 (estimated).

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
  v_done_day     integer;
  v_done_time    time;
  v_done_date    date;
  v_est_day      integer;
  v_est_time     time;
  v_est_date     date;
  v_hop          text;
  v_hop_type     text;
  v_gates_fork   boolean := false;
  v_fixed_first  date;
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

  SELECT s.design_graph INTO v_graph
    FROM studies s WHERE s.id = v_link.study_id;

  IF v_graph IS NOT NULL THEN
    SELECT ss.node_key INTO v_node_key
      FROM participant_schedule ps
      JOIN study_sessions ss ON ss.id = ps.study_session_id
      WHERE ps.id = v_link.schedule_id;

    IF v_node_key IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_graph->'edges') e
        WHERE e.value->>'from' = v_node_key
      ) INTO v_has_more;

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
        IF v_gates_fork THEN
          v_est_date := (v_now AT TIME ZONE 'America/Toronto')::date + 1;
          -- A fixed calendar (20261009_completion_estimate_fixed_calendar.sql):
          -- what follows the gate starts on its date for everyone, so the next
          -- session is the first fixed date, or today for a late joiner who
          -- arrives after it. Graphs with no fixed date keep "tomorrow".
          SELECT min((n.value->>'fixed_date')::date) INTO v_fixed_first
            FROM jsonb_array_elements(v_graph->'nodes') n
           WHERE n.value->>'type' = 'timepoint' AND n.value->>'timing' = 'fixed'
             AND n.value->>'fixed_date' IS NOT NULL;
          IF v_fixed_first IS NOT NULL THEN
            v_est_date := greatest(v_fixed_first, (v_now AT TIME ZONE 'America/Toronto')::date);
          END IF;
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
$function$
;
