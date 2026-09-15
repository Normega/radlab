-- Experience Factory — thought/feeling/sensation sorting game.
-- Design: src/games/ExperienceFactory/DESIGN.md (v0.2, approved 2026-09-15).
--
-- experience_factory_trials is a RESPONSE TABLE (participant data rule 5):
-- observe-round rows are self-report data. It gets received_at/resubmission_of,
-- the note_response_trg + forbid_response_overwrite_trg pair, and an entry in
-- src/lib/responsesAppendOnly.test.mjs RESPONSE_TABLES.
-- experience_factory_performance is a derived per-session summary (drift
-- pattern), not a response table.

-- ── 1. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.experience_factory_trials (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id         uuid REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  -- rule 1: a response records where it came from; deleting a schedule row
  -- must never delete collected answers
  schedule_id        uuid REFERENCES public.participant_schedule(id) ON DELETE SET NULL,
  level              integer NOT NULL,
  round_index        integer NOT NULL,
  round_type         text    NOT NULL CHECK (round_type IN ('practice', 'sort', 'observe')),
  trial_index        integer NOT NULL,
  item_id            text,             -- null on observe trials (self-report)
  item_modality      text,             -- text | face | color | tone; null on observe
  item_tier          integer,          -- 1 cued, 2 all-text, 3 trap; null on observe
  canonical_category text,             -- null on observe: there is no ground truth
  chosen_category    text,             -- null when the item drifted past unsorted
  correct            boolean,          -- null on observe (non-evaluative by design)
  rt_ms              integer,
  belt_speed         integer,          -- gate travel ms at the level played
  created_at         timestamptz DEFAULT now(),
  received_at        timestamptz DEFAULT now(),
  resubmission_of    uuid
);

COMMENT ON COLUMN public.experience_factory_trials.received_at IS
  'Server clock at insert (set by note_response_trg).';
COMMENT ON COLUMN public.experience_factory_trials.resubmission_of IS
  'Set when this row is a byte-identical copy of the participant''s immediately preceding submission, same trial, within 5 s. The row is kept; the id points at the original.';

CREATE INDEX IF NOT EXISTS experience_factory_trials_session
  ON public.experience_factory_trials (session_id);

