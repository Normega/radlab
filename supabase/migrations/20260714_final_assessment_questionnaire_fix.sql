-- Data fix: 9 of the 12 nodes in "Liliana Study 3 - Final Assessment"
-- (BIPS, GAD-7, PHQ-8, SPANE, PWB, ERQ, MPoD-t, SRI, SSCS-L) had
-- activity_id/questionnaire_id/module_id all NULL — get_session_by_token
-- returns activities: NULL for these, so StepDispatcher renders "Missing
-- activity on node <uuid>" for each one. A participant reaching Final
-- Assessment would hit 9 consecutive broken screens instead of their final
-- questionnaires. Found during the 2026-07-14 daily-session audit.
--
-- "Liliana Study 3 - Midpoint" has the identical 9-questionnaire set,
-- correctly linked via questionnaire_id — copy that linkage over by
-- matching node label between the two templates (verified via a dry-run
-- SELECT: exactly 9 rows match, matching the 9 known-broken nodes).

UPDATE session_template_nodes AS final_node
SET questionnaire_id = mid_node.questionnaire_id
FROM session_template_nodes AS mid_node
WHERE final_node.session_template_id = '3d1a1593-d23a-454f-8db8-f8a0b0158167'
  AND mid_node.session_template_id = 'cc839191-cb69-4d63-9df6-9c37e73c31ce'
  AND final_node.label = mid_node.label
  AND final_node.activity_id IS NULL
  AND final_node.questionnaire_id IS NULL
  AND mid_node.questionnaire_id IS NOT NULL;
