-- WP4 completion: micro-intentions + intention follow-up + prompt cadence
--
-- ripple_checkins: intention (the "one small thing" the user sets at close)
--                  prev_intention_outcome (how the *previous* check-in's intention went)
-- ripples:         prompt_cadence (how often to show the check-in prompt)

ALTER TABLE ripple_checkins
  ADD COLUMN IF NOT EXISTS intention              text,
  ADD COLUMN IF NOT EXISTS prev_intention_outcome text
    CHECK (prev_intention_outcome IN ('did', 'partly', 'not_today'));

ALTER TABLE ripples
  ADD COLUMN IF NOT EXISTS prompt_cadence text NOT NULL DEFAULT 'daily'
    CHECK (prompt_cadence IN ('every_login', 'daily', 'weekly', 'never'));