CREATE TABLE IF NOT EXISTS public.experience_factory_performance (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id               uuid REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id                  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id              uuid REFERENCES public.participant_schedule(id) ON DELETE SET NULL,
  level                    integer NOT NULL,
  sort_trials              integer,
  sort_correct             integer,
  sort_missed              integer,
  sort_accuracy            numeric(6,4),  -- drives sequential lever unlocks client-side
  accuracy_by_category     jsonb,
  accuracy_by_tier         jsonb,
  hits_by_category         jsonb,
  false_alarms_by_category jsonb,
  observe_counts           jsonb,
  duration_s               integer,
  points_awarded           integer,
  created_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experience_factory_performance_user
  ON public.experience_factory_performance (user_id, level);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_factory_sessions integer DEFAULT 0;

-- ── 2. RLS — explicit policies for authenticated (CLAUDE.md pattern) ──────────

ALTER TABLE public.experience_factory_trials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows" ON public.experience_factory_trials;
CREATE POLICY "own rows"
  ON public.experience_factory_trials
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.experience_factory_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows" ON public.experience_factory_performance;
CREATE POLICY "own rows"
  ON public.experience_factory_performance
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 3. Append-only: teach note_response_trg the new table ─────────────────────
-- Full function re-created from 20260911_responses_never_overwrite.sql with one
-- added branch. Same contract: flag provable double-fires, keep every row, fail
-- open, never discard.

CREATE OR REPLACE FUNCTION public.note_response_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subject uuid;
  v_key     text;
  v_hash    text;
BEGIN
  NEW.id          := COALESCE(NEW.id, pg_catalog.gen_random_uuid());
  NEW.received_at := pg_catalog.clock_timestamp();

  BEGIN
    IF TG_TABLE_NAME = 'questionnaire_responses' THEN
      v_subject := NEW.user_id;
      v_key  := pg_catalog.concat_ws('|', NEW.questionnaire_slug,
                  COALESCE(NEW.schedule_id::text, ''), COALESCE(NEW.step_index::text, ''));
      v_hash := pg_catalog.md5(COALESCE(NEW.responses::text, ''));

    ELSIF TG_TABLE_NAME = 'vas_responses' THEN
      v_subject := NEW.user_id;
      v_key  := pg_catalog.concat_ws('|', COALESCE(NEW.scale_id::text, ''),
                  COALESCE(NEW.schedule_id::text, ''), COALESCE(NEW.step_index::text, ''),
                  COALESCE(NEW.package_slug, ''));
      v_hash := pg_catalog.md5(COALESCE(NEW.value::text, ''));

    ELSIF TG_TABLE_NAME = 'instrument_responses' THEN
      v_subject := NEW.user_id;
      v_key  := pg_catalog.concat_ws('|', COALESCE(NEW.instrument_id::text, NEW.instrument_slug, ''),
                  COALESCE(NEW.schedule_id::text, ''), COALESCE(NEW.step_index::text, ''));
      v_hash := pg_catalog.md5(COALESCE(NEW.response::text, ''));

    ELSIF TG_TABLE_NAME = 'zerin_daily_checkins' THEN
      v_subject := NEW.user_id;
      v_key  := pg_catalog.concat_ws('|', COALESCE(NEW.schedule_id::text, ''),
                  COALESCE(NEW.study_day::text, ''), COALESCE(NEW.slot, ''));
      v_hash := pg_catalog.md5(pg_catalog.concat_ws('|', NEW.arm, NEW.rating, NEW.direction,
                  NEW.reason, NEW.tip_text));

    ELSIF TG_TABLE_NAME = 'pond_watch_results' THEN
      v_subject := NEW.user_id;
      v_key  := pg_catalog.concat_ws('|', COALESCE(NEW.schedule_id::text, ''),
                  COALESCE(NEW.study_id::text, ''));
      v_hash := pg_catalog.md5(pg_catalog.concat_ws('|', NEW.hits, NEW.misses, NEW.false_alarms,
                  NEW.correct_rejections, NEW.n_trials, NEW.pauses,
                  pg_catalog.md5(COALESCE(NEW.trials::text, ''))));

    ELSIF TG_TABLE_NAME = 'intervention_responses' THEN
      -- participant_id here is liliana_participants.id, not a profile id; the
      -- ledger comparison stays within this participant's own intervention rows.
      v_subject := NEW.participant_id;
      v_key  := pg_catalog.concat_ws('|', COALESCE(NEW.day_data_id::text, ''),
                  COALESCE(NEW.schedule_id::text, ''), COALESCE(NEW.module_id, ''),
                  COALESCE(NEW.study_day::text, ''), COALESCE(NEW.block_type, ''),
                  COALESCE(NEW.response_index::text, ''));
      v_hash := pg_catalog.md5(pg_catalog.concat_ws('|', NEW.response_text,
                  COALESCE(NEW.response_value::text, '')));

    ELSIF TG_TABLE_NAME = 'screener_results' THEN
      v_subject := NEW.participant_id;
      v_key  := COALESCE(NEW.study_id::text, '');
      v_hash := pg_catalog.md5(pg_catalog.concat_ws('|', NEW.phase1_passed, NEW.phase2_passed,
                  NEW.phase2_outcome, COALESCE(NEW.phase1_answers::text, '')));

    ELSIF TG_TABLE_NAME = 'experience_factory_trials' THEN
      v_subject := NEW.user_id;
      v_key  := pg_catalog.concat_ws('|', COALESCE(NEW.session_id::text, ''),
                  COALESCE(NEW.round_index::text, ''), COALESCE(NEW.trial_index::text, ''));
      v_hash := pg_catalog.md5(pg_catalog.concat_ws('|', NEW.chosen_category,
                  COALESCE(NEW.correct::text, ''), COALESCE(NEW.rt_ms::text, ''),
                  COALESCE(NEW.item_id, '')));

    ELSE
      RAISE EXCEPTION 'note_response_trg is not configured for table %', TG_TABLE_NAME;
    END IF;

    NEW.resubmission_of := private.note_response(TG_TABLE_NAME, v_subject, NEW.id, v_key, v_hash);

  EXCEPTION WHEN OTHERS THEN
    -- Fail open. Flagging is a convenience; capturing the answer is not.
    RAISE WARNING 'note_response_trg on %: % -- row kept, not flagged', TG_TABLE_NAME, SQLERRM;
    NEW.resubmission_of := NULL;
  END;

  RETURN NEW;
END;
$$;

-- ── 4. The two triggers on the new response table ─────────────────────────────

DROP TRIGGER IF EXISTS note_response_trg ON public.experience_factory_trials;
CREATE TRIGGER note_response_trg BEFORE INSERT ON public.experience_factory_trials
  FOR EACH ROW EXECUTE FUNCTION public.note_response_trg();

DROP TRIGGER IF EXISTS forbid_response_overwrite_trg ON public.experience_factory_trials;
CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.experience_factory_trials
  FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite();
