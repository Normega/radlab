-- main radlab. Timed class tests: the Lecture Lounge runs a term test
-- (first use: PSY309 Test 1, 2026-10-06), with a staff dashboard.
--
-- Shape, and why:
--   * Every table has RLS on and NO policies. Nothing is readable or writable
--     from a browser directly; the definer RPCs below are the only doors,
--     exactly as with weekly_quiz_keys and assessment_bank. That is what keeps
--     answer keys (class_test_items.answer) server-side.
--   * The clock is the server's. An attempt's deadline is
--       started_at + base_minutes + accommodation extra_minutes + bonus_minutes
--     computed LIVE, so raising a student's extra time on the dashboard extends
--     a test already in progress. Saves are refused after deadline + grace.
--   * Nothing needs a cron to end a test: an attempt past its deadline + grace
--     is finalized ('auto') lazily by whichever RPC next touches it.
--   * Items are served only while an attempt is in progress, never before the
--     start (no preview leak) and never after submission (students writing
--     later with accommodations sit the same form).
--   * Multiple-choice order and option order are shuffled per attempt; the
--     permutation lives in the attempt (layout), and answers are stored in the
--     ORIGINAL option index, so scoring never depends on the display.
--   * Accommodations are keyed by the roster email (lowercase UofT address), so
--     extra time can be set before a student has ever signed in.
--   * Staff = class_admins row or super admin (is_class_staff), never role 'lab'.

create table class_tests (
  id               uuid primary key default gen_random_uuid(),
  class_id         uuid not null references classes(id) on delete cascade,
  slug             text not null,
  title            text not null,
  duration_minutes int  not null default 120 check (duration_minutes between 1 and 600),
  grace_seconds    int  not null default 60  check (grace_seconds between 0 and 600),
  status           text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  access_code      text,
  shuffle_mc       boolean not null default true,
  opened_at        timestamptz,
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  unique (class_id, slug)
);

create table class_test_items (
  test_id  uuid not null references class_tests(id) on delete cascade,
  item_id  text not null,
  position int  not null,
  section  text not null check (section in ('mc', 'sa')),
  content  jsonb not null,   -- served: {stem, options} | {stem, parts:[{label, prompt}]}
  answer   jsonb not null,   -- staff only: {key, rationale} | {parts:[{label, model_answer}], rationale}
  primary key (test_id, item_id)
);

create table class_roster (
  class_id       uuid not null references classes(id) on delete cascade,
  email          text not null,       -- lowercase UofT address, as on the official roster
  first_name     text,
  last_name      text,
  student_number text,
  utorid         text,
  active         boolean not null default true,
  loaded_at      timestamptz not null default now(),
  primary key (class_id, email)
);

create table class_test_accommodations (
  test_id       uuid not null references class_tests(id) on delete cascade,
  email         text not null,
  extra_minutes int  not null default 0 check (extra_minutes between 0 and 600),
  note          text,
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  primary key (test_id, email)
);

