-- The lobby quiz card never advanced past week 1 (Norm, 2026-09-17: "quiz 2
-- didn't launch" — it had launched; 25 students found it through the archive
-- while the card still showed Quiz 1).
--
-- get_lounge_quiz_card picked, among every quiz that is open and not past its
-- EFFECTIVE close, the one with the earliest due_at. Quizzes deliberately stay
-- answerable until the midterm (full credit → grace week → 75% late tier), so
-- week 1 stayed in that candidate set and won on due_at against every later
-- week. The card was therefore pinned to Quiz 1 until 2026-10-14 for the whole
-- class — including the 195 students who had already completed it, who saw a
-- card reading "Weekly quiz · done". The late-tier policy and the card query
-- were each right alone and wrong together.
--
-- Fix: prefer the oldest OPEN quiz the student has not completed — catch-up
-- first, which is what ordering by due_at was reaching for, and which is the
-- quiz closest to losing credit. When they are caught up, show the NEWEST open
-- quiz, so the card reflects this week rather than the first week of term.
-- Everything else about the function is unchanged, including the not-yet-open
-- and nothing-open fallbacks.

CREATE OR REPLACE FUNCTION public.get_lounge_quiz_card(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
declare
  q weekly_quizzes;
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from class_members cm where cm.class_id = p_class_id and cm.user_id = v_uid) then
    return null;
  end if;

  -- 1. Oldest open quiz still outstanding for this student.
  select * into q from weekly_quizzes w
    where w.class_id = p_class_id and w.opens_at <= now()
      and weekly_quiz_effective_close(w, v_uid) > now()
      and not exists (select 1 from weekly_quiz_completions c
                      where c.quiz_id = w.id and c.profile_id = v_uid)
    order by w.due_at asc limit 1;

  -- 2. Caught up: the newest open quiz, so the card tracks the current week.
  if q.id is null then
    select * into q from weekly_quizzes w
      where w.class_id = p_class_id and w.opens_at <= now()
        and weekly_quiz_effective_close(w, v_uid) > now()
      order by w.due_at desc limit 1;
  end if;

  -- 3. Nothing open yet: the next one to open.
  if q.id is null then
    select * into q from weekly_quizzes w
      where w.class_id = p_class_id and w.opens_at > now()
      order by w.opens_at asc limit 1;
  end if;

  -- 4. Nothing open and nothing upcoming: the most recent quiz of the term.
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

-- Restated to match the live ACL exactly (CREATE OR REPLACE preserves it; this
-- keeps the grant visible in the file rather than only in the catalog).
REVOKE ALL ON FUNCTION public.get_lounge_quiz_card(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_lounge_quiz_card(uuid) TO authenticated, service_role;
