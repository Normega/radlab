-- radlab-academic (qldgwpneygvgcvexlduz) — NOT the main radlab project.
--
-- WP6 groundwork: make the Field Guide's research gaps addressable.
--
-- Until now a "gap" has been a `> **Needs research:** …` marker living in page
-- prose, with no id, no claim mechanism and no status. That is fine for a
-- working note and useless as an assignment system: two students cannot be
-- stopped from doing the same one, nothing can be marked done, and nothing can
-- be counted.
--
-- THE UNIT IS THE ASK, NOT THE ANNOTATION. Measured 2026-08-05: 301 annotations,
-- but they average 2.39 distinct asks each (215 of 301 contain more than one,
-- written as "X; Y; and Z"). At one row per annotation the pool is 301 — under
-- half of what 200 students × 3 contributions needs. Split into asks it is ~719,
-- plus 62 empty sections. That split is what makes the cohort size feasible, so
-- the schema is built on it.
--
-- Identity must survive re-parsing: page prose gets edited, and a claim must not
-- evaporate when a neighbouring sentence changes. Gaps are therefore keyed on
-- (page_id, ask_hash) where ask_hash is md5 of the normalised ask text. Editing
-- an ask creates a new gap and leaves the old one to be retired, which is the
-- honest behaviour — a reworded ask may be a different question.

begin;

create table if not exists page_gaps (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  page_id      uuid not null references wiki_pages(id) on delete cascade,
  slug         text not null,
  kind         text not null check (kind in ('annotation','empty_section','curated')),
  section      text,                    -- section slug, for empty_section gaps
  ask          text not null,
  ask_hash     text not null,
  tier         text,                    -- copied from disorders at populate time
  difficulty   text check (difficulty in ('green','amber','red')),
  capacity     integer not null default 1 check (capacity > 0),
  status       text not null default 'open'
               check (status in ('open','retired')),
  notes        text,
  detected_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (page_id, ask_hash)
);

create index if not exists page_gaps_open_idx  on page_gaps (status, difficulty, tier);
create index if not exists page_gaps_slug_idx  on page_gaps (slug);

comment on table page_gaps is
  'One row per research ask. Regenerated from page prose by populate_page_gaps(); '
  'claims live in gap_claims and survive regeneration via (page_id, ask_hash).';
comment on column page_gaps.capacity is
  'How many students may contribute to this ask. Some asks legitimately take '
  'several sources from different angles; staff raise this where that is true.';
comment on column page_gaps.difficulty is
  'green = a wrong answer is visibly wrong or harmless (student-owned); '
  'amber = a wrong answer is plausible-looking (student-drafted, staff-verified); '
  'red = a wrong answer reads as clinical instruction or creates compliance '
  'exposure (never student work). See run plan §29.';

create table if not exists gap_claims (
  id           uuid primary key default gen_random_uuid(),
  gap_id       uuid not null references page_gaps(id) on delete cascade,
  person_id    uuid not null references identity.people(id) on delete cascade,
  status       text not null default 'claimed'
               check (status in ('claimed','submitted','accepted','withdrawn')),
  source_citation text,
  version_id   uuid references wiki_page_versions(id) on delete set null,
  note         text,
  claimed_at   timestamptz not null default now(),
  submitted_at timestamptz,
  resolved_at  timestamptz,
  unique (gap_id, person_id)
);

create index if not exists gap_claims_person_idx on gap_claims (person_id, status);

-- Remaining capacity, and the browse surface students actually need.
create or replace view open_gaps
with (security_invoker = true) as
  select g.*,
         (select count(*) from gap_claims c
           where c.gap_id = g.id and c.status in ('claimed','submitted','accepted')) as claims_taken,
         g.capacity - (select count(*) from gap_claims c
           where c.gap_id = g.id and c.status in ('claimed','submitted','accepted')) as slots_left
  from page_gaps g
  where g.status = 'open';

-- ---------------------------------------------------------------------------
-- Populate. Idempotent: re-running refreshes last_seen_at for asks still
-- present, inserts newly written ones, and leaves claims untouched.
-- Asks that have disappeared from prose are NOT deleted (that would orphan
-- claims); they are reported by the stale_gaps view below for staff to retire.
-- ---------------------------------------------------------------------------
create or replace function populate_page_gaps(p_course_id uuid)
returns table (inserted int, refreshed int)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_ins int := 0;
  v_ref int := 0;
