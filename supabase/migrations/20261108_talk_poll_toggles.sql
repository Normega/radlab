-- Talk polls: a live Toggle practice for the Tanenbaum Symposium talk
-- ("Aging attentively", /tanenbaum-nov-2026, 2026-11-10).
--
-- The room sits for two minutes resting on the breath. Each phone (/live/<code>)
-- has two halves: STORY ("I notice I'm thinking") and SENSE ("I'm back with the
-- breath"). Every tap records which mode the person says they are in now and how
-- far into their own practice it came (t_ms since they pressed Begin, which
-- counts as an implicit SENSE). The deck plots the room live: how many are
-- sensing vs thinking right now, the room's share sensing over the two minutes,
-- how long people stayed with the breath before noticing they had drifted, and
-- how often they came back.
--
-- Same terms as talk_poll_responses (20261012_talk_polls.sql): anonymous, no
-- login, not participant data, nothing exported for research. Append-only.
-- Access is through definer functions only: RLS on, no policies, no grants.
-- Rounds come from talk_polls, so a new round clears the toggle taps along with
-- the mood dots.
--
-- no-api-grants: public.talk_poll_toggles -- reached only via talk_poll_toggle_submit() and talk_poll_toggle_results()

CREATE TABLE IF NOT EXISTS public.talk_poll_toggles (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  poll_code  text        NOT NULL REFERENCES public.talk_polls (code) ON DELETE CASCADE,
  round      integer     NOT NULL,
  device_id  uuid        NOT NULL,
  t_ms       integer     NOT NULL CHECK (t_ms BETWEEN 0 AND 900000),
  mode       text        NOT NULL CHECK (mode IN ('begin', 'sense', 'story', 'end')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talk_poll_toggles_poll_round
  ON public.talk_poll_toggles (poll_code, round, device_id, created_at);

ALTER TABLE public.talk_poll_toggles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talk_poll_toggles FROM anon, authenticated;

-- One tap. Caps keep a stray script from flooding the room's figure:
-- 300 taps per device per round, 40,000 per round.
CREATE OR REPLACE FUNCTION public.talk_poll_toggle_submit(
  p_code text, p_device uuid, p_t_ms integer, p_mode text
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
  IF p_device IS NULL OR p_t_ms IS NULL OR p_t_ms NOT BETWEEN 0 AND 900000
     OR p_mode NOT IN ('begin', 'sense', 'story', 'end') THEN
    RETURN 'invalid';
  END IF;
  IF (SELECT count(*) FROM public.talk_poll_toggles
       WHERE poll_code = p_code AND round = v_round AND device_id = p_device) >= 300
     OR (SELECT count(*) FROM public.talk_poll_toggles
          WHERE poll_code = p_code AND round = v_round) >= 40000 THEN
    RETURN 'limit';
  END IF;
  INSERT INTO public.talk_poll_toggles (poll_code, round, device_id, t_ms, mode)
  VALUES (p_code, v_round, p_device, p_t_ms, p_mode);
  RETURN 'ok';
END
$$;

-- The current round's taps, every one, in order. Devices become a small integer
-- (order of first tap); no device id leaves the database. secs_ago lets the deck
-- tell who is still practising (their latest tap is recent and not 'end').
CREATE OR REPLACE FUNCTION public.talk_poll_toggle_results(p_code text)
RETURNS TABLE (person integer, t_ms integer, mode text, secs_ago double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cur AS (
    SELECT t.* FROM public.talk_poll_toggles t
      JOIN public.talk_polls p ON p.code = t.poll_code AND p.round = t.round
     WHERE t.poll_code = p_code
  ),
  people AS (
    SELECT device_id, row_number() OVER (ORDER BY min(created_at), device_id)::integer AS person
      FROM cur GROUP BY device_id
  )
  SELECT pp.person, c.t_ms, c.mode, extract(epoch FROM now() - c.created_at)::double precision
    FROM cur c JOIN people pp USING (device_id)
   ORDER BY pp.person, c.t_ms, c.created_at, c.id
$$;

REVOKE ALL ON FUNCTION public.talk_poll_toggle_submit(text, uuid, integer, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.talk_poll_toggle_results(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talk_poll_toggle_submit(text, uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talk_poll_toggle_results(text) TO anon, authenticated;

INSERT INTO public.talk_polls (code, title) VALUES
  ('tanenbaum',           'Tanenbaum Symposium, November 2026'),
  ('tanenbaum-rehearsal', 'Tanenbaum Symposium (rehearsal)')
ON CONFLICT (code) DO NOTHING;
