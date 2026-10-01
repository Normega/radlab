-- Class tests: identify a student by their sign-in email when the profile has no U of T email.
--
-- Found 2026-09-30 while planning a rehearsal of PSY309 Test 1. The test functions
-- identified a student only by profiles.utoronto_email. One rostered PSY309 student
-- (and one other member) has that column blank, although their sign-in address is
-- their U of T address. For such a student:
--   * start_class_test stamped the attempt with a NULL email, so class_test_deadline
--     never found their accommodation: extra time entered in the Test tab was silently
--     not applied;
--   * get_class_test showed them 0 extra minutes for the same reason;
--   * get_class_test_dashboard matched profiles by utoronto_email only, so their row
--     read "no account / not started" for the whole test, and members with a blank
--     utoronto_email who were not on the roster did not appear at all.
--
-- class_test_person_email(uid) = the U of T email if set, else the auth email, lowercased.
-- Every place that keyed on profiles.utoronto_email now uses it, and the dashboard
-- joins attempts by profile OR by the attempt's stamped email.

create or replace function public.class_test_person_email(p_uid uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select lower(coalesce(nullif(btrim(p.utoronto_email), ''), u.email))
    from auth.users u left join profiles p on p.id = u.id
   where u.id = p_uid;
$function$;
revoke all on function public.class_test_person_email(uuid) from public, anon, authenticated;

create or replace function public.start_class_test(p_test_id uuid, p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t class_tests; v_uid uuid := auth.uid(); v_layout jsonb; v_email text;
begin
  select * into t from class_tests where id = p_test_id;
  if t.id is null then raise exception 'no such test'; end if;
  if not exists (select 1 from class_members m where m.class_id = t.class_id and m.user_id = v_uid) then
    raise exception 'not a member of this class';
  end if;
  if exists (select 1 from class_test_attempts where test_id = t.id and profile_id = v_uid) then
    return get_class_test(p_test_id);
  end if;
  if t.status <> 'open' then raise exception 'This test is not open.'; end if;
  if t.access_code is not null
     and upper(btrim(coalesce(p_code, ''))) <> upper(btrim(t.access_code)) then
    raise exception 'That access code is not right.';
  end if;
  v_email := class_test_person_email(v_uid);
  select jsonb_agg(x.obj order by x.sec, x.ord) into v_layout from (
    select case when i.section = 'mc' then 0 else 1 end sec,
           case when i.section = 'mc' and t.shuffle_mc then random() else i.position end ord,
           jsonb_build_object('item_id', i.item_id, 'perm',
             case when i.section = 'mc' then (
               select jsonb_agg(g.n order by case when t.shuffle_mc then random() else g.n end)
               from generate_series(0, jsonb_array_length(i.content->'options') - 1) g(n))
             else '[]'::jsonb end) obj
    from class_test_items i where i.test_id = t.id) x;
  insert into class_test_attempts (test_id, profile_id, email, base_minutes, layout, last_seen_at)
  values (t.id, v_uid, v_email, t.duration_minutes, v_layout, now());
  return get_class_test(p_test_id);
end $function$;

create or replace function public.get_class_test(p_test_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t class_tests; a class_test_attempts; v_uid uuid := auth.uid(); v_email text; v_extra int;
begin
  select * into t from class_tests where id = p_test_id;
  if t.id is null then raise exception 'no such test'; end if;
  if not exists (select 1 from class_members m where m.class_id = t.class_id and m.user_id = v_uid)
     and not is_class_staff(t.class_id) then
    raise exception 'not a member of this class';
  end if;
  perform class_test_finalize(t.id);
  select * into a from class_test_attempts where test_id = t.id and profile_id = v_uid;
  -- the attempt's stamped email is what class_test_deadline uses; before a start, the person's
  v_email := coalesce(a.email, class_test_person_email(v_uid));
  select extra_minutes into v_extra from class_test_accommodations where test_id = t.id and email = v_email;
  return jsonb_build_object(
    'id', t.id, 'title', t.title, 'status', t.status,
    'duration_minutes', t.duration_minutes, 'extra_minutes', coalesce(v_extra, 0),
    'code_required', t.access_code is not null,
    'item_count', (select count(*) from class_test_items where test_id = t.id),
    'attempt', case when a.id is null then null else class_test_state(a) end,
    'items',   case when a.id is not null and a.submitted_at is null then class_test_served_items(a) end,
    'answers', case when a.id is not null and a.submitted_at is null then class_test_served_answers(a) end,
    'server_now', now());
end $function$;

create or replace function public.get_class_test_dashboard(p_test_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  perform class_test_finalize(p_test_id);
  return jsonb_build_object(
    'test', jsonb_build_object('id', t.id, 'title', t.title, 'status', t.status,
      'access_code', t.access_code, 'duration_minutes', t.duration_minutes,
      'grace_seconds', t.grace_seconds, 'shuffle_mc', t.shuffle_mc,
      'opened_at', t.opened_at, 'closed_at', t.closed_at,
      'item_count', (select count(*) from class_test_items where test_id = t.id),
      'mc_count', (select count(*) from class_test_items where test_id = t.id and section = 'mc')),
    'server_now', now(),
    'rows', coalesce((
      with members as (
        select m.user_id, class_test_person_email(m.user_id) as email
          from class_members m where m.class_id = t.class_id
      ),
      people as (
        select r.email, r.first_name, r.last_name, r.student_number, true as on_roster
          from class_roster r where r.class_id = t.class_id and r.active
        union
        select mb.email, null, null, null, false
          from members mb
         where mb.email is not null
           and not exists (select 1 from class_roster r where r.class_id = t.class_id and r.email = mb.email)
      )
      select jsonb_agg(jsonb_build_object(
        'email', pe.email, 'first_name', pe.first_name, 'last_name', pe.last_name,
        'student_number', pe.student_number, 'on_roster', pe.on_roster,
        'display_name', pr.display_name,
        'has_account', pr.id is not null,
        'verified', pr.utoronto_verified_at is not null,
        'is_member', mb.user_id is not null,
        'extra_minutes', coalesce(acc.extra_minutes, 0), 'note', acc.note,
        'attempt_id', a.id, 'started_at', a.started_at,
        'deadline', case when a.id is not null then class_test_deadline(a) end,
        'bonus_minutes', a.bonus_minutes,
        'submitted_at', a.submitted_at, 'submit_kind', a.submit_kind, 'last_seen_at', a.last_seen_at,
        'answered', (select count(*) from class_test_answers x where x.attempt_id = a.id),
        'mc_correct', (select count(*) from class_test_answers x
                         join class_test_items i on i.test_id = t.id and i.item_id = x.item_id
                        where x.attempt_id = a.id and i.section = 'mc'
                          and (x.response->>'choice')::int = (i.answer->>'key')::int)
      ) order by pe.on_roster desc, lower(coalesce(pe.last_name, pe.email)), lower(coalesce(pe.first_name, '')))
      from people pe
      left join lateral (select mb.user_id from members mb where mb.email = pe.email limit 1) mb on true
      -- a member's own profile; otherwise (roster-only) a profile carrying that U of T email
      left join lateral (select p.* from profiles p
                          where (mb.user_id is not null and p.id = mb.user_id)
                             or (mb.user_id is null and lower(p.utoronto_email) = pe.email)
                          order by (p.utoronto_verified_at is not null) desc
                          limit 1) pr on true
      left join class_test_accommodations acc on acc.test_id = t.id and acc.email = pe.email
      left join lateral (select * from class_test_attempts x
                          where x.test_id = t.id and (x.profile_id = pr.id or x.email = pe.email)
                          order by x.started_at limit 1) a on true
    ), '[]'::jsonb));
end $function$;

-- Attempts already stamped with a NULL email (none exist today; kept for re-runs).
update class_test_attempts a set email = class_test_person_email(a.profile_id)
 where a.email is null;
