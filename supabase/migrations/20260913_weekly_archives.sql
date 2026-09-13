-- main radlab. Archive listings for the Question of the Week and the weekly
-- quizzes (Norm, 2026-09-13). Applied via MCP apply_migration.
--
-- Both lounge cards deliberately surface ONE item: the current question, the
-- current quiz. That is right for a lobby and wrong for a term -- the moment
-- week 2 opens, week 1 disappears from the interface while remaining
-- answerable in the database until the midterm. The syllabus promises a grace
-- week and then a 75% late tier; 131 of 212 students had not finished Quiz 1
-- when this was written, and the card was about to stop showing it to them.
-- The policy was real and the interface was about to contradict it.
--
-- Both functions are SECURITY DEFINER for the same reason get_weekly_wall is:
-- a student may read only their OWN checkin_responses, so a per-question
-- answer count cannot be assembled client-side. Membership is checked inside.
--
-- Consumed by WeeklyArchive.jsx at /lounge/questions and /lounge/quizzes.

-- Every weekly wall a member may see, newest first. 'planned' is excluded:
-- an unopened question is not yet a question.
create or replace function get_weekly_walls(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from class_members cm
                 where cm.class_id = p_class_id and cm.user_id = v_uid) then
    raise exception 'not a member of this class';
  end if;

  return coalesce((
    select jsonb_agg(s.x order by s.opened_at desc nulls last)
    from (
      select jsonb_build_object(
               'id', c.id,
               'prompt', c.config->>'prompt_text',
               'status', c.status,
               'opened_at', c.opened_at,
               'closed_at', c.closed_at,
               'count', (select count(*) from checkin_responses r
                         where r.checkin_id = c.id and r.wall_removed_at is null),
               'answered', exists (select 1 from checkin_responses r
                                   where r.checkin_id = c.id and r.profile_id = v_uid
                                     and coalesce(btrim(r.prompt_response), '') <> '')
             ) as x,
             c.opened_at
      from checkins c
      join lectures l on l.id = c.lecture_id
      where l.class_id = p_class_id and c.kind = 'weekly' and c.status <> 'planned'
    ) s
  ), '[]'::jsonb);
end $$;

-- Every quiz that has opened, with this caller's standing on each. Mirrors
-- get_lounge_quiz_card's fields so the archive tile and the lobby card cannot
-- disagree about whether something is late.
create or replace function get_weekly_quizzes(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from class_members cm
                 where cm.class_id = p_class_id and cm.user_id = v_uid) then
    raise exception 'not a member of this class';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', w.id,
             'week_no', w.week_no,
             'title', w.title,
             'opens_at', w.opens_at,
             'due_at', w.due_at,
             'hard_close_at', weekly_quiz_effective_close(w, v_uid),
             'total', jsonb_array_length(w.items),
             'answered', (select count(*) from weekly_quiz_answers a
                          where a.quiz_id = w.id and a.profile_id = v_uid),
             'completed_at', (select c.completed_at from weekly_quiz_completions c
                              where c.quiz_id = w.id and c.profile_id = v_uid)
           ) order by w.week_no)
    from weekly_quizzes w
    where w.class_id = p_class_id and w.opens_at <= now()
  ), '[]'::jsonb);
end $$;

revoke execute on function get_weekly_walls(uuid) from public, anon;
revoke execute on function get_weekly_quizzes(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Data, run once alongside the above: the ten remaining PSY240 Questions of
-- the Week. Drafted 2026-09-04 (QOTW_drafts_2026-09-04.md on the Teaching
-- drive) and never loaded, which is why only week 1 existed while PSY309
-- already held nine planned. 'planned' keeps them invisible to students until
-- opened from the console.
--
-- Matched on lecture NUMBER, not the draft file's own numbering: the deck
-- files skip L6 (midterm week), so from L7 on the file number runs one ahead
-- of the lecture it belongs to.
-- ---------------------------------------------------------------------------
insert into checkins (lecture_id, kind, status, position, config)
select l.id, 'weekly', 'planned', 99,
       jsonb_build_object('activities', jsonb_build_array('prompt'), 'prompt_text', v.q)
from (values
 (2,  $q$If a diagnosis had to give one up, which should it keep — clinicians who agree (reliability) or a category that's real (validity)? Why?$q$),
 (3,  $q$One emotion, seven disorders: is splitting anxiety this finely helping patients or just helping the manual? Why?$q$),
 (4,  $q$PTSD is the rare diagnosis that names its cause. Should more disorders be defined by what happened to the person — or fewer? Why?$q$),
 (5,  $q$One manic episode is enough for a bipolar I diagnosis for life. Fair rule or not — and why?$q$),
 (7,  $q$"No distress, no diagnosis." Is that the right rule for sexual behaviour — and where, if anywhere, does it break down?$q$),
 (8,  $q$Culture clearly shapes eating disorders. Does that make them any less biological — or any less real? Why?$q$),
 (9,  $q$Where is your line between wanting something a lot and addiction — and does your line survive being applied to your phone? Why?$q$),
 (10, $q$Is neurodiversity a difference to accommodate or a condition to treat — and does your answer hold across everything we covered this week? Why?$q$),
 (11, $q$If the disorder is the person's pattern, how responsible is the person for the pattern? Why?$q$),
 (12, $q$Plenty of people hear voices and never need care. What should tip an experience into an illness — and why?$q$)
) as v(num, q)
join lectures l on l.number = v.num
join classes cl on cl.id = l.class_id and cl.slug = 'psy240'
where not exists (select 1 from checkins c where c.lecture_id = l.id and c.kind = 'weekly');