create table class_test_attempts (
  id            uuid primary key default gen_random_uuid(),
  test_id       uuid not null references class_tests(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  email         text,                 -- utoronto_email at start (joins to roster/accommodation)
  started_at    timestamptz not null default now(),
  base_minutes  int  not null,
  bonus_minutes int  not null default 0,
  submitted_at  timestamptz,
  submit_kind   text check (submit_kind in ('student', 'auto', 'staff')),
  last_seen_at  timestamptz,
  layout        jsonb not null,       -- [{item_id, perm}] in display order; perm maps display -> original option
  unique (test_id, profile_id)
);

create table class_test_answers (
  attempt_id uuid not null references class_test_attempts(id) on delete cascade,
  item_id    text not null,
  response   jsonb not null,          -- {choice: original_index} | {parts: {A: text, ...}}
  saved_at   timestamptz not null default now(),
  primary key (attempt_id, item_id)
);

-- Every save, kept: the record to settle "I answered that" disputes.
create table class_test_answer_log (
  id         bigint generated always as identity primary key,
  attempt_id uuid not null references class_test_attempts(id) on delete cascade,
  item_id    text not null,
  response   jsonb not null,
  saved_at   timestamptz not null default now()
);
create index idx_class_test_answer_log_attempt on class_test_answer_log (attempt_id);

create table class_test_grades (
  attempt_id uuid not null references class_test_attempts(id) on delete cascade,
  item_id    text not null,
  part       text not null,
  score      numeric not null check (score >= 0 and score <= 1),
  graded_by  uuid,
  graded_at  timestamptz not null default now(),
  primary key (attempt_id, item_id, part)
);

alter table class_tests               enable row level security;
alter table class_test_items          enable row level security;
alter table class_roster              enable row level security;
alter table class_test_accommodations enable row level security;
alter table class_test_attempts       enable row level security;
alter table class_test_answers        enable row level security;
alter table class_test_answer_log     enable row level security;
alter table class_test_grades         enable row level security;
-- Deliberately NO policies on any of them: definer RPCs only.

-- ---------------------------------------------------------------- helpers

create or replace function class_test_deadline(a class_test_attempts)
returns timestamptz language sql stable security definer set search_path = public as $$
  select a.started_at + make_interval(mins => a.base_minutes + a.bonus_minutes + coalesce(
    (select x.extra_minutes from class_test_accommodations x
      where x.test_id = a.test_id and x.email = a.email), 0));
$$;

-- Finalize attempts whose time (plus grace) has run out. Idempotent.
create or replace function class_test_finalize(p_test_id uuid)
returns void language sql volatile security definer set search_path = public as $$
  update class_test_attempts a
     set submitted_at = class_test_deadline(a), submit_kind = 'auto'
    from class_tests t
   where t.id = a.test_id and a.test_id = p_test_id and a.submitted_at is null
     and now() > class_test_deadline(a) + make_interval(secs => t.grace_seconds);
$$;

-- The items of an attempt, in its display order, options permuted for display.
create or replace function class_test_served_items(a class_test_attempts)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    case when i.section = 'mc' then
      jsonb_build_object('item_id', i.item_id, 'section', 'mc', 'stem', i.content->'stem',
        'options', (select jsonb_agg(i.content->'options'->((p.value)::int) order by p.ordinality)
                      from jsonb_array_elements_text(l.value->'perm') with ordinality p))
    else
      jsonb_build_object('item_id', i.item_id, 'section', 'sa', 'stem', i.content->'stem',
        'parts', i.content->'parts')
    end order by l.ordinality), '[]'::jsonb)
  from jsonb_array_elements(a.layout) with ordinality l
  join class_test_items i on i.test_id = a.test_id and i.item_id = l.value->>'item_id';
$$;

-- This attempt's answers, MC choices translated back into display positions.
create or replace function class_test_served_answers(a class_test_attempts)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(ans.item_id,
    case when ans.response ? 'choice' then
      jsonb_build_object('choice', (
        select (p.ordinality - 1)::int
          from jsonb_array_elements(a.layout) l,
               jsonb_array_elements_text(l.value->'perm') with ordinality p
         where l.value->>'item_id' = ans.item_id and p.value::int = (ans.response->>'choice')::int))
    else ans.response end), '{}'::jsonb)
  from class_test_answers ans where ans.attempt_id = a.id;
$$;

create or replace function class_test_state(a class_test_attempts)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'attempt_id', a.id, 'started_at', a.started_at, 'deadline', class_test_deadline(a),
    'submitted_at', a.submitted_at, 'submit_kind', a.submit_kind, 'server_now', now());
$$;

-- ---------------------------------------------------------------- student RPCs

