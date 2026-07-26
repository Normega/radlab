-- 20260726_ingest_source_type.sql
-- TARGET: radlab-academic.
--
-- WP3's last piece: `reference` ingest mode, for building the ~71-page course
-- scaffold in WP4 out of open reference works (Bridley & Daffin, ICD-11 CDDR,
-- NIMH) rather than out of student-submitted papers.
--
-- Deliberately NOT a second pipeline (plan §2.3). Same function, same storage
-- bucket, same job table, same review queue — a discriminator and a second
-- system prompt. The two modes differ in intent, not machinery:
--
--   paper     (default)  "read this paper, tell me every page it touches"
--                        — the model chooses what pages exist. Student route.
--   reference            "fill THIS catalogued page from this reference source"
--                        — the target is named up front, from the taxonomy
--                        catalog, and the run is scored against that page's
--                        declared gaps.
--
-- target_slug is what makes reference mode answerable: a run either filled the
-- sections it was pointed at or it didn't, and wiki_gap_report says which.

alter table public.ingest_jobs
  add column if not exists source_type text not null default 'paper'
    check (source_type in ('paper', 'reference')),
  add column if not exists target_slug text;

comment on column public.ingest_jobs.source_type is
  'paper = extract whatever pages a submitted study touches (student route). reference = fill one named catalogue page from an open reference work (WP4 scaffold).';
comment on column public.ingest_jobs.target_slug is
  'For source_type=reference: the disorders.slug this run is meant to fill. Null for paper mode.';

-- A reference run must name its target; a paper run must not pretend to.
alter table public.ingest_jobs
  drop constraint if exists ingest_jobs_target_slug_ck;
alter table public.ingest_jobs
  add constraint ingest_jobs_target_slug_ck
  check ((source_type = 'reference' and target_slug is not null)
      or (source_type = 'paper'     and target_slug is null));

-- Reference-mode worklist: catalogued pages that still need something, ordered
-- so the biggest holes in the most-taught material come first. This is the WP4
-- queue — and, read differently, the list of topics to hand students.
create or replace view public.reference_worklist
with (security_invoker = true) as
select
  g.course_id,
  g.slug,
  g.title,
  g.tier,
  g.lecture,
  g.dsm_chapter,
  g.state,
  g.needs,
  cardinality(g.needs) as gap_count,
  (select count(*) from public.ingest_jobs j
    where j.course_id = g.course_id and j.source_type = 'reference'
      and j.target_slug = g.slug and j.status = 'done') as reference_runs
from public.wiki_gap_report g
where g.state <> 'complete'
order by
  case g.tier when 'A' then 0 when 'overview' then 1 when 'foundation' then 2 else 3 end,
  case g.state when 'no page yet' then 0 when 'shell only' then 1 else 2 end,
  cardinality(g.needs) desc,
  g.lecture nulls last,
  g.slug;

comment on view public.reference_worklist is
  'WP4 content-sprint queue: catalogued pages that are missing or incomplete, Tier A first, with the count of reference runs already attempted against each.';
