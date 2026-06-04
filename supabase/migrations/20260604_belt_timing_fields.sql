-- Trial-level timing fields
ALTER TABLE belt_trials ADD COLUMN IF NOT EXISTS condition_onset_ms integer; -- ms from trigger-1 to start of condition breaths (breath 3)
ALTER TABLE belt_trials ADD COLUMN IF NOT EXISTS trial_end_ms       integer; -- ms from trigger-1 to trigger-12 (trial end)
ALTER TABLE belt_trials ADD COLUMN IF NOT EXISTS response_rt_ms     integer; -- ms from trial end to first 3AFC response selection (Phase 3 only)

-- Session-level timing fields
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS session_start_epoch_ms bigint;  -- Unix epoch ms when trigger-1 fired (anchor for all relative offsets)
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS phase2_start_ms        integer; -- ms from trigger-1 to trigger-4 (Phase 2 start)
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS phase2_end_ms          integer; -- ms from trigger-1 to trigger-5 (Phase 2 end)
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS phase3_start_ms        integer; -- ms from trigger-1 to trigger-6 (Phase 3 start)
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS phase3_end_ms          integer; -- ms from trigger-1 to trigger-7 (Phase 3 end)
