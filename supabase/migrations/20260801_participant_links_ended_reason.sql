-- participant_links: separate WHY a link ended from WHAT the participant sees.
--
-- Background. `status` was doing two jobs at once: driving participant-facing
-- copy, and recording the cause. It did the first well and the second not at
-- all, because both terminal values were overloaded:
--
--   'revoked'  <- admin clicked Revoke (StudyDetail / AnonymousLinkPanel)
--              <- a newer link was issued (_shared/issueLink one-live-link rule)
--              <- adherence withdrawal (processAdherenceWithdrawal)
--   'expired'  <- the check_schedule timeout sweep
--              <- client-side supersession (lib/scheduleGenerator)
--
-- So "did someone cancel this, or did it just time out?" was unanswerable. Of
-- the 15 revoked rows at time of writing, 8 have a completed schedule row and 7
-- do not, and nothing in the schema distinguishes them.
--
-- The split lets `status` mean one thing to a participant:
--   'expired' = this window closed, there is nothing for you to do
--   'revoked' = something deliberate happened, talk to us
-- and `ended_reason` carry the audit trail underneath.
--
--   timeout        the expiry sweep passed expires_at        -> status 'expired'
--   superseded     the next session's link was issued, so    -> status 'expired'
--                  this one closed. The participant simply
--                  missed it; it is NOT an admin action.
--   admin_revoked  a human clicked Revoke                    -> status 'revoked'
--   withdrawn      adherence withdrawal ended participation  -> status 'revoked'

ALTER TABLE participant_links
  ADD COLUMN IF NOT EXISTS ended_reason text
    CHECK (ended_reason IN ('timeout', 'superseded', 'admin_revoked', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS ended_at     timestamptz,
  -- The acting admin, for admin_revoked. No FK: this is an audit breadcrumb and
  -- must survive the referenced account being removed.
  ADD COLUMN IF NOT EXISTS ended_by     uuid;

COMMENT ON COLUMN participant_links.ended_reason IS
  'Why the link stopped being usable. NULL for links that are still active or were used. See 20260801_participant_links_ended_reason.sql.';
COMMENT ON COLUMN participant_links.ended_by IS
  'auth.uid() of the admin who revoked the link; NULL for automated causes.';

-- Backfill only what is certain.
--
-- Every existing 'expired' row is a timeout: the sole other writer of 'expired'
-- is the client-side supersession path in lib/scheduleGenerator.issueLink,
-- which threw a ReferenceError from 2026-06-02 until it was repaired on
-- 2026-07-31 and therefore never wrote a row. Confirmed against the data: all
-- 209 are past their expires_at and none has a completed schedule row.
UPDATE participant_links
SET ended_reason = 'timeout',
    ended_at     = COALESCE(ended_at, expires_at)
WHERE status = 'expired'
  AND ended_reason IS NULL;

-- 'revoked' rows are deliberately left NULL. They mix admin revokes,
-- supersessions and withdrawals with no field that separates them, and a
-- guessed backfill would be indistinguishable from a recorded fact. NULL here
-- honestly means "ended before this migration existed; cause not recorded".

CREATE INDEX IF NOT EXISTS participant_links_ended_reason_idx
  ON participant_links (ended_reason)
  WHERE ended_reason IS NOT NULL;
