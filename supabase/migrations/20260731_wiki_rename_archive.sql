-- 20260731_wiki_rename_archive.sql
-- TARGET: radlab-academic.
--
-- Two more staff write paths, prompted by the first paper-mode foundations run.
-- Module 01 produced `abnormal-behavior` where the catalogue says
-- `what-is-abnormal`; the content was good, only the slug was wrong, and the
-- page had already been accepted. With no way to rename, the only remedies were
-- to leave a duplicate in the wiki or to burn a whole module re-read producing
-- content we already had.
--
--   rename_page(page_id, new_slug, new_title)  — put a page at the right slug
--   archive_page(page_id, reason)              — retire a page
--   restore_page(page_id, reason)              — undo an archive
--
-- Same shape as review_proposal / unpublish_page / edit_page: SECURITY DEFINER
-- with an internal staff check, so `wiki_pages` still has no authenticated write
-- policies and every write to it remains an audited function.
--
-- ── Why rename rather than delete ───────────────────────────────────────
--
-- Deleting loses the version history and the provenance chain, and turns every
-- inbound wikilink into a pointer at nothing. Renaming keeps the content, the
-- history and the attribution, and — because `wiki_pages` has triggers on
-- UPDATE OF slug — rebinds the link graph and the catalogue row automatically.
--
-- ── The bit the existing triggers get wrong ─────────────────────────────
--
-- `wiki_pages_bind_links()` only ever BINDS: it sets target_page_id on links
-- whose target_slug matches the NEW slug. It never unbinds links that pointed at
-- the OLD one, so after a rename those rows would still claim to resolve to this
-- page while naming a slug that no longer exists — `wiki_links` would report a
-- healthy graph while the reader, which resolves through the slug map, showed a
-- dead link. `link_disorder_page()` has the identical gap on `disorders.page_id`.
--
-- Rather than change two triggers used by other paths, rename_page cleans up
-- after itself explicitly and *reports what it orphaned*, so a rename that
-- breaks three inbound links says so instead of leaving it to be discovered.
-- Orphaned links become honest red links: the slug they name really is gone.

-- Events gain the two new verbs. 'renamed' records old -> new in `reason`, so
-- publish / unpublish / archive / rename read as one history per page.
alter table public.wiki_page_events
  drop constraint if exists wiki_page_events_event_check;

alter table public.wiki_page_events
  add constraint wiki_page_events_event_check
  check (event in ('published', 'unpublished', 'archived', 'restored', 'renamed'));

-- ── rename_page ─────────────────────────────────────────────────────────

