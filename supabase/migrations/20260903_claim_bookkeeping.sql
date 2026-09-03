-- The source-capture and integration columns added by 20260903_claim_source are
-- SYSTEM BOOKKEEPING about a claim, not the student's work on it — the same
-- category as notified_at, which gap_claims_guard already lets through on the
-- grounds that "recording that we told a student is not a modification of their
-- work."
--
-- Without this, every server-side write to those columns is rejected by the
-- guard: the service key carries no person identity, so current_person_id() is
-- null, `old.person_id is distinct from null` is true, and the trigger raises
-- 'not your claim' — which surfaced to students as exactly that, on a 500,
-- while they were looking at their own claim.
--
-- The escape is gated on radlab.claim_flow, which only a SECURITY DEFINER
-- function can set, so it is reachable by the two RPCs below and by nothing a
-- client can call directly.

create or replace function public.gap_claims_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $function$
declare
  v_staff boolean;
  v_flow  boolean := coalesce(current_setting('radlab.claim_flow', true), '') = '1';
  v_book  text[] := array['notified_at', 'source_kind', 'source_fulltext', 'source_url_full',
                          'source_captured_at', 'integration_status', 'integration_note',
                          'integration_version_id'];
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

  -- Source capture and integration bookkeeping, server-side only. Same
  -- reasoning, extended to the columns the contribution pipeline writes on the
  -- student's behalf: caching the source text and recording where the drafted
  -- section went are facts ABOUT the claim, not edits TO it.
  if v_flow and (to_jsonb(new) - v_book) = (to_jsonb(old) - v_book) then
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
$function$;

-- The two writes the contribution pipeline makes on a student's behalf. Both
-- set the flow flag, so both land in the bookkeeping escape above; neither can
-- touch anything else on the claim.

create or replace function public.record_claim_source(
  p_claim_id uuid, p_kind text, p_fulltext text, p_url text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform set_config('radlab.claim_flow', '1', true);
  update gap_claims
  set source_kind = p_kind, source_fulltext = p_fulltext,
      source_url_full = p_url, source_captured_at = now()
  where id = p_claim_id;
end;
$$;

create or replace function public.record_claim_integration(
  p_claim_id uuid, p_status text, p_note text, p_version_id uuid default null)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform set_config('radlab.claim_flow', '1', true);
  update gap_claims
  set integration_status = p_status, integration_note = p_note,
      integration_version_id = coalesce(p_version_id, integration_version_id)
  where id = p_claim_id;
end;
$$;

-- Server-only: these are called with the service key, never from a browser.
revoke all on function public.record_claim_source(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.record_claim_integration(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_claim_source(uuid, text, text, text) to service_role;
grant execute on function public.record_claim_integration(uuid, text, text, uuid) to service_role;
