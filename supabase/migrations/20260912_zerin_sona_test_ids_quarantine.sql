-- Quarantine the two SONA test enrollments on the Zerin Langerian Mindfulness
-- Study: `999999999` and `3055`.
--
-- Both arrived through the real join link on 2026-09-11, minutes apart, and
-- neither reached the screener: no consent, no contact email, no screener row,
-- no data. Confirmed by Norm as test ids, and one of them is worth knowing
-- about permanently:
--
--   **SONA always generates participant id 3055 for its own internal
--   link-generation test.** So `3055` will appear on EVERY study we recruit
--   through SONA, in every course and every term. It is never a participant.
--
-- Why they cannot simply be left alone. `study_enrollments.external_id` is what
-- auto-enroll matches re-entry on, and the login email
-- `ext-sona-<id>@participants.radlab.zone` is derived from the id alone and is
-- global across studies. An id left in place therefore (a) exports as a real
-- participant, and (b) captures the next arrival on the same id -- which for
-- 3055 is guaranteed to recur. Same treatment as the earlier quarantines
-- (20260908_zerin_pilot_quarantine.sql, 20260910_zerin_link_test_quarantine.sql):
-- relabel `test-<id>`, set is_test, and move the auth email and identity to
-- match, so a later 3055 gets a clean account of its own.
--
-- Guarded per id: anything that has consented, screened or written data aborts
-- the migration rather than being relabelled unseen. Re-running is a no-op.

DO $$
DECLARE
  v_study constant uuid := '6d3c38ce-d1da-42ea-9bb4-c9450054065f';
  v_ids   constant text[] := ARRAY['999999999', '3055'];
  v_id       text;
  v_profile  uuid;
  v_consent  timestamptz;
  v_screened int;
  v_data     int;
  v_done     int := 0;
BEGIN
  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT profile_id, consent_date INTO v_profile, v_consent
      FROM study_enrollments
     WHERE study_id = v_study AND external_id = v_id;

    IF v_profile IS NULL THEN
      RAISE NOTICE 'zerin SONA test quarantine: % not found (already applied?)', v_id;
      CONTINUE;
    END IF;

    SELECT count(*) INTO v_screened FROM screener_results WHERE participant_id = v_profile;
    SELECT (SELECT count(*) FROM questionnaire_responses WHERE user_id = v_profile)
         + (SELECT count(*) FROM zerin_daily_checkins   WHERE user_id = v_profile)
         + (SELECT count(*) FROM pond_watch_results     WHERE user_id = v_profile)
      INTO v_data;

    IF v_consent IS NOT NULL OR v_screened > 0 OR v_data > 0 THEN
      RAISE EXCEPTION
        'zerin SONA test quarantine: % has progressed (consent %, screener %, data rows %) -- inspect before relabelling',
        v_id, v_consent, v_screened, v_data;
    END IF;

    UPDATE study_enrollments
       SET external_id = 'test-' || v_id, is_test = true
     WHERE study_id = v_study AND external_id = v_id;

    UPDATE auth.users
       SET email = 'ext-sona-test-' || v_id || '@participants.radlab.zone'
     WHERE id = v_profile
       AND email = 'ext-sona-' || v_id || '@participants.radlab.zone';

    UPDATE auth.identities
       SET identity_data = jsonb_set(
             identity_data, '{email}',
             to_jsonb('ext-sona-test-' || v_id || '@participants.radlab.zone'))
     WHERE user_id = v_profile AND provider = 'email'
       AND identity_data->>'email' = 'ext-sona-' || v_id || '@participants.radlab.zone';

    UPDATE profiles
       SET display_name = 'SONA TEST ' || v_id
     WHERE id = v_profile AND display_name = 'SONA ' || v_id;

    v_done := v_done + 1;
  END LOOP;

  RAISE NOTICE 'zerin SONA test quarantine: % enrollment(s) relabelled', v_done;
END $$;
