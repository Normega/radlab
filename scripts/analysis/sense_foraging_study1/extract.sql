-- Sense Foraging Study 1: every questionnaire submission by a real participant,
-- with the facts the analysis needs. Participant = the random surrogate code
-- (study_enrollments.external_id, "P-…"); Prolific IDs live only in
-- external_identities, which this query never touches. Staff test enrollments
-- are excluded here and nowhere else.
SELECT e.external_id                              AS participant,
       e.external_meta->>'prolific_study_id'      AS prolific_study_id,
       e.repository_consent,
       ps.id::text                                AS schedule_id,
       ps.status                                  AS session_status,
       r.id::text                                 AS response_id,
       r.questionnaire_slug                       AS slug,
       r.step_index,
       r.received_at,
       r.resubmission_of::text                    AS resubmission_of,
       r.presentation_format,
       r.responses,
       (SELECT count(*) FROM session_diagnostics d
         WHERE d.schedule_id = ps.id AND d.kind = 'step_crash') AS step_crashes
  FROM study_enrollments e
  JOIN participant_schedule ps ON ps.participant_id = e.profile_id AND ps.study_id = e.study_id
  LEFT JOIN questionnaire_responses r ON r.schedule_id = ps.id
 WHERE e.study_id = '74cb6aa5-857c-408e-adfa-a5556acd62b7'
   AND NOT coalesce(e.is_test, false)
 ORDER BY e.external_id, r.received_at;
