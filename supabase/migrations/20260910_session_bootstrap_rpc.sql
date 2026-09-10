-- One round trip for the facts App.jsx needs about the signed-in user.
--
-- App's auth handler fanned out into five per-user reads on every auth event:
-- profiles (role/flags), avatars (exists), ripples TWICE (name, then
-- last_checkin_on -- same row, two round trips), and class_members (exists).
--
-- That handler runs far more often than "when someone signs in". auth-js calls
-- _recoverAndRefresh() on every visibilitychange -> visible and emits SIGNED_IN
-- straight from storage, with no auth-server traffic at all, so every tab focus
-- replayed all five. Measured over PSY309's 2026-09-09 lecture (18:00-20:00Z,
-- browser traffic only): 9,072 requests from these five queries out of ~15,800
-- browser REST requests total -- 57% of everything the site did, against 733
-- checkins reads and ~1,100 lobby RPCs for the lecture itself. The five counts
-- came back within 7% of each other (1,734-1,862), which is the fan-out
-- signature: one handler firing ~1,830 times, five queries each.
--
-- Only ~350 of those firings could have been token refreshes (auth_logs holds
-- 357 events of every kind for the whole site in that window), so the large
-- majority were focus.
--
-- SECURITY INVOKER on purpose: profiles, avatars, ripples and class_members all
-- carry self-scoped RLS read policies, so this reads exactly what the client
-- read before and a caller can still only see their own rows. The function
-- changes how many times we ask, not who is allowed to answer.

CREATE OR REPLACE FUNCTION public.get_session_bootstrap()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN u.uid IS NULL THEN NULL ELSE jsonb_build_object(
    -- Column-for-column what the five queries produced, including their
    -- coalescing: a missing profiles row still reads as role 'public', and a
    -- missing ripples row still reads as never-checked-in.
    'role',                   COALESCE(p.role, 'public'),
    'super_admin',            COALESCE(p.super_admin, false),
    'onboarding_complete',    COALESCE(p.onboarding_complete, false),
    'first_contact_complete', COALESCE(p.first_contact_complete, false),
    'still_water_played',     COALESCE(p.still_water_sessions, 0) > 0,
    'has_avatar',             EXISTS (SELECT 1 FROM avatars a WHERE a.user_id = u.uid),
    -- `!!(data?.name)` in JS: empty string is not a name, whitespace is.
    'ripple_named',           COALESCE(r.name, '') <> '',
    'never_checked_in',       r.last_checkin_on IS NULL,
    'is_class_member',        EXISTS (SELECT 1 FROM class_members cm WHERE cm.user_id = u.uid)
  ) END
  FROM (SELECT auth.uid() AS uid) u
  LEFT JOIN profiles p ON p.id      = u.uid
  LEFT JOIN ripples  r ON r.user_id = u.uid
$$;

COMMENT ON FUNCTION public.get_session_bootstrap() IS
  'Per-user bootstrap for App.jsx''s auth handler: role, flags, avatar/ripple/class-membership existence. SECURITY INVOKER - RLS decides the rows, exactly as the five queries it replaces did.';

-- Anon gets nothing to call: the function returns NULL without a uid anyway,
-- but the API surface stays as narrow as the rest of this project's RPCs.
REVOKE ALL ON FUNCTION public.get_session_bootstrap() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_session_bootstrap() TO authenticated;
