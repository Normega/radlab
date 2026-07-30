-- 20260730_promote_personality_disorders_tier_a.sql
-- TARGET: radlab-academic.
--
-- Norm's call, 2026-07-30: promote the seven Tier B personality disorders to
-- Tier A, so all ten PDs get a full page.
--
-- This resolves a flag the taxonomy seed carried on the narcissistic-PD row
-- from the day it was written: "this whole chapter is the tier split most likely
-- to be wrong — L11 gives all ten PDs full treatment. Promoting the seven Tier B
-- PDs is +1.5 h review and the cheapest place to spend a spare hour." The
-- argument was always that the tier split is a *review-budget* device, and here
-- it disagreed with what the lecture actually does — a student reading a
-- 150-word stub for narcissistic PD after a lecture that covered it in full
-- would reasonably conclude the wiki was thin.
--
-- Effect: Tier A 46 → 53, Tier B 52 → 45 (123 catalogue rows unchanged).
-- Cost: roughly +1.5 instructor-hours in the WP4 review pass.
-- Also reorders `reference_worklist`, which sorts Tier A first — so these seven
-- now rank above the remaining stubs for the content sprint, which is the point.
--
-- antisocial, borderline and schizotypal were already Tier A and are untouched.

update public.disorders
set tier = 'A',
    tier_review_note = case
      when tier_review_note is null or btrim(tier_review_note) = ''
        then 'promoted Tier B -> A 2026-07-30 (Norm): L11 gives all ten personality disorders full treatment'
        else tier_review_note || ' | promoted Tier B -> A 2026-07-30 (Norm): L11 gives all ten personality disorders full treatment'
      end
where dsm_chapter = 18
  and tier = 'B';
