-- Accountability Buddy — schema, RLS, append-only guards, RPCs.
--
-- A private daily goal check-in for grad students (spec:
-- I:\Shared drives\ComeSee\AccountabilityBuddy\accountability_buddy_spec.md,
-- website.md "Accountability Buddy"). The buddy_send Edge Function emails each
-- active student every weekday morning; the link opens /buddy/:token, which
-- asks whether the last goal was done and for today's goal.
--
-- Access model: RLS on every table, one policy — super admins, full access.
-- Anon and ordinary authenticated users reach the data ONLY through the two
-- SECURITY DEFINER check-in RPCs below, which take the emailed token as the
-- credential. The two send RPCs are service-role only.
--
-- Responses (buddy_goals, buddy_outcomes) are append-only (CLAUDE.md, data
-- rule 5): forbid_response_overwrite_trg refuses UPDATE from participant-facing
-- roles, and src/lib/responsesAppendOnly.test.mjs lists both tables. They do
-- NOT get note_response_trg: the unique indexes below make a second goal for
-- the same day, or a second outcome for the same goal, impossible to insert, so
-- a resubmission flag could never fire — and redefining that shared trigger
-- function for no effect is pure risk. A same-day repeat is refused visibly
-- ("already checked in") rather than silently dropped.

-- ── 1. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE public.buddy_students (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text NOT NULL,
  project_name    text,
  active          boolean NOT NULL DEFAULT true,
  paused_until    date,                       -- no sends on or before this Toronto date
  zoom_url        text,
  next_meeting_at timestamptz,
  reply_to        text NOT NULL DEFAULT 'norman@radlab.zone',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Admin-managed config, not student responses: updates are fine here.
-- The current milestone is the lowest position with done_at null.
CREATE TABLE public.buddy_milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES public.buddy_students(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  title       text NOT NULL,
  target_date date,
  done_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX buddy_milestones_student_idx ON public.buddy_milestones (student_id, position);

CREATE TABLE public.buddy_quotes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position   int,                              -- list number in the source file
  quote      text NOT NULL,
  source     text,
  tag        text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per send attempt. Lifecycle: buddy_claim_send inserts 'pending'
-- BEFORE the email goes out (so two overlapping runs cannot both send), then
-- buddy_finish_send flips it to 'sent' (superseding the previous live link in
-- the same transaction) or 'failed' (previous link stays live; next tick
-- retries). A 'pending' row older than 15 minutes is treated as a crashed
-- attempt and failed by the next claim.
--
-- One live link per student: a 'sent' row with superseded_at null. It has no
-- expiry — Friday's link works through the weekend until Monday's arrives.
CREATE TABLE public.buddy_sends (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.buddy_students(id) ON DELETE CASCADE,
  send_date     date NOT NULL,                 -- Toronto date
  token_hash    text,                          -- sha256 hex of the token; raw token never stored
  superseded_at timestamptz,
  quote_id      uuid REFERENCES public.buddy_quotes(id) ON DELETE SET NULL,
  status        text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  forced        boolean NOT NULL DEFAULT false, -- manual test send (service key + force)
  error         text,
  resend_id     text,
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz
);
-- At most one real send per student per day. Forced test sends are exempt so the
-- Sunday test plan can send a second link the same day.
CREATE UNIQUE INDEX buddy_sends_one_per_day
  ON public.buddy_sends (student_id, send_date)
  WHERE status IN ('pending', 'sent') AND NOT forced;
CREATE UNIQUE INDEX buddy_sends_one_live_link
  ON public.buddy_sends (student_id)
  WHERE status = 'sent' AND superseded_at IS NULL;
CREATE UNIQUE INDEX buddy_sends_token_hash ON public.buddy_sends (token_hash) WHERE token_hash IS NOT NULL;

-- Responses. RESTRICT on the student FK: deleting a student must be a
-- deliberate act that deletes their responses first, never a cascade.
-- send_id records WHICH emailed link the answer came through (data rule 1).
CREATE TABLE public.buddy_goals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.buddy_students(id) ON DELETE RESTRICT,
  set_on     date NOT NULL,                    -- Toronto date
  goal_text  text NOT NULL CHECK (char_length(goal_text) BETWEEN 1 AND 500),
  send_id    uuid REFERENCES public.buddy_sends(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, set_on)
);

CREATE TABLE public.buddy_outcomes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     uuid NOT NULL UNIQUE REFERENCES public.buddy_goals(id) ON DELETE RESTRICT,
  done        boolean NOT NULL,
  send_id     uuid REFERENCES public.buddy_sends(id) ON DELETE SET NULL,
  answered_at timestamptz NOT NULL DEFAULT now()
);

