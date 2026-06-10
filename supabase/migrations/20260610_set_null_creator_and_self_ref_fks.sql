-- Group 2: SET NULL — audit/creator fields and self-referential cloned_from

ALTER TABLE intervention_modules
  DROP CONSTRAINT intervention_modules_created_by_fkey,
  ADD CONSTRAINT intervention_modules_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE questionnaires
  DROP CONSTRAINT questionnaires_created_by_fkey,
  ADD CONSTRAINT questionnaires_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE session_templates
  DROP CONSTRAINT session_templates_lab_id_fkey,
  ADD CONSTRAINT session_templates_lab_id_fkey
    FOREIGN KEY (lab_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE studies
  DROP CONSTRAINT studies_created_by_fkey,
  ADD CONSTRAINT studies_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE study_debrief_forms
  DROP CONSTRAINT study_debrief_forms_uploaded_by_fkey,
  ADD CONSTRAINT study_debrief_forms_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE study_protocols
  DROP CONSTRAINT study_protocols_created_by_fkey,
  ADD CONSTRAINT study_protocols_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE study_protocols
  DROP CONSTRAINT study_protocols_lab_id_fkey,
  ADD CONSTRAINT study_protocols_lab_id_fkey
    FOREIGN KEY (lab_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE video_library
  DROP CONSTRAINT video_library_created_by_fkey,
  ADD CONSTRAINT video_library_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE session_templates
  DROP CONSTRAINT session_templates_cloned_from_fkey,
  ADD CONSTRAINT session_templates_cloned_from_fkey
    FOREIGN KEY (cloned_from) REFERENCES session_templates(id) ON DELETE SET NULL;

ALTER TABLE study_protocols
  DROP CONSTRAINT study_protocols_cloned_from_fkey,
  ADD CONSTRAINT study_protocols_cloned_from_fkey
    FOREIGN KEY (cloned_from) REFERENCES study_protocols(id) ON DELETE SET NULL;

ALTER TABLE study_protocols
  DROP CONSTRAINT study_protocols_enrollment_protocol_id_fkey,
  ADD CONSTRAINT study_protocols_enrollment_protocol_id_fkey
    FOREIGN KEY (enrollment_protocol_id) REFERENCES study_protocols(id) ON DELETE SET NULL;
