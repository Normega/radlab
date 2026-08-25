-- Composable-surveys integration, step 2a: instrument definitions + responses.
-- (Handoff: website.md §31 "NEXT UP"; source package: Dana's radlab-composable-surveys.)
--
-- PURELY ADDITIVE. Nothing existing is altered except two new nullable/defaulted
-- columns on slider_scales. Safe to apply before any frontend ships.
--
-- Design decisions:
--
-- 1. ONE library table (`composable_instruments`) for the four instrument types
--    that have no home today (likert_slider, multiple_choice, open_list,
--    hierarchy), not four tables. Every type's definition is a jsonb `config`
--    that feeds Dana's component `config` prop verbatim (her contract:
--    <Component config={...} value={...} onChange={...}/>), so per-type tables
--    would have been jsonb-in-typed-clothing anyway. The per-type libraries on
--    /admin/instruments/:slug filter on `type`.
--
-- 2. Likert sliders live HERE, not in slider_scales. They are a separate
--    sidebar category, need a label per snap point (slider_scales only has
--    min_label/max_label), and keeping them out means slider_scales stays
--    exactly what AdoptedInstrumentPage already calls it: the numeric-slider
--    library. Config shape follows Dana's SliderQuestion contract
--    ({question, min, max, step, labels:[{value,label}]}); the `type` column
--    is what selects likert rendering (labels at snap fractions, no VALUE box).
--
-- 3. VAS scales, numeric sliders and packages keep their existing tables and
--    save paths — adopted decisions, not relitigated. Composable page-based
--    questionnaires (questionnaire_type:"composable") also need NO schema:
--    they ride questionnaires.definition (jsonb) and questionnaire_responses,
--    which already has schedule_id + the 20260818 dedupe guard.
--
-- 4. ONE response table (`instrument_responses`) for all four types, per the
--    CLAUDE.md participant-data rules:
--      rule 1 — schedule_id references participant_schedule ON DELETE SET NULL;
--      rule 2 — DB-side duplicate guard, same 10 s collapse-into-update trigger
--               as 20260818_questionnaire_submit_guard (the client ref-lock is
--               per-mount and cannot survive a remount);
--      rule 3 — instrument_slug and instrument_type are recorded on the row so
--               the export names columns from facts, not joins-at-export-time
--               (a renamed or deleted definition must not relabel old data);
--               step_index records WHERE in the session the response came from,
--               so an instrument repeated pre/post in one session is
--               disambiguated by a recorded fact, not occurrence order.

-- ── Instrument definition library ────────────────────────────────────────────

CREATE TABLE composable_instruments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  type       text NOT NULL CHECK (type IN ('likert_slider','multiple_choice','open_list','hierarchy')),
  label      text NOT NULL,
  config     jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE composable_instruments ENABLE ROW LEVEL SECURITY;

-- Participants render these inside sessions → same read policy as
-- slider_scales/vas_scales ("authenticated read", USING true).
CREATE POLICY "authenticated read"
  ON composable_instruments FOR SELECT TO authenticated
  USING (true);

-- Writes mirror slider_scales' "lab write" (role-based, not created_by-based,
-- so any lab member can maintain the shared library).
CREATE POLICY "lab write"
  ON composable_instruments FOR ALL TO authenticated
  USING (my_role() = ANY (ARRAY['lab'::text, 'admin'::text]))
  WITH CHECK (my_role() = ANY (ARRAY['lab'::text, 'admin'::text]));

-- ── Responses ────────────────────────────────────────────────────────────────

CREATE TABLE instrument_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  instrument_id   uuid NOT NULL REFERENCES composable_instruments(id),
  -- Recorded facts (rule 3): what this row was when it was answered.
  instrument_slug text NOT NULL,
  instrument_type text NOT NULL,
  -- Where it came from (rule 1): the scheduled occurrence, and the step's
  -- position within that session. Deleting a schedule row must never delete
  -- collected answers.
  schedule_id     uuid REFERENCES participant_schedule(id) ON DELETE SET NULL,
  session_id      uuid,
  step_index      integer,
  response        jsonb NOT NULL,
  responded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX instrument_responses_user_schedule_idx
  ON instrument_responses (user_id, schedule_id);
CREATE INDEX instrument_responses_instrument_idx
  ON instrument_responses (instrument_id);

ALTER TABLE instrument_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows"
  ON instrument_responses FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Export path reads everything (mirrors vas_responses "export lab read").
CREATE POLICY "export lab read"
  ON instrument_responses FOR SELECT TO authenticated
  USING (my_role() = 'lab'::text);

-- ── Duplicate-submit guard (rule 2, DB half) ─────────────────────────────────
-- Same behaviour and rationale as questionnaire_responses_dedupe (20260818):
-- a repeat of (user_id, instrument_id, step_index) inside 10 s updates the
-- existing row with the newer response instead of inserting. 10 s is far below
-- any deliberate human repeat; a legitimate pre/post repeat of the same
-- instrument in one session differs in step_index and is minutes apart anyway.

CREATE OR REPLACE FUNCTION instrument_responses_dedupe()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_id uuid;
  v_window      constant interval := interval '10 seconds';
BEGIN
  SELECT id INTO v_existing_id
    FROM instrument_responses
   WHERE user_id = NEW.user_id
     AND instrument_id = NEW.instrument_id
     AND step_index IS NOT DISTINCT FROM NEW.step_index
     AND responded_at > COALESCE(NEW.responded_at, now()) - v_window
     AND responded_at <= COALESCE(NEW.responded_at, now())
   ORDER BY responded_at DESC
   LIMIT 1;

  IF v_existing_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE instrument_responses
     SET response     = NEW.response,
         responded_at = COALESCE(NEW.responded_at, now())
   WHERE id = v_existing_id;

  RAISE NOTICE 'instrument_responses: collapsed duplicate % for user %',
    NEW.instrument_slug, NEW.user_id;

  RETURN NULL;  -- BEFORE INSERT + NULL = skip the insert
END;
$$;

CREATE TRIGGER instrument_responses_dedupe_trg
  BEFORE INSERT ON instrument_responses
  FOR EACH ROW
  EXECUTE FUNCTION instrument_responses_dedupe();

-- ── Numeric sliders: the adopted format's missing fields ─────────────────────
-- The official numeric-slider format (Norm, 2026-08-24) has sparse numbered
-- anchors — start/middle/end, each a value + label — where slider_scales only
-- stores min_label/max_label. `anchors` is the full spec
-- ([{"value":0,"label":"…"},{"value":50,"label":"…"},{"value":100,"label":"…"}]);
-- NULL means "derive start/end from min_label/max_label", which is exactly how
-- AdoptedInstrumentPage's SliderPreview renders existing rows today, so every
-- current slider keeps working untouched. `step` completes Dana's
-- SliderQuestion contract (min/max/step).

ALTER TABLE slider_scales
  ADD COLUMN anchors jsonb,
  ADD COLUMN step integer NOT NULL DEFAULT 1;
