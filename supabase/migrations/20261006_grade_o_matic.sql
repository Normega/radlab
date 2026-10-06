-- Grade-o-matic: suggested marks, per-grader queues, written feedback, and releasing
-- results to students. Built for PSY309 Test 1 (Oct 6, 2026); works for any class test.
--
--   * class_test_suggestions: a suggested score, student-facing feedback and a
--     TA-only note per (attempt, item, part). Written by staff tooling (service
--     role), never by the dashboard. Kept apart from class_test_grades so a TA's
--     final mark can later be compared with the suggestion it started from (the
--     anchoring question Norm wants to look at alongside rater differences).
--   * class_test_grader_assignments: who grades which (attempt, item). PSY309
--     Test 1: one TA per SA1-3, SA4 split three ways at random.
--   * class_test_grades.feedback: the feedback the student will read.
--   * class_tests.results_released_at: when set, a student who has submitted sees
--     their total, their short-answer marks and the feedback (get_class_test_results).
--     MC items and keys are never shown back, so the item bank stays reusable.
--
-- All tables RLS-on with no policies, like the rest of class tests: definer RPCs
-- are the only doors. Staff = is_class_staff (class_admins row or super admin).

alter table class_test_grades add column if not exists feedback text;
alter table class_tests add column if not exists results_released_at timestamptz;

create table if not exists class_test_suggestions (
  attempt_id uuid not null references class_test_attempts(id) on delete cascade,
  item_id    text not null,
  part       text not null,
  score      numeric not null check (score >= 0 and score <= 1),
  feedback   text,
  note       text,
  source     text not null default 'claude',
  created_at timestamptz not null default now(),
  primary key (attempt_id, item_id, part)
);
alter table class_test_suggestions enable row level security;

create table if not exists class_test_grader_assignments (
  attempt_id  uuid not null references class_test_attempts(id) on delete cascade,
  item_id     text not null,
  grader_id   uuid not null,
  assigned_at timestamptz not null default now(),
  primary key (attempt_id, item_id)
);
alter table class_test_grader_assignments enable row level security;

-- Everything the dashboard needs, for every submitted attempt x short-answer item:
-- the anonymous response number, the answer, the suggestion, the saved grade, the
-- assigned grader. Staff see all rows; the client filters to "my queue".
create or replace function get_grade_o_matic(p_test_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  return jsonb_build_object(
    'me', auth.uid(),
    'released_at', t.results_released_at,
    'items', coalesce((select jsonb_agg(jsonb_build_object('item_id', i.item_id, 'position', i.position,
        'content', i.content, 'answer', i.answer) order by i.position)
      from class_test_items i where i.test_id = t.id and i.section = 'sa'), '[]'::jsonb),
    'graders', coalesce((select jsonb_agg(distinct jsonb_build_object('user_id', g.grader_id,
        'name', coalesce(nullif(btrim(p.display_name), ''), split_part(u.email, '@', 1))))
      from class_test_grader_assignments g
      join class_test_attempts a on a.id = g.attempt_id and a.test_id = t.id
      left join profiles p on p.id = g.grader_id
      left join auth.users u on u.id = g.grader_id), '[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attempt_id', a.id, 'seq', a.seq, 'item_id', i.item_id,
        'grader_id', ga.grader_id,
        'answer', coalesce(x.response->'parts', '{}'::jsonb),
        'suggestion', coalesce((select jsonb_object_agg(s.part, jsonb_build_object('score', s.score,
            'feedback', s.feedback, 'note', s.note))
          from class_test_suggestions s where s.attempt_id = a.id and s.item_id = i.item_id), '{}'::jsonb),
        'grade', coalesce((select jsonb_object_agg(g.part, jsonb_build_object('score', g.score,
            'feedback', g.feedback, 'graded_by', g.graded_by, 'graded_at', g.graded_at))
          from class_test_grades g where g.attempt_id = a.id and g.item_id = i.item_id), '{}'::jsonb)
      ) order by i.position, a.seq)
      from (select a.*, row_number() over (order by a.started_at, a.id) seq
              from class_test_attempts a where a.test_id = t.id) a
      join class_test_items i on i.test_id = t.id and i.section = 'sa'
      left join class_test_answers x on x.attempt_id = a.id and x.item_id = i.item_id
      left join class_test_grader_assignments ga on ga.attempt_id = a.id and ga.item_id = i.item_id
      where a.submitted_at is not null
    ), '[]'::jsonb));
end $$;

-- Save every part of one response at once: [{part, score (null clears), feedback}].
create or replace function set_class_test_part_grades(p_attempt_id uuid, p_item_id text, p_parts jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare a class_test_attempts; t class_tests; e jsonb;
begin
  select * into a from class_test_attempts where id = p_attempt_id;
  if a.id is null then raise exception 'no such attempt'; end if;
  t := class_test_staff(a.test_id);
  if not exists (select 1 from class_test_items where test_id = t.id and item_id = p_item_id) then
    raise exception 'no such item';
  end if;
  for e in select * from jsonb_array_elements(coalesce(p_parts, '[]'::jsonb)) loop
    if e->>'score' is null then
      delete from class_test_grades where attempt_id = a.id and item_id = p_item_id and part = e->>'part';
    else
      insert into class_test_grades (attempt_id, item_id, part, score, feedback, graded_by, graded_at)
      values (a.id, p_item_id, e->>'part', (e->>'score')::numeric, nullif(btrim(coalesce(e->>'feedback', '')), ''),
              auth.uid(), now())
      on conflict (attempt_id, item_id, part) do update set score = excluded.score, feedback = excluded.feedback,
        graded_by = excluded.graded_by, graded_at = excluded.graded_at;
    end if;
  end loop;
end $$;

create or replace function set_class_test_results_release(p_test_id uuid, p_release boolean)
returns timestamptz language plpgsql volatile security definer set search_path = public as $$
declare t class_tests;
begin
  t := class_test_staff(p_test_id);
  update class_tests set results_released_at = case when p_release then now() end where id = t.id;
  return case when p_release then now() end;
end $$;

-- The student's own results, once staff release them: totals, and for each short
-- answer the question, what they wrote, the mark and the feedback per part.
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
  select count(*) into v_mc
    from class_test_items i join class_test_answers x on x.attempt_id = a.id and x.item_id = i.item_id
   where i.test_id = t.id and i.section = 'mc'
     and (x.response->>'choice')::int = (i.answer->>'key')::int;
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

revoke execute on function get_grade_o_matic(uuid) from public, anon;
revoke execute on function set_class_test_part_grades(uuid, text, jsonb) from public, anon;
revoke execute on function set_class_test_results_release(uuid, boolean) from public, anon;
revoke execute on function get_class_test_results(uuid) from public, anon;
grant execute on function get_grade_o_matic(uuid) to authenticated;
grant execute on function set_class_test_part_grades(uuid, text, jsonb) to authenticated;
grant execute on function set_class_test_results_release(uuid, boolean) to authenticated;
grant execute on function get_class_test_results(uuid) to authenticated;
