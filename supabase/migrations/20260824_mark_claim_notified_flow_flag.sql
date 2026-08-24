-- mark_claim_notified was blocked by gap_claims_guard with "not your claim".
--
-- Correct behaviour by the guard, not a bug in it: the function runs under
-- service_role from api/claim-notify.js, so current_person_id() is null and
-- is_course_staff() is false — it looked exactly like a stranger writing to
-- someone else's claim, which is the thing the guard exists to stop.
--
-- The fix is the one the claim flow already uses: announce the write as a
-- sanctioned path with the transaction-local flag, the same way claim_gap()
-- and submit_claim() do. The flag is local, so it cannot leak past this
-- statement, and the function still touches nothing but notified_at.
create or replace function public.mark_claim_notified(p_claim_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
begin
  perform set_config('radlab.claim_flow', '1', true);
  update gap_claims set notified_at = now() where id = p_claim_id;
end;
$$;

revoke all on function public.mark_claim_notified(uuid) from public, anon, authenticated;
grant execute on function public.mark_claim_notified(uuid) to service_role;
