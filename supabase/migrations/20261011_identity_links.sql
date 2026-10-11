-- Retest linking for separate-identity studies (Sense Foraging Study 2's 2-week
-- retest). The Prolific ID is the only thing tying a person's baseline answers to
-- their retest answers (each study gives its own random code), and
-- deidentify_external_enrollments deletes it after payment. So:
--   studies.identity_link_study_id   pairs a study with another (the retest names
--                                    its baseline); either direction counts
--   studies.retain_identities_until  no ID of this study is deleted before this
--                                    date (set on the baseline until the retest closes)
--   external_identity_links          (study, code) <-> (study, code) for the same
--                                    person, written by the de-identification
--                                    function just before it deletes the IDs
-- The function is otherwise unchanged (live md5 9778df82244c14bea22fc4f34880087e
-- before this change).

ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS identity_link_study_id uuid REFERENCES public.studies(id) ON DELETE SET NULL;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS retain_identities_until timestamptz;

CREATE TABLE IF NOT EXISTS public.external_identity_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_a     uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  surrogate_a text NOT NULL,
  study_b     uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  surrogate_b text NOT NULL,
  linked_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (study_a, surrogate_a, study_b, surrogate_b)
);
ALTER TABLE public.external_identity_links ENABLE ROW LEVEL SECURITY;
-- No Prolific IDs here, only the two studies' random codes. Lab read, like
-- external_identities; writes only through the definer function.
DROP POLICY IF EXISTS "external_identity_links: lab read" ON public.external_identity_links;
CREATE POLICY "external_identity_links: lab read" ON public.external_identity_links FOR SELECT TO authenticated
  USING (public.my_role() = 'lab');
REVOKE INSERT, UPDATE, DELETE ON public.external_identity_links FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.deidentify_external_enrollments(p_study_id uuid, p_paid_through timestamp with time zone, p_confirm boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff  timestamptz := LEAST(p_paid_through, now() - interval '48 hours');
  v_link_h  integer;
  v_counts  jsonb;
  v_deleted integer := 0;
  v_hold    timestamptz;
  v_linked  integer := 0;
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

  -- A study whose IDs are still needed (a retest not yet closed) keeps them all
  -- until its hold date, whatever has been paid.
  SELECT retain_identities_until INTO v_hold FROM studies WHERE id = p_study_id;
  IF v_hold IS NOT NULL AND v_hold > now() THEN
    UPDATE _deid SET eligible = false;
  END IF;

  SELECT jsonb_build_object(
           'dry_run',  NOT p_confirm,
           'held_until', v_hold,
           'cutoff',   v_cutoff,
           'eligible', COALESCE(jsonb_object_agg(kind, n) FILTER (WHERE eligible), '{}'::jsonb),
           'waiting',  COALESCE(jsonb_object_agg(kind, n) FILTER (WHERE NOT eligible), '{}'::jsonb))
    INTO v_counts
    FROM (SELECT kind, eligible, count(*) AS n FROM _deid GROUP BY kind, eligible) t;

  IF p_confirm THEN
    -- Before an ID goes, pair this study's code with the paired study's code for
    -- the same person (baseline and retest), so the two stay linkable without it.
    INSERT INTO external_identity_links (study_a, surrogate_a, study_b, surrogate_b)
    SELECT ei.study_id, ei.surrogate, other.study_id, other.surrogate
      FROM external_identities ei
      JOIN external_identities other
        ON other.external_id = ei.external_id AND other.study_id <> ei.study_id
     WHERE ei.id IN (SELECT identity_id FROM _deid WHERE eligible)
       AND other.study_id IN (SELECT identity_link_study_id FROM studies WHERE id = p_study_id
                              UNION SELECT id FROM studies WHERE identity_link_study_id = p_study_id)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_linked = ROW_COUNT;
    UPDATE study_enrollments SET deidentified_at = now()
     WHERE id IN (SELECT enrollment_id FROM _deid WHERE eligible AND enrollment_id IS NOT NULL);
    DELETE FROM external_identities WHERE id IN (SELECT identity_id FROM _deid WHERE eligible);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN v_counts || jsonb_build_object('deleted', v_deleted, 'linked', v_linked,
    'remaining', (SELECT count(*) FROM external_identities WHERE study_id = p_study_id));
END;
$function$;
