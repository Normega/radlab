-- Point Liliana Study 3's Baseline at the full demographics module.
--
-- `20260818_liliana_demographics.sql` built the instrument and registered it in
-- the Session Builder, but nothing repointed the study at it — the Baseline
-- template's node 1 still referenced `form/demographics`, the four-item step.
-- So the new module existed, was previewable in the admin library, and was
-- never shown to a participant. Norm signed up on the Live Test study on
-- 2026-08-19 and got the old four questions.
--
-- Worth stating plainly, because it is the same shape as the `_note` bug and
-- the `studies.active` bug: **building the thing is not the same as wiring it
-- up.** An instrument that exists but is not referenced by any session template
-- is indistinguishable, from the participant's side, from one that was never
-- built.
--
-- Swaps the activity on the existing node rather than deleting and re-inserting,
-- so `order_index` and the node id are preserved — anything referencing that
-- node (step timings already collected, for instance) stays valid.
--
-- Verified end to end after applying: a fresh enrollment through the real
-- auto-enroll flow returns `form/liliana_demographics` at order_index 1 from
-- `get_session_by_token`, which is the payload StepDispatcher renders from.

UPDATE session_template_nodes stn
   SET activity_id = (
        SELECT id FROM activities
         WHERE category = 'form' AND subcategory = 'liliana_demographics'
       )
  FROM study_sessions ss, studies s
 WHERE ss.session_template_id = stn.session_template_id
   AND s.id = ss.study_id
   AND s.name = 'Liliana Study 3 — Live Test'
   AND ss.day_number = 1
   AND stn.activity_id = (
        SELECT id FROM activities
         WHERE category = 'form' AND subcategory = 'demographics'
       );
