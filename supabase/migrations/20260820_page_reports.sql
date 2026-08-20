-- Student error detection (Norm's call, 2026-08-20). Two kinds of finding,
-- one table: `error` (something looks wrong — typo, mismatched number,
-- cross-page contradiction; no source needed) and `contradiction` (the
-- student has a SOURCE that disagrees with the page — which is not an error
-- report but a contribution wearing one's clothes).
--
-- Students report; they never edit. Staff resolve a report one of three ways:
--   fixed      — applied via edit_page (the corrections path)
--   converted  — promoted to a page_gaps row the student can then claim and
--                submit through the normal pipeline; a verified contradiction
--                submission COUNTS toward the required three articles
--   dismissed  — with a note the reporting student can read
-- First verified `error` report earns a small participation credit; the
-- queue records who reported what, so administering that is a query.

create table if not exists public.page_reports (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null,
  page_id     uuid not null references public.wiki_pages(id) on delete cascade,
  person_id   uuid not null references identity.people(id),
  section     text,
  kind        text not null check (kind in ('error', 'contradiction')),
  body        text not null,
  citation    text,
  status      text not null default 'open'
              check (status in ('open', 'fixed', 'converted', 'dismissed')),
  gap_id      uuid references public.page_gaps(id),
  resolution  text,
  resolved_by uuid references identity.people(id),
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists page_reports_course_status_idx on public.page_reports (course_id, status);
create index if not exists page_reports_page_idx on public.page_reports (page_id);

alter table public.page_reports enable row level security;

-- Students read their own reports (the loop-closing half: they see the
-- resolution); staff read and update everything. Inserts go through the RPC
-- so course/person resolution and validation live in one place.
create policy "own reports"
  on public.page_reports for select to authenticated
  using (person_id = current_person_id());

create policy "staff read reports"
  on public.page_reports for select to authenticated
  using (is_course_staff(course_id));

create policy "staff update reports"
  on public.page_reports for update to authenticated
  using (is_course_staff(course_id))
  with check (is_course_staff(course_id));

create or replace function public.report_page_issue(
  p_page_id  uuid,
  p_kind     text,
  p_body     text,
  p_section  text default null,
  p_citation text default null
) returns public.page_reports
language plpgsql security definer
set search_path to 'public', 'identity'
as $$
declare
  v_page wiki_pages%rowtype;
  v_person uuid := current_person_id();
  v_row page_reports%rowtype;
  v_open int;
begin
  if v_person is null then raise exception 'no identity for caller'; end if;
  select * into v_page from wiki_pages where id = p_page_id;
  if v_page.id is null then raise exception 'no such page'; end if;
  if not is_course_member(v_page.course_id) then raise exception 'course members only'; end if;
  if p_kind not in ('error', 'contradiction') then
    raise exception 'kind must be error or contradiction';
  end if;
  if length(btrim(coalesce(p_body, ''))) < 30 then
    raise exception 'say what you found in at least a sentence (30+ characters) — the report is what staff act on';
  end if;
  if p_kind = 'contradiction' and length(btrim(coalesce(p_citation, ''))) < 10 then
    raise exception 'a contradiction report needs the source that contradicts the page (citation or DOI)';
  end if;

  -- A light flood valve: five open reports per person is plenty to have in
  -- flight; resolution reopens headroom.
  select count(*) into v_open from page_reports
  where person_id = v_person and status = 'open';
  if v_open >= 5 then
    raise exception 'you have five open reports already — wait for staff to resolve some before filing more';
  end if;

  insert into page_reports (course_id, page_id, person_id, section, kind, body, citation)
  values (v_page.course_id, p_page_id, v_person, nullif(btrim(p_section), ''),
          p_kind, btrim(p_body), nullif(btrim(p_citation), ''))
  returning * into v_row;
  return v_row;
end;
$$;

-- Staff resolution. `converted` requires the gap to exist first (made with
-- flag_gap, seeded from the report) and links it, so the student's next step
-- — claim it on the board — is one click away from their own report.
create or replace function public.resolve_page_report(
  p_id     uuid,
  p_status text,
  p_note   text default null,
  p_gap_id uuid default null
) returns void
language plpgsql security definer
set search_path to 'public', 'identity'
as $$
declare v_course uuid;
begin
  select course_id into v_course from page_reports where id = p_id;
  if v_course is null then raise exception 'no such report'; end if;
  if not is_course_staff(v_course) then raise exception 'staff only'; end if;
  if p_status not in ('fixed', 'converted', 'dismissed') then
    raise exception 'status must be fixed, converted or dismissed';
  end if;
  if p_status = 'converted' and p_gap_id is null then
    raise exception 'converted needs the gap id (flag the gap first, then resolve)';
  end if;

  update page_reports
  set status = p_status,
      gap_id = coalesce(p_gap_id, gap_id),
      resolution = nullif(btrim(p_note), ''),
      resolved_by = current_person_id(),
      resolved_at = now()
  where id = p_id;
end;
$$;

do $$ begin
  revoke all on function public.report_page_issue(uuid, text, text, text, text) from public, anon;
  revoke all on function public.resolve_page_report(uuid, text, text, uuid) from public, anon;
  grant execute on function public.report_page_issue(uuid, text, text, text, text) to authenticated;
  grant execute on function public.resolve_page_report(uuid, text, text, uuid) to authenticated;
end $$;
