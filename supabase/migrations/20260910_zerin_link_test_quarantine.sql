-- Quarantine the `99999999` enrollment on the Zerin Langerian Mindfulness Study.
--
-- Created 2026-09-10 22:10 UTC through the real SONA join link, hours after the
-- July pilot ids were quarantined (20260908_zerin_pilot_quarantine.sql) and
-- before recruitment opened -- a test of the link, not a participant. It stopped
-- at the screener: no consent, no contact email, no screener row, one unlocked
-- baseline row (never emailed), no data. Harmless as it stands, but recorded as
-- is_test = false, so it would appear in the export as a participant.
--
-- Same treatment as the pilot ids, for the same two reasons: the enrollment's
-- external_id is what auto-enroll matches re-entry on, and the login email
-- `ext-sona-<id>@participants.radlab.zone` is derived from the id alone, so both
-- must move or a later arrival on `99999999` inherits this account.
-- Prefixed `test-` rather than `pilot-`: it tested the link, it did not pilot the
-- protocol.
--
-- Matched by enrollment id AND by the state it was found in. If it has since
-- been used (consented or screened), the assertion aborts rather than
-- relabelling someone's data without a look. Re-running is a no-op.

DO $$
DECLARE
  v_enrollment constant uuid := 'a934787f-e0cc-4a28-b53c-07cdb1def2c6';
  v_study      constant uuid := '6d3c38ce-d1da-42ea-9bb4-c9450054065f';
  v_profile    uuid;
  v_consent    timestamptz;
  v_screened   int;
BEGIN
  SELECT profile_id, consent_date INTO v_profile, v_consent
    FROM study_enrollments
   WHERE id = v_enrollment AND study_id = v_study AND external_id = '99999999';

  IF v_profile IS NULL THEN
    RAISE NOTICE 'zerin link-test quarantine: nothing to do (already applied or not found)';
    RETURN;
  END IF;

  SELECT count(*) INTO v_screened FROM screener_results WHERE participant_id = v_profile;
  IF v_consent IS NOT NULL OR v_screened > 0 THEN
    RAISE EXCEPTION 'zerin link-test quarantine: 99999999 has progressed (consent %, screener rows %) -- inspect before relabelling', v_consent, v_screened;
  END IF;

  UPDATE study_enrollments
     SET external_id = 'test-99999999', is_test = true
   WHERE id = v_enrollment;

  UPDATE auth.users
     SET email = 'ext-sona-test-99999999@participants.radlab.zone'
   WHERE id = v_profile AND email = 'ext-sona-99999999@participants.radlab.zone';

  UPDATE auth.identities
     SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb('ext-sona-test-99999999@participants.radlab.zone'::text))
   WHERE user_id = v_profile AND provider = 'email'
     AND identity_data->>'email' = 'ext-sona-99999999@participants.radlab.zone';

  UPDATE profiles
     SET display_name = 'SONA TEST 99999999'
   WHERE id = v_profile AND display_name = 'SONA 99999999';

  RAISE NOTICE 'zerin link-test quarantine: 99999999 relabelled test-99999999';
END $$;
