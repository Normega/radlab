-- Final-notice ("last chance") reminder on critical sessions.
--
-- A critical session is one whose window closing has a consequence: it gates a
-- randomize fork (missing it formally withdraws the participant — Liliana's
-- midpoint) or it ends the study (Liliana's s_final, Zerin's s_post). Those
-- windows are long (72 h), and reminders are anchored to the cadence rather
-- than to the deadline, so at 12 h cadence with reminder_max 2 the last
-- reminder lands 48 h before the link closes. This adds one extra send, fired
-- 12 h before expires_at, carrying urgent copy that names the actual
-- consequence. See supabase/functions/_shared/criticalSession.ts.
--
-- Two schema needs:
--   1. Somewhere to record that the notice fired, so the 15-minute cron sends
--      it once rather than on every tick for 12 hours. last_sent_at can't
--      serve: cadence reminders share it, and the final notice is deliberately
--      exempt from the attempt caps that would otherwise bound the loop.
--   2. Its own message_log kind. The final notice is the only session email
--      that states a consequence, so "was this participant actually warned
--      before being withdrawn?" has to be answerable from message_log alone —
--      the same reason 'adherence_termination' is distinguished from
--      'session_link'.

ALTER TABLE participant_schedule
  ADD COLUMN IF NOT EXISTS final_notice_sent_at timestamptz;

COMMENT ON COLUMN participant_schedule.final_notice_sent_at IS
  'When the deadline-anchored "last chance" reminder was sent for this row. NULL = not sent (or not a critical session). Set by check_schedule''s reminder pass; makes that send once-only across cron ticks.';

ALTER TABLE message_log DROP CONSTRAINT IF EXISTS message_log_kind_check;
ALTER TABLE message_log ADD CONSTRAINT message_log_kind_check
  CHECK (kind = ANY (ARRAY['session_link'::text, 'adherence_termination'::text, 'final_notice'::text]));
