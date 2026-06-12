-- M2: Drop the anon INSERT policy on stillwater_responses.
-- Left over from original workaround; all participants now use authenticated sessions.
DROP POLICY IF EXISTS "stillwater insert anon" ON public.stillwater_responses;

-- M3: Add lab read policies for audio engagement tables (previously invisible to researchers).
CREATE POLICY "lab read audio sessions"
  ON public.participant_audio_sessions
  FOR SELECT TO authenticated
  USING (my_role() = 'lab');

CREATE POLICY "lab read audio events"
  ON public.participant_audio_events
  FOR SELECT TO authenticated
  USING (my_role() = 'lab');

-- M6: Revoke complete_audio_session EXECUTE from PUBLIC and anon.
-- Function already guards against null auth.uid(), but no need to expose it unauthenticated.
REVOKE EXECUTE ON FUNCTION public.complete_audio_session(uuid, integer, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_audio_session(uuid, integer, numeric) FROM anon;
