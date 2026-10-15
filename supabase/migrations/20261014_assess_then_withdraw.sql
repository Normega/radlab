-- Liliana Study 3: low-adherence participants sit the midpoint before they stop
-- (Norm, 2026-10-14).
--
-- Until now the Phase 1 adherence check (ac_p1, >= 10 of 12 daily sessions)
-- withdrew a participant the moment Phase 1 closed, so the midpoint was never
-- scheduled for them and change in low-adherence participants could not be
-- analysed. 7 had been withdrawn this way by 2026-10-14 (4 between 10-01 and
-- 10-06 with 3-9 sessions, 3 that morning with 0).
--
-- The check gains a third below-minimum action, 'assess_then_withdraw'
-- (materializeSchedule.ts): the walk carries on to the midpoint, and the
-- participant is withdrawn at the Phase 2 fork instead of being drawn. The
-- graph keeps its shape, so s_mid still leads straight into rnd_p2 and is
-- still a gate session for schedule_row_block_reason -- no hard gate moves.
--
-- What this file adds, all of it reading one rule:
--   adherence_assess_only()  -- the single SQL statement of "below an
--                               assess_then_withdraw check", counted exactly
--                               as countCompletedPhaseDays counts
--   my_midpoint_adherence()  -- the participant-facing form, for MidpointStep:
--                               below the minimum, the midpoint ends with an
--                               explanation and the debrief instead of
--                               feedback, ranking and a choice (and nothing
--                               is drawn for midpoint_group)
--   complete_session_by_token -- for those participants the midpoint is the
--                               last session, so the completion screen says
--                               so rather than "your next session is tomorrow"
--   get_liliana_credit_report -- counted the midpoint only through
--                               midpoint_completed_at, which only
--                               record_practice_decision sets; a participant
--                               who completes the midpoint without making a
--                               Phase 2 choice must still be credited for it
--
-- The graph change itself (ac_p1.on_fail) is a separate file,
-- 20261014_liliana3_ac_p1_assess_then_withdraw.sql, applied only after the
-- Edge Functions and the midpoint screen that understand it are live.

