-- Class members get 200 points when their avatar exists — once, ever.
--
-- Why (Norm, 2026-09-05): the My Ripple unlock ladder (50/100/150/200/300/500)
-- was tuned for research participants earning daily; a student earning ~5/week
-- from lounge check-ins would unlock the FIRST tier in late November. The
-- grant makes the avatar economy work for students: 200 on setup unlocks ears
-- through mouth styles immediately, auras (300) become a term of faithful
-- participation, scars (500) stay aspirational.
--
-- Class members ONLY (Norm's scoping decision) — research participants keep
-- their earned progression. Membership, not profiles.role, is the gate: the
-- bridge-created accounts stay role='public' so every main-site surface keeps
-- funnelling them through the full /welcome onboarding untouched.
--
-- SECURITY DEFINER because it flips profiles.points; the once-only flag is a
-- timestamp column so repeated calls (the client fires this opportunistically
-- from two places) are harmless no-ops.

alter table public.profiles
  add column if not exists class_avatar_bonus_at timestamptz;

create or replace function public.award_class_avatar_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_granted_at timestamptz;
  v_points int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not signed in');
  end if;

  select class_avatar_bonus_at into v_granted_at from profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no profile');
  end if;
  if v_granted_at is not null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if not exists (select 1 from class_members where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'not a class member');
  end if;
  if not exists (select 1 from avatars where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'no avatar yet');
  end if;

  update profiles
     set points = coalesce(points, 0) + 200,
         class_avatar_bonus_at = now()
   where id = v_uid
   returning points into v_points;

  return jsonb_build_object('ok', true, 'granted', 200, 'points', v_points);
end;
$$;

revoke all on function public.award_class_avatar_bonus() from public, anon;
grant execute on function public.award_class_avatar_bonus() to authenticated;
