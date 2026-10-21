-- Screener gaming on the paid route: one not-eligible message, and a flag.
--
-- WHY. Study-health check, 2026-10-15: on Liliana Study 3 — Paid, people who
-- failed the screener reopened the link in a fresh private window (a new
-- "device" to open-join) and answered again until they passed, e.g.
-- fail_high -> fail_low -> fail_low -> fail_low -> pass in 7 minutes from one
-- IP. The two phase-2 result cards told them which way to move: "you may be
-- going through a particularly difficult time" (too high) versus "you appear
-- to be coping well" (too low). 29 consented paid participants passed after a
-- failed attempt from the same connection within 24 h, 10 after two or more
-- within 3 h.
--
-- 1. ONE NOT-ELIGIBLE MESSAGE (Norm, 2026-10-15). ScreenerPage now shows every
--    failed outcome (criteria, too low, too high) with the study's
--    phase1.fail_message and its support resources, so the result no longer
--    says which way the answers fell. Liliana's fail_message is reworded to
--    say there is a specific set of eligibility criteria. Zerin and Sandy keep
--    their own, which carry instructions those participants need.
--
-- 2. A FLAG, NOT AN EXCLUSION (Norm: "so we can compare data with and without
--    these people"). get_rescreen_flags(study) returns, per enrollment whose
--    screener passed, how many FAILED attempts came from the same connection
--    (open_join_attempts.ip_hash) in the same study in the 24 h and 3 h before
--    its own attempt, and a level:
--      'likely'   -- two or more failed attempts in the preceding 3 h
--      'possible' -- at least one failed attempt in the preceding 24 h
--    Computed on read, so it covers future sign-ups without upkeep. Shared
--    campus connections can put two honest students behind one address, which
--    is why it is a flag for sensitivity analysis and never a gate: nothing
--    here changes who may take part or what they are paid.
--    Only the open route records connections; a SONA ID cannot be re-screened
--    from a new window, so SONA enrollments are never flagged.

UPDATE public.studies
   SET screener = jsonb_set(screener, '{phase1,fail_message}', jsonb_build_object(
         'heading', 'Thank you for your interest in this study.',
         'body',    'This study has a specific set of eligibility criteria, and based on your answers it isn''t the right fit for you at this time. This isn''t a judgment about you or about how you''re doing. If you''d like to talk to someone, the services below are free and confidential.'))
 WHERE screener IS NOT NULL
   AND (id = '958150a9-7821-4daf-8d83-e9325369d91d'
        OR parent_study_id = '958150a9-7821-4daf-8d83-e9325369d91d'
        OR name = 'Liliana Study 3 — Live Test');

CREATE OR REPLACE FUNCTION public.get_rescreen_flags(p_study uuid)
RETURNS TABLE (
  enrollment_id       uuid,
  external_id         text,
  prior_fails_24h     integer,
  prior_fails_3h      integer,
  rescreen_flag       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refuse rather than return nothing: an empty result would read as
  -- "nobody flagged" in an export.
  IF NOT (public.my_role() = 'lab' OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'forbidden: lab only';
  END IF;
  RETURN QUERY
  WITH a AS (
    SELECT a.ip_hash, a.created_at, e.id AS eid, e.external_id AS xid,
           (SELECT (r.phase1_passed AND COALESCE(r.phase2_passed, false))
              FROM screener_results r
             WHERE r.participant_id = e.profile_id AND r.study_id = e.study_id
               AND r.resubmission_of IS NULL
             ORDER BY r.screened_at DESC LIMIT 1) AS passed
      FROM open_join_attempts a
      JOIN study_enrollments e ON e.id = a.enrollment_id
     WHERE a.study_id = p_study AND a.ip_hash IS NOT NULL
  ), scored AS (
    SELECT p.eid, p.xid,
           (SELECT count(*) FROM a f WHERE f.ip_hash = p.ip_hash AND f.passed IS FALSE
              AND f.created_at <  p.created_at AND f.created_at >= p.created_at - interval '24 hours')::int AS f24,
           (SELECT count(*) FROM a f WHERE f.ip_hash = p.ip_hash AND f.passed IS FALSE
              AND f.created_at <  p.created_at AND f.created_at >= p.created_at - interval '3 hours')::int AS f3
      FROM a p
     WHERE p.passed
  )
  -- Qualified throughout: the OUT columns (enrollment_id, external_id, ...)
  -- are variables inside a plpgsql function and would shadow bare names.
  SELECT sc.eid, sc.xid, sc.f24, sc.f3,
         CASE WHEN sc.f3 >= 2 THEN 'likely' WHEN sc.f24 >= 1 THEN 'possible' END
    FROM scored sc
   WHERE sc.f24 >= 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rescreen_flags(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_rescreen_flags(uuid) TO authenticated;
