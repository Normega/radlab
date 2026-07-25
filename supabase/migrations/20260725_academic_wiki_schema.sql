-- 20260725_academic_wiki_schema.sql
-- WP1 of the PSY240 Field Guide wiki (docs/markdowns/psy240_wiki_plan.md §4).
--
-- TARGET: the separate `radlab-academic` Supabase project, NOT the main radlab
-- project. It builds on 20260724_academic_init.sql (identity schema, courses,
-- enrollments, invites, ingest_jobs).
--
-- Creates the wiki's four tables — wiki_pages, wiki_page_versions, wiki_links,
-- disorders — plus the dsm_chapters lookup, all roster-gated through
-- enrollments.
--
-- RLS NOTE (project CLAUDE.md): RLS enabled with no matching policy silently
-- blocks every operation with no client-side error. Every table below is
-- deliberate about this — read policies are explicit, and the *absence* of
-- authenticated write policies is intentional and commented, following the
-- invites/ingest_jobs precedent in the init migration: all writes in WP1 go
-- through the serverless function's service role, which bypasses RLS. WP3's
-- review UI and WP6's student submission add authenticated write policies;
-- until then, an authenticated INSERT failing silently here is correct
-- behavior, not the bug that pattern warns about.

-- =====================================================================
-- 1. MEMBERSHIP HELPERS
-- =====================================================================
-- SECURITY DEFINER so policies can test enrollment without exposing
-- enrollments itself and without recursing through its own RLS. The init
-- migration inlined this EXISTS in ingest_jobs; with four more tables and
-- several policies each, a helper is worth the indirection.

create or replace function public.is_course_member(p_course_id uuid)
returns boolean
language sql
security definer
set search_path = public, identity
stable
as $$
  select exists (
    select 1 from public.enrollments e
    where e.person_id = public.current_person_id()
      and e.course_id = p_course_id
      and e.status = 'active'
  )
$$;

create or replace function public.is_course_staff(p_course_id uuid)
returns boolean
language sql
security definer
set search_path = public, identity
stable
as $$
  select exists (
    select 1 from public.enrollments e
    where e.person_id = public.current_person_id()
      and e.course_id = p_course_id
      and e.role in ('ta', 'instructor')
      and e.status = 'active'
  )
$$;

grant execute on function public.is_course_member(uuid) to authenticated;
grant execute on function public.is_course_staff(uuid) to authenticated;

-- =====================================================================
-- 2. DSM-5-TR CHAPTER LOOKUP
-- =====================================================================
-- Verified 2026-07-25 against the live PsychiatryOnline index — see
-- psy240_taxonomy.md §4. These slugs are HARVESTED, NEVER COMPUTED: five of
-- the nineteen are not the chapter title slugified (three truncations, one
-- retained hyphen, and x14's misspelling in APA's own DOI). Any code that
-- rebuilds a slug from a title will ship dead criteria links. Read this
-- column; do not regenerate it.
--
-- Per-chapter, not per-disorder, so it lives here rather than as a
-- disorders.dsm_chapter_doi column (the plan's WP1 line names that column;
-- taxonomy §4 flagged the lookup as the better shape — disorders.dsm_chapter
-- FKs to it and a join gets you the DOI without 123 copies of the string).

create table public.dsm_chapters (
  number     int primary key check (number between 1 and 20),
  title      text not null,
  doi_slug   text,          -- null = not yet verified (only ch. 20, untaught)
  taught     boolean not null default false
);

comment on column public.dsm_chapters.doi_slug is
  'DOI suffix after 10.1176/appi.books.9780890425787. Opaque identifier — harvested from the live index, never derived from the title.';

