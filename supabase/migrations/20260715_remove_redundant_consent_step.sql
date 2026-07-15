-- Removes the redundant in-session "consent" step (StepDispatcher's
-- category='form'/subcategory='consent' case -> ConsentStep.jsx). It was
-- purely cosmetic: its onComplete({consented:true}) result was never
-- persisted anywhere (SessionEntry.jsx's handleStepComplete has no case for
-- it). Now fully redundant now that ConsentGate properly gates + persists
-- real consent (study_enrollments.consent_date via record_consent) before a
-- participant ever reaches session steps at all — this let a participant see
-- the same consent text a second time, mid-session, for no functional reason.
--
-- Affects every session template that has this node, not just Liliana's:
-- Liliana Study 3 - Baseline (order_index 0), Sandy Study 3 (order_index 0),
-- SummerBelt2026_Session (order_index 1), Zerin Baseline (order_index 0).
-- order_index is read via plain ORDER BY ascending with no contiguity
-- requirement anywhere in the codebase (confirmed: StudySessionRunner.jsx,
-- SessionBuilder.jsx, StudySessionsPanel.jsx, EnrollmentPanel.jsx) and
-- SessionBuilder's own save path renumbers sequentially on next edit
-- regardless, so no renumbering of the remaining nodes is needed here.

DELETE FROM session_template_nodes
WHERE id IN (
  'f2a4bfc3-ee27-4894-b4fb-914c733972b9', -- Liliana Study 3 - Baseline, order 0
  '8f562fbb-4423-43a5-a3ab-919c12116b0c', -- Sandy Study 3, order 0
  '4f87dbf8-50d0-4299-b764-aa4d8e8001ca', -- SummerBelt2026_Session, order 1
  '6b3d6dd8-c2b6-4011-98bf-5936869d2d34'  -- Zerin Baseline, order 0
);

DELETE FROM activities
WHERE id = '21f4a59a-2dd1-4aeb-935b-f5bb3884cd65'; -- form/consent, 'Consent Form'
