-- main radlab. Weekly quiz runner (syllabus: 10%, completion-graded, 11
-- quizzes). Schema + RPCs only -- quiz CONTENT is loaded per week from the
-- Teaching drive YAMLs via MCP and never enters this (public) repo.
--
-- Key design: item stems/options are class-readable (open-book by design)
-- but ANSWER KEYS live in weekly_quiz_keys with NO client policies. The
-- only path to a key is answer_weekly_quiz_item(), which records the
-- answer first and returns the reveal (correct answer, rationale, Field
-- Guide link). First answer is final; the call is idempotent so retries
-- and double-taps are safe. Completion tiers are computed at export time
-- from timestamps, never stored: full credit to due_at, +7 days automatic
-- grace, 75% to the hard close (midterm / Dec 8), with per-student
-- standing extensions (weekly_quiz_extensions) for accommodations.
--
-- Verified 2026-09-09 in rolled-back transactions as the psy240 sim
-- student: card shows pre-open metadata; keys table returns 0 rows to
-- authenticated; served items carry no keys; answering returns the reveal;
-- 7/7 answers stamp completion and flip the lounge card; confidence saves;
-- staff report returns a row per member x quiz with the tier computed.
-- (get_weekly_quiz_report was corrected live the same night: profiles has
-- display_name, not email -- this file holds the corrected version.)

create table weekly_quizzes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  week_no int not null,
  title text not null,
  items jsonb not null,                -- [{id, format, stem, options?}] -- NO keys
  opens_at timestamptz not null,
  due_at timestamptz not null,         -- posted deadline (full credit)
  hard_close_at timestamptz not null,  -- midterm / Dec 8
  created_at timestamptz not null default now(),
  unique (class_id, week_no)
);

create table weekly_quiz_keys (
  quiz_id uuid not null references weekly_quizzes(id) on delete cascade,
  item_id text not null,
  payload jsonb not null,              -- {correct_index?, answer_text, rationale, link}
  primary key (quiz_id, item_id)
);

create table weekly_quiz_answers (
  quiz_id uuid not null references weekly_quizzes(id) on delete cascade,
  item_id text not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  response jsonb not null,
  confidence int check (confidence between 1 and 3),
  answered_at timestamptz not null default now(),
  primary key (quiz_id, item_id, profile_id)
);
create index idx_weekly_quiz_answers_profile on weekly_quiz_answers (profile_id);

create table weekly_quiz_completions (
  quiz_id uuid not null references weekly_quizzes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (quiz_id, profile_id)
);
create index idx_weekly_quiz_completions_profile on weekly_quiz_completions (profile_id);

create table weekly_quiz_extensions (
  class_id uuid not null references classes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  extra_days int not null check (extra_days > 0),
  note text,
  primary key (class_id, profile_id)
);
create index idx_weekly_quiz_extensions_profile on weekly_quiz_extensions (profile_id);

alter table weekly_quizzes enable row level security;
alter table weekly_quiz_keys enable row level security;
alter table weekly_quiz_answers enable row level security;
alter table weekly_quiz_completions enable row level security;
alter table weekly_quiz_extensions enable row level security;

create policy "weekly_quizzes: members read opened"
  on weekly_quizzes for select to authenticated
  using (opens_at <= now() and exists (
    select 1 from class_members cm
    where cm.class_id = weekly_quizzes.class_id and cm.user_id = (select auth.uid())));
create policy "weekly_quizzes: admins read all"
  on weekly_quizzes for select to authenticated
  using ((my_role() = 'lab') or is_super_admin() or exists (
    select 1 from class_admins ca
    where ca.class_id = weekly_quizzes.class_id and ca.user_id = (select auth.uid())));

-- weekly_quiz_keys: deliberately NO policies -- service role and the
-- definer RPCs are the only readers.

create policy "weekly_quiz_answers: own read"
  on weekly_quiz_answers for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "weekly_quiz_completions: own read"
  on weekly_quiz_completions for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "weekly_quiz_extensions: own read"
  on weekly_quiz_extensions for select to authenticated
  using (profile_id = (select auth.uid()));
-- writes to all three go through the definer RPCs / service role only

create or replace function weekly_quiz_effective_close(p_quiz weekly_quizzes, p_profile uuid)
returns timestamptz language sql stable set search_path = public as $$
  select p_quiz.hard_close_at + coalesce(
    (select make_interval(days => e.extra_days) from weekly_quiz_extensions e
      where e.class_id = p_quiz.class_id and e.profile_id = p_profile), interval '0');
$$;

