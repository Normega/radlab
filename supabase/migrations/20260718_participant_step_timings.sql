-- Per-step (per-screen) time-on-screen tracking for participant sessions.
--
-- Generalizes the post-video dwell idea (20260718_video_advanced_at) to every
-- session step: SessionEntry stamps entered_at when a step mounts and writes one
-- row on exit with exited_at, so "time on each screen" is measurable across the
-- whole session. A very long duration flags disengagement (walked away / left it
-- idle) — the same signal advanced_at gives for video steps specifically.
--
-- Scope: SessionEntry (real remote participant flow) only. The admin in-person
-- runner (StudySessionRunner) is operator-paced and uses the lab client, so its
-- timing wouldn't measure a participant — deliberately not instrumented.
--
-- duration_ms is a STORED generated column computed from the two client
-- timestamps (same clock → accurate even if the participant's wall-clock is
-- skewed). Participants are authenticated (auth.uid() = participant_id via
-- sign_in_with_link), so RLS follows the standard participant_id own-rows pattern
-- plus lab read. One row is written per step exit; a mid-session reload restarts
-- the flow, so repeated attempts simply add more rows (timing is per sitting).

CREATE TABLE IF NOT EXISTS participant_step_timings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id           uuid NOT NULL,
  participant_schedule_id  uuid,
  study_id                 uuid,
  step_index               integer NOT NULL,
  activity_id              uuid,
  category                 text,
  subcategory              text,
  label                    text,
  entered_at               timestamptz NOT NULL,
  exited_at                timestamptz NOT NULL,
  duration_ms              integer GENERATED ALWAYS AS
                             ((EXTRACT(EPOCH FROM (exited_at - entered_at)) * 1000)::integer) STORED,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_step_timings_schedule
  ON participant_step_timings (participant_schedule_id);
CREATE INDEX IF NOT EXISTS idx_step_timings_participant
  ON participant_step_timings (participant_id);

ALTER TABLE participant_step_timings ENABLE ROW LEVEL SECURITY;

-- Participants own their timing rows (insert during a session, read back their own).
CREATE POLICY "own rows"
  ON participant_step_timings
  FOR ALL
  TO authenticated
  USING (participant_id = auth.uid())
  WITH CHECK (participant_id = auth.uid());

-- Lab / super-admin read all for analysis.
CREATE POLICY "lab read all step timings"
  ON participant_step_timings
  FOR SELECT
  TO authenticated
  USING (my_role() = 'lab' OR is_super_admin());
