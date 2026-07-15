-- study_consent_forms / study_debrief_forms had ONLY a "lab full access" RLS
-- policy — no participant could ever read their own study's consent form
-- content. Found live 2026-07-15 chasing the participant_consents bug: even
-- after fixing ConsentGate to query the right table/RPC and to run under the
-- participant's own isolated session (not the global client), the consent
-- form SELECT still failed RLS ("Could not load the consent form"), because
-- no policy granted participants read access at all.
--
-- study_debrief_forms has the exact same shape and is read the same way at
-- the end of a study (the debrief step) — fixed proactively alongside
-- consent rather than leaving it to fail the same way later in a live test.
--
-- Scope: a participant may read a study's consent/debrief form only if they
-- are enrolled in that specific study (study_enrollments.profile_id =
-- auth.uid()) — mirrors the existing "study_enrollments: own read" pattern,
-- prevents leaking one study's consent/debrief text to an unrelated
-- authenticated participant of a different study.

CREATE POLICY "participant read own study's consent form"
  ON study_consent_forms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_enrollments se
      WHERE se.study_id = study_consent_forms.study_id AND se.profile_id = auth.uid()
    )
  );

CREATE POLICY "participant read own study's debrief form"
  ON study_debrief_forms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM study_enrollments se
      WHERE se.study_id = study_debrief_forms.study_id AND se.profile_id = auth.uid()
    )
  );