create or replace function public.rename_page(
  p_page_id   uuid,
  p_new_slug  text,
  p_new_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, identity
as $$
declare
  pg        public.wiki_pages%rowtype;
  actor     uuid;
  old_slug  text;
  new_slug  text;
  orphaned  int;
  unlinked  int;
  linked    int;
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

  new_slug := lower(btrim(coalesce(p_new_slug, '')));
  -- Exactly the shape a wikilink can name: lowercase, hyphen-separated, no
  -- scheme and no path separator. A slug outside this can never be linked to.
  if new_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception
      'invalid slug %: use lowercase words separated by single hyphens, with no spaces, slashes or colons',
      p_new_slug;
  end if;

  old_slug := pg.slug;
  if new_slug = old_slug then
    raise exception 'page is already at slug %', old_slug;
  end if;

  if exists (select 1 from public.wiki_pages
              where course_id = pg.course_id and slug = new_slug) then
    raise exception
      'another page in this course already uses slug % — merge them instead of renaming onto it',
      new_slug;
  end if;

  update public.wiki_pages
  set slug = new_slug,
      title = coalesce(nullif(btrim(coalesce(p_new_title, '')), ''), title),
      updated_by = actor
  where id = p_page_id;
  -- Triggers have now bound links naming the NEW slug, and pointed any
  -- catalogue row with that slug at this page.

  -- Links that named the OLD slug are no longer satisfied by this page.
  update public.wiki_links
  set target_page_id = null
  where target_page_id = p_page_id and target_slug <> new_slug;
  get diagnostics orphaned = row_count;

  -- Likewise the catalogue: a row still pointing here under the old slug.
  update public.disorders
  set page_id = null
  where page_id = p_page_id and slug <> new_slug;
  get diagnostics unlinked = row_count;

  select count(*) into linked
  from public.disorders where page_id = p_page_id;

  insert into public.wiki_page_events (page_id, event, reason, actor)
  values (p_page_id, 'renamed', format('%s -> %s', old_slug, new_slug), actor);

  return jsonb_build_object(
    'page_id',           p_page_id,
    'old_slug',          old_slug,
    'slug',              new_slug,
    'title',             (select title from public.wiki_pages where id = p_page_id),
    'inbound_orphaned',  orphaned,   -- links that named the old slug: now red
    'catalogue_unlinked', unlinked,  -- catalogue rows released
    'catalogue_linked',  linked      -- catalogue rows now pointing here
  );
end;
$$;

comment on function public.rename_page(uuid, text, text) is
  'Move a page to a different slug, keeping content, history and provenance. Rebinds the link graph and catalogue row, and unbinds what named the old slug — reporting how many inbound links were orphaned, since those become red links.';

-- ── archive_page / restore_page ─────────────────────────────────────────
-- `archived` was already in the status CHECK and api/ingest.js already excludes
-- archived pages from the wiki index it shows the model — the concept existed,
-- there was just no way to reach it. Archiving is therefore how a page stops
-- advertising itself to future ingests as well as to students.

create or replace function public.archive_page(p_page_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, identity
as $$
declare
  pg    public.wiki_pages%rowtype;
  actor uuid;
begin
  actor := public.current_person_id();
  if actor is null then raise exception 'no identity for caller'; end if;

  select * into pg from public.wiki_pages where id = p_page_id;
  if not found then raise exception 'no such page %', p_page_id; end if;
  if not public.is_course_staff(pg.course_id) then
    raise exception 'not a TA or instructor on this course';
  end if;
  if pg.status = 'archived' then
    raise exception '% is already archived', pg.slug;
  end if;
  -- Same reasoning as unpublish: retiring a page leaves no trace of why, and a
  -- page retired for a duplicate slug and one retired as factually wrong look
  -- identical a month later.
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to archive %', pg.slug;
  end if;

  update public.wiki_pages set status = 'archived', updated_by = actor where id = p_page_id;

  insert into public.wiki_page_events (page_id, event, reason, actor)
  values (p_page_id, 'archived', btrim(p_reason), actor);

  return jsonb_build_object(
    'page_id', p_page_id, 'slug', pg.slug, 'status', 'archived', 'reason', btrim(p_reason));
end;
$$;

comment on function public.archive_page(uuid, text) is
  'Retire a page: invisible to students, and excluded from the wiki index shown to the ingest model, while keeping content, history and inbound links intact. Reason mandatory. Reversible with restore_page.';

create or replace function public.restore_page(p_page_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, identity
as $$
declare
  pg    public.wiki_pages%rowtype;
  actor uuid;
begin
  actor := public.current_person_id();
  if actor is null then raise exception 'no identity for caller'; end if;

  select * into pg from public.wiki_pages where id = p_page_id;
  if not found then raise exception 'no such page %', p_page_id; end if;
  if not public.is_course_staff(pg.course_id) then
    raise exception 'not a TA or instructor on this course';
  end if;
  if pg.status <> 'archived' then
    raise exception '% is not archived (status=%)', pg.slug, pg.status;
  end if;

  -- Back to draft, never straight to published: re-exposing a retired page to
  -- students should be a separate, deliberate act.
  update public.wiki_pages set status = 'draft', updated_by = actor where id = p_page_id;

  insert into public.wiki_page_events (page_id, event, reason, actor)
  values (p_page_id, 'restored', nullif(btrim(coalesce(p_reason, '')), ''), actor);

  return jsonb_build_object('page_id', p_page_id, 'slug', pg.slug, 'status', 'draft');
end;
$$;

comment on function public.restore_page(uuid, text) is
  'Un-archive a page back to draft. Never straight to published — re-exposing a retired page to students is a separate deliberate act.';

revoke all on function public.rename_page(uuid, text, text) from public;
revoke all on function public.archive_page(uuid, text) from public;
revoke all on function public.restore_page(uuid, text) from public;
grant execute on function public.rename_page(uuid, text, text) to authenticated;
grant execute on function public.archive_page(uuid, text) to authenticated;
grant execute on function public.restore_page(uuid, text) to authenticated;
