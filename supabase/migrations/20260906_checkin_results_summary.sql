-- AI-grouped prompt themes for the results screen (Norm, 2026-09-06).
-- Written by api/summarize-checkin (service role) when the instructor
-- presses "Show class" on a prompt check-in; readable by anyone who can
-- already read the checkin row (members), because it is aggregate,
-- quote-level, and anonymous by construction.
alter table public.checkins add column if not exists results_summary jsonb;
