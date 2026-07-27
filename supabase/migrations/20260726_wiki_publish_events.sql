-- 20260726_wiki_publish_events.sql
-- TARGET: radlab-academic.
--
-- Two things, both from the first real review session:
--
-- 1. UNPUBLISH. Publishing exposes a page to every enrolled student; there was
--    no way back except SQL. Unpublishing is not erasure — students may have
--    read it, and once WP7's export mirror exists a published page has been
--    written to the archive — so what matters is recording WHO pulled it and
--    WHY, not just that it happened. A page pulled for a typo and a page pulled
--    because a student flagged a factual error look identical three weeks later
--    otherwise.
--
--    Deliberately NOT a toggle and NOT a bulk action. The two directions are not
--    symmetric (publish exposes, unpublish retracts something already seen), and
--    a bulk publish would stamp reviewed_by on pages nobody read — an audit
--    trail that lies is worse than none.
--
-- 2. A GUARD against accepting a delta with nothing to merge into. The UI warns,
--    but warnings get clicked past: `empirical-support-for-psychodynamic-therapy`
--    was published as a bare addendum on 2026-07-26 with its own full proposal
--    still sitting in the queue. Server-side refusal is the only version of this
--    rule that actually holds.

-- =====================================================================
-- 1. PUBLISH / UNPUBLISH EVENT LOG
-- =====================================================================

create table public.wiki_page_events (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.wiki_pages (id) on delete cascade,
  event      text not null check (event in ('published', 'unpublished')),
  reason     text,          -- required for 'unpublished', free text
  actor      uuid references identity.people (id),
  created_at timestamptz not null default now()
);

create index wiki_page_events_page_idx on public.wiki_page_events (page_id, created_at desc);

alter table public.wiki_page_events enable row level security;

-- Staff-only: this is course-administration history, not student-facing.
create policy "staff read page events"
  on public.wiki_page_events for select
  to authenticated
  using (exists (
    select 1 from public.wiki_pages p
    where p.id = wiki_page_events.page_id and public.is_course_staff(p.course_id)
  ));

-- No authenticated write policies — writes go through the RPCs below, which
-- check staff enrollment themselves. (Consistent with wiki_pages; see the RLS
-- NOTE in 20260725_academic_wiki_schema.sql.)

-- =====================================================================
-- 2. UNPUBLISH
-- =====================================================================
-- Returns a page to 'draft': the content stays, the review stands, only
-- visibility is revoked. Any staff member may pull a page down — unpublishing
-- is the safe direction, and nobody should hesitate to retract something
-- harmful for want of a permission.

create or replace function public.unpublish_page(
  p_page_id uuid,
  p_reason  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, identity
as $$
declare
  pg    public.wiki_pages%rowtype;
  actor uuid;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a reason is required to unpublish';
  end if;

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
  if pg.status <> 'published' then
    raise exception 'page % is %, not published', pg.slug, pg.status;
  end if;

  update public.wiki_pages set status = 'draft', updated_by = actor where id = p_page_id;

  insert into public.wiki_page_events (page_id, event, reason, actor)
  values (p_page_id, 'unpublished', btrim(p_reason), actor);

  return jsonb_build_object(
    'page_id', p_page_id, 'slug', pg.slug, 'status', 'draft', 'reason', btrim(p_reason));
end;
$$;

revoke all on function public.unpublish_page(uuid, text) from public;
grant execute on function public.unpublish_page(uuid, text) to authenticated;

comment on function public.unpublish_page is
  'Revoke a published page''s visibility, returning it to draft. Content and review history are untouched. Reason is mandatory and logged to wiki_page_events with the actor.';

-- =====================================================================
-- 3. review_proposal: log publishes, and refuse deltas with nothing to merge
-- =====================================================================

create or replace function public.review_proposal(
  p_version_id uuid,
  p_decision   text,
  p_content    text default null,
  p_publish    boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, identity
as $$
declare
  v        public.wiki_page_versions%rowtype;
  pg       public.wiki_pages%rowtype;
  reviewer uuid;
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

    return jsonb_build_object(
      'decision', 'rejected', 'version_id', p_version_id, 'slug', pg.slug);
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
$$;

-- =====================================================================
-- 4. PAGE SHELF — accepted pages with their state, for the manage view
-- =====================================================================
-- The review queue only lists *pending proposals*, so there was nowhere to see
-- (or unpublish) a page that had already been accepted.

create or replace view public.wiki_page_shelf
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

comment on view public.wiki_page_shelf is
  'Pages that carry accepted content, with visibility state and graph counts. security_invoker so the roster gate on wiki_pages applies to the caller (see 20260726_academic_wiki_view_security_invoker.sql).';