-- Norm's annotations, not responses: edits are fine.
CREATE TABLE public.buddy_tag_options (
  tag      text PRIMARY KEY,
  position int NOT NULL DEFAULT 0
);

CREATE TABLE public.buddy_goal_tags (
  goal_id uuid NOT NULL REFERENCES public.buddy_goals(id) ON DELETE CASCADE,
  tag     text NOT NULL REFERENCES public.buddy_tag_options(tag) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (goal_id, tag)
);

-- Weekly digest to Norm (spec §7a). Same claim/finish lifecycle as buddy_sends.
CREATE TABLE public.buddy_digests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of    date NOT NULL,                    -- Monday of the digest week
  status     text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error      text,
  resend_id  text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at    timestamptz
);
CREATE UNIQUE INDEX buddy_digests_one_per_week
  ON public.buddy_digests (week_of) WHERE status IN ('pending', 'sent');

-- ── 2. RLS — super admins only ────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['buddy_students', 'buddy_milestones', 'buddy_quotes', 'buddy_sends',
                           'buddy_goals', 'buddy_outcomes', 'buddy_tag_options', 'buddy_goal_tags',
                           'buddy_digests']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format($p$CREATE POLICY "super admin" ON public.%I FOR ALL TO authenticated
                      USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())$p$, t);
  END LOOP;
END;
$$;

-- ── 3. Append-only responses ──────────────────────────────────────────────────

CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.buddy_goals
  FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite();
CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.buddy_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite();

-- ── 4. Check-in RPCs (anon + authenticated; token is the credential) ─────────
--
-- buddy_checkin_get is READ-ONLY. UofT Safe Links opens every emailed URL in a
-- JS-running browser, so the page load must write nothing; only the explicit
-- "Check in" press calls buddy_checkin_submit.