insert into public.dsm_chapters (number, title, doi_slug, taught) values
  (1,  'Neurodevelopmental Disorders',                        '.x01_Neurodevelopmental_Disorders',            true),
  (2,  'Schizophrenia Spectrum and Other Psychotic Disorders', '.x02_Schizophrenia_Spectrum',                  true),
  (3,  'Bipolar and Related Disorders',                        '.x03_Bipolar_and_Related_Disorders',           true),
  (4,  'Depressive Disorders',                                 '.x04_Depressive_Disorders',                    true),
  (5,  'Anxiety Disorders',                                    '.x05_Anxiety_Disorders',                       true),
  (6,  'Obsessive-Compulsive and Related Disorders',           '.x06_Obsessive_Compulsive_and_Related_Disorders', true),
  (7,  'Trauma- and Stressor-Related Disorders',               '.x07_Trauma_and_Stressor_Related_Disorders',   true),
  (8,  'Dissociative Disorders',                               '.x08_Dissociative_Disorders',                  true),
  (9,  'Somatic Symptom and Related Disorders',                '.x09_Somatic_Symptom_and_Related_Disorders',   true),
  (10, 'Feeding and Eating Disorders',                         '.x10_Feeding_and_Eating_Disorders',            true),
  (11, 'Elimination Disorders',                                '.x11_Elimination_Disorders',                   false),
  (12, 'Sleep-Wake Disorders',                                 '.x12_Sleep-Wake_Disorders',                    true),
  (13, 'Sexual Dysfunctions',                                  '.x13_Sexual_Dysfunctions',                     true),
  (14, 'Gender Dysphoria',                                     '.x14_Gender_Dysophoria',                       true),
  (15, 'Disruptive, Impulse-Control, and Conduct Disorders',   '.x15_Disruptive_Impulse_Control',              true),
  (16, 'Substance-Related and Addictive Disorders',            '.x16_Substance_Related_Disorders',             true),
  (17, 'Neurocognitive Disorders',                             '.x17_Neurocognitive_Disorders',                true),
  (18, 'Personality Disorders',                                '.x18_Personality_Disorders',                   true),
  (19, 'Paraphilic Disorders',                                 '.x19_Paraphilic_Disorders',                    true),
  (20, 'Other Mental Disorders',                               null,                                           false);

-- Front matter and the unnumbered chapter carry no x## prefix and are not
-- referenced by any disorder, so they are recorded here rather than stored:
--   .Introduction
--   .x00_Diagnostic_Classification              (DSM-5-TR Classification)
--   .Medication_Induced_Movement_Disorders      (no x## — breaks the ordinal rule)

alter table public.dsm_chapters enable row level security;

-- Reference data, no PII, useful to every reader.
create policy "read dsm chapters"
  on public.dsm_chapters for select
  to authenticated
  using (true);

-- =====================================================================
-- 3. WIKI PAGES
-- =====================================================================

create table public.wiki_pages (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  slug         text not null,   -- wikilink target: lowercase-with-dashes, no .md
  type         text not null check (type in
                 ('disorder', 'study', 'concept', 'treatment', 'debate', 'lecture', 'overview', 'foundation')),
  title        text not null,
  summary      text,            -- the ingest index's one_line_summary
  content      text,            -- markdown body (with YAML frontmatter, as the model emits it)
  status       text not null default 'proposed' check (status in
                 ('proposed', 'draft', 'published', 'archived')),
  current_version int not null default 1,
  created_by   uuid references identity.people (id),
  updated_by   uuid references identity.people (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,
  search_vector tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, ''))
  ) stored,
  unique (course_id, slug)
);

comment on column public.wiki_pages.status is
  'proposed = written by ingest, not yet reviewed; draft = accepted, being edited; published = visible to students; archived = withdrawn.';

create index wiki_pages_course_status_idx on public.wiki_pages (course_id, status);
create index wiki_pages_type_idx          on public.wiki_pages (course_id, type);
create index wiki_pages_search_idx        on public.wiki_pages using gin (search_vector);

alter table public.wiki_pages enable row level security;

-- Students see published pages for courses they are actively enrolled in.
create policy "members read published pages"
  on public.wiki_pages for select
  to authenticated
  using (status = 'published' and public.is_course_member(course_id));

-- Staff additionally see the unreviewed pipeline.
create policy "staff read all pages"
  on public.wiki_pages for select
  to authenticated
  using (public.is_course_staff(course_id));

-- No authenticated write policies by design — see the RLS NOTE at the top.

