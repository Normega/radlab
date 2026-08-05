-- radlab-academic (qldgwpneygvgcvexlduz) — NOT the main radlab project.
--
-- Pre-publish blocker found 2026-08-05.
--
-- `wiki_page_provenance` is the view that supplies the "Built from" source list
-- rendered by WikiPage.jsx. It is correctly `security_invoker=true`, so it runs
-- with the caller's permissions — but its two underlying tables are staff-only:
--
--   wiki_page_versions : "staff read versions"     (is_course_staff)
--   ingest_jobs        : "staff read course jobs"  (role in ta/instructor)
--
-- Consequence: a student with an active enrolment sees EVERY page with an EMPTY
-- sources panel. The corpus's central claim — that every statement is traceable
-- to a licensed source — would be invisible to precisely the audience it is for.
-- Staff never noticed because staff satisfy the staff policy.
--
-- Fix: additive read policies for course MEMBERS, deliberately narrower than the
-- staff ones. Members may read only:
--   * accepted versions of pages that are PUBLISHED, and
--   * the ingest_jobs rows those versions actually reference.
-- Draft pages, rejected/pending proposals, version bodies of unpublished pages,
-- and unrelated jobs stay staff-only. Nothing existing is altered or dropped.

begin;

-- Accepted versions of published pages, for provenance only.
create policy "members read accepted versions of published pages"
  on wiki_page_versions
  for select
  to authenticated
  using (
    review_status = 'accepted'
    and exists (
      select 1 from wiki_pages p
      where p.id = wiki_page_versions.page_id
        and p.status = 'published'
        and is_course_member(p.course_id)
    )
  );

-- Only the jobs referenced by a version a member is already allowed to read.
create policy "members read jobs cited by published pages"
  on ingest_jobs
  for select
  to authenticated
  using (
    is_course_member(course_id)
    and exists (
      select 1
      from wiki_page_versions v
      join wiki_pages p on p.id = v.page_id
      where v.job_id = ingest_jobs.id
        and v.review_status = 'accepted'
        and p.status = 'published'
    )
  );

commit;

-- Verification after applying (expect both to return rows for a STUDENT-role
-- enrolment, and to return nothing before any page is published):
--
--   select slug, source_count from wiki_page_provenance order by slug limit 5;
--
-- NOTE: as of 2026-08-05 there is no student account on this project — only
-- instructor and ta. The member-only read path has therefore never been
-- exercised end to end. Create a test student enrolment and confirm the sources
-- panel renders before relying on this.
