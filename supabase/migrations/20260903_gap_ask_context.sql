-- A gap's ask is often a FRAGMENT of a longer annotation.
--
-- The detector splits a "Needs research:" sentence on its semicolons, so one
-- annotation becomes several gaps and the tail pieces arrive as orphans. On
-- bipolar-i-disorder the page says:
--
--   > **Needs research:** the bipolar-spectrum debate — whether subthreshold
--   > presentations belong inside the category…; overdiagnosis versus
--   > underdiagnosis…; and Canadian diagnostic-delay data.
--
-- which became three gaps, the third of them "and Canadian diagnostic-delay
-- data." — real text, findable verbatim in the page, and unintelligible
-- standing alone. A student choosing it off the board cannot tell what is
-- wanted. 164 of 741 open gaps (22%) begin mid-sentence this way.
--
-- Rather than rewrite 741 asks — inventing wording that 199 students would act
-- on, and that nobody has reviewed — keep the sentence each fragment came from
-- and show the ask inside it. ask_context is the page's own line, recovered
-- mechanically; nothing here is authored.

alter table page_gaps add column if not exists ask_context text;

with located as (
  select gp.id, p.content, position(gp.ask in p.content) as pos
  from page_gaps gp
  join wiki_pages p on p.id = gp.page_id
  where gp.ask is not null and length(gp.ask) > 8
    and position(gp.ask in p.content) > 0
), bounds as (
  select id, content, pos,
    greatest(1, length(left(content, pos - 1))
                - coalesce(nullif(strpos(reverse(left(content, pos - 1)), chr(10)), 0), length(content))
                + 2) as line_start,
    pos + coalesce(nullif(strpos(substring(content from pos), chr(10)), 0),
                   length(content) - pos + 1) - 1 as line_end
  from located
)
update page_gaps g
set ask_context = btrim(substring(b.content from b.line_start for b.line_end - b.line_start + 1))
from bounds b
where g.id = b.id
  -- An annotation is a sentence or two. Anything outside this band means the
  -- match landed somewhere unintended, so no context is better than wrong
  -- context.
  and b.line_end - b.line_start + 1 between 20 and 1200;

comment on column page_gaps.ask_context is
  'The page line the ask was extracted from, shown to students so a fragmented ask reads in context. Mechanically recovered, never authored.';

-- gap_board carries it through to the board.
drop function if exists public.gap_board();

create or replace function public.gap_board()
returns table(lecture_no integer, week_no integer, meeting_date date, lecture_title text,
              gap_id uuid, slug text, page_title text, section text, ask text, ask_context text,
              difficulty text, capacity integer, claims_active bigint, remaining integer,
              my_status text, my_claim_id uuid, my_expires_at timestamp with time zone)
language sql stable security definer
set search_path = public
as $function$
  select cs.lecture_no, cs.week_no, cs.meeting_date, cs.title,
         g.id, g.slug, p.title, g.section, g.ask, g.ask_context,
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
