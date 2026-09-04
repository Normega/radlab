-- Gap asks that read as full sentences.
--
-- Showing a fragment inside the line it came from (20260903_gap_ask_context)
-- pointed at the confusing part without explaining it. The description itself
-- has to stand alone.
--
-- It cannot simply be edited in place: page_gaps.ask is IDENTITY. Gaps are
-- keyed on (page_id, md5(lower(ask))) and REGENERATED from the page prose, so
-- rewriting ask would be undone by the next detection run — the original
-- fragment re-inserted, the rewrite orphaned, and any claim attached to it
-- stranded. ask_display is therefore a separate, human-facing field the
-- detector never owns: the same gap, said properly.
--
-- ask_display_note marks the ones a rewrite could not rescue, for a human pass.
--
-- Every student-facing surface reads coalesce(ask_display, ask), so the board
-- and the wiki page degrade to the original text wherever a rewrite is absent.

alter table page_gaps add column if not exists ask_display text;
alter table page_gaps add column if not exists ask_display_note text;

comment on column page_gaps.ask_display is
  'Student-facing rewrite of ask as a self-contained sentence. Derived from ask + ask_context + page/section only; never invents scope. NULL means ask already stands alone.';
comment on column page_gaps.ask_display_note is
  'Set when a fragment could not be made self-contained from its context — needs a human copy pass.';

drop function if exists public.gap_board();

create or replace function public.gap_board()
returns table(lecture_no integer, week_no integer, meeting_date date, lecture_title text,
              gap_id uuid, slug text, page_title text, section text, ask text,
              difficulty text, capacity integer, claims_active bigint, remaining integer,
              my_status text, my_claim_id uuid, my_expires_at timestamp with time zone)
language sql stable security definer
set search_path = public
as $function$
  select cs.lecture_no, cs.week_no, cs.meeting_date, cs.title,
         g.id, g.slug, p.title, g.section,
         coalesce(nullif(btrim(g.ask_display), ''), g.ask),
         g.difficulty, g.capacity,
         coalesce(held.n, 0),
         greatest(g.capacity - coalesce(held.n, 0)::int, 0),
         mine.status, mine.id, mine.expires_at
  from page_gaps g
  join wiki_pages p    on p.id = g.page_id
  join page_lectures pl on pl.page_id = p.id
  join course_structure cs
    on cs.course_id = pl.course_id and cs.lecture_no = pl.lecture_no
  left join lateral (
    select count(*) as n
    from gap_claims x
    where x.gap_id = g.id
      and (x.status in ('submitted','accepted')
           or (x.status = 'claimed' and (x.expires_at is null or x.expires_at > now())))
  ) held on true
  left join lateral (
    select x.id, x.status, x.expires_at
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
$function$;
