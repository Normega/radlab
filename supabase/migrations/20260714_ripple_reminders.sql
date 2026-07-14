-- WP6: Ripple email reminders
-- Adds opt-in reminder settings + dedup guard to ripples,
-- and a dedicated unsubscribe token table.

ALTER TABLE ripples
  ADD COLUMN IF NOT EXISTS reminder_enabled bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_time text NOT NULL DEFAULT 'morning'
    CHECK (reminder_time IN ('morning', 'midday', 'evening')),
  ADD COLUMN IF NOT EXISTS last_reminder_sent_on date;

-- Ripple-specific unsubscribe tokens.
-- Service role only — no user-facing RLS policies. The token is the credential.
CREATE TABLE IF NOT EXISTS ripple_unsubscribe_tokens (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token      text UNIQUE NOT NULL,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  used_at    timestamptz
);
ALTER TABLE ripple_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

-- ─── pg_cron setup (run manually in the Supabase SQL editor) ─────────────────
-- Adds an hourly cron job that calls the ripple_reminder Edge Function.
-- The function filters to active time windows (8 AM / 12 PM / 7 PM ET)
-- and is a no-op outside those windows.
--
-- Prerequisites: pg_cron + pg_net enabled; credentials match your project.
-- See the existing check_schedule entry in pg_cron.job for the pattern to follow.
--
-- SELECT cron.schedule(
--   'ripple-reminders-hourly',
--   '0 * * * *',
--   $$SELECT net.http_post(
--       url        := '<SUPABASE_URL>/functions/v1/ripple_reminder',
--       headers    := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
--       body       := '{}'::jsonb
--   )$$
-- );
