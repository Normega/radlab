-- Reset a check-in back to 'planned' from the remote: wipes its responses
-- and question-box entries (votes cascade) and clears the lifecycle
-- timestamps so it can run again clean — for mis-taps and dry-runs.
-- SECURITY DEFINER because clients deliberately have no DELETE policies on
-- checkin_responses / class_questions (students must never delete each
-- other's rows, and that stays true); the admin check is inside instead.
create or replace function reset_checkin(p_checkin_id uuid)
returns void
language plpgsql security definer set search_path = public
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
  if not exists (
    select 1 from class_admins ca
    where ca.class_id = v_class and ca.user_id = auth.uid()
  ) then
    raise exception 'not an admin of this class';
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
