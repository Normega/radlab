-- Security-advisor pass on the MAIN project (Norm supplied the full advisor
-- dump, 2026-09-09). Scoped deliberately to zero-behavior-risk items the
-- night before Lecture 1; the deferred items are listed at the bottom.

-- ── 1. THE REAL BUG: checkin_responses UPDATE had no USING clause ─────────
-- (defaults to true), so any authenticated user could TARGET another
-- student's response row for update; WITH CHECK then forced profile_id to
-- the attacker, i.e. hijacking/destroying someone else's answer. USING now
-- mirrors WITH CHECK: you may only touch your own row, while the check-in
-- is open. The student upsert path targets exactly that row, so behavior
-- for honest traffic is unchanged. Verified in a rolled-back transaction:
-- own-row edit succeeds, cross-row edit touches nothing.
drop policy "checkin_responses: own update while open" on public.checkin_responses;
create policy "checkin_responses: own update while open"
  on public.checkin_responses for update
  to authenticated
  using (
    profile_id = auth.uid()
    and exists (select 1 from public.checkins c
                where c.id = checkin_responses.checkin_id and c.status = 'open')
  )
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.checkins c
                where c.id = checkin_responses.checkin_id and c.status = 'open')
  );

-- ── 2. Trigger functions are not API. Postgres does not require the firing
-- user to hold EXECUTE on a trigger function, so revoking it from the API
-- roles closes the /rest/v1/rpc/ door with zero behavior change.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_self_privilege_escalation() from public, anon, authenticated;
revoke execute on function public.board_reply_stamps_answered() from public, anon, authenticated;
revoke execute on function public.questionnaire_responses_dedupe() from public, anon, authenticated;
revoke execute on function public.instrument_responses_dedupe() from public, anon, authenticated;
revoke execute on function public.set_cumulative_trial_number() from public, anon, authenticated;
revoke execute on function public.enforce_single_live_checkin() from public, anon, authenticated;
revoke execute on function public.protect_utoronto_verification_columns() from public, anon, authenticated;
revoke execute on function public.update_updated_at() from public, anon, authenticated;

-- ── 3. Signed-in-only RPCs lose their anon grant. Each already refuses
-- internally (is_super_admin / auth.uid() checks); this removes the
-- unauthenticated attack surface entirely. Token-redemption RPCs
-- (verify_utoronto_email, *_session_by_token, class_public_info, consent
-- flow) KEEP anon on purpose — their whole audience is pre-login.
revoke execute on function public.admin_delete_user(uuid) from anon;
revoke execute on function public.admin_set_user_role(uuid, text) from anon;
revoke execute on function public.admin_list_users() from anon;
revoke execute on function public.admin_service_diagnostics() from anon;
revoke execute on function public.duplicate_study(uuid, text) from anon;
revoke execute on function public.get_liliana_credit_report(uuid) from anon;
revoke execute on function public.award_checkin_points(uuid) from anon;
revoke execute on function public.get_class_participation(uuid) from anon;

-- ── 4. search_path pinned on every function the linter flagged (prevents
-- search-path hijack for SECURITY DEFINER bodies; no behavior change).
alter function public.set_cumulative_trial_number() set search_path = public;
alter function public.protect_utoronto_verification_columns() set search_path = public;
alter function public.update_updated_at() set search_path = public;
alter function public.enforce_single_live_checkin() set search_path = public;
alter function public.normalize_uoft_email(text) set search_path = public;
alter function public.is_uoft_student_email(text) set search_path = public;
alter function public.complete_audio_session(uuid, integer, numeric) set search_path = public;
alter function public.questionnaire_responses_dedupe() set search_path = public;
alter function public.instrument_responses_dedupe() set search_path = public;

-- ── Deferred, deliberately (post-Lecture-1):
--   * revoking `authenticated` on admin_* — the UI calls them as the
--     authenticated role and the internal is_super_admin() guard is the
--     designed mechanism; tightening further needs a calmer week.
--   * avatar-png bucket listing policy — needs a check that nothing lists.
--   * leaked-password protection — dashboard toggle, Norm's click:
--     Auth → Passwords → enable HaveIBeenPwned check.
