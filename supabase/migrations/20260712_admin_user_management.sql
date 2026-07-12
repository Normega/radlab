-- Super-admin user management for /admin/users (testing workflow: see users,
-- toggle lab↔public, delete test accounts without opening the Supabase dashboard).
--
-- All three functions are SECURITY DEFINER and gate HARD on is_super_admin() —
-- the UI hides the page from non-supers, but these are the real gate. None of
-- them can touch a super_admin row (including elevation: role changes and
-- deletes both refuse super targets, and nothing here can SET super_admin).

-- ── Allow super admins through the row-level privesc trigger ─────────────────
-- RLS already grants supers full profile updates ("profiles: super_admin
-- update all", 20260611), but the belt-and-suspenders trigger from 20260707
-- only exempted service_role and lab. Align it with the RLS intent.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role = trusted server (edge functions); 'lab' = admin;
  -- super_admin aligned with the "profiles: super_admin update all" policy.
  IF auth.role() = 'service_role' OR public.my_role() = 'lab' OR public.is_super_admin() THEN
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

-- ── List all users (id, email, names, role, flags, activity) ─────────────────
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id',                 u.id,
      'email',              u.email,
      'display_name',       p.display_name,
      'role',               p.role,
      'super_admin',        COALESCE(p.super_admin, false),
      'onboarding_complete', COALESCE(p.onboarding_complete, false),
      'created_at',         u.created_at,
      'email_confirmed_at', u.email_confirmed_at,
      'last_sign_in_at',    u.last_sign_in_at
    ) ORDER BY u.created_at DESC)
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
  ), '[]'::jsonb);
END;
$$;

-- ── Toggle role between lab and public ───────────────────────────────────────
-- Deliberately narrow: no participant accounts (their role anchors study
-- linkage), no super_admin targets, no self, no elevation path of any kind.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_target uuid, p_new_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;
  IF p_new_role NOT IN ('lab', 'public') THEN
    RAISE EXCEPTION 'role must be lab or public';
  END IF;
  IF p_target = auth.uid() THEN
    RAISE EXCEPTION 'cannot change your own role here';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no profile for that user';
  END IF;
  IF COALESCE(v_target.super_admin, false) THEN
    RAISE EXCEPTION 'cannot change a super admin''s role';
  END IF;
  IF v_target.role NOT IN ('lab', 'public') THEN
    RAISE EXCEPTION 'only lab/public accounts can be toggled (target is %)', v_target.role;
  END IF;

  UPDATE public.profiles SET role = p_new_role WHERE id = p_target;
  RETURN jsonb_build_object('id', p_target, 'role', p_new_role);
END;
$$;

-- ── Irrevocably delete a user and all their data ─────────────────────────────
-- Explicit deletes cover public-schema FKs to auth.users that predate the
-- cascade cleanup (word_max_sessions has no ON DELETE CASCADE; avatars/
-- avatar_unlocks predate the migrations dir so their FK action is unverified).
-- profiles' dependents cascade via the 20260610 fk migrations; ripple tables
-- (20260712_ripple_wp1) cascade from auth.users; auth-schema internals
-- (identities, sessions, refresh tokens) cascade from auth.users natively.
-- Single function = single transaction: any unexpected FK error rolls the
-- whole deletion back rather than leaving a half-deleted account.
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth', 'public'
AS $$
DECLARE
  v_email text;
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super admin only';
  END IF;
  IF p_target = auth.uid() THEN
    RAISE EXCEPTION 'cannot delete your own account';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no such user';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_target;
  IF FOUND AND COALESCE(v_target.super_admin, false) THEN
    RAISE EXCEPTION 'cannot delete a super admin';
  END IF;

  DELETE FROM public.word_max_sessions WHERE user_id = p_target;
  DELETE FROM public.avatar_unlocks    WHERE user_id = p_target;
  DELETE FROM public.avatars           WHERE user_id = p_target;
  DELETE FROM public.profiles          WHERE id      = p_target;
  DELETE FROM auth.users               WHERE id      = p_target;

  RETURN jsonb_build_object('deleted', p_target, 'email', v_email);
END;
$$;