CREATE OR REPLACE FUNCTION private.buddy_state(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
-- Resolves a token to its send row and computes everything both RPCs need.
-- Returns {state:'not_found'|'replaced'} or {state:'ok', send_id, student_id,
-- today, open_goal, today_goal}.
DECLARE
  v_send  public.buddy_sends;
  v_today date := (pg_catalog.now() AT TIME ZONE 'America/Toronto')::date;
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
    -- 'yesterday' only for the actual calendar day before; a Friday goal asked
    -- on Monday is 'friday'; anything older is 'last_time'.
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

CREATE OR REPLACE FUNCTION public.buddy_checkin_get(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state   jsonb := private.buddy_state(p_token);
  v_student public.buddy_students;
  v_ms      jsonb;
BEGIN
  IF v_state->>'state' <> 'ok' THEN RETURN v_state; END IF;

  SELECT * INTO v_student FROM public.buddy_students WHERE id = (v_state->>'student_id')::uuid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'title', m.title, 'target_date', m.target_date, 'done', m.done_at IS NOT NULL,
           'current', m.id = cur.id)
         ORDER BY m.position), '[]'::jsonb)
    INTO v_ms
    FROM public.buddy_milestones m
    LEFT JOIN LATERAL (
      SELECT id FROM public.buddy_milestones
       WHERE student_id = v_student.id AND done_at IS NULL
       ORDER BY position LIMIT 1) cur ON true
   WHERE m.student_id = v_student.id;

  RETURN jsonb_build_object(
    'state', 'ok',
    'first_name', split_part(v_student.name, ' ', 1),
    'open_goal', v_state->'open_goal',
    'today_goal', v_state->'today_goal',
    'milestones', v_ms,
    'next_meeting_at', CASE WHEN v_student.next_meeting_at > pg_catalog.now()
                            THEN v_student.next_meeting_at END,
    'zoom_url', v_student.zoom_url
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buddy_checkin_submit(p_token text, p_done boolean, p_goal text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_state jsonb;
  v_goal  text := btrim(COALESCE(p_goal, ''));
  v_sid   uuid;
  v_send  uuid;
  v_open  jsonb;
BEGIN
  v_state := private.buddy_state(p_token);
  IF v_state->>'state' <> 'ok' THEN RETURN v_state; END IF;

  v_sid  := (v_state->>'student_id')::uuid;
  v_send := (v_state->>'send_id')::uuid;

  IF v_goal = '' THEN RETURN jsonb_build_object('state', 'goal_required'); END IF;
  IF char_length(v_goal) > 500 THEN RETURN jsonb_build_object('state', 'goal_too_long'); END IF;

  -- Serialise this student's submits, then re-read state under the lock so two
  -- racing submits cannot both pass the already-checked-in test.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('buddy_checkin:' || v_sid::text));
  v_state := private.buddy_state(p_token);
  IF v_state->>'state' <> 'ok' THEN RETURN v_state; END IF;

  IF v_state->'today_goal' <> 'null'::jsonb THEN
    RETURN jsonb_build_object('state', 'already_checked_in',
                              'goal_text', v_state->'today_goal'->>'goal_text');
  END IF;

  v_open := v_state->'open_goal';
  IF v_open <> 'null'::jsonb THEN
    IF p_done IS NULL THEN RETURN jsonb_build_object('state', 'outcome_required'); END IF;
    INSERT INTO public.buddy_outcomes (goal_id, done, send_id)
    VALUES ((v_open->>'id')::uuid, p_done, v_send);
  END IF;

  INSERT INTO public.buddy_goals (student_id, set_on, goal_text, send_id)
  VALUES (v_sid, (v_state->>'today')::date, v_goal, v_send);

  RETURN jsonb_build_object(
    'state', 'ok',
    'goal_text', v_goal,
    'done', CASE WHEN v_open <> 'null'::jsonb THEN to_jsonb(p_done) ELSE 'null'::jsonb END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.buddy_checkin_get(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buddy_checkin_submit(text, boolean, text) FROM PUBLIC;
-- authenticated as well as anon: Norm (or anyone) opening the link while signed
-- in calls the RPC as `authenticated`.
GRANT EXECUTE ON FUNCTION public.buddy_checkin_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buddy_checkin_submit(text, boolean, text) TO anon, authenticated;

-- ── 5. Send RPCs (service role only — called by buddy_send) ──────────────────

-- Claims today's send for a student. Returns the new pending row's id, or NULL
-- if a pending/sent row already holds the day (another run got there first).
CREATE OR REPLACE FUNCTION public.buddy_claim_send(
  p_student uuid, p_send_date date, p_token_hash text, p_quote_id uuid, p_forced boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.buddy_sends
     SET status = 'failed', error = 'stale pending claim (function did not finish)'
   WHERE student_id = p_student AND status = 'pending'
     AND claimed_at < pg_catalog.now() - interval '15 minutes';

  INSERT INTO public.buddy_sends (student_id, send_date, token_hash, quote_id, status, forced)
  VALUES (p_student, p_send_date, p_token_hash, p_quote_id, 'pending', p_forced)
  ON CONFLICT (student_id, send_date) WHERE status IN ('pending', 'sent') AND NOT forced DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Records the outcome of a claimed send. On success, supersedes the student's
-- previous live link and marks this one sent — one transaction, so there is
-- never a moment with zero or two live links.
CREATE OR REPLACE FUNCTION public.buddy_finish_send(
  p_send_id uuid, p_ok boolean, p_resend_id text, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_student uuid;
BEGIN
  SELECT student_id INTO v_student FROM public.buddy_sends WHERE id = p_send_id AND status = 'pending'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'buddy_finish_send: % is not a pending send', p_send_id; END IF;

  IF p_ok THEN
    UPDATE public.buddy_sends SET superseded_at = pg_catalog.now()
     WHERE student_id = v_student AND status = 'sent' AND superseded_at IS NULL;
    UPDATE public.buddy_sends
       SET status = 'sent', sent_at = pg_catalog.now(), resend_id = p_resend_id, error = NULL
     WHERE id = p_send_id;
  ELSE
    UPDATE public.buddy_sends SET status = 'failed', error = p_error WHERE id = p_send_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.buddy_claim_send(uuid, date, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.buddy_finish_send(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buddy_claim_send(uuid, date, text, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.buddy_finish_send(uuid, boolean, text, text) TO service_role;
