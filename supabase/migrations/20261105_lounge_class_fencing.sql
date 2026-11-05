-- 20261105_lounge_class_fencing.sql
--
-- Fence Lecture Lounge classes from each other, and class-only accounts from the lab.
-- Decided by Norm on 2026-11-04 ("we now have all week to fix the data gap"; "build and
-- test now", Nov 5), as item G3 of the Lecture Lounge outreach plan. It matters for PSY240
-- and PSY309 today, not only for future classes.
--
-- What was open (audited 2026-11-04 against the live policies):
--   1. class_questions "own or published read": any signed-in account could read every
--      class's published questions, with each author's profile_id.
--   2. question_votes inserts checked only that the question was published, so an outsider
--      could vote in any class. (checkin_responses and class_questions inserts were already
--      refused for outsiders, but only as a side effect: their open-window check reads
--      checkins, which outsiders cannot see. They now check membership explicitly.)
--   3. profiles "lab read all": the 10 non-super-admin lab accounts could read every
--      profile, including the U of T emails of 310 class-only students who are in no study.
--   4. api/lounge-ai.js let any lab account run summaries for any class (fixed in that file).
--
-- Before this ran: 0 responses and 0 questions came from non-members, so the membership
-- checks take nothing away from any current student.
--
-- Verified 2026-11-05 in rolled-back transactions as real accounts, before and after:
-- a non-member reading a published PSY240 question (1 -> 0) and voting on it (accepted ->
-- refused); a lab account reading a class-only student's profile (1 -> 0; profiles with a
-- U of T email visible to lab 308 -> 2; total 4956 -> 4646). Unchanged: a member answers,
-- edits the answer, asks, reads published questions and votes; the super admin sees all
-- 4956 profiles; a PSY240 TA's get_class_participation still returns the roster.
--
-- Not fixed here: any signed-in account can still add itself to any class
-- (class_members "join own"), because that is how the QR join works. Closing it is the
-- verified one-step join (G1). Within a class, question and vote rows still carry
-- profile ids, which students cannot resolve to a person.
--
-- No new tables, so no grants are needed (CLAUDE.md, explicit grants); the two helper
-- functions are granted to authenticated below.

-- Helpers, SECURITY DEFINER so the checks don't depend on (or recurse through) the
-- caller's own row-level access to lectures, class_members, profiles or study_enrollments.
create or replace function public.is_member_of_checkin_class(p_checkin_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
      from checkins c
      join lectures l on l.id = c.lecture_id
      join class_members cm on cm.class_id = l.class_id
     where c.id = p_checkin_id and cm.user_id = auth.uid());
$$;

create or replace function public.is_class_only_profile(p_profile_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from class_members cm where cm.user_id = p_profile_id)
     and not exists (select 1 from study_enrollments e where e.profile_id = p_profile_id)
     and coalesce((select role from profiles where id = p_profile_id), '') <> 'lab';
$$;

revoke all on function public.is_member_of_checkin_class(uuid) from public, anon;
revoke all on function public.is_class_only_profile(uuid) from public, anon;
grant execute on function public.is_member_of_checkin_class(uuid) to authenticated;
grant execute on function public.is_class_only_profile(uuid) to authenticated;

-- 1. Published questions: members of that class only (class admins and super admins keep
--    "class_questions: admins read all").
drop policy if exists "class_questions: own or published read" on public.class_questions;
create policy "class_questions: own or published read" on public.class_questions
  for select to authenticated
  using (profile_id = (select auth.uid())
         or (status = 'published' and public.is_member_of_checkin_class(checkin_id)));

-- 2. Writes need membership. The open-window conditions are unchanged.
drop policy if exists "class_questions: own write while open" on public.class_questions;
create policy "class_questions: own write while open" on public.class_questions
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.is_member_of_checkin_class(checkin_id)
    and exists (select 1 from checkins c
                 where c.id = class_questions.checkin_id
                   and ((c.status = 'open'
                         and (c.auto_close_seconds is null or c.opened_at is null
                              or now() < c.opened_at + make_interval(secs => (c.auto_close_seconds + 90)::double precision)))
                     or (c.status = any (array['closed', 'results_ready'])
                         and c.closed_at > now() - interval '00:01:30'))));

drop policy if exists "checkin_responses: own write while open" on public.checkin_responses;
create policy "checkin_responses: own write while open" on public.checkin_responses
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.is_member_of_checkin_class(checkin_id)
    and exists (select 1 from checkins c
                 where c.id = checkin_responses.checkin_id
                   and ((c.status = 'open'
                         and (c.auto_close_seconds is null or c.opened_at is null
                              or now() < c.opened_at + make_interval(secs => (c.auto_close_seconds + 90)::double precision)))
                     or (c.status = any (array['closed', 'results_ready'])
                         and c.closed_at > now() - interval '00:01:30'
                         and c.quiz_revealed_at is null))));

drop policy if exists "checkin_responses: own update while open" on public.checkin_responses;
create policy "checkin_responses: own update while open" on public.checkin_responses
  for update to authenticated
  using (
    profile_id = (select auth.uid())
    and public.is_member_of_checkin_class(checkin_id)
    and exists (select 1 from checkins c
                 where c.id = checkin_responses.checkin_id
                   and ((c.status = 'open'
                         and (c.auto_close_seconds is null or c.opened_at is null
                              or now() < c.opened_at + make_interval(secs => (c.auto_close_seconds + 90)::double precision)))
                     or (c.status = any (array['closed', 'results_ready'])
                         and c.closed_at > now() - interval '00:01:30'
                         and c.quiz_revealed_at is null))))
  with check (
    profile_id = (select auth.uid())
    and public.is_member_of_checkin_class(checkin_id)
    and exists (select 1 from checkins c
                 where c.id = checkin_responses.checkin_id
                   and ((c.status = 'open'
                         and (c.auto_close_seconds is null or c.opened_at is null
                              or now() < c.opened_at + make_interval(secs => (c.auto_close_seconds + 90)::double precision)))
                     or (c.status = any (array['closed', 'results_ready'])
                         and c.closed_at > now() - interval '00:01:30'
                         and c.quiz_revealed_at is null))));

drop policy if exists "question_votes: own insert on published" on public.question_votes;
create policy "question_votes: own insert on published" on public.question_votes
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from class_questions q
                 where q.id = question_votes.question_id
                   and q.status = 'published'
                   and public.is_member_of_checkin_class(q.checkin_id)));

-- 3. Lab accounts stop seeing class-only accounts (in a class, in no study). Everything else
--    they saw before stays visible. Super admins read every profile through their own policy,
--    which they previously got only by also holding the lab role.
drop policy if exists "profiles: lab read all" on public.profiles;
create policy "profiles: lab read all but class-only" on public.profiles
  for select to authenticated
  using ((select public.my_role()) = 'lab' and not public.is_class_only_profile(id));

create policy "profiles: super admin read all" on public.profiles
  for select to authenticated
  using ((select public.is_super_admin()));

drop policy if exists "profiles: lab update participants" on public.profiles;
create policy "profiles: lab update participants" on public.profiles
  for update to authenticated
  using ((select public.my_role()) = 'lab' and role = 'participant' and not public.is_class_only_profile(id))
  with check (role = 'participant' and not (super_admin is distinct from false));