-- ─── 1. The rule ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.adherence_assess_only(p_participant uuid, p_study uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- NULL unless the participant is below an adherence_check authored
  -- on_fail = 'assess_then_withdraw'. The count is countCompletedPhaseDays'
  -- (and liliana_phase_adherence's): completed liliana_day_data rows whose
  -- module belongs to the check's phase.
  WITH chk AS (
    SELECT n.value->>'id'                                   AS node_id,
           COALESCE(n.value->>'phase', 'phase1')            AS phase,
           COALESCE((n.value->>'min_required')::int, 10)    AS min_required,
           COALESCE((n.value->>'of_total')::int, 12)        AS of_total
      FROM studies s,
           jsonb_array_elements(COALESCE(s.design_graph->'nodes', '[]'::jsonb)) n
     WHERE s.id = p_study
       AND n.value->>'type' = 'adherence_check'
       AND n.value->>'on_fail' = 'assess_then_withdraw'
  ), counted AS (
    SELECT c.*,
           (SELECT count(*)
              FROM liliana_participants lp
              JOIN liliana_day_data d      ON d.participant_id = lp.id AND d.completed_at IS NOT NULL
              JOIN intervention_modules im ON im.module_id = d.module_id AND im.phase = c.phase
             WHERE lp.profile_id = p_participant AND lp.study_id = p_study)::int AS completed
      FROM chk c
  )
  SELECT jsonb_build_object('node_id', node_id, 'phase', phase, 'completed', completed,
                            'min_required', min_required, 'of_total', of_total)
    FROM counted
   WHERE completed < min_required
   ORDER BY node_id
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.adherence_assess_only(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adherence_assess_only(uuid, uuid) TO service_role;

-- ─── 2. The participant-facing form (MidpointStep) ──────────────────────────

CREATE OR REPLACE FUNCTION public.my_midpoint_adherence(p_study_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_r    jsonb;
  v_comp text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'my_midpoint_adherence: not authenticated';
  END IF;
  -- Only someone enrolled in the study gets an answer about it.
  IF NOT EXISTS (SELECT 1 FROM study_enrollments
                  WHERE study_id = p_study_id AND profile_id = v_uid) THEN
    RAISE EXCEPTION 'my_midpoint_adherence: not enrolled';
  END IF;

  v_r := public.adherence_assess_only(v_uid, p_study_id);
  SELECT compensation_kind INTO v_comp FROM studies WHERE id = p_study_id;

  RETURN jsonb_build_object(
    'assess_only',  v_r IS NOT NULL,
    'completed',    v_r->'completed',
    'min_required', v_r->'min_required',
    'of_total',     v_r->'of_total',
    'compensation', CASE WHEN v_comp = 'pay' THEN 'pay' ELSE 'credit' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_midpoint_adherence(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_midpoint_adherence(uuid) TO authenticated, service_role;

-- ─── 3. Completion screen: the midpoint is their last session ───────────────
-- Identical to the live definition except step 6.

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

      -- 6. Below an 'assess_then_withdraw' check (20261014_assess_then_withdraw):
      --    the session gating the fork is this participant's last -- the
      --    materializer withdraws them at that fork instead of drawing an arm.
      --    Say the study is finished, not "your next session is tomorrow".
      IF v_gates_fork
         AND public.adherence_assess_only(v_link.participant_id, v_link.study_id) IS NOT NULL THEN
        v_has_more     := false;
        v_next_contact := NULL;
        v_gates_fork   := false;
      END IF;

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
$function$;

-- ─── 4. Credit report: a completed midpoint counts without a Phase 2 choice ─
-- Identical to the live definition except midpoint_completed and its 20
-- minutes, which now also accept a completed midpoint schedule row.

CREATE OR REPLACE FUNCTION public.get_liliana_credit_report(p_study_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed         boolean;
  v_baseline_ss_id  uuid;
  v_midpoint_ss_id  uuid;
  v_final_ss_id     uuid;
  v_result          jsonb;
BEGIN
  SELECT COALESCE(my_role() = 'lab', false) OR is_super_admin() INTO v_allowed;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT ss.id INTO v_baseline_ss_id
    FROM study_sessions ss JOIN session_templates st ON st.id = ss.session_template_id
    WHERE ss.study_id = p_study_id AND st.label ILIKE '%Baseline%'
    LIMIT 1;

  SELECT ss.id INTO v_midpoint_ss_id
    FROM study_sessions ss JOIN session_templates st ON st.id = ss.session_template_id
    WHERE ss.study_id = p_study_id AND st.label ILIKE '%Midpoint%'
    LIMIT 1;

  SELECT ss.id INTO v_final_ss_id
    FROM study_sessions ss JOIN session_templates st ON st.id = ss.session_template_id
    WHERE ss.study_id = p_study_id AND st.label ILIKE '%Final Assessment%'
    LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'participant_id',     t.participant_id,
    'profile_id',         t.profile_id,
    'display_name',       t.display_name,
    'sona_identifier',    t.sona_identifier,
    'external_source',    t.external_source,
    'baseline_completed', t.baseline_completed,
    'midpoint_completed', t.midpoint_completed,
    'final_completed',    t.final_completed,
    'phase1_days',        t.phase1_days,
    'phase2_days',        t.phase2_days,
    'total_minutes',      t.total_minutes,
    'credit_hours',       LEAST(CEIL(t.total_minutes::numeric / 30) * 0.5, 3.0)
  ) ORDER BY t.display_name), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      lp.id                                          AS participant_id,
      lp.profile_id,
      p.display_name,
      COALESCE(se.external_id, p.display_name, lp.profile_id::text) AS sona_identifier,
      se.external_source,
      EXISTS (
        SELECT 1 FROM participant_schedule ps
        WHERE ps.participant_id = lp.profile_id AND ps.study_session_id = v_baseline_ss_id
          AND ps.completed_at IS NOT NULL
      ) AS baseline_completed,
      (lp.midpoint_completed_at IS NOT NULL OR EXISTS (
        SELECT 1 FROM participant_schedule ps
        WHERE ps.participant_id = lp.profile_id AND ps.study_session_id = v_midpoint_ss_id
          AND ps.completed_at IS NOT NULL
      )) AS midpoint_completed,
      EXISTS (
        SELECT 1 FROM participant_schedule ps
        WHERE ps.participant_id = lp.profile_id AND ps.study_session_id = v_final_ss_id
          AND ps.completed_at IS NOT NULL
      ) AS final_completed,
      COALESCE(p1.n, 0) AS phase1_days,
      COALESCE(p2.n, 0) AS phase2_days,
      (
        (CASE WHEN EXISTS (
          SELECT 1 FROM participant_schedule ps
          WHERE ps.participant_id = lp.profile_id AND ps.study_session_id = v_baseline_ss_id
            AND ps.completed_at IS NOT NULL
        ) THEN 30 ELSE 0 END)
        + (CASE WHEN lp.midpoint_completed_at IS NOT NULL OR EXISTS (
          SELECT 1 FROM participant_schedule ps
          WHERE ps.participant_id = lp.profile_id AND ps.study_session_id = v_midpoint_ss_id
            AND ps.completed_at IS NOT NULL
        ) THEN 20 ELSE 0 END)
        + (CASE WHEN EXISTS (
          SELECT 1 FROM participant_schedule ps
          WHERE ps.participant_id = lp.profile_id AND ps.study_session_id = v_final_ss_id
            AND ps.completed_at IS NOT NULL
        ) THEN 25 ELSE 0 END)
        + 4 * (COALESCE(p1.n, 0) + COALESCE(p2.n, 0))
      ) AS total_minutes
    FROM liliana_participants lp
    JOIN profiles p ON p.id = lp.profile_id
    LEFT JOIN study_enrollments se ON se.profile_id = lp.profile_id AND se.study_id = lp.study_id
    LEFT JOIN (
      SELECT ldd.participant_id, count(*) AS n
      FROM liliana_day_data ldd
      JOIN intervention_modules im ON im.module_id = ldd.module_id
      WHERE ldd.completed_at IS NOT NULL AND im.phase = 'phase1'
      GROUP BY ldd.participant_id
    ) p1 ON p1.participant_id = lp.id
    LEFT JOIN (
      SELECT ldd.participant_id, count(*) AS n
      FROM liliana_day_data ldd
      JOIN intervention_modules im ON im.module_id = ldd.module_id
      WHERE ldd.completed_at IS NOT NULL AND im.phase = 'phase2'
      GROUP BY ldd.participant_id
    ) p2 ON p2.participant_id = lp.id
    WHERE lp.study_id = p_study_id
  ) t;

  RETURN jsonb_build_object('participants', v_result);
END;
$function$;
