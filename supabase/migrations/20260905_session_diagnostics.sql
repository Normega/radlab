-- Session diagnostics: make a mid-session crash visible instead of silent.
--
-- Why (Norm, 2026-09-05): three Sandy Study 3 participants reported technical
-- issues on 2026-08-27. The record showed each finishing a step cleanly and the
-- NEXT step never being entered — twelve such sessions that night, nine of them
-- at or immediately before one of the two games. Two things made it
-- undiagnosable after the fact:
--
--   1. `/s/:token` had no error boundary, so a component throwing on mount
--      unmounted the whole tree and left a blank page. Nothing was recorded
--      because nothing was left running to record it.
--   2. Nothing anywhere captures the device or browser. Every column in the
--      schema was checked; the closest was belt_sessions.trigger_device.
--      So "was it all mobile Safari?" was unanswerable.
--
-- This table answers both. One row when a session starts (the baseline: what
-- everyone is on) and one when a step crashes (what the broken ones were on,
-- and where). Comparing the two populations is the whole point — crash rows
-- alone would have no denominator.
--
-- PURELY ADDITIVE. Nothing existing changes, so this can be applied ahead of
-- the frontend that writes to it.

CREATE TABLE session_diagnostics (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  study_id       uuid,
  -- CLAUDE.md participant-data rule 1: a response records WHERE it came from,
  -- and deleting a schedule row must never delete what was collected.
  schedule_id    uuid REFERENCES participant_schedule(id) ON DELETE SET NULL,
  step_index     integer,
  kind           text NOT NULL CHECK (kind IN ('session_start', 'step_crash')),
  -- Recorded facts about the client, not inferences drawn later.
  user_agent     text,
  viewport       text,
  -- Populated on step_crash only.
  step_category    text,
  step_subcategory text,
  error_message    text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX session_diagnostics_study_kind_idx
  ON session_diagnostics (study_id, kind, created_at DESC);
CREATE INDEX session_diagnostics_participant_idx
  ON session_diagnostics (participant_id);

ALTER TABLE session_diagnostics ENABLE ROW LEVEL SECURITY;

-- Same shape as participant_step_timings: the participant writes their own
-- rows from inside the session, the lab reads all of them.
CREATE POLICY "own rows"
  ON session_diagnostics FOR ALL TO authenticated
  USING (participant_id = auth.uid())
  WITH CHECK (participant_id = auth.uid());

CREATE POLICY "lab read all diagnostics"
  ON session_diagnostics FOR SELECT TO authenticated
  USING (my_role() = 'lab'::text OR is_super_admin());
