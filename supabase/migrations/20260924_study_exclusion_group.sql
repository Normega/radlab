-- Studies that must not run concurrently for the same participant.
--
-- WHY. A SONA participant can arrive in two longitudinal studies at once: the
-- same SONA id maps to the same platform account, and nothing checked what
-- else that account was already doing. Found 2026-09-24: participant 18919
-- joined Zerin at 22:52 and Liliana Study 3 24 minutes later; Zerin's still-open
-- entry link then held back Liliana days 2-4 for three days (check_schedule's
-- outstanding-link check was not scoped by study) until they were blocked as a
-- stale backlog. Beyond the scheduler fault, two concurrent daily-practice
-- studies contaminate each other's data.
--
-- WHAT. studies.exclusion_group: studies sharing a non-null value exclude one
-- another. auto-enroll refuses a NEW enrollment in a grouped study while the
-- same external participant (external_id + external_source) is actively in
-- another active study of the same group -- "actively" meaning consented,
-- status enrolled/in_progress, not screened out on their latest attempt, and
-- with at least one session still pending/sent/unlocked (four July Zerin
-- participants were still 'enrolled' with nothing left to send).
-- A screen-out stays 'enrolled' by design (20260924_screen_out_stops_schedule)
-- and has never consented, so it does not count: every one of the 12 people in
-- both Liliana 3 and Zerin on 2026-09-24 had been screened out of, or never
-- consented to, the first study, and four of them are eligible Liliana
-- participants.
--
-- The refused participant is offered a withdrawal link for the other study,
-- sent to the contact email on that enrollment -- never shown on the page,
-- because the SONA id arrives on the URL and is guessable.
--
-- Grouping is opt-in per study. Course studies (Academic Feedback) are left out
-- on purpose: their students may legitimately also be in a SONA study.

ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS exclusion_group text;

COMMENT ON COLUMN public.studies.exclusion_group IS
  'Studies sharing a non-null value exclude one another: auto-enroll refuses a new enrollment while the participant is consented and active in another study of the group.';

UPDATE public.studies
   SET exclusion_group = 'sona_longitudinal'
 WHERE id IN ('958150a9-7821-4daf-8d83-e9325369d91d',   -- Liliana Study 3
              '6d3c38ce-d1da-42ea-9bb4-c9450054065f');  -- Zerin Langerian Mindfulness Study