begin
  with raw as (
    -- annotations: pull each marker, strip the leading quote decoration
    select p.id as page_id, p.course_id, p.slug,
           regexp_replace(
             (regexp_matches(p.content, '\*\*Needs research:\*\*\s*((?:[^\n\r]|\n>)+)', 'g'))[1],
             E'\n>\\s*', ' ', 'g') as body
    from wiki_pages p
    where p.course_id = p_course_id and p.content is not null
  ),
  asks as (
    select page_id, course_id, slug,
           btrim(regexp_replace(unnest(string_to_array(body, ';')), '\s+', ' ', 'g')) as ask
    from raw
  ),
  cleaned as (
    select page_id, course_id, slug, ask
    from asks
    where length(ask) > 25          -- drop fragments that are not asks
  ),
  ins as (
    insert into page_gaps (course_id, page_id, slug, kind, ask, ask_hash, tier, difficulty)
    select c.course_id, c.page_id, c.slug, 'annotation', c.ask, md5(lower(c.ask)),
           d.tier,
           case
             when c.ask ~* '(dos(e|ing)|taper|titrat|consent|contraindicat|antidote|overdose|crisis|helpline|mandated report|civil commitment|sentencing|fitness to stand|withdrawal manage)'
               then 'red'
             when c.ask ~* '(prevalence|incidence|rates|Canadian|Ontario|provincial|newest source|epidemiolog|how many)'
               then 'green'
             else 'amber'
           end
    from cleaned c
    left join disorders d on d.slug = c.slug
    on conflict (page_id, ask_hash) do update set last_seen_at = now()
    returning (xmax = 0) as was_insert
  )
  select count(*) filter (where was_insert), count(*) filter (where not was_insert)
    into v_ins, v_ref from ins;

  -- empty sections, one gap each
  insert into page_gaps (course_id, page_id, slug, kind, section, ask, ask_hash, tier, difficulty)
  select p.course_id, p.id, p.slug, 'empty_section', k.key,
         'Write the ' || k.key || ' section of ' || p.slug || ' — it currently has a heading and no prose.',
         md5('empty_section:' || k.key),
         d.tier, 'amber'
  from wiki_pages p
  cross join lateral jsonb_each(extract_page_sections(p.content)) k
  left join disorders d on d.slug = p.slug
  where p.course_id = p_course_id
    and p.content is not null
    and not (k.value->>'prose')::boolean
  on conflict (page_id, ask_hash) do update set last_seen_at = now();

  return query select v_ins, v_ref;
end;
$fn$;

-- Asks that no longer appear in prose (the page was edited or the gap closed).
create or replace view stale_gaps
with (security_invoker = true) as
  select g.*, (select count(*) from gap_claims c where c.gap_id = g.id) as claims
  from page_gaps g
  where g.status = 'open'
    and g.last_seen_at < g.detected_at + interval '1 second'
    and g.detected_at < now() - interval '1 day';

-- ---------------------------------------------------------------------------
-- RLS. Gaps follow the visibility of the page they belong to: a student cannot
-- be offered work on a page they cannot read.
-- ---------------------------------------------------------------------------
alter table page_gaps  enable row level security;
alter table gap_claims enable row level security;

create policy "members read gaps on published pages"
  on page_gaps for select to authenticated
  using (exists (select 1 from wiki_pages p
                 where p.id = page_gaps.page_id
                   and p.status = 'published'
                   and is_course_member(p.course_id)));

create policy "staff read all gaps"
  on page_gaps for select to authenticated
  using (is_course_staff(course_id));

create policy "staff write gaps"
  on page_gaps for all to authenticated
  using (is_course_staff(course_id)) with check (is_course_staff(course_id));

create policy "members read own claims"
  on gap_claims for select to authenticated
  using (person_id = current_person_id());

create policy "members create own claims"
  on gap_claims for insert to authenticated
  with check (person_id = current_person_id());

create policy "members update own claims"
  on gap_claims for update to authenticated
  using (person_id = current_person_id())
  with check (person_id = current_person_id());

create policy "staff manage all claims"
  on gap_claims for all to authenticated
  using (exists (select 1 from page_gaps g
                 where g.id = gap_claims.gap_id and is_course_staff(g.course_id)))
  with check (exists (select 1 from page_gaps g
                 where g.id = gap_claims.gap_id and is_course_staff(g.course_id)));

commit;
