-- Separate external identity: a recruitment-platform id (a Prolific ID) is kept
-- in ONE table and nowhere else, so deleting that row is the whole of
-- de-identification.
--
-- WHY. The Sense Foraging consent form (REB #00051180) promises the Prolific ID
-- is "permanently deleted" once payment is confirmed and "cannot be recovered by
-- anyone, including the research team". auto-enroll used to write it into four
-- places (study_enrollments.external_id, the synthetic auth email, the account's
-- display name in user_metadata and profiles) and kept the Prolific session id,
-- which re-identifies through Prolific's dashboard. Scrubbing four places is
-- fragile, and the nightly offsite dump (Normega/radlab-backups) copies every one
-- of them into monthly snapshots that are never pruned. With one table, the
-- backup can skip its rows (pg_dump --exclude-table-data) and a delete is final.
--
-- HOW. A study opts in with studies.separate_external_identity. auto-enroll then
-- looks the platform id up here (same id in, same surrogate out, so re-entry and
-- a second Prolific posting of the same study still find the enrollment) or mints
-- a random surrogate, and every other table sees only the surrogate. Studies with
-- the flag off are untouched.
--
-- deidentify_external_enrollments() deletes the rows once they may go: 48 h after
-- completion (the consent form's withdrawal window) AND no later than the
-- caller's "paid through" time, plus decliners at once and never-consented
-- arrivals once their link has lapsed. Dry run unless p_confirm is true.
-- Plan: docs/markdowns/sense_foraging_scale_prolific_plan.md (P5, §5a).

-- ── 1. The identity table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.external_identities (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id    uuid        NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  external_id text        NOT NULL,
  surrogate   text        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (study_id, external_id)
);

COMMENT ON TABLE public.external_identities IS
  'The only copy of a recruitment-platform id (e.g. Prolific ID) for studies with separate_external_identity. Every other table holds the surrogate. Rows are deleted by deidentify_external_enrollments; the offsite backup excludes this table''s data.';

-- Lab members read it (payment reconciliation, a withdrawal request inside 48 h).
-- Nobody writes through the API: auto-enroll uses the service role and the RPC
-- below is SECURITY DEFINER. A table with RLS and no write policy blocks writes.
ALTER TABLE public.external_identities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "external_identities: lab read" ON public.external_identities;
CREATE POLICY "external_identities: lab read"
  ON public.external_identities FOR SELECT TO authenticated
  USING (public.my_role() = 'lab');
REVOKE ALL ON public.external_identities FROM anon;

-- ── 2. Flags ─────────────────────────────────────────────────────────────────
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS separate_external_identity boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.studies.separate_external_identity IS
  'auto-enroll keeps the platform id only in external_identities and gives every other table a random surrogate.';

ALTER TABLE public.study_enrollments
  ADD COLUMN IF NOT EXISTS deidentified_at timestamptz;
COMMENT ON COLUMN public.study_enrollments.deidentified_at IS
  'When this enrollment''s platform id was deleted from external_identities. NULL = not (yet) de-identified.';

-- ── 3. De-identification ─────────────────────────────────────────────────────
--   select deidentify_external_enrollments('<study>', '<paid through>');        -- dry run: counts only
--   select deidentify_external_enrollments('<study>', '<paid through>', true);  -- deletes
--
-- p_paid_through: everyone whose submission finished at or before this time has
-- been paid on Prolific (the caller's assertion; the database cannot know). The
-- effective cutoff is the earlier of that and now() - 48 h, so nobody's
-- withdrawal window is ever cut short, whatever is passed.
--
-- A participant's reference time is their completion, or, for someone who
-- consented and stopped part-way, enrollment + the session link's lifetime (they
-- cannot continue after it). Decliners go at once (nothing is kept about people
-- who did not take part); never-consented arrivals go once their link has lapsed;
-- identity rows with no enrollment at all (a refused or failed join) go after 48 h.
CREATE OR REPLACE FUNCTION public.deidentify_external_enrollments(
  p_study_id     uuid,
  p_paid_through timestamptz,
  p_confirm      boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cutoff  timestamptz := LEAST(p_paid_through, now() - interval '48 hours');
  v_link_h  integer;
  v_counts  jsonb;
  v_deleted integer := 0;
BEGIN
  IF public.my_role() IS DISTINCT FROM 'lab' THEN
    RAISE EXCEPTION 'deidentify_external_enrollments: lab members only';
  END IF;
  IF p_paid_through IS NULL THEN
    RAISE EXCEPTION 'deidentify_external_enrollments: pass the time everyone up to has been paid';
  END IF;

  SELECT COALESCE(MAX(link_expires_hours), 48) INTO v_link_h
    FROM study_sessions WHERE study_id = p_study_id;

  DROP TABLE IF EXISTS _deid;
  CREATE TEMP TABLE _deid ON COMMIT DROP AS
  WITH ids AS (
    SELECT ei.id AS identity_id, ei.created_at AS identity_at, e.id AS enrollment_id,
           e.status, e.withdrawal_reason, e.consent_date, e.enrolled_at,
           (SELECT MAX(ps.completed_at) FROM participant_schedule ps
             WHERE ps.participant_id = e.profile_id AND ps.study_id = e.study_id) AS completed_at
      FROM external_identities ei
      LEFT JOIN study_enrollments e ON e.study_id = ei.study_id AND e.external_id = ei.surrogate
     WHERE ei.study_id = p_study_id
  )
  SELECT identity_id, enrollment_id,
         CASE
           WHEN enrollment_id IS NULL                       THEN 'no_enrollment'
           WHEN withdrawal_reason = 'declined_consent'      THEN 'declined'
           WHEN consent_date IS NULL                        THEN 'never_consented'
           WHEN completed_at IS NOT NULL                    THEN 'completed'
           ELSE 'partial'
         END AS kind,
         CASE
           WHEN enrollment_id IS NULL                  THEN identity_at <= now() - interval '48 hours'
           WHEN withdrawal_reason = 'declined_consent' THEN true
           WHEN consent_date IS NULL                   THEN enrolled_at <= now() - make_interval(hours => v_link_h)
           WHEN completed_at IS NOT NULL               THEN completed_at <= v_cutoff
           ELSE enrolled_at + make_interval(hours => v_link_h) <= v_cutoff
         END AS eligible
    FROM ids;

  SELECT jsonb_build_object(
           'dry_run',  NOT p_confirm,
           'cutoff',   v_cutoff,
           'eligible', COALESCE(jsonb_object_agg(kind, n) FILTER (WHERE eligible), '{}'::jsonb),
           'waiting',  COALESCE(jsonb_object_agg(kind, n) FILTER (WHERE NOT eligible), '{}'::jsonb))
    INTO v_counts
    FROM (SELECT kind, eligible, count(*) AS n FROM _deid GROUP BY kind, eligible) t;

  IF p_confirm THEN
    UPDATE study_enrollments SET deidentified_at = now()
     WHERE id IN (SELECT enrollment_id FROM _deid WHERE eligible AND enrollment_id IS NOT NULL);
    DELETE FROM external_identities WHERE id IN (SELECT identity_id FROM _deid WHERE eligible);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN v_counts || jsonb_build_object('deleted', v_deleted,
    'remaining', (SELECT count(*) FROM external_identities WHERE study_id = p_study_id));
END;
$$;

REVOKE ALL ON FUNCTION public.deidentify_external_enrollments(uuid, timestamptz, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.deidentify_external_enrollments(uuid, timestamptz, boolean) TO authenticated;