-- =====================================================================
-- 4. PAGE VERSIONS — history and proposals in one append-only table
-- =====================================================================
-- kind = 'accepted' → a snapshot of what the page actually said, written
--                     automatically by trigger on every content change.
-- kind = 'proposed' → an ingest output awaiting review. Never touches
--                     wiki_pages.content; WP3's review UI promotes it.
-- Keeping both in one table means the review UI diffs proposal against
-- current using the same shape, and the provenance (job_id) survives review.

create table public.wiki_page_versions (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.wiki_pages (id) on delete cascade,
  kind        text not null check (kind in ('accepted', 'proposed')),
  version     int,             -- set for 'accepted'; null for 'proposed'
  title       text,
  summary     text,
  content     text,
  action      text check (action in ('new', 'update')),  -- as the model labelled it
  job_id      uuid references public.ingest_jobs (id) on delete set null,
  created_by  uuid references identity.people (id),
  created_at  timestamptz not null default now(),
  review_status text not null default 'pending'
                check (review_status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references identity.people (id),
  reviewed_at timestamptz,
  constraint accepted_versions_numbered check (kind <> 'accepted' or version is not null)
);

create unique index wiki_page_versions_accepted_idx
  on public.wiki_page_versions (page_id, version) where kind = 'accepted';
create index wiki_page_versions_page_idx on public.wiki_page_versions (page_id, created_at desc);
create index wiki_page_versions_queue_idx
  on public.wiki_page_versions (review_status) where kind = 'proposed';

alter table public.wiki_page_versions enable row level security;

-- History is staff-facing. Students read pages, not the editorial record.
create policy "staff read versions"
  on public.wiki_page_versions for select
  to authenticated
  using (exists (
    select 1 from public.wiki_pages p
    where p.id = wiki_page_versions.page_id
      and public.is_course_staff(p.course_id)
  ));

-- Snapshot every substantive change to a page as an 'accepted' version.
create or replace function public.wiki_pages_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A page can exist as a shell (slug/title/summary, no content) while its
  -- first proposal is still in review. Nothing to snapshot until there is
  -- accepted content.
  if new.content is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.content is not distinct from old.content
     and new.title   is not distinct from old.title
     and new.summary is not distinct from old.summary then
    return new;
  end if;

  insert into public.wiki_page_versions
    (page_id, kind, version, title, summary, content, created_by, review_status)
  values
    (new.id, 'accepted', new.current_version, new.title, new.summary, new.content,
     new.updated_by, 'accepted');
  return new;
end;
$$;

create or replace function public.wiki_pages_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.content is not null
     and (new.content is distinct from old.content
          or new.title   is distinct from old.title
          or new.summary is distinct from old.summary) then
    -- Only bump once there is prior accepted content to supersede, so a
    -- shell page's first reviewed body is version 1 rather than version 2.
    if old.content is not null then
      new.current_version := old.current_version + 1;
    end if;
    new.updated_at := now();
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create trigger wiki_pages_touch_trg
  before update on public.wiki_pages
  for each row execute function public.wiki_pages_touch();

create trigger wiki_pages_snapshot_trg
  after insert or update on public.wiki_pages
  for each row execute function public.wiki_pages_snapshot();

-- =====================================================================
-- 5. WIKI LINKS — the graph, including links to pages that don't exist yet
-- =====================================================================
-- target_page_id null = an unresolved wikilink (a "red link"). Taxonomy §5's
-- whole argument for Tier B stubs is that these should be rare on day one;
-- this table is how we measure that rather than assume it.

create table public.wiki_links (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references public.courses (id) on delete cascade,
  source_page_id uuid not null references public.wiki_pages (id) on delete cascade,
  target_slug    text not null,
  target_page_id uuid references public.wiki_pages (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (source_page_id, target_slug)
);

create index wiki_links_target_idx     on public.wiki_links (target_page_id);
create index wiki_links_unresolved_idx on public.wiki_links (course_id, target_slug)
  where target_page_id is null;

alter table public.wiki_links enable row level security;

create policy "members read links"
  on public.wiki_links for select
  to authenticated
  using (public.is_course_member(course_id));

-- Resolve on write: stamp course_id from the source page and bind the target
-- if a page with that slug already exists.
create or replace function public.wiki_links_resolve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select p.course_id into new.course_id
  from public.wiki_pages p where p.id = new.source_page_id;

  select p.id into new.target_page_id
  from public.wiki_pages p
  where p.course_id = new.course_id and p.slug = new.target_slug;

  return new;
end;
$$;

create trigger wiki_links_resolve_trg
  before insert or update of target_slug, source_page_id on public.wiki_links
  for each row execute function public.wiki_links_resolve();

-- And resolve backwards: when a page appears (or is renamed), bind every
-- red link that was waiting for its slug.
create or replace function public.wiki_pages_bind_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wiki_links l
  set target_page_id = new.id
  where l.course_id = new.course_id
    and l.target_slug = new.slug
    and l.target_page_id is distinct from new.id;
  return new;
end;
$$;

create trigger wiki_pages_bind_links_trg
  after insert or update of slug on public.wiki_pages
  for each row execute function public.wiki_pages_bind_links();

-- Links are derived from accepted page content, so they are maintained here
-- rather than by whatever happens to be writing pages. Extracting them in the
-- serverless function instead would mean unreviewed proposals silently
-- entering the graph and skewing the red-link count that taxonomy §5's Tier B
-- argument rests on.
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

  -- [[slug]], [[slug|label]], [[slug#section]] — take the target only.
  select coalesce(array_agg(distinct t), '{}')
  into targets
  from (
    select regexp_replace(lower(trim(m[1])), '\.md$', '') as t
    from regexp_matches(new.content, '\[\[([^\]|#]+)', 'g') as m
  ) s
  where t <> '';

  delete from public.wiki_links
  where source_page_id = new.id and target_slug <> all (targets);

  insert into public.wiki_links (course_id, source_page_id, target_slug)
  select new.course_id, new.id, unnest(targets)
  on conflict (source_page_id, target_slug) do nothing;

  return new;
end;
$$;

create trigger wiki_pages_sync_links_trg
  after insert or update of content on public.wiki_pages
  for each row execute function public.sync_wiki_links();

-- =====================================================================
-- 6. DISORDERS — the DSM catalog / taxonomy seed
-- =====================================================================
-- Distinct from wiki_pages on purpose: a disorder is a domain entity that
-- exists in the taxonomy before any page is written about it (that is exactly
-- what the fall scope needs — 123 catalogued, 71 generated in August). page_id
-- is the optional link to the page once it exists.
--
-- Rows are seeded in WP3 from psy240_taxonomy.md §6. WP1 creates the shape and
-- seeds only dsm_chapters above, which is fully verified data.

create table public.disorders (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  slug         text not null,
  title        text not null,
  dsm_chapter  int references public.dsm_chapters (number),
  tier         text not null check (tier in ('A', 'B', 'overview', 'foundation')),
  lecture      int check (lecture between 1 and 11),
  tier_review_note text,   -- taxonomy §6's "†" close calls and rewrite-level flags
  page_id      uuid references public.wiki_pages (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (course_id, slug)
);

create index disorders_chapter_idx on public.disorders (course_id, dsm_chapter);
create index disorders_tier_idx    on public.disorders (course_id, tier);

alter table public.disorders enable row level security;

create policy "members read disorders"
  on public.disorders for select
  to authenticated
  using (public.is_course_member(course_id));

-- Convenience: the catalog with its criteria deep-link already assembled.
-- Uses the verified slug from dsm_chapters — never a computed one.
create view public.disorder_criteria_links as
select
  d.id,
  d.course_id,
  d.slug,
  d.title,
  d.tier,
  d.lecture,
  c.number as dsm_chapter,
  c.title  as dsm_chapter_title,
  case when c.doi_slug is null then null else
    'https://psychiatryonline-org.myaccess.library.utoronto.ca/doi/10.1176/appi.books.9780890425787'
    || c.doi_slug
  end as criteria_url
from public.disorders d
left join public.dsm_chapters c on c.number = d.dsm_chapter;

comment on view public.disorder_criteria_links is
  'Criteria deep-links via the U of T myaccess EZproxy host (confirmed working 2026-07-25). Links are for a student browser to follow — the wiki links criteria and never copies them (plan §2.1).';
