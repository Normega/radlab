-- ============================================================
-- RADlab · Guard profiles.study_id against participant self-edit (2026-06-18)
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Idempotent / re-runnable.
--
-- Follow-up to 20260611_super_admin_profiles_lockdown.sql. That migration
-- hardened the "profiles: own update" policy so a user can no longer escalate
-- their own role/super_admin, but it left study_id self-editable.
--
-- profiles.study_id is an access-control key: the "studies: participant read
-- own" policy lets a participant read a studies row only when their own
-- profiles.study_id matches it. A participant who can rewrite their own
-- study_id could therefore reassign their study enrollment (integrity) and
-- read a different study's config row (minor confidentiality).
--
-- RLS WITH CHECK can't compare new-vs-stored values directly, so we mirror the
-- is_super_admin() pattern: a SECURITY DEFINER helper returns the stored value
-- and the policy requires the submitted value to match it. Lab staff and super
-- admins keep their existing ability to (re)assign study_id via their own
-- policies, which are left untouched.
-- ============================================================


-- Stored-value helper, mirroring my_role() / is_super_admin().
CREATE OR REPLACE FUNCTION public.my_study_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT study_id FROM profiles WHERE id = auth.uid()
$$;


-- Re-create the self-update policy, now also pinning study_id to its stored
-- value. role / super_admin guards are carried over from the prior migration.
DROP POLICY IF EXISTS "profiles: own update safe" ON public.profiles;
CREATE POLICY "profiles: own update safe"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = my_role()
    AND (super_admin IS NOT DISTINCT FROM is_super_admin())
    AND (study_id IS NOT DISTINCT FROM my_study_id())
  );
