-- Talk polls: anonymous audience answers for live talk demos (no login).
--
-- First use: the social-personality group talk (/socpers-oct-2026). The audience
-- breathes with a pacer twice, and after each trial answers on their phone at
-- /poll/<code>: did the pace change (faster / slower / same) and how activated
-- they feel (1-6). The deck then plots the room's noticers vs missers live.
--
-- Not participant data: no consent, no identity, nothing exported for research.
-- It is still append-only. A phone that answers twice adds a row, and results
-- read the latest answer per device per trial.
--
-- Access is through definer functions only. Both tables have RLS on with no
-- policies, and anon/authenticated hold no table grants, so the anon key can
-- neither read device ids nor write outside the checks in talk_poll_submit().
--
-- Rounds: rehearsals and the real talk share a poll code, so a super admin
-- starts a new round (talk_poll_new_round) before going live. Results read
-- only the current round, and older rounds stay in the table untouched.

CREATE TABLE IF NOT EXISTS public.talk_polls (
  code       text        PRIMARY KEY CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  title      text        NOT NULL,
  round      integer     NOT NULL DEFAULT 1 CHECK (round >= 1),
  is_open    boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.talk_poll_responses (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  poll_code  text        NOT NULL REFERENCES public.talk_polls (code) ON DELETE CASCADE,
  round      integer     NOT NULL,
  device_id  uuid        NOT NULL,
  trial      smallint    NOT NULL CHECK (trial IN (1, 2)),
  pace       text        NOT NULL CHECK (pace IN ('faster', 'slower', 'same')),
  arousal    smallint    NOT NULL CHECK (arousal BETWEEN 1 AND 6),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talk_poll_responses_poll_round
  ON public.talk_poll_responses (poll_code, round, device_id, trial, created_at);

ALTER TABLE public.talk_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talk_poll_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talk_polls FROM anon, authenticated;
REVOKE ALL ON public.talk_poll_responses FROM anon, authenticated;

-- What a phone needs to render: the title, the round (so it can forget answers
-- from a rehearsal round), and whether answers are being taken.
CREATE OR REPLACE FUNCTION public.talk_poll_info(p_code text)
RETURNS TABLE (title text, round integer, is_open boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.title, p.round, p.is_open FROM public.talk_polls p WHERE p.code = p_code
$$;

-- One answer for one trial. Caps keep a stray script from flooding a poll:
-- 6 rows per device per round, 2,000 per round.
CREATE OR REPLACE FUNCTION public.talk_poll_submit(
  p_code text, p_device uuid, p_trial integer, p_pace text, p_arousal integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round integer;
  v_open  boolean;
BEGIN
  SELECT round, is_open INTO v_round, v_open FROM public.talk_polls WHERE code = p_code;
  IF v_round IS NULL THEN RETURN 'unknown'; END IF;
  IF NOT v_open THEN RETURN 'closed'; END IF;
  IF p_device IS NULL OR p_trial NOT IN (1, 2)
     OR p_pace NOT IN ('faster', 'slower', 'same') OR p_arousal NOT BETWEEN 1 AND 6 THEN
    RETURN 'invalid';
  END IF;
  IF (SELECT count(*) FROM public.talk_poll_responses
       WHERE poll_code = p_code AND round = v_round AND device_id = p_device) >= 6
     OR (SELECT count(*) FROM public.talk_poll_responses
          WHERE poll_code = p_code AND round = v_round) >= 2000 THEN
    RETURN 'limit';
  END IF;
  INSERT INTO public.talk_poll_responses (poll_code, round, device_id, trial, pace, arousal)
  VALUES (p_code, v_round, p_device, p_trial::smallint, p_pace, p_arousal::smallint);
  RETURN 'ok';
END
$$;

-- The current round's answers, latest per device per trial. Devices are
-- replaced by a small integer (order of first answer), so no device id leaves
-- the database; the integer only pairs a person's two trials.
CREATE OR REPLACE FUNCTION public.talk_poll_results(p_code text)
RETURNS TABLE (person integer, trial integer, pace text, arousal integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cur AS (
    SELECT r.* FROM public.talk_poll_responses r
      JOIN public.talk_polls p ON p.code = r.poll_code AND p.round = r.round
     WHERE r.poll_code = p_code
  ),
  latest AS (
    SELECT DISTINCT ON (device_id, trial) device_id, trial, pace, arousal
      FROM cur ORDER BY device_id, trial, created_at DESC, id DESC
  ),
  people AS (
    SELECT device_id, row_number() OVER (ORDER BY min(created_at), device_id)::integer AS person
      FROM cur GROUP BY device_id
  )
  SELECT pp.person, l.trial::integer, l.pace, l.arousal::integer
    FROM latest l JOIN people pp USING (device_id)
   ORDER BY pp.person, l.trial
$$;

-- Start a fresh round (before the real talk, after rehearsing). Super admin only.
CREATE OR REPLACE FUNCTION public.talk_poll_new_round(p_code text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_round integer;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'not allowed'; END IF;
  UPDATE public.talk_polls SET round = round + 1 WHERE code = p_code RETURNING round INTO v_round;
  RETURN v_round;
END
$$;

REVOKE ALL ON FUNCTION public.talk_poll_info(text) FROM public;
REVOKE ALL ON FUNCTION public.talk_poll_submit(text, uuid, integer, text, integer) FROM public;
REVOKE ALL ON FUNCTION public.talk_poll_results(text) FROM public;
REVOKE ALL ON FUNCTION public.talk_poll_new_round(text) FROM public;
GRANT EXECUTE ON FUNCTION public.talk_poll_info(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talk_poll_submit(text, uuid, integer, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talk_poll_results(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talk_poll_new_round(text) TO authenticated;

INSERT INTO public.talk_polls (code, title) VALUES
  ('socpers',           'Social-personality talk, October 2026'),
  ('socpers-rehearsal', 'Social-personality talk (rehearsal)')
ON CONFLICT (code) DO NOTHING;

-- Supabase default privileges grant EXECUTE to anon directly, which a
-- REVOKE FROM public does not remove (applied as talk_polls_revoke_anon_new_round).
REVOKE ALL ON FUNCTION public.talk_poll_new_round(text) FROM anon;
