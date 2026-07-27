-- ============================================================
-- WP3 review UNDO — put every reviewed proposal back to pending
-- and strip the content it published. radlab-academic project.
--
-- WHY THIS EXISTS: the 26 proposals in the queue came from three real
-- papers and are the actual course content. Reviewing is one-way —
-- review_proposal() refuses anything not 'pending', so a mis-reject
-- cannot be re-reviewed and a mis-accept has no unpublish button.
-- Test drives would otherwise consume real material.
--
-- WHAT IT DOES NOT DO: it never deletes a proposal. Bodies are
-- untouched; only review verdicts and the content they promoted are
-- rolled back. Ingest jobs are untouched.
--
-- SAFETY: run inside the BEGIN/ROLLBACK as written first to see the
-- counts. Only when they look right, delete the BEGIN/ROLLBACK lines
-- (or change ROLLBACK to COMMIT) and run again for real.
--
-- ⚠ Do NOT run this after real review work you want to keep — it
-- reverts genuine decisions just as readily as test ones.
-- ============================================================

BEGIN;

-- 1. Verdicts back to pending.
update public.wiki_page_versions
set review_status = 'pending', reviewed_by = null, reviewed_at = null
where kind = 'proposed' and review_status in ('accepted', 'rejected');

-- 2. Drop the accepted snapshots those acceptances generated.
delete from public.wiki_page_versions where kind = 'accepted';

-- 3. Strip promoted content and return pages to shells. This fires
--    sync_wiki_links (which clears that page's links, since content is
--    null) and skips the snapshot trigger (which returns early on null
--    content), so the derived state cleans itself up.
update public.wiki_pages
set content = null, status = 'proposed', current_version = 1, published_at = null
where content is not null;

-- 4. Belt and braces: any link left behind by a page that no longer has
--    a body.
delete from public.wiki_links l
where not exists (
  select 1 from public.wiki_pages p
  where p.id = l.source_page_id and p.content is not null
);

select 'proposals now pending' as check, count(*)::text as value
  from public.wiki_page_versions where kind = 'proposed' and review_status = 'pending'
union all select 'accepted snapshots left', count(*)::text
  from public.wiki_page_versions where kind = 'accepted'
union all select 'pages with a body', count(*)::text
  from public.wiki_pages where content is not null
union all select 'published pages', count(*)::text
  from public.wiki_pages where status = 'published'
union all select 'wikilinks', count(*)::text from public.wiki_links
order by 1;

ROLLBACK;   -- ← change to COMMIT (or delete BEGIN/ROLLBACK) to apply for real
