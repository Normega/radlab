-- 20261105_lounge_class_fencing_private_helper.sql
--
-- Follow-up to 20261105_lounge_class_fencing.sql, the same day. The security advisor flagged
-- that public.is_class_only_profile(uuid), a SECURITY DEFINER helper, was callable through
-- the Data API (/rest/v1/rpc/is_class_only_profile): any signed-in account could ask whether
-- a given profile id belongs to a class-only student. Minor, but it is the kind of leak the
-- fencing migration exists to close.
--
-- Moved to the private schema, which the Data API does not expose (it holds only two
-- functions, neither executable by authenticated, and no tables). authenticated gets USAGE
-- on the schema and EXECUTE on this one function, because the profiles policies run as the
-- caller. public.is_member_of_checkin_class stays in public: it answers only about the
-- caller's own membership.

create or replace function private.is_class_only_profile(p_profile_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from class_members cm where cm.user_id = p_profile_id)
     and not exists (select 1 from study_enrollments e where e.profile_id = p_profile_id)
     and coalesce((select role from profiles where id = p_profile_id), '') <> 'lab';
$$;

revoke all on function private.is_class_only_profile(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_class_only_profile(uuid) to authenticated;

drop policy if exists "profiles: lab read all but class-only" on public.profiles;
create policy "profiles: lab read all but class-only" on public.profiles
  for select to authenticated
  using ((select public.my_role()) = 'lab' and not private.is_class_only_profile(id));

drop policy if exists "profiles: lab update participants" on public.profiles;
create policy "profiles: lab update participants" on public.profiles
  for update to authenticated
  using ((select public.my_role()) = 'lab' and role = 'participant' and not private.is_class_only_profile(id))
  with check (role = 'participant' and not (super_admin is distinct from false));

drop function public.is_class_only_profile(uuid);
