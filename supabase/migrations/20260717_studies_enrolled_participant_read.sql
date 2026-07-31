-- studies: enrolled participants can read their study row.
--
-- The only participant-facing SELECT policy on studies was
-- "studies: participant read own" (profiles.study_id = studies.id).
-- auto-enroll sets profiles.study_id, but create_anonymous_participant
-- (admin "Generate link") never has — invisible while that function
-- pre-stamped consent_date at enrollment (the consent gate never fired,
-- so no participant-context read of studies ever happened on that path).
-- Once the pre-stamp was removed (2026-07-17), ConsentGate's
-- studies.select().single() returned zero rows under RLS (PostgREST 406)
-- and every admin-generated link died at "Study not found."
--
-- Enrollment, not profiles.study_id, is the real participant↔study
-- relationship (profiles.study_id is single-valued and only set by one
-- enrollment path), so gate the read on study_enrollments — the same
-- pattern as study_consent_forms / study_debrief_forms (20260715).
-- study_enrollments' own policies don't reference studies, so no
-- policy recursion.

CREATE POLICY "studies: enrolled participant read"
  ON public.studies
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.study_enrollments e
    WHERE e.profile_id = auth.uid()
      AND e.study_id   = studies.id
  ));
