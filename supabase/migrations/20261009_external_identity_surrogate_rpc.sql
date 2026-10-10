-- external_identity_surrogate(): find-or-create a surrogate in ONE call, by POST.
--
-- WHY. The first version of auto-enroll's identity step (20261009_external_identities.sql)
-- looked the platform id up with a PostgREST GET:
--   /rest/v1/external_identities?select=surrogate&study_id=eq.…&external_id=eq.<PROLIFIC ID>
-- and the API gateway logs every request URL (edge_logs). The live test on
-- 2026-10-09 found the test id there twice, on the very first run. Moving the id
-- into the URL fragment kept it out of the browser's request; the function's own
-- database lookup put it back. An RPC is a POST, so the id travels in the body,
-- which is not logged. Doing the insert and the read in one statement also makes
-- the first-click race atomic.
--
-- Service role only (auto-enroll). Lab staff read the table under RLS; any lab
-- tool that looks a Prolific ID up must also go by POST (an RPC), never a GET
-- filter, for the same reason.

CREATE OR REPLACE FUNCTION public.external_identity_surrogate(
  p_study_id    uuid,
  p_external_id text,
  p_candidate   text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ins AS (
    INSERT INTO external_identities (study_id, external_id, surrogate)
    VALUES (p_study_id, p_external_id, p_candidate)
    ON CONFLICT (study_id, external_id) DO NOTHING
    RETURNING surrogate
  )
  SELECT surrogate FROM ins
  UNION ALL
  SELECT surrogate FROM external_identities
   WHERE study_id = p_study_id AND external_id = p_external_id
     AND NOT EXISTS (SELECT 1 FROM ins)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.external_identity_surrogate(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.external_identity_surrogate(uuid, text, text) TO service_role;
