-- Class tests: credit an MC item to everyone after item analysis (PSY309 Test 1, 2026-10-12)
--
-- Item T1-L2-010 (covariate vs moderator) was answered correctly by 5 of 41 and discriminated
-- negatively (-.28): the students who chose "moderator" outscored those who chose the key on
-- the other 39 items. The term "covariate" had not been taught before the test, so Norm
-- credited the item to every writer and made it a teaching point in the Oct 13 lecture.
--
-- MC was scored by the literal (choice = key) in two functions. Both now call
-- class_test_mc_score(), which also counts any MC item whose answer carries
-- credit_all = true, whether or not the student answered it. The key itself is unchanged,
-- so the answer-key preview still shows the intended answer; no student response is touched.
--
-- Run once in the SQL editor. Re-running is harmless.

create or replace function class_test_mc_score(p_attempt_id uuid, p_test_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from class_test_items i
    left join class_test_answers x on x.attempt_id = p_attempt_id and x.item_id = i.item_id
   where i.test_id = p_test_id and i.section = 'mc'
     and (coalesce((i.answer->>'credit_all')::boolean, false)
          or (x.response->>'choice')::int = (i.answer->>'key')::int);
$$;
revoke execute on function class_test_mc_score(uuid, uuid) from public, anon, authenticated;

-- The 20261001 dashboard, with mc_correct from class_test_mc_score (0 with no attempt, as before).
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
      'mc_count', (select count(*) from class_test_items where test_id = t.id and section = 'mc'),
      'vsa_count', (select count(*) from class_test_items where test_id = t.id and section = 'vsa')),
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
        'mc_correct', case when a.id is null then 0 else class_test_mc_score(a.id, t.id) end,
        'vsa_correct', case when a.id is not null then class_test_vsa_correct(a) end
      ) order by pe.on_roster desc, lower(coalesce(pe.last_name, pe.email)), lower(coalesce(pe.first_name, '')))
      from people pe
      left join lateral (select mb.user_id from members mb where mb.email = pe.email limit 1) mb on true
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

-- The 20261006 student results, with v_mc from class_test_mc_score.
create or replace function get_class_test_results(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t class_tests; a class_test_attempts; v_mc int; v_mc_n int; v_vsa int; v_vsa_n int;
begin
  select * into t from class_tests where id = p_test_id;
  if t.id is null then raise exception 'no such test'; end if;
  select * into a from class_test_attempts where test_id = t.id and profile_id = auth.uid();
  if a.id is null or a.submitted_at is null or t.results_released_at is null then
    return jsonb_build_object('released', false);
  end if;
  v_mc := class_test_mc_score(a.id, t.id);
  select count(*) into v_mc_n from class_test_items where test_id = t.id and section = 'mc';
  select count(*) into v_vsa_n from class_test_items where test_id = t.id and section = 'vsa';
  v_vsa := case when v_vsa_n > 0 then class_test_vsa_correct(a) else 0 end;
  return jsonb_build_object(
    'released', true,
    'mc_correct', coalesce(v_mc, 0), 'mc_count', v_mc_n,
    'vsa_correct', v_vsa, 'vsa_count', v_vsa_n,
    'sa', coalesce((select jsonb_agg(jsonb_build_object(
        'item_id', i.item_id, 'stem', i.content->'stem',
        'parts', (select jsonb_agg(jsonb_build_object(
            'label', p->>'label', 'prompt', p->>'prompt',
            'answer', x.response->'parts'->>(p->>'label'),
            'score', g.score, 'feedback', g.feedback) order by n)
          from jsonb_array_elements(i.content->'parts') with ordinality q(p, n)
          left join class_test_grades g on g.attempt_id = a.id and g.item_id = i.item_id and g.part = p->>'label')
      ) order by i.position)
      from class_test_items i left join class_test_answers x on x.attempt_id = a.id and x.item_id = i.item_id
      where i.test_id = t.id and i.section = 'sa'), '[]'::jsonb));
end $$;

revoke execute on function get_class_test_results(uuid) from public, anon;
grant execute on function get_class_test_results(uuid) to authenticated;

-- The decision itself: PSY309 Test 1, item T1-L2-010, credited to everyone.
update class_test_items
   set answer = answer || jsonb_build_object('credit_all', true,
         'credit_note', 'Credited to all writers 2026-10-12: covariate had not been taught before the test (5/41 correct, discrimination -.28).')
 where test_id = '1eb74d83-23b7-4514-b8ac-da771256f287' and item_id = 'T1-L2-010' and section = 'mc';
