-- Liliana Study 3: close recruitment on both routes (Norm, 2026-11-20).
--
-- The preregistration ends recruitment on 2026-11-08, but nothing in the
-- platform knew that date: the paid study's cap was 257 and the SONA study had
-- none, so the open sign-up page kept issuing baseline links and four paid-route
-- participants started after the close (Nov 13-16).
--
-- Closing is done with the existing enrollment_full gate rather than by turning
-- the studies off. schedule_row_block_reason returns 'enrollment_full' only for
-- someone who has NOT completed their entry session, so everyone already past
-- baseline (the four late starters included, by Norm's decision) carries on to
-- the end of the study, and anyone new is told recruitment is complete before
-- the screener renders. studies.active = false would stop them all mid-study.
--
-- Each cap is set to the number of baselines completed at the time of closing
-- (study_baselines_completed): paid 185, SONA 60.

UPDATE public.studies SET baseline_cap = 185
 WHERE id = 'ee542d3b-c0da-4a5f-ac34-6b981f153298';   -- Liliana Study 3 — Paid

UPDATE public.studies SET baseline_cap = 60
 WHERE id = '958150a9-7821-4daf-8d83-e9325369d91d';   -- Liliana Study 3 (SONA)
