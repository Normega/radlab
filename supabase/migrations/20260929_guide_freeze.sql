-- Guide freeze: students read a snapshot while staff keep working (radlab-academic).
--
-- The syllabus promises that "the Guide freezes before each test (Sept 30 for the midterm;
-- Dec 8 for the final), so the text you study is exactly the text you are examined on", and that
-- "accepted contributions during a freeze are published after the test". Until now nothing
-- implemented it: every acceptance, ingest and staff edit wrote wiki_pages, which students read
-- directly. Norm (2026-09-29): keep accepting ingests and contributions, but show students a
-- frozen version, then the complete one after Oct 15.
--
-- Design. A freeze is a window on one course (guide_freezes). At the start of the window the
-- course's pages are copied once into wiki_page_snapshots; while the window is open, the student
-- reader reads the snapshot instead of wiki_pages (the client picks the table from
-- guide_freeze_state()). Staff read and write wiki_pages exactly as before, so the review and
-- ingest pipelines are untouched. When the window closes, students read wiki_pages again and see
-- everything accepted meanwhile. Snapshots are kept as the record of what was examinable.
--
-- When the snapshot is taken. This project has no pg_cron, so the copy is taken on first touch
-- after starts_at: the first guide_freeze_state() call (every reader page load makes one), or the
-- first write to a course page — a BEFORE trigger on wiki_pages takes the snapshot before that
-- write lands. Either way it holds the pages as they stood at the start of the window.
--
-- RLS on snapshots mirrors wiki_pages: members read published rows, staff read all, and anyone
-- reads published rows of a public course — but only rows of a freeze whose window is open now.

