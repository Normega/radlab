-- radlab-academic (qldgwpneygvgcvexlduz)
-- Rejecting a proposal should not leave its page behind.
--
-- `api/ingest.js` lands every returned page as a proposed version against a *shell* page
-- created on the spot — content null, status 'proposed'. `review_proposal()` then marked
-- only the **version** rejected, so rejecting the sole proposal for a brand-new page left
-- the shell sitting in `wiki_pages` forever.
--
-- That is not merely untidy. `wiki_pages_bind_links()` resolves a `[[wikilink]]` by slug
-- against any existing row, so an inbound link to a rejected page **resolved**: it counted
-- as a healthy link in `wiki_links`, rendered blue in the reader, and led to a blank page.
-- A red link would have been the honest state and is a first-class concept here — the
-- schema keeps unresolved links precisely so gaps are visible. Instead the corpus reported
-- "0 red links" while carrying one link to nowhere.
--
-- Found 2026-08-01 catching up after Module 07. The two duplicates rejected on 2026-07-31
-- (`history-of-mental-illness`, `research-methods-in-psychopathology`) were both still
-- present as shells, and `what-is-abnormal` linked to the first of them. That link has since
-- been retargeted at `historical-traditions` through `edit_page()`; §2 below removes the
-- shells themselves, and §1 stops them accruing — otherwise this is one pair per foundations
-- run, since inventing a duplicate of the target is exactly what those runs do.
--
-- **Deletion, not archival.** `archive_page` is for a page that had a life: it keeps version
-- history and provenance and requires a reason. A shell whose only proposal was rejected has
-- neither — no accepted body ever existed. Nothing is lost by deleting it: the model's full
-- proposed text survives in `ingest_jobs.result_json`, which is where a rejected proposal's
-- audit trail actually lives.
--
-- The delete is guarded three ways and reports what it did, rather than being silent.

-- 1. The fix.
CREATE OR REPLACE FUNCTION public.review_proposal(
  p_version_id uuid,
  p_decision   text,
  p_content    text DEFAULT NULL::text,
  p_publish    boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'identity'
AS $function$
declare
  v            public.wiki_page_versions%rowtype;
  pg           public.wiki_pages%rowtype;
  reviewer     uuid;
  survivors    int;
  orphaned     int := 0;
  page_dropped boolean := false;
begin
  if p_decision not in ('accept', 'reject') then
    raise exception 'decision must be accept or reject, got %', p_decision;
  end if;

  reviewer := public.current_person_id();
  if reviewer is null then
    raise exception 'no identity for caller';
  end if;

  select * into v from public.wiki_page_versions where id = p_version_id;
  if not found then
    raise exception 'no such version %', p_version_id;
  end if;
  if v.kind <> 'proposed' then
    raise exception 'version % is not a proposal (kind=%)', p_version_id, v.kind;
  end if;
  if v.review_status <> 'pending' then
    raise exception 'version % already %', p_version_id, v.review_status;
  end if;

  select * into pg from public.wiki_pages where id = v.page_id;
  if not public.is_course_staff(pg.course_id) then
    raise exception 'not a TA or instructor on this course';
  end if;

  -- An `update` is a delta: the system prompt asks the model for "only the new
  -- information to merge, not a full rewrite". Accepting one verbatim onto a
  -- page with no accepted body makes the addendum the whole page — a section
  -- headed "Update from X" with no definition in front of it. Refuse it here,
  -- because the UI warning demonstrably gets clicked past. Editing the delta
  -- into a standalone page is still allowed: that arrives as p_content.
  if p_decision = 'accept'
     and v.action = 'update'
     and pg.content is null
     and p_content is null then
    raise exception
      'page % has no accepted body, so this update would become the whole page. Review its full proposal first, or edit this into a standalone page before accepting.',
      pg.slug;
  end if;

  if p_decision = 'reject' then
    update public.wiki_page_versions
    set review_status = 'rejected', reviewed_by = reviewer, reviewed_at = now()
    where id = p_version_id;

    -- Drop the shell this proposal created, when nothing else is keeping it alive:
    --   * only for `new` — an `update` targets a page that existed before this run;
    --   * only when no body was ever accepted;
    --   * only when no other version is accepted or still pending, so a competing
    --     proposal from another run (or a page mid-review) is never pulled out from
    --     under the reviewer.
    if v.action = 'new' and pg.content is null then
      select count(*) into survivors
      from public.wiki_page_versions
      where page_id = v.page_id
        and id <> p_version_id
        and review_status in ('accepted', 'pending');

      if survivors = 0 then
        -- Report the links this strands. They revert to red (FK is ON DELETE SET NULL),
        -- which is the honest state, but a reviewer should be told it happened.
        select count(*) into orphaned
        from public.wiki_links where target_page_id = v.page_id;

        -- Cascades the rejected version and any events; nulls inbound `wiki_links`
        -- and `disorders.page_id`, returning that catalogue row to "unwritten".
        delete from public.wiki_pages where id = v.page_id;
        page_dropped := true;
      end if;
    end if;

    return jsonb_build_object(
      'decision',       'rejected',
      'version_id',     p_version_id,
      'slug',           pg.slug,
      'page_dropped',   page_dropped,
      'links_orphaned', orphaned);
  end if;

  update public.wiki_pages
  set content    = coalesce(p_content, v.content),
      title      = coalesce(v.title, title),
      summary    = coalesce(v.summary, summary),
      status     = case when p_publish then 'published' else 'draft' end,
      updated_by = reviewer
  where id = v.page_id;

  update public.wiki_page_versions
  set review_status = 'accepted',
      reviewed_by   = reviewer,
      reviewed_at   = now(),
      content       = coalesce(p_content, content)
  where id = p_version_id;

  -- Log the exposure event so publish/unpublish reads as one history.
  if p_publish and pg.status is distinct from 'published' then
    insert into public.wiki_page_events (page_id, event, actor)
    values (v.page_id, 'published', reviewer);
  end if;

  select * into pg from public.wiki_pages where id = v.page_id;

  return jsonb_build_object(
    'decision',        'accepted',
    'version_id',      p_version_id,
    'page_id',         pg.id,
    'slug',            pg.slug,
    'status',          pg.status,
    'current_version', pg.current_version,
    'edited',          p_content is not null,
    'links_extracted', (select count(*) from public.wiki_links where source_page_id = pg.id)
  );
end;
$function$;

-- 2. Clear the shells already accrued.
-- Same three guards as above, expressed as a set: no body, at least one version, and every
-- version rejected. A shell with a pending proposal, or one created moments ago by an
-- in-flight ingest that has not written its version yet, is left alone.
DELETE FROM public.wiki_pages p
WHERE p.content IS NULL
  AND p.status = 'proposed'
  AND EXISTS (SELECT 1 FROM public.wiki_page_versions v WHERE v.page_id = p.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.wiki_page_versions v
    WHERE v.page_id = p.id AND v.review_status IN ('accepted', 'pending')
  );
