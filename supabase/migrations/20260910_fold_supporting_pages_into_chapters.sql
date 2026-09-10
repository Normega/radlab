-- radlab-academic. Fold supporting pages into their DSM chapter
-- (Norm, 2026-09-10). Applied via MCP apply_migration.
--
-- A student asked which readings were required and could not find pages the
-- quiz tests: 145 of 276 published PSY240 pages sat under a wiki-index
-- heading called "Contributed pages" -- below the disorder chapters and
-- reading, to a student, as optional work by other students. They are the
-- ingest pipeline's own concept and treatment pages, and the quizzes examine
-- them.
--
-- `disorders` is already the course CATALOGUE rather than a list of disorders
-- (it holds clinical-assessment, research-methods, what-is-abnormal as
-- tier='foundation'), so a catalogue row is how a page gets a placement.
--
-- WHICH pages get a chapter is decided by inbound links from catalogue pages,
-- and ONLY where exactly one chapter links them. That restraint is the point:
-- taking the most-linked chapter for pages that many chapters link produced
-- nonsense (cognitive-behavioral-therapy -> Personality Disorders on 15% of
-- its links; epidemiology -> Sexual Dysfunctions; insanity-defense-standards
-- -> Sleep-Wake). The signal is inverted -- a page many chapters link is
-- FOUNDATIONAL, not ambiguous -- so those stay out of the chapters and
-- surface under a renamed, promoted "Foundations & methods" section instead.
--
-- Source/provenance pages (the Bridley & Daffin module records and the named
-- study pages) are excluded; they are citations, not readings, and the index
-- now gives them their own "Sources" section.
--
-- tier='supporting' is new: inside a chapter but not a disorder, and the
-- index sorts these after the disorder entries.
--
-- Result: 59 pages folded across 15 chapters (Substance-Related +13,
-- Neurocognitive +8, Schizophrenia +5). 68 remain as Foundations & methods,
-- 18 as Sources. No page is left in a bucket that misdescribes it.
alter table disorders drop constraint disorders_tier_check;
alter table disorders add constraint disorders_tier_check
  check (tier = any (array['A','B','overview','foundation','supporting']));

with cid as (select '35e9842a-51a5-4f1e-aa5f-3a52f938196f'::uuid id),
contrib as (
  select w.id, w.slug, w.title
  from wiki_pages w, cid
  where w.course_id = cid.id and w.status = 'published'
    and w.type not in ('study')
    and w.slug not like 'fundamentals-psychological-disorders-module%'
    and not exists (select 1 from disorders d where d.slug = w.slug and d.course_id = cid.id)
),
inbound as (
  select c.id, c.slug, c.title, d.dsm_chapter, count(*) as links
  from contrib c
  join wiki_links l on l.target_page_id = c.id
  join wiki_pages src on src.id = l.source_page_id
  join disorders d on d.slug = src.slug and d.course_id = (select id from cid)
  where d.dsm_chapter is not null
  group by c.id, c.slug, c.title, d.dsm_chapter
),
only_one as (   -- exactly one chapter links it: an unambiguous home
  select id, slug, title, min(dsm_chapter) as dsm_chapter
  from inbound group by id, slug, title having count(*) = 1
)
insert into disorders (course_id, slug, title, dsm_chapter, tier, page_id)
select (select id from cid), o.slug, o.title, o.dsm_chapter, 'supporting', o.id
from only_one o
on conflict (course_id, slug) do nothing;
