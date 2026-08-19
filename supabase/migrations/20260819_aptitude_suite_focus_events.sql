-- Aptitude Suite: allow suite-level events in aptitude_events
--
-- The Aptitude Suite shows all three subtasks SIMULTANEOUSLY in a 3-column grid,
-- so unlike ColourMax there is no page to leave and no navigation event to log.
-- Until now the suite emitted only per-subtask action events (solve, submit_*,
-- guess_*), which means time-on-task could not be reconstructed at all: a
-- participant dwelling on the hardest subtask without typing produced no events,
-- so any time attributed from the action stream would systematically UNDER-count
-- exactly the unproductive dwell the study is about.
--
-- The suite now also emits focus transitions and session boundaries. Focus
-- events name the newly focused subtask (so they already satisfy this CHECK),
-- but the session-level ones - session_start, game_end, window_blur,
-- window_focus - belong to the suite rather than to any one subtask, exactly as
-- ColourMax's own session_start/game_end/page_switch use task = 'color_max'.
--
-- Widening the CHECK is additive: no existing row changes, and nothing that
-- reads the table filters on the absence of this value.

ALTER TABLE aptitude_events DROP CONSTRAINT IF EXISTS aptitude_events_task_check;

ALTER TABLE aptitude_events
  ADD CONSTRAINT aptitude_events_task_check
  CHECK (task = ANY (ARRAY['anagram'::text, 'fluency'::text, 'wordprobe'::text,
                           'color_max'::text, 'aptitude_suite'::text]));
