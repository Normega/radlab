-- 20260730_wiki_edit_page.sql
-- TARGET: radlab-academic.
--
-- The wiki had no edit path. `review_proposal()` needs a *pending* version, so
-- it can only ever accept what an ingest proposed; `unpublish_page()` hides a
-- page; and `wiki_pages` deliberately has no authenticated write policies. The
-- consequence, unnoticed until the WP2 reader made two malformed pages visible:
-- **an accepted page could not be corrected at all** — not a duplicated
-- skeleton, not a wrong prevalence figure, not a typo — without service-role
-- SQL. For a wiki that ~300 students will read, that is a missing primitive
-- rather than a missing nicety.
--
-- Same shape as the other two write paths: one audited SECURITY DEFINER
-- function with an internal staff check, so `wiki_pages` still has no
-- authenticated write policies and there remains exactly one client-reachable
-- way to change a page body.
--
-- Design notes:
--
-- * **History is automatic.** `wiki_pages_snapshot` already writes an
--   `accepted` version whenever content changes, and `wiki_pages_touch`
--   already bumps `current_version` from the highest existing snapshot. So an
--   edit is recoverable by construction and this function does not need to
--   manage versioning — it only labels the snapshot the trigger just made.
--
-- * **The note is optional, unlike unpublish's reason.** Unpublishing requires
--   one because the act leaves no trace of *why* — a page pulled for a typo and
--   one pulled for a factual error look identical afterwards. An edit leaves a
--   diff, which is self-documenting, so a mandatory note here would mostly
--   collect the word "fix". Encouraged in the UI, recorded when given.
--
-- * **Blanking a page is not an edit.** Content is refused when empty: a page
--   with no body is a *shell* (a slug that exists so links resolve, awaiting a
--   first proposal), and turning a live page back into one is a retirement, not
--   a correction. `unpublish_page` is the tool for taking a page away from
--   students.
--
-- * **A no-op is refused rather than silently versioned**, so the version
--   history doesn't accumulate identical snapshots from a double-clicked Save.

alter table public.wiki_page_versions
  add column if not exists note text;

comment on column public.wiki_page_versions.note is
  'Why this version exists, when a human wrote it. Set by edit_page(); null for ingest proposals and for snapshots taken on accept.';

create or replace function public.edit_page(
  p_page_id uuid,
  p_content text,
  p_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, identity
as $$
declare
  pg     public.wiki_pages%rowtype;
  editor uuid;
  vid    uuid;
begin
  editor := public.current_person_id();
  if editor is null then
    raise exception 'no identity for caller';
  end if;

  select * into pg from public.wiki_pages where id = p_page_id;
  if not found then
    raise exception 'no such page %', p_page_id;
  end if;

  if not public.is_course_staff(pg.course_id) then
    raise exception 'not a TA or instructor on this course';
  end if;

  if p_content is null or btrim(p_content) = '' then
    raise exception
      'refusing to blank %: a page with no body is a shell awaiting its first proposal. Use unpublish_page to take a page away from students.',
      pg.slug;
  end if;

  if pg.content is not distinct from p_content then
    raise exception 'no change to % — content is identical', pg.slug;
  end if;

  -- Fires wiki_pages_touch (version bump), wiki_pages_snapshot (accepted
  -- snapshot of the NEW body), set_page_needs (gap re-derivation) and
  -- sync_wiki_links (link graph).
  update public.wiki_pages
  set content    = p_content,
      updated_by = editor
  where id = p_page_id;

  select * into pg from public.wiki_pages where id = p_page_id;

  -- Label the snapshot the trigger just wrote.
  select id into vid
  from public.wiki_page_versions
  where page_id = p_page_id and kind = 'accepted' and version = pg.current_version
  order by created_at desc
  limit 1;

  if vid is not null then
    update public.wiki_page_versions
    set note = nullif(btrim(coalesce(p_note, '')), ''),
        created_by = coalesce(created_by, editor)
    where id = vid;
  end if;

  return jsonb_build_object(
    'page_id',         pg.id,
    'slug',            pg.slug,
    'status',          pg.status,
    'current_version', pg.current_version,
    'version_id',      vid,
    'needs',           to_jsonb(pg.needs),
    'links_extracted', (select count(*) from public.wiki_links where source_page_id = pg.id),
    'note',            nullif(btrim(coalesce(p_note, '')), '')
  );
end;
$$;

comment on function public.edit_page(uuid, text, text) is
  'Staff correction of an accepted page body. The only client-reachable write to wiki_pages.content besides review_proposal(): wiki_pages has no authenticated write policies, so the staff check lives here. Refuses a blank body (that is a retirement, use unpublish_page) and a no-op. History is automatic — the existing snapshot trigger records the previous body as an accepted version.';

revoke all on function public.edit_page(uuid, text, text) from public;
grant execute on function public.edit_page(uuid, text, text) to authenticated;
