-- enrollment_attempts gains a kind, so auto-enroll can throttle re-entry
-- lookups separately from new-account creation.
--
-- Why: re-entry was never limited. auto-enroll returns an enrollment's live
-- session link to anyone who supplies its (study_id, external_id), and SONA ids
-- are short numbers, so the join URL could be walked id by id to collect other
-- participants' links. Only new-account creation was throttled, and its 429
-- only answered misses, so it even told a prober which ids were NOT enrolled.
--
-- Existing rows are all new-account attempts, hence the default. Apply BEFORE
-- deploying the matching auto-enroll: until this column exists the function's
-- limiter queries error and, being fail-open, let everything through.

ALTER TABLE enrollment_attempts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'new_account'
  CHECK (kind IN ('new_account', 'lookup'));

DROP INDEX IF EXISTS enrollment_attempts_lookup;
CREATE INDEX IF NOT EXISTS enrollment_attempts_lookup
  ON enrollment_attempts (study_id, ip_hash, kind, attempted_at);

-- Verify:
--   SELECT kind, count(*) FROM enrollment_attempts GROUP BY kind;
