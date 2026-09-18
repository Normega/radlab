-- A Question of the Week wall stays open for the term (Norm, 2026-09-16,
-- reaffirmed 2026-09-17 after PSY240 week 2 was closed a second time).
--
-- Policy, both courses: a weekly wall is never closed during term. The lobby
-- card features the most recently opened question and Course Home lists the
-- rest, so nothing needs closing to make room — and closing is not harmless:
-- a student who missed the week can no longer answer it, and PSY240 week 1
-- gained 41 further answers in the day after it was reopened.
--
-- It had been closed twice by hand in nine days (2026-09-15 by a cleanup, and
-- 2026-09-17 12:57 ET from the console's planner). The second time is what
-- makes this a guard rather than a reminder: the console's Close control is
-- one tap, sits beside Open, and as of 2026-09-16 three TAs hold class_admin,
-- so the surface is wider than the one person who knows the policy.
--
-- The rule: an end-user session may not take a `kind='weekly'` check-in out of
-- 'open' unless it is a super admin. Following 20260909_reset_checkin_super_
-- admin_only.sql — narrow the guard, and fix the UI in the same commit so the
-- guard and the console agree rather than leaving a visible dead control.
--
-- `auth.uid() is null` passes deliberately: that is service_role or a direct
-- SQL session (migrations, MCP, the end-of-term pass), not a browser. Clients
-- always carry a uid, so this exempts no one using the app.
--
-- End of term: closing every wall is the deliberate act that makes them
-- readable by students who never answered — while a wall is open,
-- get_weekly_wall withholds other people's answers until you have posted your
-- own. Norm can do it from the console (he is the only super admin), or in SQL:
--
--   update checkins set status='closed', closed_at=now()
--    where kind='weekly' and status='open'
--      and lecture_id in (select id from lectures where class_id = '…');

CREATE OR REPLACE FUNCTION public.forbid_weekly_wall_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if NEW.kind <> 'weekly' then
    return NEW;
  end if;
  if OLD.status = 'open' and NEW.status is distinct from 'open' then
    if auth.uid() is not null and not is_super_admin() then
      raise exception
        'A Question of the Week wall stays open for the term; closing it is restricted to the instructor';
    end if;
  end if;
  return NEW;
end $$;

DROP TRIGGER IF EXISTS forbid_weekly_wall_close_trg ON public.checkins;
CREATE TRIGGER forbid_weekly_wall_close_trg
  BEFORE UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.forbid_weekly_wall_close();
