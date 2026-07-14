-- Liliana Study 3 SONA credit calculator — manual-award report, not an
-- auto-grant integration. Per the consent form's compensation section:
-- baseline ~30min, midpoint ~20min, final ~25min, each completed daily
-- session ~4min (up to 24 across both phases), credit "rounded up to the
-- nearest half hour", capped at 3 hours total. SONA's own auto-grant URL
-- mechanism is all-or-nothing per study, so a study with prorated credit
-- (this one, per the "10 of 12 days" rule) needs an RA to read the earned
-- amount here and enter it into SONA's researcher interface by hand — this
-- function computes that amount, it does not submit anything to SONA.
--
-- Interpretation note: credit accrues per completed daily session (4 min
-- each) rather than as a flat "full phase" bonus unlocked at >=10/12 — the
-- two readings only diverge by ~8 minutes at exactly 10-11 completed days,
-- which the half-hour rounding step usually absorbs anyway. Revisit if a
-- literal "full phase credit at >=10, else prorated" split is wanted instead.
--
-- Baseline/Final Assessment completion resolved by matching this study's
-- own study_sessions -> session_templates.label (ILIKE 'Baseline' /
-- 'Final Assessment') rather than hardcoded template ids, so this keeps
-- working if the study is rebuilt/relaunched under a new study_id.

CREATE OR REPLACE FUNCTION public.get_liliana_credit_report(p_study_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_allowed         boolean;
  v_baseline_ss_id  uuid;
  v_final_ss_id     uuid;
  v_result          jsonb;
BEGIN
  SELECT my_role() = 'lab' OR is_super_admin() INTO v_allowed;
  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT ss.id INTO v_baseline_ss_id
    FROM study_sessions ss JOIN session_templates st ON st.id = ss.session_template_id
    WHERE ss.study_id = p_study_id AND st.label ILIKE '%Baseline%'
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
      (lp.midpoint_completed_at IS NOT NULL) AS midpoint_completed,
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
        + (CASE WHEN lp.midpoint_completed_at IS NOT NULL THEN 20 ELSE 0 END)
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
