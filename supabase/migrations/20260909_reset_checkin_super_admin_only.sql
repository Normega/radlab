-- main radlab. Narrow reset_checkin to super admins (Norm, 2026-09-09).
--
-- Found while smoke-testing the load-test harness: the guard accepted anyone
-- in class_admins, but the console that renders the Reset button gates on a
-- WIDER rule (class_admins OR lab OR super_admin). Six of seven lab members
-- could therefore see a Reset button that would refuse them -- a visible dead
-- control, and on the one action that wipes every student's response for a
-- check-in.
--
-- Resolved by narrowing rather than widening: deleting a whole room's answers
-- is the sharpest thing the console can do, and it should belong to one
-- person rather than to everyone who can run a lecture. The button is hidden
-- for everyone else in the same commit, so the guard and the UI agree.
--
-- Everything else about the function is unchanged, including why it is
-- SECURITY DEFINER: clients deliberately hold no DELETE policy on
-- checkin_responses or class_questions, and that stays true.
--
-- Verified in rolled-back transactions: norman@ (the only profiles.super_admin)
-- reset a dirtied results_ready check-in back to planned; sandyluu7@, a
-- class_admin on psy309 who could have reset before, now gets
-- 'reset is restricted to super admins'.
create or replace function reset_checkin(p_checkin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
begin
  select l.class_id into v_class
  from checkins c join lectures l on l.id = c.lecture_id
  where c.id = p_checkin_id;
  if v_class is null then
    raise exception 'checkin not found';
  end if;
  if not is_super_admin() then
    raise exception 'reset is restricted to super admins';
  end if;
  delete from class_questions where checkin_id = p_checkin_id;  -- votes cascade
  delete from checkin_responses where checkin_id = p_checkin_id;
  update checkins
     set status = 'planned', opened_at = null, closed_at = null,
         quiz_revealed_at = null, dismissed_at = null
   where id = p_checkin_id;
end;
$$;

revoke all on function reset_checkin(uuid) from public, anon;
grant execute on function reset_checkin(uuid) to authenticated;
