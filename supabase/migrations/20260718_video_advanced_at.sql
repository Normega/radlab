-- Post-video dwell tracking.
--
-- participant_video_sessions already records started_at (player mount) and
-- completed_at (90% threshold or video 'ended'), but nothing captured when the
-- participant actually LEFT the video screen by clicking Continue. Step
-- advancement in SessionEntry is client-only (setCurrentIndex), and the video
-- is often the final step of a template (e.g. the Liliana intro video), so there
-- is no next-step timestamp to derive dwell from.
--
-- advanced_at closes that gap:
--   total time on screen   = advanced_at - started_at
--   dwell after video ends = advanced_at - completed_at   <- flags "let it run
--                            out and walked off": a large gap here means the
--                            participant sat on the finished video (or wandered
--                            back long after it ended) before continuing.
--
-- Participants have no UPDATE policy on participant_video_sessions (only INSERT +
-- SELECT; see RLS), so — like complete_video_session — the write goes through a
-- SECURITY DEFINER RPC rather than a direct update, which RLS would silently block.

ALTER TABLE participant_video_sessions
  ADD COLUMN IF NOT EXISTS advanced_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_video_advanced(p_session_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Idempotent: only the first Continue click stamps the time; later calls
  -- (e.g. back-navigation) leave the original dwell measurement intact.
  UPDATE participant_video_sessions
     SET advanced_at = now()
   WHERE id = p_session_id
     AND advanced_at IS NULL;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_video_advanced(uuid) TO anon, authenticated, service_role;
