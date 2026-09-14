-- Calendar-date timepoints, whose date can be left to be determined.
--
-- WHY. Dana's course studies (CHM135, PHL245) survey a whole class around
-- events on the course calendar — a test, a grade release — not N days after
-- each student happened to enrol. And those dates move: a grade release is
-- postponed. Norm (2026-09-11): a timepoint can be "to be determined", a
-- placeholder that must never fire until a person fills in the date; the date
-- can change as long as it is still in the future; one date per study.
--
-- The graph carries it (materializeSchedule.ts, experimentGraph.js):
--   timepoint.timing = 'fixed', timepoint.fixed_date = 'YYYY-MM-DD' | null.
-- Enrolment then creates that timepoint's rows as
--   'awaiting_date'  no date; nothing sends, reminds or sweeps them, and they
--                    hold study completion open;
--   'pending'        the date is set and has not passed — sent as usual;
--   'skipped'        the date had already passed when this participant
--                    enrolled. They get what has not happened yet, never a
--                    missed date (Norm, 2026-09-11).
-- participant_schedule.status has no CHECK constraint, so no DDL is needed;
-- every consumer of the column was audited for the two new values.
--
-- This migration adds the one door that changes a date after enrolment, and
-- stops the completion screen from inventing a date for an undated session.

-- ── 1. set_timepoint_date ────────────────────────────────────────────────────
-- Sets, changes or clears (p_date NULL = back to "to be determined") the date
-- of one calendar-date timepoint, in the graph (for everyone who enrols later)
-- and on every participant row it has not yet sent. p_dry_run = true (the
-- default) changes nothing and reports what would move, which is what the
-- study page shows in its confirmation before anything is released.
--
-- Refuses when:
--   * the caller is not lab staff;
--   * the timepoint's current date and time have already arrived — a date
--     that has happened is history, not a plan;
--   * any of its rows has already been sent, opened or completed;
--   * the new date and time are not in the future (lab time zone).
--
-- The session walk mirrors sessionsUnderTimepoint() in experimentGraph.js and
-- the materializer: sessions chained directly share the timepoint's date, a
-- block's children run on consecutive days, and the walk ends at the next
-- timepoint. Graphs with forks cannot hold calendar-date timepoints
-- (validate()), so a linear walk is complete.
CREATE OR REPLACE FUNCTION public.set_timepoint_date(
  p_study_id uuid,
  p_node_id  text,
  p_date     date,
  p_time     time    DEFAULT NULL,
  p_dry_run  boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now_local  timestamp := now() AT TIME ZONE 'America/Toronto';
  v_graph      jsonb;
  v_node       jsonb;
  v_idx        integer;
  v_cur_date   date;
  v_cur_time   time;
  v_keys       text[]    := '{}';
  v_offsets    integer[] := '{}';
  v_offset     integer   := 0;
  v_hop        text;
  v_hop_node   jsonb;
  v_child      text;
  v_i          integer;
  v_movable    integer;
  v_people     integer;
  v_sent       integer;
  v_skipped    integer;
BEGIN
  IF my_role() IS DISTINCT FROM 'lab' THEN
    RAISE EXCEPTION 'forbidden: lab staff only';
  END IF;

  -- Serialise date changes on one study.
  SELECT design_graph INTO v_graph FROM studies WHERE id = p_study_id FOR UPDATE;
  IF v_graph IS NULL THEN
    RAISE EXCEPTION 'study has no design graph';
  END IF;

  SELECT n.value, (n.ordinality - 1)::integer INTO v_node, v_idx
    FROM jsonb_array_elements(v_graph->'nodes') WITH ORDINALITY n
   WHERE n.value->>'id' = p_node_id;
  IF v_node IS NULL OR v_node->>'type' <> 'timepoint' OR COALESCE(v_node->>'timing', 'relative') <> 'fixed' THEN
    RAISE EXCEPTION 'not a calendar-date timepoint';
  END IF;

  IF p_date IS NOT NULL AND p_time IS NULL THEN
    RAISE EXCEPTION 'a date needs a send time';
  END IF;
  IF p_date IS NOT NULL AND (p_date + p_time) <= v_now_local THEN
    RAISE EXCEPTION 'the new date and time must be in the future';
  END IF;

  v_cur_date := NULLIF(v_node->>'fixed_date', '')::date;
  v_cur_time := COALESCE(NULLIF(v_node->>'time_of_day', '')::time, '00:00'::time);
  IF v_cur_date IS NOT NULL AND (v_cur_date + v_cur_time) <= v_now_local THEN
    RAISE EXCEPTION 'this timepoint''s date has already arrived and can no longer be changed';
  END IF;

  -- Sessions under the timepoint, with their offset from its date.
  SELECT e.value->>'to' INTO v_hop
    FROM jsonb_array_elements(v_graph->'edges') e WHERE e.value->>'from' = p_node_id LIMIT 1;
  FOR v_i IN 1..500 LOOP
    EXIT WHEN v_hop IS NULL;
    SELECT n.value INTO v_hop_node
      FROM jsonb_array_elements(v_graph->'nodes') n WHERE n.value->>'id' = v_hop LIMIT 1;
    EXIT WHEN v_hop_node IS NULL OR v_hop_node->>'type' = 'timepoint';
    IF v_hop_node->>'type' = 'session' THEN
      v_keys    := v_keys || v_hop;
      v_offsets := v_offsets || v_offset;
    ELSIF v_hop_node->>'type' = 'block' THEN
      FOR v_child IN SELECT jsonb_array_elements_text(v_hop_node->'children') LOOP
        v_keys    := v_keys || v_child;
        v_offsets := v_offsets || v_offset;
        v_offset  := v_offset + 1;
      END LOOP;
    ELSE
      RAISE EXCEPTION 'calendar-date timepoints only support sessions and blocks after them';
    END IF;
    SELECT e.value->>'to' INTO v_hop
      FROM jsonb_array_elements(v_graph->'edges') e WHERE e.value->>'from' = v_hop LIMIT 1;
  END LOOP;

  -- What the change would touch. Movable = never sent, never opened.
  SELECT count(*) FILTER (WHERE ps.status IN ('awaiting_date', 'pending')
                            AND ps.link_id IS NULL AND ps.attempts = 0 AND ps.completed_at IS NULL),
         count(DISTINCT ps.participant_id) FILTER (WHERE ps.status IN ('awaiting_date', 'pending')
                            AND ps.link_id IS NULL AND ps.attempts = 0 AND ps.completed_at IS NULL),
         count(*) FILTER (WHERE ps.status = 'skipped'),
         count(*) FILTER (WHERE ps.status <> 'skipped' AND NOT (ps.status IN ('awaiting_date', 'pending')
                            AND ps.link_id IS NULL AND ps.attempts = 0 AND ps.completed_at IS NULL))
    INTO v_movable, v_people, v_skipped, v_sent
    FROM participant_schedule ps
    JOIN study_sessions ss ON ss.id = ps.study_session_id
   WHERE ps.study_id = p_study_id
     AND ss.node_key = ANY (v_keys);

  IF v_sent > 0 THEN
    RAISE EXCEPTION 'this timepoint has already been sent to % participant row(s) and can no longer be changed', v_sent;
  END IF;

  IF NOT p_dry_run THEN
    UPDATE participant_schedule ps
       SET scheduled_date = CASE WHEN p_date IS NULL THEN NULL ELSE p_date + k.off END,
           send_time      = COALESCE(p_time, ps.send_time),
           status         = CASE WHEN p_date IS NULL THEN 'awaiting_date' ELSE 'pending' END
      FROM study_sessions ss,
           unnest(v_keys, v_offsets) AS k(node_key, off)
     WHERE ss.id = ps.study_session_id
       AND ss.node_key = k.node_key
       AND ps.study_id = p_study_id
       AND ps.status IN ('awaiting_date', 'pending')
       AND ps.link_id IS NULL AND ps.attempts = 0 AND ps.completed_at IS NULL;

    v_graph := jsonb_set(v_graph, ARRAY['nodes', v_idx::text, 'fixed_date'],
                         CASE WHEN p_date IS NULL THEN 'null'::jsonb ELSE to_jsonb(to_char(p_date, 'YYYY-MM-DD')) END);
    IF p_time IS NOT NULL THEN
      v_graph := jsonb_set(v_graph, ARRAY['nodes', v_idx::text, 'time_of_day'], to_jsonb(to_char(p_time, 'HH24:MI')));
      UPDATE study_sessions SET send_time = p_time
       WHERE study_id = p_study_id AND node_key = ANY (v_keys);
    END IF;
    UPDATE studies SET design_graph = v_graph WHERE id = p_study_id;
  END IF;

  RETURN jsonb_build_object(
    'dry_run',      p_dry_run,
    'date',         p_date,
    'time',         to_char(p_time, 'HH24:MI'),
    'sessions',     cardinality(v_keys),
    'rows',         v_movable,
    'participants', v_people,
    'skipped',      v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_timepoint_date(uuid, text, date, time, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_timepoint_date(uuid, text, date, time, boolean) TO authenticated;

-- ── 2. complete_session_by_token: no invented date for an undated session ────
-- Byte-identical to 20260729_late_gate_estimate_symmetric.sql (verified against
-- the live prosrc by md5 before this was written) except the design-estimate
-- guard, marked below.

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
$$;

GRANT EXECUTE ON FUNCTION complete_session_by_token(text) TO anon, authenticated;
