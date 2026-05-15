-- Adds is_test flag to message_log so test sends are distinguishable in the audit log.
-- Column already applied on live DB via MCP; this file is for record-keeping only.
ALTER TABLE message_log ADD COLUMN IF NOT EXISTS is_test bool DEFAULT false;
