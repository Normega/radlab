-- Participant-supplied withdrawal reason, collected (optionally) on the
-- /withdraw/{token} confirmation page and written by the handle_withdraw
-- edge function (service role). Deliberately separate from withdrawal_reason,
-- which is the system's classification ('Adherence check failed: …',
-- 'Participant withdrew via the email withdrawal link.') — mixing free text
-- into that field would make it unparseable for analysis.
--
-- No RLS change: only the service role writes it, and lab members already
-- read study_enrollments through their existing policies.

ALTER TABLE study_enrollments
  ADD COLUMN IF NOT EXISTS withdrawal_note text;

COMMENT ON COLUMN study_enrollments.withdrawal_note IS
  'Optional free-text reason the participant gave when self-withdrawing via /withdraw/{token}. Capped at 500 chars by handle_withdraw. NULL when withdrawn by other paths or when the participant skipped the box.';
