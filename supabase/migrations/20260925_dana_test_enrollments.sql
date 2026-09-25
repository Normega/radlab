-- Dana's own account, enrolled in her two live course studies while she tested
-- them, is marked as a test account.
--
-- Found in the 2026-09-21 data audit: the self-enrolment for her login address
-- (profile e56b7b40-…, display name "Self-enrolled 98b8d948") joined
-- Academic Feedback Study (PHL245) on 2026-09-16 with research consent and
-- finished the baseline in 57 s, then CHM135 the same day as credit-only in
-- 84 s. In PHL245 it was one of the 7 completed participants and would have
-- exported as one. The same account also holds the 266 pre-launch test answers
-- from 2026-09-13/14 that carry no session.
--
-- is_test only. Unlike SONA's test id 3055 (20260912_zerin_sona_test_ids_quarantine),
-- nothing needs relabelling: a self-enrolment id is a hash of the address that
-- signed up, so no real student can ever arrive on this enrollment. The export
-- keeps test enrolments and labels them is_test = TRUE in the master's third
-- column (studyExport.js, with a codebook entry) — analysts filter on it.
-- Approved by Norm, 2026-09-25.

UPDATE public.study_enrollments
   SET is_test = true
 WHERE profile_id = 'e56b7b40-1026-4b4a-8ffb-ed9b7f130318'
   AND study_id IN ('41dd1528-5e81-4d66-b2bb-7bfc5352ee96',   -- Academic Feedback Study (CHM135)
                    'b76615a8-3d13-482b-a2ec-6e6ce452ae4d')   -- Academic Feedback Study (PHL245)
   AND is_test = false;
