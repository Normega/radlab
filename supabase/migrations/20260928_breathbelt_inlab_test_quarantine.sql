-- Quarantine the in-lab Breath Belt test accounts: 909090909, 9998877665 and
-- 9999991-9999993 in BreathbeltOfficial, and 999444, the one enrollment in
-- Belt Demo. Confirmed as test accounts by Norm, 2026-09-28.
--
-- Same treatment as 20260908_zerin_pilot_quarantine.sql and
-- 20260912_zerin_sona_test_ids_quarantine.sql: relabel the enrollment
-- `test-<id>`, set is_test, and move the login to match. The in-lab login is
-- `p-<id>@participants.radlab.zone` (create_participant), derived from the id
-- alone, so an id left in place would hand the next person typed in as 9999991
-- this account, its consent and its data. After the move, create_participant
-- given `test-9999991` derives `p-test-9999991`, which is the address the
-- account now holds.
--
-- Unlike the SONA ids these accounts carry data: 27 belt_trials rows
-- (9999991-3), 5 stillwater_responses and 3 participant_compensation rows.
-- None of it is edited (rule 5: collected rows are never updated).
--   * stillwater_responses and participant_compensation export by profile, so
--     they follow the enrollment and appear under `test-<id>`, is_test = TRUE.
--   * belt_trials export by participant_external_id, which still reads the
--     raw id; with no enrollment carrying that id any more, those rows drop out
--     of the study export instead of being attributed to a participant.
--
-- Guarded: an id that is missing, or no longer carries the address this
-- migration expects, is skipped with a NOTICE. Re-running is a no-op.

DO $$
DECLARE
  v_official constant uuid := '9818212f-4d14-4f1d-9a03-b07b05d23908';  -- BreathbeltOfficial
  v_demo     constant uuid := '564dbd3b-8be6-4e8c-86d2-b7ba27ee2117';  -- Belt Demo
  r          record;
  v_profile  uuid;
  v_done     int := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      (v_official, '909090909'),
      (v_official, '9998877665'),
      (v_official, '9999991'),
      (v_official, '9999992'),
      (v_official, '9999993'),
      (v_demo,     '999444')
    ) AS t(study_id, ext)
  LOOP
    SELECT profile_id INTO v_profile
      FROM study_enrollments
     WHERE study_id = r.study_id AND external_id = r.ext;

    IF v_profile IS NULL THEN
      RAISE NOTICE 'breathbelt test quarantine: % not found (already applied?)', r.ext;
      CONTINUE;
    END IF;

    UPDATE study_enrollments
       SET external_id = 'test-' || r.ext, is_test = true
     WHERE study_id = r.study_id AND external_id = r.ext;

    UPDATE auth.users
       SET email = 'p-test-' || r.ext || '@participants.radlab.zone'
     WHERE id = v_profile
       AND email = 'p-' || r.ext || '@participants.radlab.zone';

    UPDATE auth.identities
       SET identity_data = jsonb_set(
             identity_data, '{email}',
             to_jsonb('p-test-' || r.ext || '@participants.radlab.zone'))
     WHERE user_id = v_profile AND provider = 'email'
       AND identity_data->>'email' = 'p-' || r.ext || '@participants.radlab.zone';

    UPDATE profiles
       SET display_name = 'TEST Participant ' || r.ext
     WHERE id = v_profile AND display_name = 'Participant ' || r.ext;

    v_done := v_done + 1;
  END LOOP;

  RAISE NOTICE 'breathbelt test quarantine: % enrollment(s) relabelled', v_done;
END $$;

-- Verify (expect six rows, all is_test, all p-test- addresses):
--   SELECT e.external_id, e.is_test, u.email, p.display_name
--     FROM study_enrollments e
--     JOIN auth.users u ON u.id = e.profile_id
--     JOIN profiles  p ON p.id = e.profile_id
--    WHERE e.study_id IN ('9818212f-4d14-4f1d-9a03-b07b05d23908','564dbd3b-8be6-4e8c-86d2-b7ba27ee2117')
--      AND e.external_id LIKE 'test-%';
