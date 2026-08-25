-- Two fixes to the claim guard, found by accepting a submission.
--
-- 1. "accepted claims are read-only" was blocking the notification stamp.
--    The rule is right about claim CONTENT — an accepted claim's source,
--    limitation and status must not move, because it has been graded. But
--    notified_at is bookkeeping about us, not about the student's work, and
--    the rule was broad enough to catch it. An update that changes nothing
--    except notified_at now passes, expressed as a whole-row comparison so it
--    stays correct when columns are added later.
--
--    Safe by construction: `authenticated` has no UPDATE grant on
--    notified_at (column grants, 20260808_claim_flow), so no student can
--    reach this path — only the service-role notifier can. Verified with a
--    student JWT: reopening an accepted claim still raises, and writing
--    notified_at is refused at the grant layer before the trigger runs.
--
-- 2. `anon` still held INSERT/UPDATE/DELETE on gap_claims, left from before
--    the column-grant lockdown, which only tightened `authenticated`. RLS
--    blocks anon today because every policy is `to authenticated` — but that
--    is one permissive policy away from mattering.
create or replace function public.gap_claims_guard()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_staff boolean;
  v_flow  boolean := coalesce(current_setting('radlab.claim_flow', true), '') = '1';
begin
  select is_course_staff(g.course_id) into v_staff
  from page_gaps g where g.id = coalesce(new.gap_id, old.gap_id);
  if coalesce(v_staff, false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not v_flow then
      raise exception 'claims are created through claim_gap(), not direct insert';
    end if;
    return new;
  end if;

  -- Notification bookkeeping only: nothing about the claim itself changed.
  -- Checked before the ownership and read-only rules, because recording that
  -- we told a student is not a modification of their work.
  if (to_jsonb(new) - 'notified_at') = (to_jsonb(old) - 'notified_at') then
    return new;
  end if;

  if old.person_id is distinct from current_person_id() and not v_flow then
    raise exception 'not your claim';
  end if;

  if old.status = 'accepted' then
    raise exception 'accepted claims are read-only';
  end if;

  if old.status = 'submitted' then
    raise exception 'submitted claims are locked while under review';
  end if;

  if old.status = 'withdrawn' then
    if new.status = 'claimed' and v_flow then
      return new;
    end if;
    raise exception 'withdrawn claims are re-opened through claim_gap()';
  end if;

  if new.status = 'claimed' or new.status = 'withdrawn' then
    return new;
  end if;
  if new.status = 'submitted' then
    if not v_flow then
      raise exception 'submissions go through submit_claim(), which runs the precheck';
    end if;
    if old.expires_at is not null and old.expires_at < now() then
      raise exception 'this claim expired on % — re-claim the gap if slots remain', old.expires_at::date;
    end if;
    new.submitted_at := coalesce(new.submitted_at, now());
    return new;
  end if;

  raise exception 'transition % -> % is not allowed', old.status, new.status;
end;
$$;

revoke insert, update, delete on public.gap_claims from anon;
