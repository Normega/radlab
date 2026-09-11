-- Quarantine the Zerin Langerian Mindfulness Study July pilot participants
-- before the study opens to real SONA recruitment.
--
-- THE PROBLEM. The July 20-22 dry run created 17 enrollments with external ids
-- in the 808080-808110 block -- ids shaped exactly like real U of T SONA
-- participant ids, because that is what they were imitating. `auto-enroll`
-- keys re-entry on (study_id, external_id), so a real participant whose SONA id
-- lands in that block does not enrol. They inherit the pilot's enrollment:
--
--   * the 8 withdrawn ids (808100-808102, 808105-808109) return
--     "Your participation in this study has ended." -- the participant is
--     locked out of the study entirely, and nothing reports it;
--   * the 9 live ids (808080-808085, 808103, 808104, 808110) are adopted
--     silently. Four already carry a consent_date and a contact_email of
--     norman.farb@gmail.com / zerin.mahfuz@gmail.com, so the participant would
--     skip the consent gate outright and their 63 daily reminder emails would
--     be delivered to the study team's inbox rather than their own.
--
-- THE SECOND VECTOR, which is the reason this migration touches auth. The
-- participant's login is derived from the id alone, not from the study:
-- `ext-<source>-<external_id>@participants.radlab.zone` (auto-enroll step 3).
-- Renaming the enrollment therefore is NOT sufficient on its own. A real 808081
-- would miss the renamed enrollment, fall through to account creation, collide
-- with the pilot's still-existing auth user on "already been registered", and be
-- handed that user's profile_id -- commingling their responses with the pilot's
-- 84 check-in rows under one profile, where no enrollment-level filter can
-- separate them again. Both the enrollment and the account must move.
--
-- WHY RENAME AND NOT DELETE. Three reasons.
--   1. Precedent: 20260818_test_participant_flag.sql made exactly this call for
--      Liliana's accounts -- "Marking the enrollment is honest, reversible, and
--      lets the export carry the distinction instead of hiding it."
--   2. It is reversible, and the dry run is the only end-to-end evidence that
--      all three arms, the randomiser and the 3x/day cadence work (website.md
--      section 26b, Phase 3). A delete cannot be undone if a question about it
--      comes up during analysis.
--   3. It propagates further than a flag does. Every per-table file in the
--      study export leads with `participant_external_id`, so a renamed id marks
--      the pilot rows in all of them; `is_test` appears only on the
--      participants table. Rule 4 of the data-logging policy in CLAUDE.md --
--      prefer a visibly non-committal label to a plausible one -- is satisfied
--      by "pilot-808081" and defeated by "808081".
--
-- `admin_delete_user` would in fact cascade cleanly (questionnaire_responses,
-- screener_results and game_sessions all CASCADE from profiles, and
-- participant_compensation from study_enrollments -- verified, no orphans), so
-- deletion remains available later. It cannot run here: it gates on
-- is_super_admin(), which reads auth.uid(), and auth.uid() is NULL in the SQL
-- editor. It has to be driven from /admin as a signed-in super admin.
--
-- SAFETY. Scoped to one study, to enrollments made before 2026-08-01, and to
-- ids not already renamed. The row count is asserted at 17 before anything is
-- written, so a pattern that ever matched something unexpected aborts rather
-- than renaming a real participant. Re-running is a no-op.

DO $$
DECLARE
  v_study   constant uuid := '6d3c38ce-d1da-42ea-9bb4-c9450054065f';
  v_targets uuid[];
  v_n       int;
BEGIN
  SELECT array_agg(profile_id), COUNT(*)
    INTO v_targets, v_n
    FROM study_enrollments
   WHERE study_id     = v_study
     AND enrolled_at  < '2026-08-01'
     AND external_id  ~ '^8080[0-9]{2}$|^8081[0-9]{2}$'
     AND external_id NOT LIKE 'pilot-%';

  IF v_n = 0 THEN
    RAISE NOTICE 'zerin pilot quarantine: nothing to do (already applied)';
    RETURN;
  END IF;

  IF v_n <> 17 THEN
    RAISE EXCEPTION
      'zerin pilot quarantine: expected 17 pilot enrollments, found %. Refusing to run -- inspect before proceeding.', v_n;
  END IF;

  -- 1. The enrollment. `pilot-` prefix breaks the auto-enroll re-entry match,
  --    and is_test carries the distinction into the export's participants file.
  UPDATE study_enrollments
     SET external_id = 'pilot-' || external_id,
         is_test     = true
   WHERE study_id    = v_study
     AND profile_id  = ANY(v_targets);

  -- 2. The account. Without this a colliding id is handed the pilot's profile
  --    by auto-enroll's "already been registered" branch (see header).
  UPDATE auth.users
     SET email = replace(email, 'ext-sona-', 'ext-sona-pilot-')
   WHERE id    = ANY(v_targets)
     AND email LIKE 'ext-sona-%'
     AND email NOT LIKE 'ext-sona-pilot-%';

  -- auth.identities.email is GENERATED from identity_data->>'email', so the
  -- jsonb is what must be written. provider_id holds the user's uuid, not the
  -- address, so the (provider, provider_id) key is unaffected.
  UPDATE auth.identities
     SET identity_data = jsonb_set(
           identity_data, '{email}',
           to_jsonb(replace(identity_data->>'email', 'ext-sona-', 'ext-sona-pilot-')))
   WHERE user_id  = ANY(v_targets)
     AND provider = 'email'
     AND identity_data->>'email' LIKE 'ext-sona-%'
     AND identity_data->>'email' NOT LIKE 'ext-sona-pilot-%';

  -- 3. Cosmetic, but these names are what the admin enrollment panel shows.
  UPDATE profiles
     SET display_name = replace(display_name, 'SONA ', 'SONA PILOT ')
   WHERE id           = ANY(v_targets)
     AND display_name LIKE 'SONA %'
     AND display_name NOT LIKE 'SONA PILOT %';

  RAISE NOTICE 'zerin pilot quarantine: % enrollments and accounts renamed', v_n;
END $$;
