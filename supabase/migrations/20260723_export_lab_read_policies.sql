-- ============================================================
-- Study data export — lab-read SELECT policies for every
-- study-linked participant-data table.
--
-- WHY: The study-level Export tab (DataExportPage) reads across
-- ALL participants of a study. Many data tables have only an
-- "own rows" RLS policy (participant_id = auth.uid()), which
-- silently returns ZERO rows to a lab member querying other
-- participants' data — no error, just an empty result. That
-- makes real data look like an empty table in the export.
-- (See the RLS gotcha at the top of CLAUDE.md.)
--
-- This migration adds a uniquely-named lab-read SELECT policy to
-- every table the export touches. It is idempotent (DROP IF
-- EXISTS + CREATE) and only ever creates/replaces policies it
-- owns by name, so it never disturbs existing policies. Tables
-- that already have a lab FOR ALL policy are unaffected — the
-- extra SELECT policy is simply OR'd in and harmless.
--
-- Predicate `public.my_role() = 'lab'` matches the established
-- convention (schema.sql, 20260604_lab_write_policies_all_game_tables.sql).
--
-- Run once in the Supabase SQL Editor.
-- ============================================================

DO $$
DECLARE
  t         text;
  polname   text;
  export_tables text[] := ARRAY[
    -- generic session/trial catalog
    'game_sessions', 'trials', 'performance',
    -- questionnaires / demographics
    'questionnaire_responses', 'demographics',
    -- physio (BreathBelt)
    'belt_sessions', 'belt_trials',
    -- circumplex / games
    'stillwater_responses',
    'drift_trials', 'drift_performance',
    'face_read_trials', 'face_read_performance',
    'farm_joy_trials', 'farm_joy_performance', 'farm_joy_feedback', 'farm_joy_value_history',
    'word_max_sessions',
    'aptitude_sessions', 'aptitude_events',
    'breath_guardian_sessions',
    'pond_watch_results',
    -- rating scales
    'vas_responses',
    -- screeners
    'screener_results',
    -- video
    'participant_video_sessions', 'participant_video_events',
    -- audio
    'participant_audio_sessions', 'participant_audio_events',
    -- forms / bespoke
    'equity_census_responses',
    'participant_compensation',
    'participant_step_timings',
    'participant_assignments',
    'zerin_daily_checkins',
    -- Liliana longitudinal (Study 3)
    'intervention_responses', 'liliana_day_data', 'liliana_participants', 'liliana_midpoint_feedback'
  ];
BEGIN
  FOREACH t IN ARRAY export_tables LOOP
    polname := t || ': export lab read';
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', polname, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.my_role() = ''lab'')',
        polname, t
      );
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'export_lab_read: table %I does not exist — skipping', t;
    END;
  END LOOP;
END $$;
