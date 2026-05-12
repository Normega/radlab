CREATE OR REPLACE FUNCTION get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id FROM auth.users WHERE email = lookup_email LIMIT 1;
$$;
