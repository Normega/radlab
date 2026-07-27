-- ============================================================
-- WP1 ingest smoke check — run after a test PDF through
-- /academic/fieldguide/ingest. Read-only, safe to re-run.
-- Run against the radlab-academic project, NOT main radlab.
-- ============================================================
create or replace function pg_temp.wp1_ingest_check()
returns table (step text, result text)
language plpgsql
as $fn$
declare
  r record;
  n int; bad int; upd int;
begin
  -- ── the job itself ────────────────────────────────────────
  step := '=== JOBS ===';  result := '';  return next;
  for r in
    select id, status, coalesce(input_tokens,0) i, coalesce(output_tokens,0) o,
           left(coalesce(error,''), 90) err,
           jsonb_array_length(coalesce(result_json->'pages','[]'::jsonb)) pages
    from public.ingest_jobs order by created_at desc limit 3
  loop
    step := 'job ' || left(r.id::text, 8);
    result := r.status || ' | ' || r.pages || ' pages | ' || r.i || ' in / ' || r.o || ' out'
              || case when r.err <> '' then ' | ERROR: ' || r.err else '' end;
    return next;
  end loop;
  if not found then step := 'job'; result := '(no ingest jobs yet)'; return next; end if;

  -- ── 1. pages must be shells: content NULL, status proposed ──
  step := '=== 1. PAGES (expect shells) ===';  result := '';  return next;
  for r in select slug, type, status, (content is null) empty, coalesce(summary,'(none)') s
           from public.wiki_pages order by created_at
  loop
    step := '  ' || r.slug;
    result := r.type || ' | ' || r.status || ' | body_empty=' || r.empty || ' | ' || left(r.s, 60);
    return next;
  end loop;

  select count(*), count(*) filter (where content is not null) into n, bad from public.wiki_pages;
  step := 'VERDICT 1';
  result := case when n = 0 then 'NO PAGES — ingest wrote nothing. Check the job error above.'
                 when bad = 0 then 'PASS — all ' || n || ' pages are shells (no unreviewed body in wiki_pages)'
                 else 'FAIL — ' || bad || ' page(s) have content set; unreviewed text reached wiki_pages' end;
  return next;

  -- ── 2. proposals: pending, with body + job linkage ─────────
  step := '=== 2. PROPOSALS ===';  result := '';  return next;
  for r in select p.slug, v.kind, coalesce(v.action,'?') act, v.review_status rs,
                  length(coalesce(v.content,'')) len, (v.job_id is not null) linked
           from public.wiki_page_versions v join public.wiki_pages p on p.id = v.page_id
           order by v.created_at
  loop
    step := '  ' || r.slug;
    result := r.kind || ' | action=' || r.act || ' | ' || r.rs || ' | body=' || r.len
              || ' chars | job_linked=' || r.linked;
    return next;
  end loop;

  select count(*), count(*) filter (where review_status <> 'pending' or content is null or job_id is null)
    into n, bad from public.wiki_page_versions where kind = 'proposed';
  step := 'VERDICT 2';
  result := case when n = 0 then 'NO PROPOSALS — persistProposals wrote nothing.'
                 when bad = 0 then 'PASS — ' || n || ' proposal(s), all pending with body + job link'
                 else 'FAIL — ' || bad || ' proposal(s) missing body/job link or not pending' end;
  return next;

  -- accepted versions should NOT exist yet (nothing reviewed)
  select count(*) into n from public.wiki_page_versions where kind = 'accepted';
  step := 'VERDICT 2b';
  result := case when n = 0 then 'PASS — no accepted versions (nothing auto-published)'
                 else 'FAIL — ' || n || ' accepted version(s) exist without review' end;
  return next;

  -- ── 3. links must be empty until content is accepted ───────
  select count(*) into n from public.wiki_links;
  step := 'VERDICT 3';
  result := case when n = 0 then 'PASS — wiki_links empty (proposals are not leaking into the graph)'
                 else 'FAIL — ' || n || ' link(s) exist; unreviewed content reached the link graph' end;
  return next;

  -- ── did the index actually reach the prompt? ───────────────
  -- action=update is only meaningful if the target page predates the job
  -- that proposed it. A model can label a page 'update' that never existed;
  -- persistProposals then creates a fresh shell and the rows look identical
  -- to a real update. Compare against page creation to tell them apart.
  step := '=== INDEX REUSE ===';  result := '';  return next;
  for r in
    select p.slug, v.action, p.created_at < j.created_at as predates
    from public.wiki_page_versions v
    join public.wiki_pages p on p.id = v.page_id
    left join public.ingest_jobs j on j.id = v.job_id
    where v.kind = 'proposed' and j.id is not null
    order by j.created_at, p.slug
  loop
    step := '  ' || r.slug;
    result := 'action=' || r.action
      || case when r.action = 'update' and r.predates then ' | GENUINE — page predates this job'
              when r.action = 'update' then ' | SUSPECT — page created by this same job; the model claimed an update on a page that did not exist'
              when r.predates then ' | STALE — page already existed but came back as new; the model ignored the index entry'
              else ' | new page, first sighting' end;
    return next;
  end loop;

  select count(*) into upd
  from public.wiki_page_versions v
  join public.wiki_pages p on p.id = v.page_id
  join public.ingest_jobs j on j.id = v.job_id
  where v.kind='proposed' and v.action='update' and p.created_at < j.created_at;

  select count(*) into bad
  from public.wiki_page_versions v
  join public.wiki_pages p on p.id = v.page_id
  join public.ingest_jobs j on j.id = v.job_id
  where v.kind='proposed' and v.action='update' and p.created_at >= j.created_at;

  step := 'VERDICT 4';
  result := case
    when upd > 0 and bad = 0 then 'PASS — ' || upd || ' genuine update(s): the wiki_pages index reached the prompt. This is what retiring the job-replay index was for.'
    when upd > 0 then 'MIXED — ' || upd || ' genuine, ' || bad || ' suspect. Read the rows above.'
    when bad > 0 then 'FAIL — ' || bad || ' update(s) target pages that did not exist. The index is not reaching the model.'
    else 'none yet — expected until a SECOND, related PDF. All-new on ingest #1 is correct.' end;
  return next;
end
$fn$;

select * from pg_temp.wp1_ingest_check();
