-- radlab-academic. Concepts and Methods becomes a chapter in its own right
-- (Norm, 2026-09-10). Applied via MCP apply_migration.
--
-- The earlier fold left a mess: the 68 cross-cutting pages surfaced as a
-- section called "Foundations & methods" sitting NEXT TO an existing
-- catalogue chapter 0 called "Foundations" (14 pages: what-is-abnormal,
-- historical-traditions, clinical-assessment, research-methods...). Two
-- foundations-shaped things on one page, which is worse than the single
-- wrong bucket it replaced.
--
-- They are the same chapter. Giving the 68 a catalogue row with a null
-- dsm_chapter merges them into chapter 0, which already renders as a proper
-- chapter band with an icon and a fold control -- so Concepts and Methods
-- stops being a leftovers bin and becomes the first chapter of the textbook,
-- which is what it always was.
--
-- 68 pages: 44 concept, 20 treatment, 4 debate. tier='supporting' keeps them
-- sorted after the 14 tier='foundation' entries, so the chapter opens with
-- what "abnormal" means and research methods rather than with acceptance and
-- commitment therapy.
--
-- Source/provenance pages stay out: they are citations, and the index lists
-- them separately under "Sources". After this, chapter 0 holds 82 pages and
-- exactly 18 published pages sit outside the catalogue -- all of them
-- sources.
with cid as (select '35e9842a-51a5-4f1e-aa5f-3a52f938196f'::uuid id)
insert into disorders (course_id, slug, title, dsm_chapter, tier, page_id)
select cid.id, w.slug, w.title, null, 'supporting', w.id
from wiki_pages w, cid
where w.course_id = cid.id
  and w.status = 'published'
  and w.type <> 'study'
  and w.slug not like 'fundamentals-psychological-disorders-module%'
  and not exists (select 1 from disorders d where d.slug = w.slug and d.course_id = cid.id)
on conflict (course_id, slug) do nothing;
