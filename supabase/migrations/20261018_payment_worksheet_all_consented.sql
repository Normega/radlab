-- Payment worksheet: every consented participant, and the bank reference of
-- each transfer (Norm, 2026-10-18).
--
-- 1. get_liliana_credit_report was built FROM liliana_participants, and that
--    row is only created when a participant starts the daily sessions. Anyone
--    who sat the baseline (30 min) and stopped there was missing from both the
--    SONA credit report and the paid route's payment worksheet. On 2026-10-15
--    the first five paid-route payouts all had to be computed by hand for this
--    reason; on 2026-10-18 the paid route had 3 withdrawn and 6 enrolled
--    participants with a completed session and no liliana_participants row.
--    The report now starts from the union of liliana_participants and
--    consented enrollments. Earned time is unchanged: daily sessions are still
--    counted through liliana_participants, so a participant without that row
--    is credited for the assessments they completed and nothing else.
--    It also returns enrollment_id, which the worksheet now matches on.
--
-- 2. participant_compensation.payment_reference: the e-transfer's bank
--    reference number, entered by the lab when it marks a payment sent. A
--    participant's own insert must leave it empty, like paid_at and amount_cad.

-- ─── 1. Credit report: all consented participants ──────────────────────────

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
    'enrollment_id',      t.enrollment_id,
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
      se.id                                          AS enrollment_id,
      base.profile_id,
      p.display_name,
      COALESCE(se.external_id, p.display_name, base.profile_id::text) AS sona_identifier,
      se.external_source,
      EXISTS (
        SELECT 1 FROM participant_schedule ps
        WHERE ps.participant_id = base.profile_id AND ps.study_session_id = v_baseline_ss_id
          AND ps.completed_at IS NOT NULL
      ) AS baseline_completed,
      (lp.midpoint_completed_at IS NOT NULL OR EXISTS (
        SELECT 1 FROM participant_schedule ps
        WHERE ps.participant_id = base.profile_id AND ps.study_session_id = v_midpoint_ss_id
          AND ps.completed_at IS NOT NULL
      )) AS midpoint_completed,
      EXISTS (
        SELECT 1 FROM participant_schedule ps
        WHERE ps.participant_id = base.profile_id AND ps.study_session_id = v_final_ss_id
          AND ps.completed_at IS NOT NULL
      ) AS final_completed,
      COALESCE(p1.n, 0) AS phase1_days,
      COALESCE(p2.n, 0) AS phase2_days,
      (
        (CASE WHEN EXISTS (
          SELECT 1 FROM participant_schedule ps
          WHERE ps.participant_id = base.profile_id AND ps.study_session_id = v_baseline_ss_id
            AND ps.completed_at IS NOT NULL
        ) THEN 30 ELSE 0 END)
        + (CASE WHEN lp.midpoint_completed_at IS NOT NULL OR EXISTS (
          SELECT 1 FROM participant_schedule ps
          WHERE ps.participant_id = base.profile_id AND ps.study_session_id = v_midpoint_ss_id
            AND ps.completed_at IS NOT NULL
        ) THEN 20 ELSE 0 END)
        + (CASE WHEN EXISTS (
          SELECT 1 FROM participant_schedule ps
          WHERE ps.participant_id = base.profile_id AND ps.study_session_id = v_final_ss_id
            AND ps.completed_at IS NOT NULL
        ) THEN 25 ELSE 0 END)
        + 4 * (COALESCE(p1.n, 0) + COALESCE(p2.n, 0))
      ) AS total_minutes
    FROM (
      -- Everyone who started the daily sessions, plus everyone who consented:
      -- a participant who sat only the baseline has earned that half hour.
      SELECT lp0.profile_id FROM liliana_participants lp0 WHERE lp0.study_id = p_study_id
      UNION
      SELECT se0.profile_id FROM study_enrollments se0
       WHERE se0.study_id = p_study_id AND se0.consent_date IS NOT NULL AND se0.profile_id IS NOT NULL
    ) base
    LEFT JOIN liliana_participants lp ON lp.profile_id = base.profile_id AND lp.study_id = p_study_id
    LEFT JOIN profiles p ON p.id = base.profile_id
    LEFT JOIN study_enrollments se ON se.profile_id = base.profile_id AND se.study_id = p_study_id
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
  ) t;

  RETURN jsonb_build_object('participants', v_result);
END;
$function$;

-- ─── 2. The transfer's bank reference ──────────────────────────────────────

ALTER TABLE public.participant_compensation
  ADD COLUMN IF NOT EXISTS payment_reference text;

COMMENT ON COLUMN public.participant_compensation.payment_reference IS
  'Bank reference number of the e-transfer, entered by the lab when it marks the payment sent.';

DROP POLICY IF EXISTS "participant insert own" ON public.participant_compensation;
CREATE POLICY "participant insert own"
  ON public.participant_compensation
  FOR INSERT
  TO authenticated
  WITH CHECK (
    paid_at IS NULL
    AND amount_cad IS NULL
    AND payment_reference IS NULL
    AND EXISTS (
      SELECT 1 FROM study_enrollments
       WHERE study_enrollments.id = participant_compensation.enrollment_id
         AND study_enrollments.profile_id = auth.uid()
    )
  );
