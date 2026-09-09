-- Performance pass ahead of the 199-student join wave (advisors, 2026-09-08).

-- 1. The advisors' one WARN-level RLS finding: auth.uid() re-evaluated per
-- row on identity.people. Wrapping in (select ...) makes it an InitPlan,
-- evaluated once per query.
drop policy "read own person row" on identity.people;
create policy "read own person row"
  on identity.people for select
  to authenticated
  using (auth_user_id = (select auth.uid()));

-- 2. Covering indexes for the foreign keys on hot read paths. Every page
-- load's access check joins enrollments by course; the gap board and wiki
-- filter by course; roster admin resolves person links. Cold analytics FKs
-- (created_by, reviewed_by, etc.) are deliberately left unindexed.
create index if not exists enrollments_course_id_idx on public.enrollments (course_id);
create index if not exists page_gaps_course_id_idx on public.page_gaps (course_id);
create index if not exists ingest_jobs_course_id_idx on public.ingest_jobs (course_id);
create index if not exists invites_course_id_idx on public.invites (course_id);
create index if not exists roster_person_id_idx on identity.roster (person_id);
