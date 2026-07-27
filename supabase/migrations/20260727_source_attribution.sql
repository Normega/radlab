-- 20260727_source_attribution.sql
-- TARGET: radlab-academic.
--
-- Attribution was left to the model: pages were supposed to emit a `sources:`
-- frontmatter list. Measured on live data, all 28 pages with accepted content
-- carried none, because that instruction only existed in the reference prompt
-- until 2026-07-26.
--
-- The deeper problem is that it was ever the model's job. For CC BY-NC-SA
-- material (Bridley & Daffin) attribution is a LICENCE CONDITION, not a
-- courtesy — so it cannot depend on prompt compliance, on which mode the
-- operator picked, or on a reviewer noticing it is absent. It has to be
-- derived from the ingest record, which already knows exactly which source
-- produced which page: every one of those 28 pages traces to a job through
-- wiki_page_versions.job_id.
--
-- So: each job carries a citation, and a page's attribution is the set of
-- citations of the jobs whose proposals were accepted into it. Automatic,
-- exact, and true even if a page is regenerated or hand-edited.
--
-- The model's own `sources:` frontmatter stays useful — it says which claim
-- came from where *within* a page — but the licence obligation no longer
-- rests on it.

alter table public.ingest_jobs add column if not exists source_citation text;

comment on column public.ingest_jobs.source_citation is
  'Human-readable citation for this job''s source document, captured at upload. The basis of page attribution — see wiki_page_provenance. Licence-required for openly-licensed sources.';

-- ── Backfill the nine existing jobs ─────────────────────────────────────
-- Citations for the three research papers are taken from the `study` pages the
-- model itself produced from those PDFs (title/authors/year/journal/doi), not
-- invented here. The textbook citation carries its licence, which is the whole
-- point of recording it.

update public.ingest_jobs set source_citation =
  'Shedler, J. (2010). The Efficacy of Psychodynamic Psychotherapy. American Psychologist. doi:10.1037/a0018378'
where pdf_path like '%Shedler%' and source_citation is null;

update public.ingest_jobs set source_citation =
  'Fonagy, P. (2015). The effectiveness of psychodynamic psychotherapies: an update. World Psychiatry. doi:10.1002/wps.20235'
where pdf_path like '%Fonagy%' and source_citation is null;

update public.ingest_jobs set source_citation =
  'Schramm, E., et al. (2025). Efficacy of Psychotherapy vs Pharmacotherapy, or Their Combination, in Chronic Depression (study protocol). BMJ Open. doi:10.1136/bmjopen-2024-089356'
where pdf_path like '%bmj_open%' and source_citation is null;

update public.ingest_jobs set source_citation =
  'Bridley, A., & Daffin, L. W. (2023). Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update), Module 4: Mood Disorders. Washington State University. Licensed CC BY-NC-SA 4.0.'
where pdf_path like '%Module04%' and source_citation is null;

update public.ingest_jobs set source_citation =
  'Rosenhan, D. L. (1973). On being sane in insane places. Science, 179(4070), 250-258.'
where pdf_path like '%Rosenhan%' and source_citation is null;

update public.ingest_jobs set source_citation =
  'Borsboom, D. (2017). A network theory of mental disorders. World Psychiatry, 16(1), 5-13.'
where pdf_path like '%Borsboom%' and source_citation is null;

update public.ingest_jobs set source_citation =
  'Jones, J. L., & Mehr, S. L. (2007). Foundations and assumptions of the scientist-practitioner model. American Behavioral Scientist.'
where pdf_path like '%jones-mehr%' and source_citation is null;

-- Anything still unset falls back to its filename so a page is never silently
-- unattributed; flagged so it is obvious these want a proper citation.
update public.ingest_jobs
set source_citation = 'UNVERIFIED SOURCE: ' || regexp_replace(pdf_path, '^[^/]+/[0-9]+_', '')
where source_citation is null;

-- ── Page attribution, derived ───────────────────────────────────────────

create or replace view public.wiki_page_provenance
with (security_invoker = true) as
select
  p.id         as page_id,
  p.course_id,
  p.slug,
  array_agg(distinct j.source_citation order by j.source_citation)
    filter (where j.source_citation is not null)          as sources,
  count(distinct j.id)                                    as source_count,
  bool_or(j.source_citation like 'UNVERIFIED%')           as has_unverified_source
from public.wiki_pages p
join public.wiki_page_versions v
  on v.page_id = p.id and v.kind = 'proposed' and v.review_status = 'accepted'
left join public.ingest_jobs j on j.id = v.job_id
where p.content is not null
group by p.id, p.course_id, p.slug;

comment on view public.wiki_page_provenance is
  'What each page is built from, derived from the jobs whose proposals were accepted into it. This is the licence-facing attribution — independent of whether the model remembered to emit a sources: block.';

-- Surface it on the shelf alongside the gap counts.
drop view if exists public.wiki_page_shelf;
create view public.wiki_page_shelf
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
  p.needs,
  cardinality(p.needs) as gap_count,
  pv.sources,
  coalesce(pv.source_count, 0) as source_count,
  coalesce(pv.has_unverified_source, false) as has_unverified_source,
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
left join public.wiki_page_provenance pv on pv.page_id = p.id
where p.content is not null;
