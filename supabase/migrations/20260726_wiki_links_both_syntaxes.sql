-- 20260726_wiki_links_both_syntaxes.sql
-- TARGET: radlab-academic.
--
-- sync_wiki_links() only matched [[wikilink]] syntax. The model does not use
-- it consistently: measured across the 26 proposals in the queue,
--
--   action=new     22 proposals — 11 use [[...]], 5 use [text](slug.md) ONLY
--   action=update   4 proposals —  0 use [[...]], 4 use [text](slug.md) ONLY
--
-- so 9 of 26 pages would have contributed nothing to the link graph, with no
-- error anywhere. That matters more than it sounds: backlinks and the
-- red-link count are what taxonomy §5's Tier B argument is measured against,
-- and a silently empty graph reads exactly like a well-connected one.
--
-- Caught 2026-07-26 when an accepted `update` proposal produced a page with
-- three obvious internal references and zero rows in wiki_links.
--
-- Fix: extract both syntaxes. Matching markdown links is deliberately narrow —
-- only relative targets ending in .md, so external URLs and image embeds are
-- ignored:
--     [[slug]] [[slug|label]] [[slug#section]]      → slug
--     [label](slug.md)  [label](slug.md#section)    → slug
-- Anything with a scheme (http:, mailto:) or a path separator is skipped.

create or replace function public.sync_wiki_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  targets text[];
begin
  if new.content is null then
    delete from public.wiki_links where source_page_id = new.id;
    return new;
  end if;

  select coalesce(array_agg(distinct t), '{}')
  into targets
  from (
    -- [[wikilink]] form
    select regexp_replace(lower(trim(m[1])), '\.md$', '') as t
    from regexp_matches(new.content, '\[\[([^\]|#]+)', 'g') as m
    union
    -- [label](slug.md) form — relative .md targets only
    select regexp_replace(lower(trim(m2[1])), '\.md$', '') as t
    from regexp_matches(new.content, '\]\(([^)\s#]+\.md)', 'g') as m2
  ) s
  where t <> ''
    and t not like '%:%'    -- no http:, mailto:, etc.
    and t not like '%/%';   -- no paths; wiki slugs are flat

  delete from public.wiki_links
  where source_page_id = new.id and target_slug <> all (targets);

  insert into public.wiki_links (course_id, source_page_id, target_slug)
  select new.course_id, new.id, unnest(targets)
  on conflict (source_page_id, target_slug) do nothing;

  return new;
end;
$$;

-- Backfill: re-run extraction over every page that already has accepted
-- content. The trigger fires on UPDATE OF content, so touching content with
-- its own value is enough to re-derive the links.
update public.wiki_pages set content = content where content is not null;
