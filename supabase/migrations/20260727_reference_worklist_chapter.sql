-- 20260727_reference_worklist_chapter.sql
-- TARGET: radlab-academic.
--
-- The reference-mode target picker is a flat list of 121 catalogue pages, which
-- is hard to navigate and easy to mis-select — and it is driven ~15 times during
-- the WP4 content sprint, once per textbook module.
--
-- Grouping by DSM-5-TR chapter matches how the sprint actually runs: one
-- Bridley & Daffin module corresponds to one DSM chapter, so "I am ingesting
-- Module 4" becomes "show me the Bipolar and Depressive pages". Adds the
-- chapter title (and a sort key) so the UI can build <optgroup>s without a
-- second query.

drop view if exists public.reference_worklist;

create view public.reference_worklist
with (security_invoker = true) as
select
  g.course_id,
  g.slug,
  g.title,
  g.tier,
  g.lecture,
  g.dsm_chapter,
  -- Foundations carry no DSM chapter; give them a stable bucket that sorts last
  -- rather than a null that scatters.
  coalesce(c.title, 'Foundations & course-wide') as chapter_title,
  coalesce(g.dsm_chapter, 99) as chapter_sort,
  g.state,
  g.needs,
  cardinality(g.needs) as gap_count,
  (select count(*) from public.ingest_jobs j
    where j.course_id = g.course_id and j.source_type = 'reference'
      and j.target_slug = g.slug and j.status = 'done') as reference_runs
from public.wiki_gap_report g
left join public.dsm_chapters c on c.number = g.dsm_chapter
where g.state <> 'complete'
order by
  coalesce(g.dsm_chapter, 99),
  case g.tier when 'overview' then 0 when 'A' then 1 when 'foundation' then 2 else 3 end,
  g.slug;

comment on view public.reference_worklist is
  'WP4 content-sprint queue: catalogue pages still missing or incomplete, grouped by DSM-5-TR chapter (overview first, then Tier A, then B) with the count of reference runs already attempted per page.';
