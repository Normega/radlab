-- Adherence checks stop gating the final assessment (2026-08-11)
--
-- Norm's call: everyone who reaches Phase 2 gets the final assessment unless
-- they unsubscribe or withdraw. The >= 10-of-12 rule stays exactly as
-- pre-specified, but it becomes an analysis criterion rather than a gate, so
-- intention-to-treat analysis is possible alongside per-protocol.
--
-- Two parts:
--   1. `on_fail` on the adherence_check nodes — 'continue' on the Phase 2
--      checks, explicit 'withdraw' on Phase 1 (unchanged behaviour, now
--      stated rather than defaulted). Acted on in
--      supabase/functions/_shared/materializeSchedule.ts.
--   2. `liliana_phase_adherence` — the per-protocol classification, derived.
--      It used to be readable off study_enrollments.withdrawal_reason; with
--      nobody withdrawn for Phase 2 adherence there is nothing to read, so
--      the count needs a first-class home. Deliberately a view and not a
--      stored flag: it recounts, so a session completed after the check ran
--      is reflected rather than frozen wrong.

-- ─── 1. on_fail on every adherence_check node ────────────────────────────────
-- Scoped by node shape rather than by hardcoded study id: the two Liliana
-- studies (DRY RUN and Live Test) are the only graphs with these nodes, and
-- both want the same rule. WITH ORDINALITY + ORDER BY preserves node order —
-- entryNode() and the builder's layout both read it.

UPDATE studies s
SET design_graph = jsonb_set(
  s.design_graph,
  '{nodes}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN t.n->>'type' <> 'adherence_check' THEN t.n
        WHEN t.n->>'phase' = 'phase2' THEN t.n || '{"on_fail":"continue"}'::jsonb
        ELSE t.n || '{"on_fail":"withdraw"}'::jsonb
      END
      ORDER BY t.ord
    )
    FROM jsonb_array_elements(s.design_graph->'nodes') WITH ORDINALITY AS t(n, ord)
  )
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(s.design_graph->'nodes') n
  WHERE n->>'type' = 'adherence_check'
);

-- ─── 2. Per-protocol adherence, derived ──────────────────────────────────────
-- One row per (participant, authored adherence_check). Counts exactly what
-- countCompletedPhaseDays() in materializeSchedule.ts counts — completed
-- liliana_day_data rows whose module belongs to the phase — so the analysis
-- classification and the runtime rule can never disagree about the number.
-- security_invoker: the caller's RLS on the underlying tables applies.

CREATE OR REPLACE VIEW public.liliana_phase_adherence
WITH (security_invoker = true) AS
WITH checks AS (
  SELECT s.id                                    AS study_id,
         n->>'id'                                AS node_id,
         n->>'phase'                             AS phase,
         COALESCE((n->>'min_required')::int, 10) AS min_required,
         COALESCE((n->>'of_total')::int, 12)     AS of_total,
         COALESCE(n->>'on_fail', 'withdraw')     AS on_fail
  FROM studies s, jsonb_array_elements(s.design_graph->'nodes') n
  WHERE n->>'type' = 'adherence_check'
),
completed AS (
  SELECT lp.id       AS participant_id,
         im.phase    AS phase,
         count(*)::int AS n
  FROM liliana_day_data ldd
  JOIN liliana_participants lp  ON lp.id = ldd.participant_id
  JOIN intervention_modules im  ON im.module_id = ldd.module_id
  WHERE ldd.completed_at IS NOT NULL
  GROUP BY 1, 2
)
SELECT lp.id                            AS participant_id,
       lp.profile_id,
       c.study_id,
       c.node_id,
       c.phase,
       COALESCE(d.n, 0)                 AS completed_sessions,
       c.min_required,
       c.of_total,
       c.on_fail,
       COALESCE(d.n, 0) >= c.min_required AS meets_criterion,
       e.status                         AS enrollment_status,
       e.withdrawal_reason
FROM checks c
JOIN liliana_participants lp ON lp.study_id = c.study_id
LEFT JOIN completed d        ON d.participant_id = lp.id AND d.phase = c.phase
LEFT JOIN study_enrollments e ON e.study_id = c.study_id AND e.profile_id = lp.profile_id;

COMMENT ON VIEW public.liliana_phase_adherence IS
  'Per-protocol adherence per participant per authored adherence_check node. '
  'meets_criterion is the >=min_required rule; on_fail says whether missing it '
  'ended participation (phase 1) or was recorded only (phase 2, since 2026-08-11). '
  'Counts match countCompletedPhaseDays() in materializeSchedule.ts.';
