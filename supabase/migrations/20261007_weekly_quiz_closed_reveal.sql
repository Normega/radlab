-- main radlab. Once a weekly quiz has closed, a student can see the answers to the
-- questions they skipped (Norm, 2026-10-07: "if they already submitted and skipped
-- they should still be able to see the answer, why not?").
--
-- Until now the reveal (correct answer, rationale, Field Guide link) came only from
-- answering, and answering is refused after the close -- so a skipped question
-- stayed blank forever, and the quiz review page was no help for exactly the
-- questions a student most needed before the midterm.
--
-- get_weekly_quiz gains 'closed_keys': item_id -> the same reveal payload, for the
-- items this student did NOT answer, returned only once the quiz is closed for the
-- WHOLE class -- hard_close_at plus the longest extension anyone in the class holds
-- (weekly_quiz_extensions). Keying on the student's own close would let a student
-- without an extension pass answers to one who can still sit the quiz.
--
-- Additive: every existing key is unchanged; closed_keys is '{}' while any member
-- can still answer.

create or replace function public.weekly_quiz_closed_for_all(q weekly_quizzes)
returns boolean language sql stable security definer set search_path = public as $$
  select now() > q.hard_close_at + coalesce(
    (select make_interval(days => max(e.extra_days)) from weekly_quiz_extensions e
      where e.class_id = q.class_id), interval '0');
$$;
revoke execute on function public.weekly_quiz_closed_for_all(weekly_quizzes) from public, anon, authenticated;

create or replace function public.get_weekly_quiz(p_quiz_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  q weekly_quizzes;
  v_uid uuid := auth.uid();
  v_answers jsonb;
  v_completed timestamptz;
  v_closed_keys jsonb := '{}'::jsonb;
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

  if weekly_quiz_closed_for_all(q) then
    select coalesce(jsonb_object_agg(k.item_id, k.payload), '{}'::jsonb)
      into v_closed_keys
      from weekly_quiz_keys k
     where k.quiz_id = p_quiz_id
       and not exists (select 1 from weekly_quiz_answers a
                        where a.quiz_id = k.quiz_id and a.item_id = k.item_id and a.profile_id = v_uid);
  end if;

  select completed_at into v_completed
    from weekly_quiz_completions where quiz_id = p_quiz_id and profile_id = v_uid;

  return jsonb_build_object(
    'id', q.id, 'week_no', q.week_no, 'title', q.title, 'items', q.items,
    'opens_at', q.opens_at, 'due_at', q.due_at,
    'hard_close_at', weekly_quiz_effective_close(q, v_uid),
    'answers', v_answers, 'completed_at', v_completed,
    'closed_keys', v_closed_keys);
end $$;
