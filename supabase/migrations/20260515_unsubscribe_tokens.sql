-- Unsubscribe tokens — one permanent token per participant per study.
-- Used to verify unsubscribe requests without requiring authentication.
-- used_at is audit-only; tokens remain valid for repeated idempotent use.
CREATE TABLE IF NOT EXISTS participant_unsubscribe_tokens (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token            text UNIQUE NOT NULL,
  participant_id   uuid REFERENCES profiles(id),
  study_id         uuid REFERENCES studies(id),
  created_at       timestamptz DEFAULT now(),
  used_at          timestamptz
);

ALTER TABLE participant_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
