-- WP6 Phase D (second half): the review stamp, flag-from-reader, and the
-- class changelog feed. Run plan §38.3 items 2–3 and §39.12.8–9.
--
-- page_reviews is deliberately three things at once (one table, three
-- consumers):
--   1. coverage bookkeeping — which of 262 pages has Norm actually read;
--   2. the examinability gate — §39.12.8: a test item may only be authored
--      against a section whose current version carries a clear stamp;
--   3. the input to the changelog's examinable/reference-only marker.
--
-- Stamps are history rows, never updated in place: each stamp records the
-- page version it read, so "stale" is computable (stamp.version <
-- current_version) rather than remembered. The latest clear stamp is the
-- current one.

create table if not exists public.page_reviews (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null,
  page_id     uuid not null references public.wiki_pages(id) on delete cascade,
  version     integer not null,
  reviewer    uuid not null references identity.people(id),
  verdict     text not null check (verdict in ('clear', 'needs_work')),
  note        text,
  reviewed_at timestamptz not null default now()
);

create index if not exists page_reviews_page_idx on public.page_reviews (page_id, reviewed_at desc);

alter table public.page_reviews enable row level security;

-- Staff read the stamp history. Members get examinability only through
-- whats_new() below — a stamp note is a working remark ("prevalence figure
-- looks dated, verify before items"), not student-facing prose, so the table
-- itself is staff-only and the definer function exposes just the boolean.
create policy "staff read reviews"
  on public.page_reviews
  for select
  to authenticated
  using (is_course_staff(course_id));

-- Writes go through stamp_page() only — no insert policy. Same shape as the
-- claim flow: the function is the door, the table has no client-reachable
-- write surface to drift from it.

create or replace function public.stamp_page(
  p_page_id uuid,
  p_verdict text,
  p_note    text default null
) returns public.page_reviews
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_page public.wiki_pages%rowtype;
  v_row  public.page_reviews%rowtype;
begin
  select * into v_page from wiki_pages where id = p_page_id;
  if v_page.id is null then
    raise exception 'no such page';
  end if;
  if not is_course_staff(v_page.course_id) then
    raise exception 'staff only';
  end if;
  if p_verdict not in ('clear', 'needs_work') then
    raise exception 'verdict must be clear or needs_work';
  end if;

  insert into page_reviews (course_id, page_id, version, reviewer, verdict, note)
  values (v_page.course_id, p_page_id, v_page.current_version,
          current_person_id(), p_verdict, nullif(btrim(p_note), ''))
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.stamp_page(uuid, text, text) from public, anon;
grant execute on function public.stamp_page(uuid, text, text) to authenticated;

-- Applied to the live project as a second server migration
-- (page_gaps_staff_kind): the kind check predated 'staff'.
alter table public.page_gaps drop constraint page_gaps_kind_check;
alter table public.page_gaps add constraint page_gaps_kind_check
  check (kind = any (array['annotation'::text, 'empty_section'::text, 'curated'::text, 'staff'::text]));

-- Flag-from-reader (§38.3 item 2). Staff could insert into page_gaps directly
-- (the "staff write gaps" policy allows it), but the ask_hash convention lives
-- in populate_page_gaps() and a hand-built hash that differs by whitespace
-- would defeat the (page_id, ask_hash) dedup. The function owns the hash.
create or replace function public.flag_gap(
  p_page_id    uuid,
  p_section    text,
  p_ask        text,
  p_difficulty text default 'amber'
) returns public.page_gaps
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_page public.wiki_pages%rowtype;
  v_ask  text := btrim(regexp_replace(coalesce(p_ask, ''), '\s+', ' ', 'g'));
  v_row  public.page_gaps%rowtype;
begin
  select * into v_page from wiki_pages where id = p_page_id;
  if v_page.id is null then
    raise exception 'no such page';
  end if;
  if not is_course_staff(v_page.course_id) then
    raise exception 'staff only';
  end if;
  if length(v_ask) < 26 then
    raise exception 'ask too short — say what is missing in at least a sentence (26+ chars)';
  end if;
  if p_difficulty not in ('green', 'amber', 'red') then
    raise exception 'difficulty must be green, amber or red';
  end if;

  insert into page_gaps (course_id, page_id, slug, kind, section, ask, ask_hash,
                         tier, difficulty, capacity, notes)
  values (v_page.course_id, p_page_id, v_page.slug, 'staff',
          nullif(btrim(p_section), ''), v_ask, md5(lower(v_ask)),
          (select d.tier from disorders d where d.slug = v_page.slug),
          p_difficulty,
          case when p_difficulty = 'green' then 2 else 1 end,
          'Flagged from the reader by staff, ' || to_char(now(), 'YYYY-MM-DD'))
  on conflict (page_id, ask_hash) do update set last_seen_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.flag_gap(uuid, text, text, text) from public, anon;
grant execute on function public.flag_gap(uuid, text, text, text) to authenticated;

-- The class changelog (§39.12.9): every accepted version on a published page,
-- newest first. SECURITY DEFINER for the same reason as gap_board() — the
-- feed joins gap_claims (own-rows RLS) and page_reviews (staff-only RLS) to
-- decorate entries, and a member's invoker query would silently under-match
-- both (the §10 nested-RLS lesson). It returns no names and no stamp notes.
--
-- Two version shapes carry the feed, and they must not double-count. An
-- accepted *proposal* (kind='proposed', job_id always set, version always
-- null) IS the change — it landed when it was reviewed. A job-less *snapshot*
-- with a note is an edit_page correction (corrections_feed's definition) —
-- the snapshot holds the pre-edit body, created at edit time. Job-less
-- snapshots WITHOUT notes are the mechanical echo of a proposal-driven
-- update (the snapshot trigger fires on any content write) and are excluded,
-- or every ingest update would appear twice.
--
-- ask/section come from the accepted claim's gap when there is one: the
-- gap's ask is the free one-line "what the guide now knows" summary.
--
-- examinable: a clear stamp made after the change landed. Proposal rows
-- carry no version number, so this is a timestamp comparison, which is also
-- the honest one — the stamped read covered whatever the page held when it
-- happened. Later drift stales the page, not the already-covered entry.
create or replace function public.whats_new(p_course_id uuid)
returns table(
  version_id uuid,
  landed_at  timestamptz,
  slug       text,
  page_title text,
  origin     text,
  note       text,
  ask        text,
  section    text,
  examinable boolean
)
language sql stable security definer set search_path to 'public'
as $$
  select v.id,
         case when v.kind = 'proposed'
              then coalesce(v.reviewed_at, v.created_at)
              else v.created_at end as landed_at,
         p.slug, p.title,
         case
           when gc.id is not null then 'submission'
           when v.kind = 'proposed' then 'ingest'
           else 'correction'
         end,
         case when gc.id is not null then null else v.note end,
         g.ask, g.section,
         exists (
           select 1 from page_reviews r
           where r.page_id = p.id and r.verdict = 'clear'
             and r.reviewed_at >= case when v.kind = 'proposed'
                                       then coalesce(v.reviewed_at, v.created_at)
                                       else v.created_at end
         )
  from wiki_page_versions v
  join wiki_pages p on p.id = v.page_id
  left join gap_claims gc on gc.version_id = v.id and gc.status = 'accepted'
  left join page_gaps g on g.id = gc.gap_id
  where p.course_id = p_course_id
    and p.status = 'published'
    and v.review_status = 'accepted'
    and (v.kind = 'proposed' or (v.job_id is null and v.note is not null))
    and is_course_member(p_course_id)
  order by 2 desc
  limit 400
$$;

revoke all on function public.whats_new(uuid) from public, anon;
grant execute on function public.whats_new(uuid) to authenticated;
