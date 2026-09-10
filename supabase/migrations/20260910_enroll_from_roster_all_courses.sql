-- radlab-academic. enroll_from_roster enrolled a student in ONE course,
-- arbitrarily (reported by a student, 2026-09-10). Applied via MCP.
--
-- The roster lookup was:
--
--   select * into v_row from identity.roster
--   where email_match_key = normalize_uoft_email(v_email)
--     and status <> 'dropped'
--   limit 1;
--
-- No course filter, no ORDER BY. A student on two rosters therefore got
-- whichever row Postgres happened to return. The reporter is on PSY309
-- (enrolled) and PSY240 (invited); the query kept selecting the PSY309 row,
-- the insert hit `on conflict do nothing`, and the function returned
-- enrolled=true. So every sign-in reported success while the PSY240 row was
-- never touched -- "it gives me the code, but then loops me back to the
-- beginning", a loop no amount of retrying could break, and one the UI
-- described as "that address is not on the PSY240 roster" when the address
-- was on it all along.
--
-- A student on two rosters should be enrolled in both. Loop over every
-- matching row instead of picking one.
--
-- Return shape unchanged for callers (FieldGuideAuthRoute and
-- lounge-continue read `enrolled` only); `courses` added for diagnosis.
--
-- Scale at the time of the fix: 2 students were on two rosters, 1 of them
-- stuck. The other 20 PSY240 roster rows sitting at 'invited' had accounts
-- but had NEVER SIGNED IN -- accounts are created when the invite is sent,
-- not when it is clicked -- so they are waiting on the student, not on us,
-- and were deliberately left alone. Clicking the link is what proves the
-- mailbox; enrolling them from here would have skipped that proof.
create or replace function public.enroll_from_roster()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_person uuid;
  v_row    identity.roster%rowtype;
  v_ids    uuid[] := '{}';
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then
    return jsonb_build_object('enrolled', false, 'reason', 'no session');
  end if;

  select p.id into v_person from identity.people p where p.auth_user_id = auth.uid();
  if v_person is null then
    insert into identity.people (auth_user_id, email) values (auth.uid(), v_email)
    returning id into v_person;
  end if;

  -- EVERY non-dropped roster row for this mailbox, not the first one found.
  for v_row in
    select * from identity.roster
    where email_match_key = normalize_uoft_email(v_email)
      and status <> 'dropped'
    order by course_id
  loop
    insert into public.enrollments (person_id, course_id, role)
    values (v_person, v_row.course_id, 'student')
    on conflict (person_id, course_id) do nothing;

    update identity.roster
    set status = 'enrolled', enrolled_at = coalesce(enrolled_at, now()), person_id = v_person
    where id = v_row.id;

    v_ids := v_ids || v_row.course_id;
  end loop;

  if array_length(v_ids, 1) is null then
    return jsonb_build_object('enrolled', false, 'reason', 'not on roster');
  end if;

  return jsonb_build_object('enrolled', true, 'course_id', v_ids[1], 'courses', to_jsonb(v_ids));
end;
$$;

revoke all on function public.enroll_from_roster() from public, anon;
grant execute on function public.enroll_from_roster() to authenticated;

-- Backfill, run once alongside this migration: anyone whose mailbox is
-- already proved (auth.users.last_sign_in_at is not null) but who is missing
-- an enrollment for a roster row they hold. Exactly one student matched.
with stuck as (
  select r.id as roster_id, r.course_id, p.id as person_id
  from identity.roster r
  join identity.people p on lower(p.email) = lower(r.email)
  join auth.users u on u.id = p.auth_user_id
  left join enrollments e on e.person_id = p.id and e.course_id = r.course_id
  where r.status <> 'dropped' and u.last_sign_in_at is not null and e.id is null
), ins as (
  insert into enrollments (person_id, course_id, role)
  select person_id, course_id, 'student' from stuck
  on conflict (person_id, course_id) do nothing
  returning 1
)
update identity.roster r
set status = 'enrolled', enrolled_at = coalesce(r.enrolled_at, now()), person_id = s.person_id
from stuck s where r.id = s.roster_id;
