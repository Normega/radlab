-- Restrict get_user_id_by_email to lab members only.
-- Previously any authenticated user could enumerate email → UUID mappings.
-- The EXISTS guard causes the function to return NULL for non-lab callers.
CREATE OR REPLACE FUNCTION get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id FROM auth.users
  WHERE email = lookup_email
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'lab'
    )
  LIMIT 1;
$$;
