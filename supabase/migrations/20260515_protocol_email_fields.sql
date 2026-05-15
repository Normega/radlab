-- Adds per-protocol custom email subject and body to study_protocols.
-- When null the send_message edge function uses the default RADlab template.
ALTER TABLE study_protocols
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text;
