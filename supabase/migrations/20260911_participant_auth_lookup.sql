-- Look up an existing participant account by its synthetic address — directly,
-- instead of scanning one page of auth users.
--
-- WHY. Three Edge Functions create a participant's auth account and, when the
-- address already exists, recover its id with `auth.admin.listUsers()` and a
-- `.find()`. listUsers() returns ONE page — 50 users by default — and the
-- project has ~850. Any account outside that page was "not found", and the
-- function returned a 500:
--
--   * study-signup-verify — every student whose `self-<hash>` address already
--     had an account. The hash is of the student's address, not the study, so
--     that is anyone joining a SECOND self-enrollment study (PHL245 and
--     CHM135), or retrying after a first attempt created the account and then
--     failed. Dana hit exactly this on 2026-09-10: both of her confirmation
--     emails arrived, her clicks reached the function, and all six verify
--     attempts (hers and Defender's) died here. The branch did not log, so the
--     function logs showed nothing.
--   * auto-enroll — a SONA or Prolific participant already holding an account
--     from another study (`ext-<source>-<id>@` is not per study either).
--   * create_participant — the admin path, same pattern.
--
-- Service role only. It answers "which account owns this address" for any
-- address, which is exactly what must not be callable from a browser; the lab
-- UI keeps using get_user_id_by_email, which is gated on the caller's role.

CREATE OR REPLACE FUNCTION public.auth_user_id_for_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id
    FROM auth.users
   WHERE lower(email) = lower(btrim(p_email))
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.auth_user_id_for_email(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_for_email(text) TO service_role;
