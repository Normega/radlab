-- Account/My Ripple redesign: email reminder cadence gains "every other day"
-- and "every other week" (between Daily/Weekly), reusing the existing hourly
-- ripple_reminder cron job rather than new cron infrastructure — see that
-- function's day-count filter.
--
-- 'every_login' and 'never' are left in the constraint for existing rows;
-- the app just no longer offers them as UI choices (the reminder toggle does
-- what 'never' used to, and prompt_cadence is now an email-only cadence, so
-- 'every_login' doesn't map to anything a UI would offer). Not backfilling
-- legacy rows currently sitting at 'never' or 'every_login' here — deliberately
-- left as a follow-up, since mutating existing user data isn't something to
-- do sight-unseen against a live table.
ALTER TABLE ripples DROP CONSTRAINT IF EXISTS ripples_prompt_cadence_check;
ALTER TABLE ripples ADD CONSTRAINT ripples_prompt_cadence_check
  CHECK (prompt_cadence IN ('every_login', 'daily', 'every_other_day', 'weekly', 'every_other_week', 'never'));
