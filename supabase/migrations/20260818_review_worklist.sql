-- The pre-publish read, made into a queue (run plan §38.4). One RPC returns
-- every page in risk order with its stamp state, so the reader never decides
-- what to read next — open the top unreviewed page, read, stamp, repeat.
--
-- Risk bands, per §38.4 with the red set's history folded in:
--   1  pages that ever carried a red gap, plus the named safety/legal set —
--      clinical instruction and legal standards, where a wrong sentence
--      costs the most (the red gaps are closed; the pages still get first read)
--   2  heavy pages — 6+ open gaps, the most student-exposed scaffolding
--   3  tier A and foundation pages — highest readership
--   4  everything else
-- Within a band, most open gaps first.
--
-- reviewed_current means: the latest clear stamp is for the page's current
-- version. An edit after a stamp drops the page back into the queue, which is
-- exactly what staleness should do.

create or replace function public.review_worklist(p_course_id uuid)
returns table (
  slug text, title text, page_type text, tier text,
  open_gaps bigint, risk_band int,
  reviewed_current boolean, last_verdict text, last_reviewed_at timestamptz
)
language sql stable security definer
set search_path to 'public', 'identity'
as $$
  with gaps as (
    select page_id,
           count(*) filter (where status = 'open') as open_gaps,
           bool_or(difficulty = 'red') as ever_red
    from page_gaps group by page_id
  ),
  stamps as (
    select distinct on (page_id) page_id, verdict, version, reviewed_at
    from page_reviews order by page_id, reviewed_at desc
  )
  select p.slug, p.title, p.type, d.tier,
         coalesce(g.open_gaps, 0),
         case
           when coalesce(g.ever_red, false)
             or p.slug in ('law-and-ethics', 'student-support-resources',
                           'suicide-and-self-harm', 'tarasoff-duty-to-warn',
                           'insanity-defense-standards') then 1
           when coalesce(g.open_gaps, 0) >= 6 then 2
           when d.tier in ('A', 'foundation') then 3
           else 4
         end as risk_band,
         coalesce(s.verdict = 'clear' and s.version >= p.current_version, false),
         s.verdict, s.reviewed_at
  from wiki_pages p
  left join gaps g on g.page_id = p.id
  left join disorders d on d.slug = p.slug
  left join stamps s on s.page_id = p.id
  where p.course_id = p_course_id
    and p.content is not null
    and is_course_staff(p_course_id)
  order by 6, 5 desc, 1
$$;

revoke all on function public.review_worklist(uuid) from public, anon;
grant execute on function public.review_worklist(uuid) to authenticated;
