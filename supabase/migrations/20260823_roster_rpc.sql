-- WP5 fix: the invite and join endpoints reached identity.roster with
-- supabase-js `.schema('identity')`, which routes through PostgREST — and
-- `identity` is deliberately NOT on the exposed-schema list, because that is
-- where names and student numbers live. The endpoints therefore failed with
-- "Invalid schema: identity" on the first real bulk invite.
--
-- Exposing `identity` to PostgREST would have fixed the symptom by widening
-- the PII surface, which is the opposite of the §2a.7 design. These functions
-- are the same door the rest of the roster already uses: SECURITY DEFINER,
-- service-role only, one narrow job each.

-- Rows eligible for a staff-triggered invite. `p_all` means everyone not yet
-- enrolled; otherwise the explicit id list. Never returns dropped rows or
-- anyone over the lifetime cap.
create or replace function public.roster_invite_targets(
  p_course_id uuid,
  p_ids       uuid[] default null,
  p_all       boolean default false,
  p_cap       int default 10,
  p_limit     int default 61
) returns table (id uuid, full_name text, email text, status text, invite_count int)
language sql security definer
set search_path to 'public', 'identity'
as $$
  select r.id, r.full_name, r.email, r.status, r.invite_count
  from identity.roster r
  where r.course_id = p_course_id
    and r.status <> 'dropped'
    and r.invite_count < p_cap
    and (
      (p_all and r.status in ('added','invited','bounced'))
      or (not p_all and p_ids is not null and r.id = any(p_ids))
    )
  order by r.full_name
  limit p_limit
$$;

-- One roster row, matched on the normalized key, for the public join endpoint.
-- Returns at most one row and never exposes the student number.
create or replace function public.roster_find_by_key(p_match_key text)
returns table (id uuid, full_name text, email text, status text,
               invite_count int, last_invited_at timestamptz)
language sql security definer
set search_path to 'public', 'identity'
as $$
  select r.id, r.full_name, r.email, r.status, r.invite_count, r.last_invited_at
  from identity.roster r
  where r.email_match_key = p_match_key
    and r.status <> 'dropped'
  limit 1
$$;

-- Stamp a successful send. Keeps the "first invite sets invited_at" rule and
-- the "never demote an enrolled student" rule in SQL rather than in two
-- separate JS call sites.
create or replace function public.roster_mark_invited(p_id uuid)
returns void
language sql security definer
set search_path to 'public', 'identity'
as $$
  update identity.roster
  set status          = case when status = 'enrolled' then 'enrolled' else 'invited' end,
      invited_at      = coalesce(invited_at, now()),
      last_invited_at = now(),
      invite_count    = invite_count + 1
  where id = p_id
$$;

-- The unmatched-attempt queue write, from the public endpoint.
create or replace function public.roster_log_attempt(
  p_submitted text, p_match_key text, p_ip_hash text
) returns void
language sql security definer
set search_path to 'public', 'identity'
as $$
  insert into identity.roster_match_attempts (submitted, match_key, ip_hash)
  values (left(p_submitted, 254), left(p_match_key, 254), p_ip_hash)
$$;

-- Service role only: these are called by the serverless endpoints with the
-- service key, never from a browser. roster_find_by_key in particular must not
-- become an enrolment oracle for anonymous callers.
do $$ begin
  revoke all on function public.roster_invite_targets(uuid, uuid[], boolean, int, int) from public, anon, authenticated;
  revoke all on function public.roster_find_by_key(text) from public, anon, authenticated;
  revoke all on function public.roster_mark_invited(uuid) from public, anon, authenticated;
  revoke all on function public.roster_log_attempt(text, text, text) from public, anon, authenticated;
  grant execute on function public.roster_invite_targets(uuid, uuid[], boolean, int, int) to service_role;
  grant execute on function public.roster_find_by_key(text) to service_role;
  grant execute on function public.roster_mark_invited(uuid) to service_role;
  grant execute on function public.roster_log_attempt(text, text, text) to service_role;
end $$;
