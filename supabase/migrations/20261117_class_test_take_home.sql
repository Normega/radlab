-- main radlab. Class tests gain a TAKE-HOME mode and UNSCORED multiple-choice items.
-- First use: the PSY240 RCT reflection (Norm, 2026-11-17), open Nov 18, due Tue Dec 8 11:59 pm ET.
--
-- Take-home mode: class_tests.due_at. When it is set, every attempt's deadline is the due date
-- (or a per-student class_test_accommodations.due_until, set only on Norm's word), not
-- started_at + minutes. Students start, leave, come back and submit any time before it; the
-- existing lazy finalize submits whatever is saved once the due date + grace passes. When due_at
-- is null nothing changes: class_test_deadline keeps the timed formula exactly, so every timed
-- test (PSY309 Test 2, the PSY240 final, the rehearsals) behaves as before.
--
-- Unscored MC: an item whose answer carries "unscored": true (the reflection's "which practice
-- were you assigned?") is shown and saved like any MC item but is never marked: it is skipped by
-- class_test_mc_score and left out of every MC count (dashboard, results, review).
--
-- No new tables (no grants needed). Every function below is redefined from its latest
-- definition: class_test_deadline, get_lounge_test_card and get_class_test_preview (20260928),
-- class_test_served_items, start_class_test and get_class_test (20261001),
-- class_test_mc_score, get_class_test_dashboard and get_class_test_results (20261012),
-- get_class_test_review (20261026). New: class_test_due_for, class_test_mc_count,
-- set_class_test_due, set_class_test_due_until.
--
-- APPLY ONLY when no timed test is in progress: class_test_deadline is read by every live
-- attempt. Verify first with the rolled-back checks in the session notes.

begin;

alter table class_tests add column if not exists due_at timestamptz;
alter table class_test_accommodations add column if not exists due_until timestamptz;

comment on column class_tests.due_at is
  'Take-home mode when set: every attempt is due at this time (or the student''s accommodation due_until), with no countdown.';
comment on column class_test_accommodations.due_until is
  'Take-home tests only: this student''s extended due date. Set only on the instructor''s decision.';

-- ---------------------------------------------------------------- the deadline
create or replace function class_test_deadline(a class_test_attempts)
returns timestamptz language sql stable security definer set search_path = public as $$
  select case
    when t.due_at is not null then coalesce(
      (select x.due_until from class_test_accommodations x
        where x.test_id = a.test_id and x.email = a.email), t.due_at)
    else a.started_at + make_interval(mins => a.base_minutes + a.bonus_minutes + coalesce(
      (select x.extra_minutes from class_test_accommodations x
        where x.test_id = a.test_id and x.email = a.email), 0))
  end
  from class_tests t where t.id = a.test_id;
$$;
revoke execute on function class_test_deadline(class_test_attempts) from public, anon, authenticated;

-- A person's due date on a take-home test, before or after they start (null for timed tests).
create or replace function class_test_due_for(p_test_id uuid, p_email text)
returns timestamptz language sql stable security definer set search_path = public as $$
  select case when t.due_at is null then null else coalesce(
    (select x.due_until from class_test_accommodations x
      where x.test_id = t.id and x.email = lower(btrim(coalesce(p_email, '')))), t.due_at) end
  from class_tests t where t.id = p_test_id;
$$;
revoke execute on function class_test_due_for(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- unscored MC
create or replace function class_test_mc_score(p_attempt_id uuid, p_test_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from class_test_items i
    left join class_test_answers x on x.attempt_id = p_attempt_id and x.item_id = i.item_id
   where i.test_id = p_test_id and i.section = 'mc'
     and not coalesce((i.answer->>'unscored')::boolean, false)
     and (coalesce((i.answer->>'credit_all')::boolean, false)
          or (x.response->>'choice')::int = (i.answer->>'key')::int);
$$;
revoke execute on function class_test_mc_score(uuid, uuid) from public, anon, authenticated;

-- MC items that count toward the mark.
create or replace function class_test_mc_count(p_test_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from class_test_items
   where test_id = p_test_id and section = 'mc'
     and not coalesce((answer->>'unscored')::boolean, false);
$$;
revoke execute on function class_test_mc_count(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- serving: carry the "not marked" flag
-- The flag also lives in content (served to students), because answer never leaves the server.
create or replace function public.class_test_served_items(a class_test_attempts)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    case when i.section = 'mc' then
      jsonb_build_object('item_id', i.item_id, 'section', 'mc', 'stem', i.content->'stem',
        'options', (select jsonb_agg(i.content->'options'->((p.value)::int) order by p.ordinality)
                      from jsonb_array_elements_text(l.value->'perm') with ordinality p))
        || case when i.content ? 'group' then jsonb_build_object('group', i.content->'group') else '{}'::jsonb end
        || case when coalesce((i.content->>'unscored')::boolean, false) then jsonb_build_object('unscored', true) else '{}'::jsonb end
    when i.section = 'vsa' then
      jsonb_build_object('item_id', i.item_id, 'section', 'vsa', 'stem', i.content->'stem')
    else
      jsonb_build_object('item_id', i.item_id, 'section', 'sa', 'stem', i.content->'stem',
        'parts', i.content->'parts')
    end order by l.ordinality), '[]'::jsonb)
  from jsonb_array_elements(a.layout) with ordinality l
  join class_test_items i on i.test_id = a.test_id and i.item_id = l.value->>'item_id';
$$;
revoke execute on function class_test_served_items(class_test_attempts) from public, anon, authenticated;

-- Staff preview: the due date too, so the preview shows the take-home screens.
create or replace function get_class_test_preview(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  return jsonb_build_object('id', t.id, 'title', t.title, 'duration_minutes', t.duration_minutes,
    'take_home', t.due_at is not null, 'due_at', t.due_at,
    'items', coalesce((select jsonb_agg(jsonb_build_object('item_id', item_id, 'section', section,
       'content', content, 'answer', answer) order by position)
       from class_test_items where test_id = t.id), '[]'::jsonb));
end $$;
revoke execute on function get_class_test_preview(uuid) from public, anon;

-- ---------------------------------------------------------------- start: refuse a take-home after its due date
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
  if t.due_at is not null and now() > class_test_due_for(t.id, v_email) then
    raise exception 'This was due %.', to_char(class_test_due_for(t.id, v_email) at time zone 'America/Toronto', 'Dy Mon FMDD, FMHH12:MI am');
  end if;
  with items as (
    select i.*, coalesce(i.content->>'group', i.item_id) gkey,
           case i.section when 'mc' then 0 when 'vsa' then 1 else 2 end sec
      from class_test_items i where i.test_id = t.id
  ), groups as (
    select gkey, case when t.shuffle_mc then random() else min(position) end r
      from items group by gkey
  )
  select jsonb_agg(x.obj order by x.sec, x.gord, x.position) into v_layout from (
    select it.sec, it.position,
           case when it.sec = 2 then it.position else g.r end gord,
           jsonb_build_object('item_id', it.item_id, 'perm',
             case when it.section = 'mc' then (
               select jsonb_agg(gs.n order by case when t.shuffle_mc
                                                    and coalesce((it.content->>'fixed_options')::boolean, false) = false
                                                   then random() else gs.n end)
               from generate_series(0, jsonb_array_length(it.content->'options') - 1) gs(n))
             else '[]'::jsonb end) obj
      from items it join groups g on g.gkey = it.gkey) x;
  insert into class_test_attempts (test_id, profile_id, email, base_minutes, layout, last_seen_at)
  values (t.id, v_uid, v_email, t.duration_minutes, v_layout, now());
  return get_class_test(p_test_id);
end $function$;
revoke execute on function start_class_test(uuid, text) from public, anon;

-- ---------------------------------------------------------------- student view: the due date
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
  v_email := coalesce(a.email, class_test_person_email(v_uid));
  select extra_minutes into v_extra from class_test_accommodations where test_id = t.id and email = v_email;
  return jsonb_build_object(
    'id', t.id, 'title', t.title, 'status', t.status,
    'duration_minutes', t.duration_minutes, 'extra_minutes', coalesce(v_extra, 0),
    'take_home', t.due_at is not null,
    'due_at', class_test_due_for(t.id, v_email),
    'code_required', t.access_code is not null,
    'item_count', (select count(*) from class_test_items where test_id = t.id),
    'sections', (select coalesce(jsonb_agg(distinct section), '[]'::jsonb) from class_test_items where test_id = t.id),
    'attempt', case when a.id is null then null else class_test_state(a) end,
    'items',   case when a.id is not null and a.submitted_at is null then class_test_served_items(a) end,
    'answers', case when a.id is not null and a.submitted_at is null then class_test_served_answers(a) end,
    'server_now', now());
end $function$;
revoke execute on function get_class_test(uuid) from public, anon;

create or replace function get_lounge_test_card(p_class_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from class_members m where m.class_id = p_class_id and m.user_id = auth.uid())
              then null else (
    select jsonb_build_object('id', t.id, 'title', t.title,
      'started', a.id is not null, 'submitted', a.submitted_at is not null,
      'take_home', t.due_at is not null,
      'due_at', class_test_due_for(t.id, coalesce(a.email, class_test_person_email(auth.uid()))))
      from class_tests t
      left join class_test_attempts a on a.test_id = t.id and a.profile_id = auth.uid()
     where t.class_id = p_class_id and t.status = 'open'
     order by t.opened_at desc nulls last limit 1) end;
$$;
revoke execute on function get_lounge_test_card(uuid) from public, anon;

-- ---------------------------------------------------------------- staff: dashboard, setters
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
      'due_at', t.due_at,
      'item_count', (select count(*) from class_test_items where test_id = t.id),
      'mc_count', class_test_mc_count(t.id),
      'unscored_count', (select count(*) from class_test_items where test_id = t.id and section = 'mc'
                           and coalesce((answer->>'unscored')::boolean, false)),
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
        'due_until', acc.due_until,
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
revoke execute on function get_class_test_dashboard(uuid) from public, anon;

-- Set or clear a test's due date (null = timed). Only before anyone has started, so a test
-- never changes mode under a writer; moving an existing due date is allowed.
create or replace function set_class_test_due(p_test_id uuid, p_due_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  if (t.due_at is null) <> (p_due_at is null)
     and exists (select 1 from class_test_attempts where test_id = p_test_id) then
    raise exception 'Someone has already started this test, so it cannot switch between timed and take-home.';
  end if;
  update class_tests set due_at = p_due_at where id = p_test_id;
end $$;
revoke execute on function set_class_test_due(uuid, timestamptz) from public, anon;
grant execute on function set_class_test_due(uuid, timestamptz) to authenticated;

-- One student's extended due date on a take-home test (null clears it).
create or replace function set_class_test_due_until(p_test_id uuid, p_email text, p_due_until timestamptz, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  if t.due_at is null then raise exception 'This test is timed; use extra minutes instead.'; end if;
  insert into class_test_accommodations (test_id, email, extra_minutes, note, due_until, updated_by, updated_at)
  values (p_test_id, lower(btrim(p_email)), 0, nullif(btrim(coalesce(p_note, '')), ''), p_due_until, auth.uid(), now())
  on conflict (test_id, email) do update set due_until = excluded.due_until,
    note = coalesce(excluded.note, class_test_accommodations.note),
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end $$;
revoke execute on function set_class_test_due_until(uuid, text, timestamptz, text) from public, anon;
grant execute on function set_class_test_due_until(uuid, text, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------- results and review
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
  v_mc_n := class_test_mc_count(t.id);
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

create or replace function get_class_test_review(p_test_id uuid, p_attempt_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t class_tests; a class_test_attempts; v_has_vsa boolean;
begin
  select * into t from class_tests where id = p_test_id;
  if t.id is null then raise exception 'no such test'; end if;

  if p_attempt_id is not null then
    perform class_test_staff(t.id);
    select * into a from class_test_attempts where id = p_attempt_id and test_id = t.id;
    if a.id is null then raise exception 'no such attempt'; end if;
  else
    select * into a from class_test_attempts where test_id = t.id and profile_id = auth.uid();
    if a.id is null or a.submitted_at is null or t.results_released_at is null then
      return jsonb_build_object('available', false, 'title', t.title);
    end if;
  end if;

  select exists (select 1 from class_test_items where test_id = t.id and section = 'vsa') into v_has_vsa;

  return jsonb_build_object(
    'available', true,
    'preview', p_attempt_id is not null,
    'title', t.title,
    'released_at', t.results_released_at,
    'submitted', a.submitted_at is not null,
    'mc_correct', class_test_mc_score(a.id, t.id),
    'mc_count', class_test_mc_count(t.id),
    'vsa_correct', case when v_has_vsa then class_test_vsa_correct(a) else 0 end,
    'items', coalesce((
      select jsonb_agg(case
        when i.section = 'mc' then jsonb_build_object(
          'item_id', i.item_id, 'section', 'mc', 'position', i.position,
          'stem', i.content->'stem', 'options', i.content->'options', 'group', i.content->'group',
          'choice', (x.response->>'choice')::int,
          'unscored', coalesce((i.answer->>'unscored')::boolean, false),
          'key', (i.answer->>'key')::int,
          'credit_all', coalesce((i.answer->>'credit_all')::boolean, false),
          'correct', case when coalesce((i.answer->>'unscored')::boolean, false) then null
                          else coalesce((i.answer->>'credit_all')::boolean, false)
                               or (x.response->>'choice')::int = (i.answer->>'key')::int end,
          'rationale', i.answer->>'rationale')
        when i.section = 'vsa' then jsonb_build_object(
          'item_id', i.item_id, 'section', 'vsa', 'position', i.position,
          'stem', i.content->'stem',
          'text', x.response->>'text',
          'accepted', coalesce(i.answer->'accepted', '[]'::jsonb),
          'correct', coalesce(g.score = 1, class_test_vsa_auto(i.answer, x.response->>'text'), false),
          'rationale', i.answer->>'rationale')
        else jsonb_build_object(
          'item_id', i.item_id, 'section', 'sa', 'position', i.position,
          'stem', i.content->'stem',
          'parts', (select jsonb_agg(jsonb_build_object(
              'label', p->>'label', 'prompt', p->>'prompt',
              'answer', x.response->'parts'->>(p->>'label'),
              'score', pg.score, 'feedback', pg.feedback) order by n)
            from jsonb_array_elements(i.content->'parts') with ordinality q(p, n)
            left join class_test_grades pg on pg.attempt_id = a.id and pg.item_id = i.item_id
                                          and pg.part = p->>'label'))
        end order by i.position)
      from class_test_items i
      left join class_test_answers x on x.attempt_id = a.id and x.item_id = i.item_id
      left join class_test_grades g on g.attempt_id = a.id and g.item_id = i.item_id and g.part = 'A'
                                   and i.section = 'vsa'
      where i.test_id = t.id), '[]'::jsonb));
end $$;
revoke all on function get_class_test_review(uuid, uuid) from public, anon;
grant execute on function get_class_test_review(uuid, uuid) to authenticated;

commit;
