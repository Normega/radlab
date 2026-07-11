-- Supports the new /admin/classes management screen: profiles has no email
-- column (it lives in auth.users, not exposed to clients), so listing which
-- instructors are already class_admins for a class needs a SECURITY DEFINER
-- lookup. Mirrors get_user_id_by_email's lab-only gating convention.
CREATE OR REPLACE FUNCTION public.list_class_admins(p_class_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', ca.id, 'user_id', ca.user_id, 'email', u.email) ORDER BY u.email), '[]'::jsonb)
  FROM public.class_admins ca
  JOIN auth.users u ON u.id = ca.user_id
  WHERE ca.class_id = p_class_id
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'lab' OR super_admin)
    );
$function$;
