-- A check-in that holds student submissions cannot be deleted from the console
-- (Norm, 2026-09-17: "no more wall deletes after there are submissions").
--
-- The planner's Delete sits beside Edit on every check-in row, and both
-- checkin_responses and class_questions reference checkins ON DELETE CASCADE —
-- so one tap on a Question of the Week row would have destroyed 42 answers
-- (PSY240 week 1's wall is at 142), irreversibly and with no confirmation.
-- Same surface and same week as the accidental wall close that prompted
-- 20260917_weekly_walls_stay_open.sql; three TAs hold class_admin as of
-- 2026-09-16.
--
-- This one is NOT scoped to super admins, and that is deliberate. Closing a
-- wall is recoverable — the row is still there, and reopening it cost one
-- UPDATE twice this week. Deleting collected answers is not recoverable, and
-- the platform's standing rule is that a collected response is never
-- discarded. So no browser session deletes them, including the instructor's.
--
-- There is already a named, deliberate path for genuinely unwanted responses:
-- reset_checkin() (super-admin only, 20260909_reset_checkin_super_admin_only)
-- clears a check-in's answers and returns it to 'planned'; the empty row can
-- then be deleted normally. Two deliberate acts instead of one tap.
--
-- Deleting an EMPTY check-in stays ordinary planning work and is untouched.
--
-- `auth.uid() is null` passes: service_role, a migration, or the SQL editor —
-- deliberate database work, never the console.

CREATE OR REPLACE FUNCTION public.forbid_delete_answered_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_responses int;
  v_questions int;
begin
  if auth.uid() is null then
    return OLD;
  end if;

  select count(*) into v_responses from checkin_responses where checkin_id = OLD.id;
  select count(*) into v_questions from class_questions  where checkin_id = OLD.id;

  if v_responses > 0 or v_questions > 0 then
    raise exception
      'This check-in holds % student answer(s) and % question(s). Deleting it would destroy them, so it cannot be deleted here.',
      v_responses, v_questions;
  end if;

  return OLD;
end $$;

DROP TRIGGER IF EXISTS forbid_delete_answered_checkin_trg ON public.checkins;
CREATE TRIGGER forbid_delete_answered_checkin_trg
  BEFORE DELETE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.forbid_delete_answered_checkin();

-- What the planner needs to hide Delete on the rows the trigger will refuse:
-- one row per check-in, counts only. SECURITY DEFINER with the class-admin
-- check inside, so it never widens what a caller can read — a class admin can
-- already read these rows; this just avoids shipping thousands of them to
-- render a number.
CREATE OR REPLACE FUNCTION public.checkin_answer_counts(p_class_id uuid)
RETURNS TABLE (checkin_id uuid, answers int, questions int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if not exists (select 1 from class_admins ca
                 where ca.class_id = p_class_id and ca.user_id = auth.uid()) then
    raise exception 'not an admin of this class';
  end if;

  return query
    select c.id,
           (select count(*)::int from checkin_responses r where r.checkin_id = c.id),
           (select count(*)::int from class_questions  q where q.checkin_id = c.id)
      from checkins c
      join lectures l on l.id = c.lecture_id
     where l.class_id = p_class_id;
end $$;

REVOKE ALL ON FUNCTION public.checkin_answer_counts(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.checkin_answer_counts(uuid) TO authenticated, service_role;
