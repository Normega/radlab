-- An expired link to a baseline that is still open (2026-10-17).
--
-- A hold session (a baseline the rest of the study waits on) is never marked
-- missed: check_schedule re-sends it every day with a fresh 24-hour link until
-- it is completed (passes 0b/0e). But a participant who opened an OLDER email
-- got SessionEntry's ordinary expired screen, "This session's window has closed
-- ... there's nothing to make up", which is false on both counts for a
-- baseline. A PSY240 class-trial student wrote in believing the baseline had
-- closed, on an evening when a working link had already been emailed to them.
--
-- link_resends_daily(token): true when the token's session is a hold session
-- that check_schedule will keep re-sending. Mirrors check_schedule's isHold:
-- not completed, still in flight (link_sent / unlocked), a session node marked
-- hold, study active, enrollment not withdrawn; plus the hard gates open, since
-- send_message asks schedule_row_block_reason before every re-send. It sends
-- nothing and opens nothing: it only chooses the copy on a screen that is
-- already closed.
--
-- Anon-callable: the expired path has no participant session (sign_in_with_link
-- refuses dead links). The token is the participant's own credential, and the
-- answer is one boolean about that token's own session.

CREATE OR REPLACE FUNCTION public.link_resends_daily(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM participant_links pl
      JOIN participant_schedule ps ON ps.id = pl.schedule_id
      JOIN study_sessions ss       ON ss.id = ps.study_session_id
      JOIN studies s               ON s.id = ps.study_id
      JOIN study_enrollments e     ON e.study_id = ps.study_id AND e.profile_id = ps.participant_id
     WHERE pl.token = p_token
       AND ps.completed_at IS NULL
       AND ps.status IN ('link_sent', 'unlocked')
       AND s.active
       AND e.status IS DISTINCT FROM 'withdrawn'
       AND EXISTS (
         SELECT 1
           FROM jsonb_array_elements(COALESCE(s.design_graph->'nodes', '[]'::jsonb)) n
          WHERE n.value->>'type' = 'session'
            AND n.value->>'id' = ss.node_key
            AND COALESCE((n.value->>'hold')::boolean, false))
       AND public.schedule_row_block_reason(ps.id) IS NULL
  )
$$;

REVOKE ALL ON FUNCTION public.link_resends_daily(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_resends_daily(text) TO anon, authenticated;
