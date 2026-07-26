-- 20260726_wiki_page_needs.sql
-- TARGET: radlab-academic.
--
-- Disorder pages now declare their own gaps. The ingest prompt requires six
-- fixed H2 sections (Presentation / Diagnosis / Epidemiology / Etiology /
-- Treatment / Contested) and a frontmatter list naming the ones the source
-- could not support:
--
--     needs: [diagnosis, etiology, epidemiology]
--
-- This parses that list into a column so "what is the wiki missing" is a query
-- rather than a reading exercise. The WP4 ingest worklist and the list of
-- topics to assign students are the same data.
--
-- Why it exists: reviewing the first 26 proposals, both disorder pages came out
-- of psychotherapy-efficacy papers and were therefore entirely treatment-shaped
-- — no diagnosis, no etiology, and nothing indicating either was absent. A page
-- that silently omits etiology is indistinguishable from one where etiology is
-- settled. (Norm, 2026-07-26.)

alter table public.wiki_pages add column if not exists needs text[] not null default '{}';

comment on column public.wiki_pages.needs is
  'Sections the page declares it lacks, parsed from the frontmatter `needs:` list. Empty for page types that do not use the disorder skeleton.';

-- Parse `needs: [a, b, c]` out of the frontmatter. Tolerates quotes and spacing.
create or replace function public.extract_page_needs(md text)
returns text[]
language sql
immutable
as $$
  select coalesce((
    select array_agg(distinct n order by n)
    from unnest(
      string_to_array((regexp_match(md, 'needs:\s*\[([^\]]*)\]'))[1], ',')
    ) as raw,
    lateral (select btrim(lower(btrim(raw)), '"''')) as v(n)
    where n <> ''
  ), '{}'::text[])
$$;

create or replace function public.set_page_needs()
returns trigger
language plpgsql
as $$
begin
  new.needs := case when new.content is null then '{}'::text[]
                    else public.extract_page_needs(new.content) end;
  return new;
end;
$$;

create trigger wiki_pages_set_needs_trg
  before insert or update of content on public.wiki_pages
  for each row execute function public.set_page_needs();

-- Backfill (no-op for existing pages, which predate the skeleton — they will
-- pick up needs when their next proposal is accepted).
update public.wiki_pages set content = content where content is not null;

-- Surface gaps on the shelf. Dropped rather than replaced: CREATE OR REPLACE
-- VIEW cannot insert a column mid-list, and `needs` belongs next to the other
-- page facts rather than bolted on the end.
drop view if exists public.wiki_page_shelf;
create view public.wiki_page_shelf
with (security_invoker = true) as
select
  p.id as page_id,
  p.course_id,
  p.slug,
  p.type,
  p.title,
  p.status,
  p.current_version,
  length(p.content) as body_length,
  p.needs,
  cardinality(p.needs) as gap_count,
  p.published_at,
  p.updated_at,
  (select count(*) from public.wiki_links l where l.source_page_id = p.id) as outbound_links,
  (select count(*) from public.wiki_links l where l.target_page_id = p.id) as backlinks,
  (select count(*) from public.wiki_page_versions v
    where v.page_id = p.id and v.kind = 'proposed' and v.review_status = 'pending') as pending_proposals,
  (select e.reason from public.wiki_page_events e
    where e.page_id = p.id and e.event = 'unpublished'
    order by e.created_at desc limit 1) as last_unpublish_reason
from public.wiki_pages p
where p.content is not null;

-- The gap report: which catalogued disorders still need what. Drives the WP4
-- worklist and doubles as the student assignment list.
create or replace view public.wiki_gap_report
with (security_invoker = true) as
select
  d.course_id,
  d.slug,
  d.title,
  d.tier,
  d.lecture,
  d.dsm_chapter,
  case
    when p.id is null            then 'no page yet'
    when p.content is null       then 'shell only — nothing reviewed'
    when cardinality(p.needs) = 0 then 'complete'
    else 'gaps'
  end as state,
  coalesce(p.needs, '{}') as needs,
  p.status as page_status
from public.disorders d
left join public.wiki_pages p on p.course_id = d.course_id and p.slug = d.slug;

comment on view public.wiki_gap_report is
  'Every catalogued page and what it still lacks. "no page yet" = never ingested; "shell only" = proposed but unreviewed; "gaps" = reviewed but self-declared incomplete sections.';
