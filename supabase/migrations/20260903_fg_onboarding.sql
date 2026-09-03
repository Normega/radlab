-- radlab-academic: first-sign-in onboarding stamp.
--
-- The overlay shows until mark_onboarded() runs; the stamp lives on the
-- person (identity schema, not exposed to PostgREST), so both RPCs are
-- SECURITY DEFINER and scoped to auth.uid(). Durable across devices, unlike
-- a localStorage flag.

alter table identity.people add column if not exists onboarded_at timestamptz;

create or replace function public.my_onboarding()
returns timestamptz
language sql security definer
set search_path = public, identity
as $$
  select onboarded_at from identity.people where auth_user_id = auth.uid();
$$;

revoke all on function public.my_onboarding() from public, anon;
grant execute on function public.my_onboarding() to authenticated;

create or replace function public.mark_onboarded()
returns timestamptz
language sql security definer
set search_path = public, identity
as $$
  update identity.people
  set onboarded_at = coalesce(onboarded_at, now())
  where auth_user_id = auth.uid()
  returning onboarded_at;
$$;

revoke all on function public.mark_onboarded() from public, anon;
grant execute on function public.mark_onboarded() to authenticated;
