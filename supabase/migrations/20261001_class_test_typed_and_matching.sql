-- main radlab. Class tests gain two things for the PSY240 midterm (Oct 14, 2026):
--
--   1. SHORT TYPED answers (section 'vsa'): one or two words, auto-marked against a
--      list of accepted answers, tolerant of misspelling (students were told spelling
--      is not marked). Staff can override any verdict; the override is a
--      class_test_grades row (part 'A', score 0 or 1), so it reuses the existing
--      grading table and set_class_test_grade. Effective mark = override, else auto.
--
--   2. EXTENDED MATCHING: an mc item may carry content.fixed_options = true (its
--      option list is never permuted, so every case in a set shows the same list in
--      the same order) and content.group (the set id). Items sharing a group stay
--      together, in authored order, while the groups and the stand-alone questions
--      are still shuffled per student. (Norm, 2026-10-01: fixed list; shuffle
--      question order so a neighbour's screen is no help.)
--
-- Additive by construction. PSY309 Test 1 (Oct 6) has only mc and sa items with no
-- group and no fixed_options: for it every mc item is its own group (random order,
-- as before), every permutation is random (as before), sa stays last in position
-- order (as before). Its dashboard and grading payloads keep every existing key.
--
-- Answer shapes:  vsa content {stem}  ·  answer {accepted: [...], rationale}
--                 vsa response {text}

alter table class_test_items drop constraint if exists class_test_items_section_check;
alter table class_test_items add constraint class_test_items_section_check
  check (section in ('mc', 'sa', 'vsa'));

-- ---------------------------------------------------------------- marking

-- Normal form for comparing a typed answer: lowercase, apostrophes dropped
-- ("Tourette's" = "Tourettes"), every other non-alphanumeric run a single space,
-- a leading "the" dropped.
create or replace function class_test_norm(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
           btrim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[''’`]', '', 'g'),
                                '[^a-z0-9]+', ' ', 'g')),
           '^the ', '');
$$;

-- Edit distance counting a swap of neighbouring letters as one edit ("stabel" is one
-- slip from "stable", not two) -- optimal string alignment. Hand-written: no
-- fuzzystrmatch on this project. Typed answers are capped at 300 characters.
create or replace function class_test_edit_distance(a text, b text)
returns int language plpgsql immutable set search_path = public as $$
declare
  la int := length(a); lb int := length(b); w int := length(b) + 1;
  d int[]; i int; j int; cost int; v int;
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  d := array_fill(0, array[(la + 1) * w]);          -- d(i, j) lives at d[i*w + j + 1]
  for i in 0..la loop d[i * w + 1] := i; end loop;
  for j in 0..lb loop d[j + 1] := j; end loop;
  for i in 1..la loop
    for j in 1..lb loop
      cost := case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end;
      v := least(d[(i - 1) * w + j + 1] + 1, d[i * w + j] + 1, d[(i - 1) * w + j] + cost);
      if i > 1 and j > 1 and substr(a, i, 1) = substr(b, j - 1, 1) and substr(a, i - 1, 1) = substr(b, j, 1) then
        v := least(v, d[(i - 2) * w + j - 1] + 1);
      end if;
      d[i * w + j + 1] := v;
    end loop;
  end loop;
  return d[la * w + lb + 1];
end $$;

-- Auto verdict for one typed answer against an item's answer json. A match is an
-- exact normal-form match, or a near miss: up to 1 edit for answers of 5-8
-- characters, 2 for 9 or more, none for 4 or fewer (short words are too easily
-- another word).
create or replace function class_test_vsa_auto(p_answer jsonb, p_text text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(bool_or(
           n.typed = n.acc
           or (length(n.acc) >= 5 and class_test_edit_distance(n.typed, n.acc)
               <= case when length(n.acc) >= 9 then 2 else 1 end)), false)
    from (select class_test_norm(p_text) typed, class_test_norm(x) acc
            from jsonb_array_elements_text(coalesce(p_answer->'accepted', '[]'::jsonb)) x) n
   where n.typed <> '';
$$;

-- Effective typed-answer mark for an attempt: override if staff set one, else auto.
create or replace function class_test_vsa_correct(a class_test_attempts)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
    from class_test_items i
    left join class_test_answers x on x.attempt_id = a.id and x.item_id = i.item_id
    left join class_test_grades g on g.attempt_id = a.id and g.item_id = i.item_id and g.part = 'A'
   where i.test_id = a.test_id and i.section = 'vsa'
     and coalesce(g.score = 1, class_test_vsa_auto(i.answer, x.response->>'text'), false);
$$;

-- ---------------------------------------------------------------- serving

create or replace function public.class_test_served_items(a class_test_attempts)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    case when i.section = 'mc' then
      jsonb_build_object('item_id', i.item_id, 'section', 'mc', 'stem', i.content->'stem',
        'options', (select jsonb_agg(i.content->'options'->((p.value)::int) order by p.ordinality)
                      from jsonb_array_elements_text(l.value->'perm') with ordinality p))
        || case when i.content ? 'group' then jsonb_build_object('group', i.content->'group') else '{}'::jsonb end
    when i.section = 'vsa' then
      jsonb_build_object('item_id', i.item_id, 'section', 'vsa', 'stem', i.content->'stem')
    else
      jsonb_build_object('item_id', i.item_id, 'section', 'sa', 'stem', i.content->'stem',
        'parts', i.content->'parts')
    end order by l.ordinality), '[]'::jsonb)
  from jsonb_array_elements(a.layout) with ordinality l
  join class_test_items i on i.test_id = a.test_id and i.item_id = l.value->>'item_id';
$$;

-- Layout: mc first (groups and loose questions shuffled, a group's members kept
-- together in authored order), then typed answers (shuffled), then written answers
-- (in order). Option permutation random unless the item has fixed_options.
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

create or replace function public.save_class_test_answer(p_test_id uuid, p_item_id text, p_response jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  t class_tests; a class_test_attempts; v_item class_test_items; v_resp jsonb; v_disp int; v_orig int;
begin
  select * into t from class_tests where id = p_test_id;
  select * into a from class_test_attempts where test_id = p_test_id and profile_id = auth.uid();
  if a.id is null then raise exception 'no attempt'; end if;
  if a.submitted_at is not null then raise exception 'This test has been submitted.'; end if;
  if now() > class_test_deadline(a) + make_interval(secs => t.grace_seconds) then
    perform class_test_finalize(p_test_id);
    raise exception 'Time is up.';
  end if;
  select * into v_item from class_test_items where test_id = p_test_id and item_id = p_item_id;
  if v_item.item_id is null then raise exception 'no such item'; end if;
  if v_item.section = 'mc' then
    v_disp := (p_response->>'choice')::int;
    select (p.value)::int into v_orig
      from jsonb_array_elements(a.layout) l,
           jsonb_array_elements_text(l.value->'perm') with ordinality p
     where l.value->>'item_id' = p_item_id and p.ordinality = v_disp + 1;
    if v_orig is null then raise exception 'bad choice'; end if;
    v_resp := jsonb_build_object('choice', v_orig);
  elsif v_item.section = 'vsa' then
    if coalesce(jsonb_typeof(p_response->'text'), '') <> 'string' then raise exception 'bad response'; end if;
    if length(p_response->>'text') > 300 then raise exception 'answer too long'; end if;
    v_resp := jsonb_build_object('text', p_response->>'text');
  else
    -- coalesce: jsonb_typeof of a missing key is NULL, and NULL <> 'x' is not true, so the
    -- 20260928 check let a response with no parts through (found testing this migration).
    if coalesce(jsonb_typeof(p_response->'parts'), '') <> 'object' then raise exception 'bad response'; end if;
    if length(p_response::text) > 40000 then raise exception 'answer too long'; end if;
    v_resp := jsonb_build_object('parts', p_response->'parts');
  end if;
  insert into class_test_answers (attempt_id, item_id, response, saved_at)
  values (a.id, p_item_id, v_resp, now())
  on conflict (attempt_id, item_id) do update set response = excluded.response, saved_at = excluded.saved_at;
  insert into class_test_answer_log (attempt_id, item_id, response) values (a.id, p_item_id, v_resp);
  update class_test_attempts set last_seen_at = now() where id = a.id;
  return jsonb_build_object('saved_at', now(), 'deadline', class_test_deadline(a), 'server_now', now());
end $$;

-- ---------------------------------------------------------------- staff

-- The 20260930 dashboard, plus test.vsa_count and row.vsa_correct.
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
        'mc_correct', (select count(*) from class_test_answers x
                         join class_test_items i on i.test_id = t.id and i.item_id = x.item_id
                        where x.attempt_id = a.id and i.section = 'mc'
                          and (x.response->>'choice')::int = (i.answer->>'key')::int),
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

-- Typed-answer review: every typed item with its accepted list, and every attempt's
-- responses with the auto verdict and any override. Blind (sequence numbers, as in
-- get_class_test_grading).
create or replace function get_class_test_vsa_review(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('item_id', item_id, 'stem', content->'stem',
       'accepted', answer->'accepted') order by position)
       from class_test_items where test_id = t.id and section = 'vsa'), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object(
       'attempt_id', a.id, 'seq', a.seq, 'submitted', a.submitted_at is not null,
       'answers', coalesce((select jsonb_object_agg(i.item_id, jsonb_build_object(
            'text', x.response->>'text',
            'norm', class_test_norm(x.response->>'text'),
            'auto', class_test_vsa_auto(i.answer, x.response->>'text'),
            'override', g.score))
          from class_test_items i
          join class_test_answers x on x.attempt_id = a.id and x.item_id = i.item_id
          left join class_test_grades g on g.attempt_id = a.id and g.item_id = i.item_id and g.part = 'A'
         where i.test_id = t.id and i.section = 'vsa'), '{}'::jsonb)
     ) order by a.seq)
     from (select a.*, row_number() over (order by a.started_at, a.id) seq
             from class_test_attempts a where a.test_id = t.id) a), '[]'::jsonb));
end $$;

revoke execute on function class_test_norm(text) from public, anon, authenticated;
revoke execute on function class_test_edit_distance(text, text) from public, anon, authenticated;
revoke execute on function class_test_vsa_auto(jsonb, text) from public, anon, authenticated;
revoke execute on function class_test_vsa_correct(class_test_attempts) from public, anon, authenticated;
revoke execute on function get_class_test_vsa_review(uuid) from public, anon;

-- The 20260930 get_class_test, plus 'sections': which sections the test has, so the
-- start screen can say "multiple choice, then short typed answers" before the items
-- are served. (Applied as a third step, with the save guard above.)
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
    'code_required', t.access_code is not null,
    'item_count', (select count(*) from class_test_items where test_id = t.id),
    'sections', (select coalesce(jsonb_agg(distinct section), '[]'::jsonb) from class_test_items where test_id = t.id),
    'attempt', case when a.id is null then null else class_test_state(a) end,
    'items',   case when a.id is not null and a.submitted_at is null then class_test_served_items(a) end,
    'answers', case when a.id is not null and a.submitted_at is null then class_test_served_answers(a) end,
    'server_now', now());
end $function$;
