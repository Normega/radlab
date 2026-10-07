-- Evaluate the role helpers once per query, not once per row, on the tables a
-- Lecture Lounge class hammers. Who can see or change what is unchanged.
--
-- Why: these policies called my_role() / is_super_admin() bare. Both are
-- STABLE SECURITY DEFINER helpers that look the caller up in profiles, and a
-- bare call in a policy is evaluated for every row the scan touches (and it
-- also stops the planner using the caller's own-row index). Wrapped as
-- (SELECT fn()) the planner turns it into an InitPlan: one evaluation per
-- statement. Same function, same snapshot, same answer.
--
-- Found 2026-10-07 from PSY240 check-in #15: when it closed, ~100 phones
-- fetched results at once (1,604 requests in 30 s) and the slowest 5% took
-- 3.2 s (max 5.6 s), on checkins / class_questions / checkin_responses reads.
-- And get_session_bootstrap() (SECURITY INVOKER, every page load and tab
-- focus; 270k calls, the database's largest cumulative cost) took 19-40 ms
-- because "profiles: lab read all" made it seq-scan all ~3,000 profiles calling
-- my_role() on each (~9,000 buffer reads for one row). Rolled-back test of the
-- profiles change alone: 19 ms -> 5 ms.
--
-- Scope: the four Lecture Lounge / bootstrap tables only. The same bare-call
-- pattern is in ~150 more policies across ~70 tables; those want one sweep,
-- checked table by table, not a rider on this.
--
-- Verified before and after as a PSY240 student and as Norm: identical row
-- counts on all four tables.

-- profiles
ALTER POLICY "profiles: lab read all" ON public.profiles
  USING ((SELECT public.my_role()) = 'lab'::text);

ALTER POLICY "profiles: lab update participants" ON public.profiles
  USING (((SELECT public.my_role()) = 'lab'::text) AND (role = 'participant'::text))
  WITH CHECK ((role = 'participant'::text) AND (NOT (super_admin IS DISTINCT FROM false)));

ALTER POLICY "profiles: own update safe" ON public.profiles
  USING (id = (SELECT auth.uid()))
  WITH CHECK ((id = (SELECT auth.uid()))
    AND (role = (SELECT public.my_role()))
    AND (NOT (super_admin IS DISTINCT FROM (SELECT public.is_super_admin())))
    AND (NOT (study_id IS DISTINCT FROM (SELECT public.my_study_id()))));

ALTER POLICY "profiles: super_admin update all" ON public.profiles
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

-- checkins
ALTER POLICY "checkins: admins all" ON public.checkins
  USING ((SELECT public.is_super_admin()) OR (EXISTS (
    SELECT 1 FROM lectures l JOIN class_admins ca ON ca.class_id = l.class_id
     WHERE l.id = checkins.lecture_id AND ca.user_id = (SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_super_admin()) OR (EXISTS (
    SELECT 1 FROM lectures l JOIN class_admins ca ON ca.class_id = l.class_id
     WHERE l.id = checkins.lecture_id AND ca.user_id = (SELECT auth.uid()))));

-- class_questions
ALTER POLICY "class_questions: admins read all" ON public.class_questions
  USING ((SELECT public.is_super_admin()) OR (EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
     WHERE c.id = class_questions.checkin_id AND ca.user_id = (SELECT auth.uid()))));

ALTER POLICY "class_questions: admins update" ON public.class_questions
  USING ((SELECT public.is_super_admin()) OR (EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
     WHERE c.id = class_questions.checkin_id AND ca.user_id = (SELECT auth.uid()))))
  WITH CHECK ((SELECT public.is_super_admin()) OR (EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
     WHERE c.id = class_questions.checkin_id AND ca.user_id = (SELECT auth.uid()))));

-- checkin_responses
ALTER POLICY "checkin_responses: admins read all" ON public.checkin_responses
  USING ((SELECT public.is_super_admin()) OR (EXISTS (
    SELECT 1 FROM checkins c JOIN lectures l ON l.id = c.lecture_id JOIN class_admins ca ON ca.class_id = l.class_id
     WHERE c.id = checkin_responses.checkin_id AND ca.user_id = (SELECT auth.uid()))));
