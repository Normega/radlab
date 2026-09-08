-- L1 (2026-09-08): students got "new row violates row-level security" when
-- submitting a quiz the console still showed OPEN. The INSERT/UPDATE policies
-- re-derived their own deadline (now() < opened_at + auto_close_seconds) on
-- top of status='open', so a check-in opened longer than its auto-close
-- window silently refused writes while the instructor believed it was live
-- (quiz opened 14:22 with a 15-min window, run to 14:56 → all submissions
-- after 14:37 rejected). The auto-close countdown is a console affordance
-- that flips status; RLS must not independently second-guess it. status is
-- now the sole authority — closing (manual or auto) sets status, and that
-- gates writes.
drop policy if exists "checkin_responses: own write while open" on public.checkin_responses;
create policy "checkin_responses: own write while open"
  on public.checkin_responses for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from checkins c
                where c.id = checkin_responses.checkin_id and c.status = 'open')
  );

drop policy if exists "checkin_responses: own update while open" on public.checkin_responses;
create policy "checkin_responses: own update while open"
  on public.checkin_responses for update to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from checkins c
                where c.id = checkin_responses.checkin_id and c.status = 'open')
  );
