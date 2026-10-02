-- Accountability Buddy: the check-in day rolls over at 04:00 Toronto, not midnight.
--
-- John's second check-in landed at 01:49 on what was, to him, Tuesday night.
-- Counting by calendar date filed that goal under Wednesday, so Tuesday read as
-- a missed day and his Wednesday 08:00 link opened on "you've already checked
-- in today". Norm, 2026-10-02: assume a night owl. Anything before 04:00 now
-- belongs to the previous day.
--
-- Only private.buddy_state changes (the one place the check-in day is
-- computed; both check-in RPCs read it). buddy_send's send_date is unaffected:
-- it only runs 08:00-11:59, where the two definitions agree.
--
-- Rows already collected are not rewritten (data rule 5): the COSINOR goal
-- submitted Wed 2026-09-30 01:49 keeps set_on 2026-09-30; its created_at
-- records when it really arrived.

CREATE OR REPLACE FUNCTION private.buddy_state(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_send  public.buddy_sends;
  -- Check-in day: Toronto wall clock minus four hours, so 00:00-03:59 counts
  -- as the night before.
  v_today date := ((pg_catalog.now() AT TIME ZONE 'America/Toronto') - interval '4 hours')::date;
  v_last  public.buddy_goals;
  v_tg    public.buddy_goals;
  v_open  jsonb := NULL;
  v_asked text;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('state', 'not_found');
  END IF;

  SELECT * INTO v_send FROM public.buddy_sends
   WHERE token_hash = pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex')
     AND status = 'sent';
  IF NOT FOUND THEN RETURN jsonb_build_object('state', 'not_found'); END IF;
  IF v_send.superseded_at IS NOT NULL THEN RETURN jsonb_build_object('state', 'replaced'); END IF;

  SELECT * INTO v_tg FROM public.buddy_goals
   WHERE student_id = v_send.student_id AND set_on = v_today;

  -- Only the latest goal before today is ever asked about; if it already has an
  -- outcome, nothing is open. Older unanswered goals show as "no response" in
  -- the admin log.
  SELECT * INTO v_last FROM public.buddy_goals
   WHERE student_id = v_send.student_id AND set_on < v_today
   ORDER BY set_on DESC LIMIT 1;
  IF FOUND AND NOT EXISTS (SELECT 1 FROM public.buddy_outcomes WHERE goal_id = v_last.id) THEN
    -- 'yesterday' only for the day before; a Friday goal asked on Monday is
    -- 'friday'; anything older is 'last_time'.
    v_asked := CASE
      WHEN v_last.set_on = v_today - 1 THEN 'yesterday'
      WHEN extract(isodow FROM v_today) = 1 AND v_last.set_on = v_today - 3 THEN 'friday'
      ELSE 'last_time'
    END;
    v_open := jsonb_build_object('id', v_last.id, 'goal_text', v_last.goal_text,
                                 'set_on', v_last.set_on, 'asked_as', v_asked);
  END IF;

  RETURN jsonb_build_object(
    'state', 'ok',
    'send_id', v_send.id,
    'student_id', v_send.student_id,
    'today', v_today,
    'open_goal', v_open,
    'today_goal', CASE WHEN v_tg.id IS NULL THEN NULL
                       ELSE jsonb_build_object('goal_text', v_tg.goal_text) END
  );
END;
$$;
REVOKE ALL ON FUNCTION private.buddy_state(text) FROM PUBLIC;
