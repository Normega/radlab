-- radlab-academic. gap_claims.first_submitted_at: when a claim was FIRST submitted,
-- kept through every send-back and resubmission (Norm, 2026-10-08).
--
-- submit_claim() sets submitted_at = now() on every submission, so a resubmission
-- after a send-back overwrote the original time. Contribution 1 was due Oct 7; a
-- student who submitted on time, was sent back, and resubmitted on Oct 12 looked
-- late on the only timestamp the claim kept, and nothing anywhere recorded that
-- they had been on time. Norm's rule: a send-back gives another 14 days, and a
-- resubmission inside that window is not late. This column is what lets anyone
-- show "on time the first time".
--
-- Stamped by a trigger, not by submit_claim(), so no path into 'submitted' can
-- miss it. The trigger name sorts after gap_claims_guard (triggers fire in name
-- order), so the guard sees the row before this bookkeeping is added -- the same
-- arrangement as note_claim_decision_trg.
--
-- Backfill, from what survives: submitted_at is exact for every claim never sent
-- back (177 at the time of writing) and for a claim sent back once and awaiting
-- resubmission (40). It cannot recover a first time already overwritten: an
-- accepted claim that was sent back before acceptance gets its LAST submission.
-- No claim currently under review had lost its time.

ALTER TABLE public.gap_claims ADD COLUMN IF NOT EXISTS first_submitted_at timestamptz;

COMMENT ON COLUMN public.gap_claims.first_submitted_at IS
  'When this claim was first submitted; unlike submitted_at, never moved by a resubmission. Stamped by gap_claims_stamp_first_submit. Backfilled 2026-10-08 from submitted_at (exact unless the claim had already been resubmitted).';

CREATE OR REPLACE FUNCTION public.stamp_first_submit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  if NEW.status = 'submitted' and NEW.first_submitted_at is null then
    NEW.first_submitted_at := coalesce(NEW.submitted_at, now());
  end if;
  return NEW;
end $$;

DROP TRIGGER IF EXISTS gap_claims_stamp_first_submit ON public.gap_claims;
CREATE TRIGGER gap_claims_stamp_first_submit
  BEFORE INSERT OR UPDATE ON public.gap_claims
  FOR EACH ROW EXECUTE FUNCTION public.stamp_first_submit();

-- Backfill. gap_claims_guard refuses any write it cannot attribute to staff or to the
-- claim flow (it would read this as "not your claim"), so it is suspended for this one
-- statement only; the migration runs in a single transaction, so it is never off for
-- anyone else.
ALTER TABLE public.gap_claims DISABLE TRIGGER gap_claims_guard;
UPDATE public.gap_claims SET first_submitted_at = submitted_at
 WHERE first_submitted_at IS NULL AND submitted_at IS NOT NULL;
ALTER TABLE public.gap_claims ENABLE TRIGGER gap_claims_guard;
