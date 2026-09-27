-- Sign-in email limits: a rolling 24-hour window per address, on every send path (radlab-academic).
--
-- Found 2026-09-25: a PSY240 student was refused sign-in with "Send limit reached for this
-- address — contact the course team" three weeks into term. api/roster-join.js capped each
-- roster row at LIFETIME_SEND_CAP = 50 sends, a number meant to "cover a whole term"; hers had
-- reached 50 by Sept 24 (the next-highest student is at 28). A lifetime cap is the wrong shape
-- for an abuse guard: it never protects anything a daily limit would not, and it turns a
-- student whose device loses its session into one who is locked out for the rest of term,
-- with nothing to do but email the instructor.
--
-- Two further gaps in the same guard:
--   * only the roster path was limited at all. The enrolled-person path (staff, and students
--     whose roster row is gone) and the unconsumed-invite path sent a sign-in email on every
--     request, with no cooldown and no cap;
--   * invite_count also counts api/fieldguide-continue.js's bridge mints, which send no email,
--     so the "lifetime sends" it capped were not all sends.
--
-- The limit now lives here, keyed by the normalised address (email_match_key), so all three
-- paths share it: at most one email per 120 s, and at most 10 in any rolling 24 hours.
-- signin_send_claim() checks and records in one step under a per-address advisory lock, so two
-- simultaneous requests cannot both slip under the limit; signin_send_release() returns the
-- slot when the email then fails to send. invite_count / last_invited_at stay on the roster
-- as staff-facing history and no longer gate anything.
--
-- Also here: roster_find_by_key_in_course() and roster_course_code() were executable by anon
-- and authenticated. The first returns a roster row's full name, email and status for any
-- guessed address, so the class list could be read one address at a time with the public key.
-- Both are only ever called with the service key (api/roster-join.js, api/fieldguide-continue.js);
-- they now match their siblings roster_find_by_key / roster_mark_invited, service role only.

create table if not exists identity.signin_sends (
  id         bigint generated always as identity primary key,
  match_key  text not null,
  path       text not null check (path in ('roster', 'enrolled', 'invite')),
  sent_at    timestamptz not null default now()
);
create index if not exists signin_sends_key_time on identity.signin_sends (match_key, sent_at desc);
alter table identity.signin_sends enable row level security;
-- No policies: written and read only through the definer functions below, by the service role.
revoke all on identity.signin_sends from public, anon, authenticated;

create or replace function public.signin_send_claim(p_match_key text, p_path text)
returns jsonb
language plpgsql
security definer
set search_path to 'identity', 'public'
as $$
declare
  c_cooldown constant interval := interval '120 seconds';
  c_window   constant interval := interval '24 hours';
  c_cap      constant int      := 10;
  v_last     timestamptz;
  v_count    int;
  v_oldest   timestamptz;
  v_id       bigint;
begin
  if coalesce(btrim(p_match_key), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'bad_key');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('signin_send:' || p_match_key, 0));

  -- The roster's own stamp counts toward the cooldown too, so a send made just before this
  -- table existed (or by a path that only stamps the roster) is still spaced out.
  select greatest(
           (select max(s.sent_at) from identity.signin_sends s where s.match_key = p_match_key),
           (select max(r.last_invited_at) from identity.roster r where r.email_match_key = p_match_key))
    into v_last;
  if v_last is not null and v_last > now() - c_cooldown then
    return jsonb_build_object('ok', false, 'reason', 'cooldown',
                              'retry_at', v_last + c_cooldown);
  end if;

  select count(*), min(s.sent_at) into v_count, v_oldest
  from identity.signin_sends s
  where s.match_key = p_match_key and s.sent_at > now() - c_window;
  if v_count >= c_cap then
    return jsonb_build_object('ok', false, 'reason', 'window', 'cap', c_cap,
                              'retry_at', v_oldest + c_window);
  end if;

  insert into identity.signin_sends (match_key, path) values (p_match_key, p_path)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'claim_id', v_id);
end;
$$;

-- The email failed after the slot was claimed: give the slot back, so a provider outage does
-- not spend the student's allowance.
create or replace function public.signin_send_release(p_claim_id bigint)
returns void
language sql
security definer
set search_path to 'identity', 'public'
as $$
  delete from identity.signin_sends where id = p_claim_id
$$;

revoke all on function public.signin_send_claim(text, text) from public, anon, authenticated;
revoke all on function public.signin_send_release(bigint) from public, anon, authenticated;
grant execute on function public.signin_send_claim(text, text) to service_role;
grant execute on function public.signin_send_release(bigint) to service_role;

-- Close the two roster lookups that were callable with the public key.
revoke execute on function public.roster_find_by_key_in_course(text, text) from public, anon, authenticated;
revoke execute on function public.roster_course_code(uuid) from public, anon, authenticated;
grant execute on function public.roster_find_by_key_in_course(text, text) to service_role;
grant execute on function public.roster_course_code(uuid) to service_role;
