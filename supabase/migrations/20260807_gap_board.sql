-- 20260807_gap_board.sql
--
-- gap_board(): the one read the student gap browser makes (WP6 Phase B).
--
-- Why a SECURITY DEFINER function and not a view: remaining capacity is
-- capacity minus ALL students' active claims, but gap_claims RLS lets a
-- student read only their own rows. A security_invoker view would silently
-- under-count (the nested-RLS lesson from 20260806_staff_read_enrolled_people:
-- a predicate reading an RLS-protected table returns too little, not an
-- error), and a definer VIEW is against house rules. So: a definer function,
-- gated inside by is_course_member(), returning aggregate counts only — no
-- row ever says who holds a claim, only how many do.
--
-- `my_status` is the caller's own claim state (their rows are theirs to see);
-- `withdrawn` is excluded everywhere — a withdrawn claim frees its slot, which
-- is also how the future 14-day claim TTL will release abandoned holds without
-- this function changing.
--
-- Red gaps ARE returned. The browser dims them and labels them staff-only
-- rather than hiding them — the board should be honest about why a student
-- cannot take them, and precheck blocks them server-side regardless.

create or replace function public.gap_board()
returns table(
  lecture_no    int,
  week_no       int,
  meeting_date  date,
  lecture_title text,
  gap_id        uuid,
  slug          text,
  page_title    text,
  section       text,
  ask           text,
  difficulty    text,
  capacity      int,
  claims_active bigint,
  remaining     int,
  my_status     text
)
language sql stable security definer set search_path to 'public'
as $$
  select cs.lecture_no, cs.week_no, cs.meeting_date, cs.title,
         g.id, g.slug, p.title, g.section, g.ask,
         g.difficulty, g.capacity,
         coalesce(held.n, 0),
         greatest(g.capacity - coalesce(held.n, 0)::int, 0),
         mine.status
  from page_gaps g
  join wiki_pages p    on p.id = g.page_id
  join page_lectures pl on pl.page_id = p.id
  join course_structure cs
    on cs.course_id = pl.course_id and cs.lecture_no = pl.lecture_no
  left join lateral (
    select count(*) as n
    from gap_claims x
    where x.gap_id = g.id
      and x.status in ('claimed','submitted','accepted')
  ) held on true
  left join lateral (
    select x.status
    from gap_claims x
    where x.gap_id = g.id
      and x.person_id = current_person_id()
      and x.status <> 'withdrawn'
    limit 1
  ) mine on true
  where g.status = 'open'
    and is_course_member(g.course_id)
  order by cs.week_no,
           case g.difficulty when 'green' then 0 when 'amber' then 1 else 2 end,
           g.slug, g.section nulls first
$$;

grant execute on function public.gap_board() to authenticated;
