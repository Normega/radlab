-- ============================================================
-- WP1 apply check (20260725_academic_wiki_schema.sql)
-- Run against the radlab-academic project. Read-only; safe to
-- re-run; works whether or not the migration has been applied.
-- ============================================================
create or replace function pg_temp.wp1_check()
returns table (step text, result text)
language plpgsql
as $fn$
declare
  missing text;
  n int;
  m int;
begin
  -- 1. tables and view
  select string_agg(name, ', ') into missing
  from (values ('dsm_chapters'),('wiki_pages'),('wiki_page_versions'),
               ('wiki_links'),('disorders'),('disorder_criteria_links')) v(name)
  where to_regclass('public.' || name) is null;
  step := '1. tables + view';
  result := coalesce('MISSING: ' || missing, 'OK - all 6 present');
  return next;

  -- 2. functions
  select string_agg(name, ', ') into missing
  from (values ('is_course_member(uuid)'),('is_course_staff(uuid)'),
               ('wiki_pages_snapshot()'),('wiki_pages_touch()'),('sync_wiki_links()'),
               ('wiki_links_resolve()'),('wiki_pages_bind_links()')) v(name)
  where to_regprocedure('public.' || name) is null;
  step := '2. functions';
  result := coalesce('MISSING: ' || missing, 'OK - all 7 present');
  return next;

  -- 3. triggers on wiki_pages + wiki_links
  select count(*) into n from pg_trigger
  where not tgisinternal
    and tgrelid = any (array_remove(
      array[to_regclass('public.wiki_pages'), to_regclass('public.wiki_links')], null));
  step := '3. triggers';
  result := case when n = 5 then 'OK - 5 of 5' else 'EXPECTED 5, FOUND ' || n end;
  return next;

  -- 4/5. seed data (only meaningful once the table exists)
  if to_regclass('public.dsm_chapters') is null then
    step := '4. dsm_chapters seed';  result := 'n/a - table not present'; return next;
    step := '5. irregular slugs';    result := 'n/a - table not present'; return next;
  else
    execute 'select count(*), count(*) filter (where doi_slug is not null) from public.dsm_chapters'
      into n, m;
    step := '4. dsm_chapters seed';
    result := case when n = 20 and m = 19 then 'OK - 20 chapters, 19 slugs'
                   else 'EXPECTED 20 rows / 19 slugs, FOUND ' || n || ' / ' || m end;
    return next;

    execute $q$select count(*) from public.dsm_chapters where doi_slug in
      ('.x02_Schizophrenia_Spectrum', '.x12_Sleep-Wake_Disorders', '.x14_Gender_Dysophoria',
       '.x15_Disruptive_Impulse_Control', '.x16_Substance_Related_Disorders')$q$ into n;
    step := '5. irregular slugs';
    result := case when n = 5 then 'OK - all 5 verbatim'
                   else 'ALTERED - found ' || n || ' of 5. Someone "corrected" a slug; re-seed from the migration.' end;
    return next;
  end if;

  -- 6. read policies
  select count(*) into n from pg_policy
  where polrelid = any (array_remove(array[
    to_regclass('public.wiki_pages'), to_regclass('public.wiki_page_versions'),
    to_regclass('public.wiki_links'), to_regclass('public.disorders'),
    to_regclass('public.dsm_chapters')], null));
  step := '6. read policies';
  result := case when n >= 6 then 'OK - ' || n || ' policies' else 'ONLY ' || n || ' - expected 6+' end;
  return next;

  -- 7. the CLAUDE.md audit: RLS enabled with no policy blocks everything, silently
  select string_agg(relname, ', ') into missing from (
    select c.relname from pg_class c
    left join pg_policy p on p.polrelid = c.oid
    where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace and c.relrowsecurity
      -- 'invites' is service-role-only on purpose (init migration); not a defect.
      and c.relname <> 'invites'
    group by c.relname having count(p.oid) = 0
  ) t;
  step := '7. RLS-on-but-no-policy';
  result := coalesce('REVIEW: ' || missing || ' - RLS on, no policy: silently blocks all access',
                     'OK - none (invites excluded: service-role-only by design)');
  return next;
end
$fn$;

select * from pg_temp.wp1_check();
