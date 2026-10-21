-- How many people have answered a check-in, for the Lecture Lounge popcorn
-- bowl (the waiting screen after a student answers; src/academic/lecture-lounge/
-- PopcornBowl.jsx). Students can read only their own checkin_responses rows, so
-- the count comes from here: a bare number, never who answered or what.
--
-- Why not presence: each student re-tracking "answered" on the class presence
-- channel fans out to every phone in the room. Realtime counts every message
-- delivered (Pro: 500/s, 2,500/s without a spend cap, and over the limit
-- connections are dropped), so ~10 answers a second in a 250-seat lecture is
-- ~2,500 messages a second. Phones poll this instead, every few seconds while
-- a check-in they have answered is open, and Realtime load is unchanged.
--
-- Same access rule as get_checkin_quiz_results: members of the check-in's
-- class, its class admins, and super admins. Anyone else gets NULL.

create or replace function public.get_checkin_progress(p_checkin_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    is_super_admin()
    or exists (
      select 1 from checkins c join lectures l on l.id = c.lecture_id
      join class_members cm on cm.class_id = l.class_id
      where c.id = p_checkin_id and cm.user_id = auth.uid()
    )
    or exists (
      select 1 from checkins c join lectures l on l.id = c.lecture_id
      join class_admins ca on ca.class_id = l.class_id
      where c.id = p_checkin_id and ca.user_id = auth.uid()
    )
  ) then
    return null;
  end if;

  return (select count(*)::int from checkin_responses where checkin_id = p_checkin_id);
end;
$$;

revoke execute on function public.get_checkin_progress(uuid) from public, anon;
grant execute on function public.get_checkin_progress(uuid) to authenticated;