create or replace function get_class_test(p_test_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
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
  select lower(utoronto_email) into v_email from profiles where id = v_uid;
  select extra_minutes into v_extra from class_test_accommodations where test_id = t.id and email = v_email;
  select * into a from class_test_attempts where test_id = t.id and profile_id = v_uid;

  return jsonb_build_object(
    'id', t.id, 'title', t.title, 'status', t.status,
    'duration_minutes', t.duration_minutes, 'extra_minutes', coalesce(v_extra, 0),
    'code_required', t.access_code is not null,
    'item_count', (select count(*) from class_test_items where test_id = t.id),
    'attempt', case when a.id is null then null else class_test_state(a) end,
    -- items and answers only while the attempt is live
    'items',   case when a.id is not null and a.submitted_at is null then class_test_served_items(a) end,
    'answers', case when a.id is not null and a.submitted_at is null then class_test_served_answers(a) end,
    'server_now', now());
end $$;

create or replace function start_class_test(p_test_id uuid, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  t class_tests; v_uid uuid := auth.uid(); v_layout jsonb; v_email text;
begin
  select * into t from class_tests where id = p_test_id;
  if t.id is null then raise exception 'no such test'; end if;
  if not exists (select 1 from class_members m where m.class_id = t.class_id and m.user_id = v_uid) then
    raise exception 'not a member of this class';
  end if;
  if exists (select 1 from class_test_attempts where test_id = t.id and profile_id = v_uid) then
    return get_class_test(p_test_id);          -- idempotent: a double-tap or a second device resumes
  end if;
  if t.status <> 'open' then raise exception 'This test is not open.'; end if;
  if t.access_code is not null
     and upper(btrim(coalesce(p_code, ''))) <> upper(btrim(t.access_code)) then
    raise exception 'That access code is not right.';
  end if;

  select lower(utoronto_email) into v_email from profiles where id = v_uid;

  -- MC items shuffled (if enabled), each with its own option permutation; SA after, in order.
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
end $$;

create or replace function save_class_test_answer(p_test_id uuid, p_item_id text, p_response jsonb)
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
  else
    if jsonb_typeof(p_response->'parts') <> 'object' then raise exception 'bad response'; end if;
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

create or replace function ping_class_test(p_test_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a class_test_attempts;
begin
  perform class_test_finalize(p_test_id);
  update class_test_attempts set last_seen_at = now()
   where test_id = p_test_id and profile_id = auth.uid() and submitted_at is null;
  select * into a from class_test_attempts where test_id = p_test_id and profile_id = auth.uid();
  if a.id is null then return null; end if;
  return class_test_state(a);
end $$;

create or replace function submit_class_test(p_test_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a class_test_attempts;
begin
  perform class_test_finalize(p_test_id);
  update class_test_attempts set submitted_at = now(), submit_kind = 'student', last_seen_at = now()
   where test_id = p_test_id and profile_id = auth.uid() and submitted_at is null;
  select * into a from class_test_attempts where test_id = p_test_id and profile_id = auth.uid();
  if a.id is null then raise exception 'no attempt'; end if;
  return class_test_state(a);
end $$;

-- The lobby card: any open test in this class, and where this student stands.
create or replace function get_lounge_test_card(p_class_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from class_members m where m.class_id = p_class_id and m.user_id = auth.uid())
              then null else (
    select jsonb_build_object('id', t.id, 'title', t.title,
      'started', a.id is not null, 'submitted', a.submitted_at is not null)
      from class_tests t
      left join class_test_attempts a on a.test_id = t.id and a.profile_id = auth.uid()
     where t.class_id = p_class_id and t.status = 'open'
     order by t.opened_at desc nulls last limit 1) end;
$$;

-- ---------------------------------------------------------------- staff RPCs

create or replace function class_test_staff(p_test_id uuid)
returns class_tests language plpgsql stable security definer set search_path = public as $$
declare t class_tests;
begin
  select * into t from class_tests where id = p_test_id;
  if t.id is null or not is_class_staff(t.class_id) then raise exception 'staff only'; end if;
  return t;
end $$;

create or replace function list_class_tests(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_class_staff(p_class_id) then raise exception 'staff only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'title', title,
    'status', status) order by created_at) from class_tests where class_id = p_class_id), '[]'::jsonb);
end $$;

create or replace function get_class_test_dashboard(p_test_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
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
      with people as (
        -- everyone on the roster, plus any class member who isn't (TA test accounts, late adds)
        select r.email, r.first_name, r.last_name, r.student_number, true as on_roster
          from class_roster r where r.class_id = t.class_id and r.active
        union
        select lower(p.utoronto_email), null, null, null, false
          from class_members m join profiles p on p.id = m.user_id
         where m.class_id = t.class_id and p.utoronto_email is not null
           and not exists (select 1 from class_roster r where r.class_id = t.class_id
                                                        and r.email = lower(p.utoronto_email))
      )
      select jsonb_agg(jsonb_build_object(
        'email', pe.email, 'first_name', pe.first_name, 'last_name', pe.last_name,
        'student_number', pe.student_number, 'on_roster', pe.on_roster,
        'display_name', pr.display_name,
        'has_account', pr.id is not null,
        'verified', pr.utoronto_verified_at is not null,
        'is_member', exists (select 1 from class_members m where m.class_id = t.class_id and m.user_id = pr.id),
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
      left join lateral (select * from profiles p where lower(p.utoronto_email) = pe.email
                          order by (p.utoronto_verified_at is not null) desc limit 1) pr on true
      left join class_test_accommodations acc on acc.test_id = t.id and acc.email = pe.email
      left join class_test_attempts a on a.test_id = t.id and a.profile_id = pr.id
    ), '[]'::jsonb));
end $$;

create or replace function set_class_test_status(p_test_id uuid, p_status text, p_code text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  if p_status not in ('draft', 'open', 'closed') then raise exception 'bad status'; end if;
  update class_tests set
    status = p_status,
    access_code = nullif(btrim(coalesce(p_code, '')), ''),
    opened_at = case when p_status = 'open' and opened_at is null then now() else opened_at end,
    closed_at = case when p_status = 'closed' then now() else closed_at end
  where id = p_test_id;
end $$;

create or replace function set_class_test_accommodation(p_test_id uuid, p_email text, p_extra int, p_note text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  insert into class_test_accommodations (test_id, email, extra_minutes, note, updated_by, updated_at)
  values (p_test_id, lower(btrim(p_email)), greatest(coalesce(p_extra, 0), 0),
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid(), now())
  on conflict (test_id, email) do update set extra_minutes = excluded.extra_minutes, note = excluded.note,
    updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end $$;

-- 'extend' adds minutes to a live attempt; 'reopen' reopens a submitted one and
-- guarantees it at least p_minutes from now; 'submit' ends it now.
create or replace function adjust_class_test_attempt(p_attempt_id uuid, p_action text, p_minutes int)
returns void language plpgsql volatile security definer set search_path = public as $$
declare a class_test_attempts; t class_tests; v_need int;
begin
  select * into a from class_test_attempts where id = p_attempt_id;
  if a.id is null then raise exception 'no such attempt'; end if;
  t := class_test_staff(a.test_id);
  if p_action = 'extend' then
    update class_test_attempts set bonus_minutes = bonus_minutes + greatest(coalesce(p_minutes, 0), 0) where id = a.id;
  elsif p_action = 'reopen' then
    v_need := greatest(0, ceil(extract(epoch from (now() + make_interval(mins => greatest(coalesce(p_minutes, 10), 1))
                                                   - class_test_deadline(a))) / 60)::int);
    update class_test_attempts set submitted_at = null, submit_kind = null,
      bonus_minutes = bonus_minutes + v_need where id = a.id;
  elsif p_action = 'submit' then
    update class_test_attempts set submitted_at = now(), submit_kind = 'staff'
     where id = a.id and submitted_at is null;
  else
    raise exception 'bad action';
  end if;
end $$;

-- Staff preview: the whole form in fixed order, with keys and model answers.
create or replace function get_class_test_preview(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  return jsonb_build_object('id', t.id, 'title', t.title, 'duration_minutes', t.duration_minutes,
    'items', coalesce((select jsonb_agg(jsonb_build_object('item_id', item_id, 'section', section,
       'content', content, 'answer', answer) order by position)
       from class_test_items where test_id = t.id), '[]'::jsonb));
end $$;

-- Short-answer grading: every submitted attempt's responses, graded blind
-- (a sequence number, not a name), with the model answers and saved grades.
create or replace function get_class_test_grading(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('item_id', item_id, 'content', content,
       'answer', answer) order by position) from class_test_items where test_id = t.id and section = 'sa'), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object(
       'attempt_id', a.id, 'seq', a.seq, 'submitted', a.submitted_at is not null,
       'answers', coalesce((select jsonb_object_agg(x.item_id, x.response) from class_test_answers x
                             join class_test_items i on i.test_id = t.id and i.item_id = x.item_id and i.section = 'sa'
                            where x.attempt_id = a.id), '{}'::jsonb),
       'grades', coalesce((select jsonb_object_agg(g.item_id || '|' || g.part, g.score)
                             from class_test_grades g where g.attempt_id = a.id), '{}'::jsonb)
     ) order by a.seq)
     from (select a.*, row_number() over (order by a.started_at, a.id) seq
             from class_test_attempts a where a.test_id = t.id) a), '[]'::jsonb));
