-- ============================================================
-- WP3 review state — where the queue stands right now.
-- Read-only, safe to re-run. radlab-academic project.
-- Run before and after a review test to see exactly what moved.
-- ============================================================
create or replace function pg_temp.wp3_state()
returns table (step text, result text)
language plpgsql
as $fn$
declare r record; n int;
begin
  step := '=== PROPOSALS ==='; result := ''; return next;
  for r in
    select review_status, count(*) c from public.wiki_page_versions
    where kind = 'proposed' group by review_status order by review_status
  loop
    step := '  ' || r.review_status; result := r.c || ' proposal(s)'; return next;
  end loop;

  step := '=== PAGES ==='; result := ''; return next;
  for r in select status, count(*) c from public.wiki_pages group by status order by status
  loop
    step := '  ' || r.status; result := r.c || ' page(s)'; return next;
  end loop;

  select count(*) into n from public.wiki_pages where content is not null;
  step := '  with a body'; result := n || ' page(s) carry accepted content'; return next;

  step := '=== DERIVED ==='; result := ''; return next;
  select count(*) into n from public.wiki_page_versions where kind = 'accepted';
  step := '  accepted snapshots'; result := n::text; return next;

  select count(*) into n from public.wiki_links;
  step := '  wikilinks'; result := n::text; return next;

  select count(*) into n from public.wiki_links where target_page_id is null;
  step := '  of those, red links';
  result := n || ' unresolved' || case when n > 0 then ' (targets not yet created)' else '' end;
  return next;

  -- What a student would actually see right now.
  step := '=== STUDENT-VISIBLE ==='; result := ''; return next;
  for r in select slug, length(content) len from public.wiki_pages
           where status = 'published' order by slug
  loop
    step := '  ' || r.slug; result := r.len || ' chars'; return next;
  end loop;
  if not found then
    step := '  (none)'; result := 'no page is published yet'; return next;
  end if;

  step := '=== CATALOG ==='; result := ''; return next;
  select count(*) into n from public.disorders;
  step := '  seeded rows'; result := n || ' (expect 123)'; return next;
  select count(*) into n from public.disorders where page_id is not null;
  step := '  linked to a page'; result := n::text; return next;
end
$fn$;

select * from pg_temp.wp3_state();
