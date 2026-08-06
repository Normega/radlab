-- radlab-academic (qldgwpneygvgcvexlduz) — NOT the main radlab project.
--
-- Bug report: "permission denied for table people" on
-- /academic/fieldguide/submissions, 2026-08-06. Introduced the same day by
-- submission_review_queue, which joins identity.people to show whose
-- submission a row is.
--
-- Three faults, each hidden behind the one in front of it:
--
-- 1. GRANT. identity.people had SELECT granted to `postgres` only. Any client
--    query touching it failed on privileges before RLS was consulted, which is
--    why the message was "permission denied" rather than an empty result. The
--    existing "read own person row" policy had therefore never been reachable
--    from the client — nothing had queried the table until now.
--
-- 2. SCHEMA USAGE. Granting the table is not enough without USAGE on the
--    schema. USAGE confers no access by itself: every table in `identity`
--    still needs its own grant plus RLS, and only `people` has one.
--
-- 3. NESTED RLS. The first version of the staff policy tested `enrollments`
--    directly. But enrollments carries "read own enrollments"
--    (person_id = current_person_id()), so the EXISTS subquery could only ever
--    see the caller's own row. A reviewer saw exactly one name — their own —
--    and every submission would have rendered with a blank student. This is
--    the same reason the existing is_course_member / is_course_staff helpers
--    are SECURITY DEFINER: an authorisation check has to be able to see rows
--    the caller cannot.
--
-- Verified by RLS test rather than inspection, with SET LOCAL ROLE authenticated:
--   instructor → 2 rows (self + the TA enrolled in the same course)
--   student    → 1 row  (self only)

begin;

grant usage  on schema identity      to authenticated;
grant select on identity.people      to authenticated;

create or replace function shares_staffed_course(p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1
    from enrollments target
    join enrollments mine on mine.course_id = target.course_id
    where target.person_id = p_person_id
      and mine.person_id   = current_person_id()
      and mine.role in ('ta','instructor')
      and mine.status = 'active'
  )
$fn$;

drop policy if exists "staff read people enrolled in their course" on identity.people;

-- Scoped through shared enrolment rather than a blanket read on a table of
-- names and email addresses. The pre-existing "read own person row" policy is
-- left in place and is what a student matches.
create policy "staff read people enrolled in their course"
  on identity.people
  for select
  to authenticated
  using (shares_staffed_course(identity.people.id));

commit;
