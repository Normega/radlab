-- A collected response is never overwritten and never discarded.
--
-- WHY. On 2026-08-26/27 a duplicate-submit guard destroyed 1,895 of 3,290 slider
-- ratings in Sandy Study 3 (20260910_dedupe_by_step_index.sql). That guard, and
-- the three built on the same pattern, answered a suspected double submission by
-- UPDATEing the earlier row with the new values and returning NULL to drop the
-- insert. Whenever the "duplicate" test was wrong, a real answer vanished with no
-- error anywhere. The step-keyed fix of 2026-09-10 narrowed the test but kept the
-- pattern: a participant re-answering the same step minutes later still lost
-- their first answer. The Zerin and Pond Watch guards (2026-09-10, before the
-- SONA launch) key on the session with no time window at all.
--
-- POLICY (Norm, 2026-09-10). Every datum collected gets its own row. A double
-- submission can only be one that arrives within a few seconds of the previous
-- submission, with nothing else collected in between -- once any other variable
-- has been recorded, a repeat cannot be a double submission.
--
-- DESIGN: flag, don't drop.
--
--   * Every insert is kept. Nothing in this file returns NULL from an insert
--     trigger or updates an existing row.
--   * `received_at` is stamped by the SERVER clock. Participant clocks were off by
--     up to an hour in Sandy Study 3, so no duplicate test may use them.
--   * `response_ledger` records every response received, across tables, in order,
--     so a participant's previous entry is whatever was collected immediately
--     before, whichever table it went to.
--   * A new row is marked `resubmission_of = <earlier row>` only when the
--     participant's immediately preceding ledger entry is the same table, the same
--     variable (identity key) and a byte-identical payload, received no more than
--     5 seconds earlier. Anything collected in between, a different answer, or a
--     longer gap: not a resubmission, no flag.
--   * A flag never removes data. The row stays in its table and in the per-table
--     export; the participant master omits only rows that are provably identical
--     copies, and reports how many it omitted.
--   * The trigger fails OPEN. If flagging errors for any reason, the row is kept
--     unflagged and a warning is logged: capturing the answer outranks labelling it.
--   * UPDATE of a response row is refused for participant-facing roles
--     (`authenticated`, `anon`). Maintenance through the service role or a
--     migration is unaffected. DELETE is left alone: account deletion and data
--     withdrawal remove rows deliberately, and that is not this failure.
--
-- SCOPE. The six response tables that had, or needed, a submit guard. The
-- screener joins in 20260911_screener_results_append_only.sql, applied only after
-- the frontend stops upserting it (dropping its unique key first would break the
-- deployed upsert).
--
-- REGRESSION GUARD. src/lib/responsesAppendOnly.test.mjs replays the migrations and
-- fails CI if a later one reinstates an insert trigger that discards rows on these
-- tables, or if client code updates or upserts one.

-- ── 0. Private schema: helpers participants cannot call ───────────────────────

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- ── 1. The ledger ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.response_ledger (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  received_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  subject_id      uuid,
  table_name      text NOT NULL,
  row_id          uuid NOT NULL,
  identity_key    text NOT NULL,
  payload_hash    text NOT NULL,
  resubmission_of uuid
);

COMMENT ON TABLE public.response_ledger IS
  'Append-only record of every participant response received, across response '
  'tables, in server-clock order. Written only by note_response_trg. Lets the '
  'resubmission test see what was collected immediately before, and lets an audit '
  'confirm every received row still exists.';

