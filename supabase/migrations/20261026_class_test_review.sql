-- Test review: a student walks back through their own submitted class test.
-- Built 2026-10-26 for PSY309 Term Test 1 and the PSY240 midterm; works for any class test.
--
-- get_class_test_review(test, attempt?) returns every item in key order (position),
-- with what the student gave and how it scored:
--   * mc:  the options in their canonical order, the student's choice, the key and the
--          key's rationale. Canonical order, not the student's shuffled one, because
--          some rationales name options by letter ("option B").
--   * vsa: what they typed, the accepted answers, the mark (staff override first, then
--          class_test_vsa_auto, exactly as class_test_vsa_correct scores it), rationale.
--   * sa:  each part's prompt, their answer, the mark and the feedback. Never the
--          model answers: those are marking guides with "Do not accept" notes.
--
-- Two doors, one function:
--   * no attempt id: the caller's own attempt, only once it is submitted AND staff
--     have released results (class_tests.results_released_at). Otherwise
--     {available:false}: nothing about the test is returned.
--   * an attempt id: staff only (class_test_staff raises otherwise), any attempt of
--     that test, released or not. This is the console's "Review" preview.
--
-- This reverses one choice in 20261006_grade_o_matic.sql ("MC items and keys are never
-- shown back, so the item bank stays reusable"): on Norm's decision, released tests now
-- show students the items, the keys and the rationales. The release button is the gate.

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
    'vsa_correct', case when v_has_vsa then class_test_vsa_correct(a) else 0 end,
    'items', coalesce((
      select jsonb_agg(case
        when i.section = 'mc' then jsonb_build_object(
          'item_id', i.item_id, 'section', 'mc', 'position', i.position,
          'stem', i.content->'stem', 'options', i.content->'options', 'group', i.content->'group',
          'choice', (x.response->>'choice')::int,
          'key', (i.answer->>'key')::int,
          'credit_all', coalesce((i.answer->>'credit_all')::boolean, false),
          'correct', coalesce((i.answer->>'credit_all')::boolean, false)
                     or (x.response->>'choice')::int = (i.answer->>'key')::int,
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