create table if not exists public.guide_freezes (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references public.courses(id) on delete cascade,
  label             text not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  snapshot_taken_at timestamptz,
  snapshot_pages    integer,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists guide_freezes_course_window on public.guide_freezes (course_id, starts_at, ends_at);
alter table public.guide_freezes enable row level security;
drop policy if exists "members read their course freezes" on public.guide_freezes;
create policy "members read their course freezes" on public.guide_freezes
  for select to authenticated using (is_course_member(course_id));

create table if not exists public.wiki_page_snapshots (
  freeze_id       uuid not null references public.guide_freezes(id) on delete cascade,
  id              uuid not null,          -- the wiki_pages id, so links, gaps and visits still resolve
  course_id       uuid not null,
  slug            text not null,
  type            text,
  title           text,
  summary         text,
  content         text,
  status          text,
  current_version integer,
  updated_at      timestamptz,
  published_at    timestamptz,
  needs           text[],
  search_vector   tsvector generated always as (
    to_tsvector('english'::regconfig, ((((coalesce(title, '') || ' ') || coalesce(summary, '')) || ' ') || coalesce(content, '')))
  ) stored,
  primary key (freeze_id, id)
);
create index if not exists wiki_page_snapshots_course_slug on public.wiki_page_snapshots (course_id, slug);
create index if not exists wiki_page_snapshots_search on public.wiki_page_snapshots using gin (search_vector);
alter table public.wiki_page_snapshots enable row level security;

create or replace function public.guide_freeze_is_open(p_freeze_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from guide_freezes f
                 where f.id = p_freeze_id and now() >= f.starts_at and now() < f.ends_at)
$$;

drop policy if exists "members read published snapshot pages" on public.wiki_page_snapshots;
create policy "members read published snapshot pages" on public.wiki_page_snapshots
  for select to authenticated
  using (status = 'published' and is_course_member(course_id) and guide_freeze_is_open(freeze_id));
drop policy if exists "staff read all snapshot pages" on public.wiki_page_snapshots;
create policy "staff read all snapshot pages" on public.wiki_page_snapshots
  for select to authenticated
  using (is_course_staff(course_id) and guide_freeze_is_open(freeze_id));
drop policy if exists "anyone reads published snapshot pages of public courses" on public.wiki_page_snapshots;
create policy "anyone reads published snapshot pages of public courses" on public.wiki_page_snapshots
  for select to anon, authenticated
  using (status = 'published' and guide_freeze_is_open(freeze_id)
         and exists (select 1 from courses c where c.id = course_id and c.is_public));

-- Take the snapshot for a course's open freeze if it has not been taken. Idempotent and safe to
-- race: the freeze row is locked, and the second caller finds snapshot_taken_at set.
create or replace function public.guide_freeze_ensure_snapshot(p_course_id uuid)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_f guide_freezes%rowtype;
  v_n int;
begin
  select * into v_f from guide_freezes
   where course_id = p_course_id and now() >= starts_at and now() < ends_at
   order by starts_at desc limit 1
   for update;
  if not found then return null; end if;
  if v_f.snapshot_taken_at is null then
    insert into wiki_page_snapshots (freeze_id, id, course_id, slug, type, title, summary, content,
                                     status, current_version, updated_at, published_at, needs)
    select v_f.id, p.id, p.course_id, p.slug, p.type, p.title, p.summary, p.content,
           p.status, p.current_version, p.updated_at, p.published_at, p.needs
      from wiki_pages p where p.course_id = p_course_id
    on conflict (freeze_id, id) do nothing;
    get diagnostics v_n = row_count;
    update guide_freezes set snapshot_taken_at = now(), snapshot_pages = v_n where id = v_f.id;
  end if;
  return v_f.id;
end;
$$;
revoke all on function public.guide_freeze_ensure_snapshot(uuid) from public, anon, authenticated;

-- What the reader needs: is this course frozen now (and if so, from when, until when), or is a
-- freeze coming up. Takes the snapshot on the first call after the window opens.
create or replace function public.guide_freeze_state(p_course_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path to 'public'
as $$
declare
  v_f guide_freezes%rowtype;
  v_next guide_freezes%rowtype;
begin
  if not (is_course_member(p_course_id)
          or exists (select 1 from courses c where c.id = p_course_id and c.is_public)) then
    return jsonb_build_object('active', false);
  end if;
  perform guide_freeze_ensure_snapshot(p_course_id);
  select * into v_f from guide_freezes
   where course_id = p_course_id and now() >= starts_at and now() < ends_at
   order by starts_at desc limit 1;
  if found then
    return jsonb_build_object('active', true, 'freeze_id', v_f.id, 'label', v_f.label,
                              'starts_at', v_f.starts_at, 'ends_at', v_f.ends_at,
                              'snapshot_at', v_f.snapshot_taken_at);
  end if;
  select * into v_next from guide_freezes
   where course_id = p_course_id and starts_at > now()
   order by starts_at limit 1;
  return jsonb_build_object('active', false,
    'next', case when v_next.id is null then null else
      jsonb_build_object('label', v_next.label, 'starts_at', v_next.starts_at, 'ends_at', v_next.ends_at) end);
end;
$$;
revoke all on function public.guide_freeze_state(uuid) from public;
grant execute on function public.guide_freeze_state(uuid) to anon, authenticated;

-- A write to a page during an open freeze takes the snapshot first, so the snapshot is always
-- the state at the start of the window, whichever comes first — a reader or an edit.
create or replace function public.wiki_pages_freeze_snapshot_first()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if exists (select 1 from guide_freezes f
             where f.course_id = coalesce(new.course_id, old.course_id)
               and now() >= f.starts_at and now() < f.ends_at and f.snapshot_taken_at is null) then
    perform guide_freeze_ensure_snapshot(coalesce(new.course_id, old.course_id));
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists wiki_pages_freeze_snapshot_first on public.wiki_pages;
create trigger wiki_pages_freeze_snapshot_first
  before insert or update or delete on public.wiki_pages
  for each row execute function public.wiki_pages_freeze_snapshot_first();

-- PSY240's midterm freeze: from the end of Sept 30 (Toronto) until the start of Oct 15, the day
-- after the Oct 14 midterm — the dates the syllabus and the L4 slides state.
insert into public.guide_freezes (course_id, label, starts_at, ends_at)
select c.id, 'Midterm freeze', '2026-10-01 03:59:00+00', '2026-10-15 04:00:00+00'
  from public.courses c
 where c.code = 'PSY240'
   and not exists (select 1 from public.guide_freezes f where f.course_id = c.id and f.label = 'Midterm freeze');
