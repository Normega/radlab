-- Public courses + a reviewer-facing publish path (scope doc D2, ratified
-- 2026-08-25: PSY309's published pages are world-readable; students need a
-- radlab.zone login only for Lecture Lounge, never to read the textbook).
--
-- Two pieces:
--   1. `publish_page()` — the missing write primitive. `review_proposal` can
--      publish only what an ingest proposed, and the PSY240 corpus publish was
--      service-role SQL; PSY309's review flow is Norm stamping fresh-authored
--      drafts in the reader, so publishing needs a client-reachable,
--      staff-gated function in the unpublish_page mould.
--   2. `courses.is_public` + anon read policies. Published pages of a public
--      course (and their link graph + calendar) become readable without a
--      session. Drafts, gaps, reviews, events, and everything staff-side stay
--      exactly as gated as before — the new policies are additive ORs that
--      match only published content of public courses.
--
-- The policies are TO anon, authenticated: "public" includes signed-in users
-- of *other* courses (a PSY240 student reading the PSY309 guide), which the
-- old members-only policy would have blocked.

-- 1. publish_page --------------------------------------------------------
create or replace function public.publish_page(p_page_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'identity'
as $$
declare
  pg    public.wiki_pages%rowtype;
  actor uuid;
begin
  actor := public.current_person_id();
  if actor is null then
    raise exception 'no identity for caller';
  end if;

  select * into pg from public.wiki_pages where id = p_page_id;
  if not found then
    raise exception 'no such page %', p_page_id;
  end if;
  if not public.is_course_staff(pg.course_id) then
    raise exception 'not a TA or instructor on this course';
  end if;
  if pg.status = 'published' then
    raise exception 'page % is already published', pg.slug;
  end if;
  if pg.status = 'archived' then
    raise exception 'page % is archived — restore it before publishing', pg.slug;
  end if;
  if pg.content is null or btrim(pg.content) = '' then
    raise exception 'page % has no body — a shell cannot be published', pg.slug;
  end if;

  update public.wiki_pages
  set status = 'published',
      published_at = coalesce(published_at, now()),
      updated_by = actor
  where id = p_page_id;

  insert into public.wiki_page_events (page_id, event, reason, actor)
  values (p_page_id, 'published', nullif(btrim(coalesce(p_note, '')), ''), actor);

  return jsonb_build_object(
    'page_id', p_page_id, 'slug', pg.slug, 'status', 'published');
end;
$$;

do $$ begin
  revoke all on function public.publish_page(uuid, text) from public, anon;
  grant execute on function public.publish_page(uuid, text) to authenticated;
end $$;

-- 2. Public courses ------------------------------------------------------
alter table public.courses add column is_public boolean not null default false;
comment on column public.courses.is_public is
  'Published pages of a public course are world-readable (no session). D2, 2026-08-25.';

update public.courses set is_public = true where code = 'PSY309';

-- Anon must be able to resolve which courses are public (also the subquery
-- the other policies lean on — policies run as the caller, so this is the
-- policy that makes the others' EXISTS checks true).
create policy "anyone reads public courses"
  on public.courses for select
  to anon
  using (is_public);

create policy "anyone reads published pages of public courses"
  on public.wiki_pages for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (select 1 from public.courses c
                where c.id = wiki_pages.course_id and c.is_public)
  );

-- Link rows travel with their SOURCE page: a row is readable when the page it
-- annotates is readable. Backlink queries filter by target_page_id but join
-- the source page for display, so source-side gating covers both directions
-- without leaking edges out of unpublished drafts.
create policy "anyone reads links of published public pages"
  on public.wiki_links for select
  to anon, authenticated
  using (
    exists (select 1 from public.wiki_pages p
            join public.courses c on c.id = p.course_id
            where p.id = wiki_links.source_page_id
              and p.status = 'published' and c.is_public)
  );

-- The week-anchored reader's navigation: calendar + page↔lecture mapping.
create policy "anyone reads structure of public courses"
  on public.course_structure for select
  to anon, authenticated
  using (exists (select 1 from public.courses c
                 where c.id = course_structure.course_id and c.is_public));

create policy "anyone reads page lectures of public courses"
  on public.page_lectures for select
  to anon, authenticated
  using (exists (select 1 from public.courses c
                 where c.id = page_lectures.course_id and c.is_public));

-- Deliberately NOT opened to anon: page_gaps, page_reviews, page_reports,
-- wiki_page_versions, wiki_page_events, enrollments, and every staff surface.
-- The reader already renders empty-handed when those queries return nothing.
