-- UTMAP 2026: the consent form and debrief lose their "Internal pilot version"
-- notice. The protocol is approved (Norm, 2026-10-22: "please update the consent
-- form we are approved!", "take pilot notice off").
--
-- The notice said the protocol was not yet approved, that no data collected would
-- be analysed or reported, and that the form must be replaced before anyone
-- outside the research group took part. Recruitment from the table began on
-- 2026-10-20, so everyone who consented from then until this change agreed to a
-- form carrying it. Nothing else in either form changes: the wording is the
-- version of 2026-10-19 (20261019_utmap_findings_out_of_consent.sql).
--
-- Forms are versioned rows: this inserts new versions without the notice and
-- points the study at them, leaving the previous versions in place, so each
-- participant's consent_date can still be matched against the versions'
-- uploaded_at to tell which form they saw.
DO $$
DECLARE
  sid      uuid := 'f5a2db89-9697-489f-9a16-dea9c64053e0';
  old_c    uuid;
  old_d    uuid;
  c_html   text;
  d_html   text;
  new_c    text;
  new_d    text;
  new_cid  uuid;
  new_did  uuid;
  -- the notice is the first element of both forms
  notice   constant text := '^\s*<div style="border:2px solid #c4501d;[^"]*">\s*<p[^>]*>Internal pilot version</p>\s*<p[^>]*>[^<]*</p>\s*</div>\s*';
BEGIN
  SELECT active_consent_form_id, active_debrief_form_id INTO old_c, old_d
    FROM studies WHERE id = sid;
  SELECT html_content INTO c_html FROM study_consent_forms WHERE id = old_c;
  SELECT html_content INTO d_html FROM study_debrief_forms WHERE id = old_d;

  new_c := regexp_replace(c_html, notice, '');
  new_d := regexp_replace(d_html, notice, '');

  IF new_c ~* 'pilot' OR new_d ~* 'pilot' OR new_c = c_html OR new_d = d_html
     OR new_c !~ '^<h2>Consent to participate in research</h2>'
     OR new_d !~ '^<h2>Thank you</h2>' THEN
    RAISE EXCEPTION 'UTMAP pilot notice did not match; nothing changed';
  END IF;

  INSERT INTO study_consent_forms (study_id, docx_url, html_content, uploaded_by)
    SELECT study_id, docx_url, new_c, uploaded_by FROM study_consent_forms WHERE id = old_c
    RETURNING id INTO new_cid;
  INSERT INTO study_debrief_forms (study_id, docx_url, html_content, uploaded_by)
    SELECT study_id, docx_url, new_d, uploaded_by FROM study_debrief_forms WHERE id = old_d
    RETURNING id INTO new_did;
  UPDATE studies SET active_consent_form_id = new_cid, active_debrief_form_id = new_did
   WHERE id = sid;
END $$;
