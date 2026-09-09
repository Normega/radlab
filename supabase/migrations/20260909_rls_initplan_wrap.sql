-- main radlab. Performance advisor: 117 policies re-evaluated
-- auth.uid()/role()/jwt() per ROW instead of once per query
-- (auth_rls_initplan). Under L1's quiz load this is exactly the
-- checkin_responses hot path that produced 41 statement timeouts. Wrapping
-- the call as (SELECT auth.fn()) makes the planner evaluate it once as an
-- InitPlan -- semantically identical, the canonical Supabase remediation,
-- same fix already applied on academic (20260908_perf_indexes_and_initplan).
--
-- Done as a data-driven rewrite over pg_policies rather than 117
-- hand-written ALTERs: wrap any auth.<fn>() not already preceded by SELECT,
-- re-assert each policy's USING / WITH CHECK otherwise unchanged, and abort
-- unless exactly 117 policies were touched.
--
-- Verified after: 0 unwrapped calls remain, 251 total policies intact, and
-- a live student identity (psy240 sim) still reads own profile/membership
-- and is still blind to other classes' check-ins.
do $$
declare
  r record;
  new_qual text;
  new_check text;
  stmt text;
  n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual,'') ~ '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.(uid|role|jwt)\(\)'
        or coalesce(with_check,'') ~ '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.(uid|role|jwt)\(\)')
  loop
    new_qual  := regexp_replace(r.qual,       '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.(uid|role|jwt)\(\)', '(SELECT auth.\1())', 'g');
    new_check := regexp_replace(r.with_check, '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.(uid|role|jwt)\(\)', '(SELECT auth.\1())', 'g');
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if r.with_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;
    execute stmt;
    n := n + 1;
  end loop;
  if n <> 117 then
    raise exception 'expected to rewrite 117 policies, rewrote %', n;
  end if;
end $$;
