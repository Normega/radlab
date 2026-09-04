-- Two "lab write" policies gate on a role that cannot exist.
--
-- `composable_instruments` and `displays` both read
--   my_role() = ANY (ARRAY['lab', 'admin'])
-- but `profiles.role` is CHECK-constrained to ('lab', 'participant', 'public').
-- No profile can ever hold 'admin', so that branch has never matched anything
-- and never will.
--
-- The platform's actual elevated-privilege mechanism is `profiles.super_admin`
-- via `is_super_admin()`, and every comparable policy uses the shape
-- `my_role() = 'lab' OR is_super_admin()` (avatars, classes, class_admins,
-- checkins, checkin_responses, class_questions, the workbench tables). These
-- two are the outliers, written as though a role existed that does not.
--
-- Rewritten to that shape, which is what the dead branch evidently meant. This
-- is a NO-OP in practice today: there is exactly one super admin and they
-- already hold role = 'lab'. The value is that the policy stops implying a
-- permission model the database cannot express — the next person reading it
-- should not have to check the role constraint to find out that half of it is
-- unreachable.
--
-- Note the related asymmetry this does NOT change: `activities` (the
-- session-builder picker rows these two tables are paired with) is `lab` only,
-- with no super-admin clause. That stays as it is rather than being widened on
-- the strength of a dead branch elsewhere; it is only reachable-by-lab today
-- either way.

DROP POLICY "lab write" ON public.composable_instruments;
CREATE POLICY "lab write"
  ON public.composable_instruments
  FOR ALL
  TO authenticated
  USING      (my_role() = 'lab' OR is_super_admin())
  WITH CHECK (my_role() = 'lab' OR is_super_admin());

DROP POLICY "lab write" ON public.displays;
CREATE POLICY "lab write"
  ON public.displays
  FOR ALL
  TO authenticated
  USING      (my_role() = 'lab' OR is_super_admin())
  WITH CHECK (my_role() = 'lab' OR is_super_admin());
