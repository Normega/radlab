-- trial_onset_ms: milliseconds from trigger-1 (session start) to trigger-10 (trial start).
-- Used to align trial events with physio recordings that reference the same trigger channel.
ALTER TABLE belt_trials ADD COLUMN IF NOT EXISTS trial_onset_ms integer;

-- Final QUEST staircase thresholds and posterior SDs, stored as scalars so
-- they are queryable without unpacking quest_state JSON.
-- log10 scale matches log10_mag in belt_trials (log10 of delta in seconds).
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS thresh_faster_log10 float;
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS thresh_slower_log10 float;
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS thresh_sd_faster    float;
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS thresh_sd_slower    float;
