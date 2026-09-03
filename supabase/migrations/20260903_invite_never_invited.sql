-- Split bulk-invite targeting (Norm, 2026-09-03): "Invite all not-yet-
-- enrolled" would have re-emailed the 61 already-invited students. The RPC
-- gains p_never_invited (invite_count = 0 only), and `all` mode now orders
-- never-invited first so even a re-invite round reaches fresh people before
-- repeats. Dropped and recreated because adding a defaulted parameter via
-- CREATE OR REPLACE would leave two overloads and make PostgREST rpc
-- resolution ambiguous.
drop function if exists public.roster_invite_targets(uuid, uuid[], boolean, integer, integer);

create function public.roster_invite_targets(
  p_course_id uuid,
  p_ids uuid[] default null,
  p_all boolean default false,
  p_cap integer default 10,
  p_limit integer default 61,
  p_never_invited boolean default false
)
returns table(id uuid, full_name text, email text, status text, invite_count integer)
language sql security definer
set search_path to 'public', 'identity'
as $function$
  select r.id, r.full_name, r.email, r.status, r.invite_count
  from identity.roster r
  where r.course_id = p_course_id
    and r.status <> 'dropped'
    and r.invite_count < p_cap
    and (not p_never_invited or r.invite_count = 0)
    and (
      (p_all and r.status in ('added','invited','bounced'))
      or (not p_all and p_ids is not null and r.id = any(p_ids))
    )
  order by r.invite_count asc, r.full_name
  limit p_limit
$function$;

revoke all on function public.roster_invite_targets(uuid, uuid[], boolean, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.roster_invite_targets(uuid, uuid[], boolean, integer, integer, boolean) to service_role;
