-- Backfill: capture trigger that already exists in production but was applied
-- manually via the SQL editor (schema drift), not through a tracked migration.
--
-- Belt-and-suspenders alongside the RLS policies in
-- 20260611_cleanup_admin_role_policies.sql: those policies already stop
-- non-super-admins from changing role/super_admin/study_id via the API, but
-- this trigger enforces the same rule at the row level regardless of policy
-- config, and allows service_role (edge functions) and lab staff to bypass it.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role = trusted server (edge functions); 'lab' = admin.
  IF auth.role() = 'service_role' OR public.my_role() = 'lab' THEN
    RETURN NEW;
  END IF;

  -- IS DISTINCT FROM is null-safe; unchanged values (even if re-sent) pass.
  IF NEW.role        IS DISTINCT FROM OLD.role
  OR NEW.super_admin IS DISTINCT FROM OLD.super_admin
  OR NEW.study_id    IS DISTINCT FROM OLD.study_id THEN
    RAISE EXCEPTION 'role, super_admin and study_id are not self-editable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privesc ON public.profiles;

CREATE TRIGGER profiles_prevent_privesc
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_privilege_escalation();
