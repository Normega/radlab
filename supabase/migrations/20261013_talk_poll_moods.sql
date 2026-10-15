-- Talk polls: a mood check-in before the breathing demo.
--
-- The social-personality talk (/socpers-oct-2026) now opens with the room
-- tapping where they are on the mood circle (StillWater's wheel: 8 emotions x 3
-- intensity rings, or the neutral centre). The deck's second slide plots every
-- dot, and the presenter asks how people knew whether to place themselves high
-- or low on arousal.
--
-- Same terms as talk_poll_responses (20261012_talk_polls.sql): anonymous, not
-- participant data, nothing exported. Append-only: a phone that changes its
-- answer adds a row, and results read the latest answer per device. Access is
-- through definer functions only; the table has RLS on with no policies and no
-- grants to anon/authenticated. Rounds come from talk_polls, so a new round
-- clears the mood dots along with the trial answers.

CREATE TABLE IF NOT EXISTS public.talk_poll_moods (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  poll_code  text        NOT NULL REFERENCES public.talk_polls (code) ON DELETE CASCADE,
  round      integer     NOT NULL,
  device_id  uuid        NOT NULL,
  emotion_id smallint    CHECK (emotion_id BETWEEN 0 AND 7),   -- NULL = neutral centre
  zone       smallint    CHECK (zone BETWEEN 0 AND 2),         -- intensity ring, inner to outer
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((emotion_id IS NULL) = (zone IS NULL))
);

CREATE INDEX IF NOT EXISTS talk_poll_moods_poll_round
  ON public.talk_poll_moods (poll_code, round, device_id, created_at);

ALTER TABLE public.talk_poll_moods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talk_poll_moods FROM anon, authenticated;

-- One mood tap. p_emotion and p_zone both NULL = the neutral centre.
-- Caps: 4 rows per device per round, 2,000 per round.
CREATE OR REPLACE FUNCTION public.talk_poll_mood_submit(
  p_code text, p_device uuid, p_emotion integer, p_zone integer
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
  IF p_device IS NULL
     OR (p_emotion IS NULL) <> (p_zone IS NULL)
     OR p_emotion NOT BETWEEN 0 AND 7 OR p_zone NOT BETWEEN 0 AND 2 THEN
    RETURN 'invalid';
  END IF;
  IF (SELECT count(*) FROM public.talk_poll_moods
       WHERE poll_code = p_code AND round = v_round AND device_id = p_device) >= 4
     OR (SELECT count(*) FROM public.talk_poll_moods
          WHERE poll_code = p_code AND round = v_round) >= 2000 THEN
    RETURN 'limit';
  END IF;
  INSERT INTO public.talk_poll_moods (poll_code, round, device_id, emotion_id, zone)
  VALUES (p_code, v_round, p_device, p_emotion::smallint, p_zone::smallint);
  RETURN 'ok';
END
$$;

-- The current round's moods, latest per device. Devices become a small integer
-- (order of first tap) so the deck can keep each dot in place between reads;
-- no device id leaves the database.
CREATE OR REPLACE FUNCTION public.talk_poll_mood_results(p_code text)
RETURNS TABLE (person integer, emotion_id integer, zone integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cur AS (
    SELECT m.* FROM public.talk_poll_moods m
      JOIN public.talk_polls p ON p.code = m.poll_code AND p.round = m.round
     WHERE m.poll_code = p_code
  ),
  latest AS (
    SELECT DISTINCT ON (device_id) device_id, emotion_id, zone
      FROM cur ORDER BY device_id, created_at DESC, id DESC
  ),
  people AS (
    SELECT device_id, row_number() OVER (ORDER BY min(created_at), device_id)::integer AS person
      FROM cur GROUP BY device_id
  )
  SELECT pp.person, l.emotion_id::integer, l.zone::integer
    FROM latest l JOIN people pp USING (device_id)
   ORDER BY pp.person
$$;

REVOKE ALL ON FUNCTION public.talk_poll_mood_submit(text, uuid, integer, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.talk_poll_mood_results(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talk_poll_mood_submit(text, uuid, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talk_poll_mood_results(text) TO anon, authenticated;
