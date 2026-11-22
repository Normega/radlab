-- Study codes and timed deletion of SONA IDs, for in-person studies with an
-- admin-generated link (first user: the Breath Attention and Emotional Recovery
-- honours study, plan WP-G4).
--
-- WHY. That study's REB package says the SONA ID is "recorded in a separate,
-- lab-role-only linking table against the study code ... After one week the SONA
-- ID entry is permanently deleted", and that physiology files are "named with the
-- study code only". The admin "Generate link" (create_anonymous_participant) wrote
-- the SONA ID into profiles.sona_id, the display name and
-- study_enrollments.external_id, deleted none of them, and had no code to show.
--
-- HOW. The Prolific machinery already does the hard part
-- (20261009_external_identities.sql): a study with separate_external_identity
-- keeps the platform id only in external_identities, and every other table holds
-- a surrogate. This migration adds two study settings:
--   study_code_prefix                 the surrogate becomes a short code
--                                     ("MB-7KQ3D"), minted by the Edge Function
--   external_identity_retention_days  rows older than this are deleted nightly
-- and the nightly job, plus a lab lookup (by POST) for withdrawal requests.
-- Studies with neither setting are untouched.

-- ── 1. Settings ──────────────────────────────────────────────────────────────
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS study_code_prefix text
    CHECK (study_code_prefix IS NULL OR study_code_prefix ~ '^[A-Z]{1,4}$');
COMMENT ON COLUMN public.studies.study_code_prefix IS
  'With separate_external_identity: participants get a short study code (prefix + 5 characters) as their surrogate, shown to the RA and on the end screen.';

ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS external_identity_retention_days integer
    CHECK (external_identity_retention_days IS NULL OR external_identity_retention_days > 0);
COMMENT ON COLUMN public.studies.external_identity_retention_days IS
  'external_identities rows for this study are deleted this many days after the participant''s session (purge_expired_external_identities, nightly). NULL = deleted only by deidentify_external_enrollments.';

-- ── 2. Nightly deletion ──────────────────────────────────────────────────────
-- The reference time is the later of the identity row's creation (the RA
-- generated the link at the session) and the participant's last completed
-- session, so a session finished the next day still gets its full window.
-- A study held by retain_identities_until keeps its rows until that date.
CREATE OR REPLACE FUNCTION public.purge_expired_external_identities()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DROP TABLE IF EXISTS _purge;
  CREATE TEMP TABLE _purge ON COMMIT DROP AS
  SELECT ei.id AS identity_id, e.id AS enrollment_id
    FROM external_identities ei
    JOIN studies s ON s.id = ei.study_id
    LEFT JOIN study_enrollments e ON e.study_id = ei.study_id AND e.external_id = ei.surrogate
   WHERE s.external_identity_retention_days IS NOT NULL
     AND (s.retain_identities_until IS NULL OR s.retain_identities_until <= now())
     AND GREATEST(
           ei.created_at,
           (SELECT MAX(ps.completed_at) FROM participant_schedule ps
             WHERE ps.participant_id = e.profile_id AND ps.study_id = e.study_id)
         ) + make_interval(days => s.external_identity_retention_days) <= now();

  UPDATE study_enrollments SET deidentified_at = now()
   WHERE id IN (SELECT enrollment_id FROM _purge WHERE enrollment_id IS NOT NULL)
     AND deidentified_at IS NULL;
  DELETE FROM external_identities WHERE id IN (SELECT identity_id FROM _purge);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- pg_cron runs it as the job owner; nobody calls it through the API.
REVOKE ALL ON FUNCTION public.purge_expired_external_identities() FROM public, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-external-identities-daily';
SELECT cron.schedule('purge-external-identities-daily', '15 8 * * *',
                     'select public.purge_expired_external_identities()');  -- 08:15 UTC = 03:15 Toronto (EST)

-- ── 3. Withdrawal lookup ─────────────────────────────────────────────────────
-- A participant asks to withdraw within the week and gives their SONA ID. Lab
-- members may read external_identities under RLS, but a PostgREST GET filter
-- would put the SONA ID in a request URL, which the API gateway logs
-- (20261009_external_identity_surrogate_rpc.sql). This is the POST equivalent.
-- NULL means no code: never enrolled, or the week has passed and the link is gone.
CREATE OR REPLACE FUNCTION public.study_code_for_external_id(p_study_id uuid, p_external_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.my_role() IS DISTINCT FROM 'lab' THEN
    RAISE EXCEPTION 'study_code_for_external_id: lab members only';
  END IF;
  RETURN (SELECT surrogate FROM external_identities
           WHERE study_id = p_study_id AND external_id = btrim(p_external_id));
END;
$$;

REVOKE ALL ON FUNCTION public.study_code_for_external_id(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.study_code_for_external_id(uuid, text) TO authenticated;