create or replace function get_weekly_quiz(p_quiz_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q weekly_quizzes;
  v_uid uuid := auth.uid();
  v_answers jsonb;
  v_completed timestamptz;
begin
  select * into q from weekly_quizzes where id = p_quiz_id;
  if q.id is null then raise exception 'no such quiz'; end if;
  if not exists (select 1 from class_members cm where cm.class_id = q.class_id and cm.user_id = v_uid) then
    raise exception 'not a member of this class';
  end if;
  if now() < q.opens_at then raise exception 'quiz not open yet'; end if;

  select coalesce(jsonb_object_agg(a.item_id, jsonb_build_object(
           'response', a.response, 'confidence', a.confidence,
           'answered_at', a.answered_at, 'reveal', k.payload)), '{}'::jsonb)
    into v_answers
    from weekly_quiz_answers a
    join weekly_quiz_keys k on k.quiz_id = a.quiz_id and k.item_id = a.item_id
    where a.quiz_id = p_quiz_id and a.profile_id = v_uid;

  select completed_at into v_completed
    from weekly_quiz_completions where quiz_id = p_quiz_id and profile_id = v_uid;

  return jsonb_build_object(
    'id', q.id, 'week_no', q.week_no, 'title', q.title, 'items', q.items,
    'opens_at', q.opens_at, 'due_at', q.due_at,
    'hard_close_at', weekly_quiz_effective_close(q, v_uid),
    'answers', v_answers, 'completed_at', v_completed);
end $$;

create or replace function answer_weekly_quiz_item(p_quiz_id uuid, p_item_id text, p_response jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  q weekly_quizzes;
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_total int;
  v_answered int;
  v_completed timestamptz;
begin
  select * into q from weekly_quizzes where id = p_quiz_id;
  if q.id is null then raise exception 'no such quiz'; end if;
  if not exists (select 1 from class_members cm where cm.class_id = q.class_id and cm.user_id = v_uid) then
    raise exception 'not a member of this class';
  end if;
  if now() < q.opens_at then raise exception 'quiz not open yet'; end if;
  if now() > weekly_quiz_effective_close(q, v_uid) then raise exception 'quiz closed'; end if;
  select payload into v_payload from weekly_quiz_keys where quiz_id = p_quiz_id and item_id = p_item_id;
  if v_payload is null then raise exception 'no such item'; end if;

  insert into weekly_quiz_answers (quiz_id, item_id, profile_id, response)
  values (p_quiz_id, p_item_id, v_uid, p_response)
  on conflict (quiz_id, item_id, profile_id) do nothing;

  select jsonb_array_length(q.items) into v_total;
  select count(*) into v_answered from weekly_quiz_answers
    where quiz_id = p_quiz_id and profile_id = v_uid;
  if v_answered >= v_total then
    insert into weekly_quiz_completions (quiz_id, profile_id) values (p_quiz_id, v_uid)
    on conflict do nothing;
  end if;
  select completed_at into v_completed from weekly_quiz_completions
    where quiz_id = p_quiz_id and profile_id = v_uid;

  return jsonb_build_object('reveal', v_payload, 'answered', v_answered,
                            'total', v_total, 'completed_at', v_completed);
end $$;

create or replace function set_weekly_quiz_confidence(p_quiz_id uuid, p_item_id text, p_confidence int)
returns void language sql volatile security definer set search_path = public as $$
  update weekly_quiz_answers set confidence = p_confidence
  where quiz_id = p_quiz_id and item_id = p_item_id and profile_id = auth.uid();
$$;

create or replace function get_lounge_quiz_card(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q weekly_quizzes;
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from class_members cm where cm.class_id = p_class_id and cm.user_id = v_uid) then
    return null;
  end if;
  select * into q from weekly_quizzes w
    where w.class_id = p_class_id and w.opens_at <= now()
      and weekly_quiz_effective_close(w, v_uid) > now()
    order by w.due_at asc limit 1;
  if q.id is null then
    select * into q from weekly_quizzes w
      where w.class_id = p_class_id and w.opens_at > now()
      order by w.opens_at asc limit 1;
  end if;
  if q.id is null then
    select * into q from weekly_quizzes w where w.class_id = p_class_id
      order by w.due_at desc limit 1;
  end if;
  if q.id is null then return null; end if;
  return jsonb_build_object(
    'id', q.id, 'week_no', q.week_no, 'title', q.title,
    'opens_at', q.opens_at, 'due_at', q.due_at,
    'hard_close_at', weekly_quiz_effective_close(q, v_uid),
    'total', jsonb_array_length(q.items),
    'answered', (select count(*) from weekly_quiz_answers a
                 where a.quiz_id = q.id and a.profile_id = v_uid),
    'completed_at', (select completed_at from weekly_quiz_completions c
                     where c.quiz_id = q.id and c.profile_id = v_uid));
end $$;

create or replace function get_weekly_quiz_report(p_class_id uuid)
returns table (utoronto_email text, display_name text, week_no int,
               completed_at timestamptz, credit numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not ((my_role() = 'lab') or is_super_admin() or exists (
      select 1 from class_admins ca where ca.class_id = p_class_id and ca.user_id = auth.uid())) then
    raise exception 'staff only';
  end if;
  return query
  select p.utoronto_email, p.display_name, w.week_no, c.completed_at,
         case
           when c.completed_at is null then 0
           when c.completed_at <= w.due_at + interval '7 days' then 1.0
           when c.completed_at <= weekly_quiz_effective_close(w, cm.user_id) then 0.75
           else 0
         end::numeric
  from class_members cm
  join profiles p on p.id = cm.user_id
  cross join weekly_quizzes w
  left join weekly_quiz_completions c on c.quiz_id = w.id and c.profile_id = cm.user_id
  where cm.class_id = p_class_id and w.class_id = p_class_id
  order by p.utoronto_email nulls last, w.week_no;
end $$;

revoke execute on function weekly_quiz_effective_close(weekly_quizzes, uuid) from public, anon, authenticated;
revoke execute on function get_weekly_quiz(uuid) from public, anon;
revoke execute on function answer_weekly_quiz_item(uuid, text, jsonb) from public, anon;
revoke execute on function set_weekly_quiz_confidence(uuid, text, int) from public, anon;
revoke execute on function get_lounge_quiz_card(uuid) from public, anon;
revoke execute on function get_weekly_quiz_report(uuid) from public, anon;
