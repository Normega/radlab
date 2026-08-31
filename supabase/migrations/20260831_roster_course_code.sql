-- Project: radlab-academic
--
-- Reply-To routing for the self-serve /join sign-in email.
--
-- api/roster-join.js sends the magic link itself through Resend, and now sets
-- a Reply-To so a student's "the link didn't work" reply reaches a real
-- mailbox instead of hard-bouncing off course.radlab.zone, which has no MX
-- record. Picking the right course inbox needs the matched roster row's
-- course, and roster_find_by_key returns no course column.
--
-- Additive on purpose. Adding the column to roster_find_by_key's return type
-- would require DROP + CREATE, and that function backs the public join
-- endpoint, so the drop is a window where week-one sign-in is broken. A new
-- function cannot break anything that already works.
--
-- identity.roster carries the PII behind zero policies and identity is not on
-- PostgREST's exposed-schema list, so this follows the same SECURITY DEFINER +
-- pinned search_path + service_role-only pattern as the other roster_*
-- functions (see 20260818_roster.sql).

create or replace function public.roster_course_code(p_id uuid)
returns text
language sql
security definer
set search_path to 'public', 'identity'
as $$
  select c.code
  from identity.roster r
  join public.courses c on c.id = r.course_id
  where r.id = p_id
$$;

revoke all on function public.roster_course_code(uuid) from public;
grant execute on function public.roster_course_code(uuid) to service_role;