CREATE INDEX IF NOT EXISTS response_ledger_subject_time
  ON public.response_ledger (subject_id, received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS response_ledger_row
  ON public.response_ledger (table_name, row_id);

ALTER TABLE public.response_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "response_ledger: lab read" ON public.response_ledger;
CREATE POLICY "response_ledger: lab read"
  ON public.response_ledger FOR SELECT TO authenticated
  USING (public.my_role() = 'lab');
-- No INSERT/UPDATE/DELETE policy: participants and lab users cannot write it.
-- The trigger writes it as the function owner.

-- ── 2. The resubmission test ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.note_response(
  p_table   text,
  p_subject uuid,
  p_row     uuid,
  p_key     text,
  p_hash    text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window constant interval := interval '5 seconds';
  v_last   public.response_ledger%ROWTYPE;
  v_flag   uuid;
BEGIN
  IF p_subject IS NOT NULL THEN
    -- Serialise one participant's submissions so two copies racing each other
    -- are compared in order rather than both seeing an empty ledger.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('response_ledger:' || p_subject::text, 0));

    SELECT * INTO v_last
      FROM public.response_ledger
     WHERE subject_id = p_subject
     ORDER BY received_at DESC, id DESC
     LIMIT 1;

    -- The IMMEDIATELY preceding submission, across every response table, must be
    -- this same variable with a byte-identical payload, seconds ago.
    IF FOUND
       AND v_last.table_name   = p_table
       AND v_last.identity_key = p_key
       AND v_last.payload_hash = p_hash
       AND pg_catalog.clock_timestamp() - v_last.received_at <= v_window THEN
      v_flag := COALESCE(v_last.resubmission_of, v_last.row_id);
    END IF;
  END IF;

  INSERT INTO public.response_ledger
    (subject_id, table_name, row_id, identity_key, payload_hash, resubmission_of)
  VALUES
    (p_subject, p_table, p_row, p_key, p_hash, v_flag);

  RETURN v_flag;
END;
$$;

REVOKE ALL ON FUNCTION private.note_response(text, uuid, uuid, text, text) FROM PUBLIC;

-- ── 3. One insert trigger for every response table ────────────────────────────
--
-- Identity key = what makes two rows "the same variable". Payload hash = the
-- answer itself, excluding client timestamps (a double-fire resends the same
-- object, but a fresh `new Date()` would differ).

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

-- ── 4. Refuse overwrites from participant-facing roles ────────────────────────

CREATE OR REPLACE FUNCTION public.forbid_response_overwrite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION '% is append-only: a collected response is never updated. Insert a new row instead.',
      TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. Apply to the six tables ────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['questionnaire_responses', 'vas_responses', 'instrument_responses',
                           'zerin_daily_checkins', 'pond_watch_results', 'intervention_responses']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS received_at timestamptz', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN received_at SET DEFAULT now()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS resubmission_of uuid', t);
    EXECUTE format($c$COMMENT ON COLUMN public.%I.received_at IS
      'Server clock at insert (set by note_response_trg). NULL on rows collected before 2026-09-11.'$c$, t);
    EXECUTE format($c$COMMENT ON COLUMN public.%I.resubmission_of IS
      'Set when this row is a byte-identical copy of the participant''s immediately preceding submission, same variable, within 5 s. The row is kept; the id points at the original.'$c$, t);

    EXECUTE format('DROP TRIGGER IF EXISTS note_response_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER note_response_trg BEFORE INSERT ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION public.note_response_trg()', t);

    EXECUTE format('DROP TRIGGER IF EXISTS forbid_response_overwrite_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite()', t);
  END LOOP;
END;
$$;

-- ── 6. Retire the guards that dropped and overwrote ───────────────────────────

DROP TRIGGER IF EXISTS questionnaire_responses_dedupe_trg ON public.questionnaire_responses;
DROP FUNCTION IF EXISTS public.questionnaire_responses_dedupe();
DROP TRIGGER IF EXISTS instrument_responses_dedupe_trg ON public.instrument_responses;
DROP FUNCTION IF EXISTS public.instrument_responses_dedupe();
DROP TRIGGER IF EXISTS zerin_daily_checkins_dedupe_trg ON public.zerin_daily_checkins;
DROP FUNCTION IF EXISTS public.zerin_daily_checkins_dedupe();
DROP TRIGGER IF EXISTS pond_watch_results_dedupe_trg ON public.pond_watch_results;
DROP FUNCTION IF EXISTS public.pond_watch_results_dedupe();
