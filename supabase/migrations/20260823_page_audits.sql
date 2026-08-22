-- Machine review record (Norm's ask, 2026-08-23). Deliberately NOT page_reviews:
-- that table is Norm's stamp and the examinability gate (§39.12.8), and its
-- meaning is "the instructor read this". An audit is a different claim — "a
-- reviewer with one concern checked this and found N things" — and conflating
-- them would let a model's opinion gate exam items.
--
-- One row per (page, reviewer, run). Findings are structured so the queue can
-- be worked rather than read: each carries what was claimed, what is wrong,
-- and which of the three dispositions it got —
--   corrected — fixed in place (internal contradiction, arithmetic that does
--               not sum, a figure its own on-page citation refutes)
--   removed   — inaccurate and peripheral; cut rather than repaired
--   flagged   — inaccurate and central, or unresolvable without the source;
--               needs a human with the paper
create table if not exists public.page_audits (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null,
  page_id      uuid not null references public.wiki_pages(id) on delete cascade,
  reviewer     text not null,
  verdict      text not null check (verdict in ('pass', 'revised', 'flagged')),
  page_version integer,
  summary      text,
  findings     jsonb not null default '[]'::jsonb,
  run_label    text,
  created_at   timestamptz not null default now()
);

create index if not exists page_audits_page_idx on public.page_audits (page_id, created_at desc);
create index if not exists page_audits_verdict_idx on public.page_audits (course_id, verdict);

alter table public.page_audits enable row level security;

create policy "staff read audits"
  on public.page_audits for select to authenticated
  using (is_course_staff(course_id));

-- Latest audit per page per reviewer, joined to the page's current state so a
-- stale audit (page edited since) is visible as stale rather than trusted.
create or replace function public.audit_summary(p_course_id uuid)
returns table (
  slug text, title text, reviewer text, verdict text,
  audited_version int, current_version int, stale boolean,
  finding_count int, flagged_count int, summary text, created_at timestamptz
)
language sql stable security definer
set search_path to 'public'
as $$
  select p.slug, p.title, a.reviewer, a.verdict,
         a.page_version, p.current_version,
         coalesce(a.page_version < p.current_version, false),
         jsonb_array_length(a.findings),
         (select count(*)::int from jsonb_array_elements(a.findings) f
          where f->>'disposition' = 'flagged'),
         a.summary, a.created_at
  from (
    select distinct on (page_id, reviewer) *
    from page_audits
    where course_id = p_course_id
    order by page_id, reviewer, created_at desc
  ) a
  join wiki_pages p on p.id = a.page_id
  where is_course_staff(p_course_id)
  order by (a.verdict = 'flagged') desc, p.slug
$$;

revoke all on function public.audit_summary(uuid) from public, anon;
grant execute on function public.audit_summary(uuid) to authenticated;
