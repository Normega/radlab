-- `self` joins sona/prolific as an enrollment source.
--
-- Missed by 20260903_self_enrollment.sql. That migration anticipated the check
-- on `studies.external_enrollment_source` (which the self path deliberately
-- does not use, having its own `allow_self_enrollment` flag) but not the one on
-- `study_enrollments.external_source`, which enumerates the same two values and
-- is what an enrollment row is actually written against.
--
-- Found by the first live verification click: the enrollment insert failed with
-- study_enrollments_external_source_check. Worth recording that the failure
-- behaved correctly — the claim released, the request payload stayed intact,
-- and the same token worked on the retry. That is exactly what the
-- release-on-failure path in study-signup-verify exists for.

ALTER TABLE public.study_enrollments
  DROP CONSTRAINT study_enrollments_external_source_check;

ALTER TABLE public.study_enrollments
  ADD CONSTRAINT study_enrollments_external_source_check
  CHECK (external_source = ANY (ARRAY['sona'::text, 'prolific'::text, 'self'::text]));
