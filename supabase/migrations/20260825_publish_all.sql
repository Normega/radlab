-- The publish (run plan §38.3 Phase E), 2026-08-25.
--
-- All at once, not page by page: wiki_links is member-readable while an
-- unpublished target is not, so a partially published corpus renders every
-- outbound link to a draft as broken to a student. 268 pages went live in one
-- transaction; 2 archived duplicates (abnormal-behavior, classification-systems,
-- superseded in July) were correctly left out.
--
-- Preconditions verified before running: 0 red links, 0 pages under 200 chars,
-- and every page carrying a `clear` page_reviews stamp at its current version —
-- the stamp gate from §39.12.8, which also makes the whole corpus item-eligible
-- for test authoring as of this date.
update wiki_pages
set status = 'published',
    published_at = coalesce(published_at, now())
where course_id = '35e9842a-51a5-4f1e-aa5f-3a52f938196f'
  and status = 'draft'
  and content is not null
  and exists (select 1 from page_reviews v
              where v.page_id = wiki_pages.id
                and v.verdict = 'clear'
                and v.version >= wiki_pages.current_version);