end $$;

create or replace function set_class_test_grade(p_attempt_id uuid, p_item_id text, p_part text, p_score numeric)
returns void language plpgsql volatile security definer set search_path = public as $$
declare a class_test_attempts; t class_tests;
begin
  select * into a from class_test_attempts where id = p_attempt_id;
  if a.id is null then raise exception 'no such attempt'; end if;
  t := class_test_staff(a.test_id);
  if p_score is null then
    delete from class_test_grades where attempt_id = a.id and item_id = p_item_id and part = p_part;
  else
    insert into class_test_grades (attempt_id, item_id, part, score, graded_by, graded_at)
    values (a.id, p_item_id, p_part, p_score, auth.uid(), now())
    on conflict (attempt_id, item_id, part) do update set score = excluded.score,
      graded_by = excluded.graded_by, graded_at = excluded.graded_at;
  end if;
end $$;

revoke execute on function class_test_deadline(class_test_attempts) from public, anon, authenticated;
revoke execute on function class_test_finalize(uuid) from public, anon, authenticated;
revoke execute on function class_test_served_items(class_test_attempts) from public, anon, authenticated;
revoke execute on function class_test_served_answers(class_test_attempts) from public, anon, authenticated;
revoke execute on function class_test_state(class_test_attempts) from public, anon, authenticated;
revoke execute on function class_test_staff(uuid) from public, anon, authenticated;
revoke execute on function get_class_test(uuid) from public, anon;
revoke execute on function start_class_test(uuid, text) from public, anon;
revoke execute on function save_class_test_answer(uuid, text, jsonb) from public, anon;
revoke execute on function ping_class_test(uuid) from public, anon;
revoke execute on function submit_class_test(uuid) from public, anon;
revoke execute on function get_lounge_test_card(uuid) from public, anon;
revoke execute on function list_class_tests(uuid) from public, anon;
revoke execute on function get_class_test_dashboard(uuid) from public, anon;
revoke execute on function set_class_test_status(uuid, text, text) from public, anon;
revoke execute on function set_class_test_accommodation(uuid, text, int, text) from public, anon;
revoke execute on function adjust_class_test_attempt(uuid, text, int) from public, anon;
revoke execute on function get_class_test_preview(uuid) from public, anon;
revoke execute on function get_class_test_grading(uuid) from public, anon;
revoke execute on function set_class_test_grade(uuid, text, text, numeric) from public, anon;
