-- Create is_super_admin() security-definer helper (mirrors my_role() pattern)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(super_admin, false) FROM profiles WHERE id = auth.uid()
$$;

-- Drop unrestricted lab update policies
DROP POLICY IF EXISTS "profiles: lab update all" ON public.profiles;
DROP POLICY IF EXISTS "lab_can_update_participant_profiles" ON public.profiles;

-- Drop existing own-update policy (replacing with hardened version)
DROP POLICY IF EXISTS "profiles: own update" ON public.profiles;

-- Own update: users can update their own row but cannot change role or super_admin
CREATE POLICY "profiles: own update safe"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = my_role()
    AND (super_admin IS NOT DISTINCT FROM is_super_admin())
  );

-- Lab update: lab staff can update participant profile rows, but cannot change role or super_admin
CREATE POLICY "profiles: lab update participants"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (my_role() = 'lab' AND role = 'participant')
  WITH CHECK (
    role = 'participant'
    AND (super_admin IS NOT DISTINCT FROM false)
  );

-- Super admin: full update access on all profiles
CREATE POLICY "profiles: super_admin update all"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
