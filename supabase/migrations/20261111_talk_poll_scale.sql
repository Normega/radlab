-- Talk polls: a short self-report scale answered on phones, for the MCC Summit
-- talk ("Two ways of paying attention", /mcc-nov-2026, 2026-11-15, on Zoom).
--
-- The audience opens radlab.zone/mcc and rates a fixed list of statements on a
-- 1-6 agree scale, any of them "Prefer not to answer" (stored as NULL). The first
-- use is the 8-statement Sense Foraging Scale chosen after Study 2a (form
-- 'sf8-2b'); the deck shows the room's spread and each statement's agreement
-- beside Study 2a's. `form` names the list, so another talk can reuse the table.
--
-- Same terms as talk_poll_responses (20261012_talk_polls.sql): anonymous, no
-- login, not participant data, nothing exported for research. Append-only: a
-- phone that answers again adds a row, and results read the latest per device.
-- Access is through definer functions only: RLS on, no policies, no grants.
-- Rounds come from talk_polls, so a new round clears rehearsal answers from the
-- figures along with the mood dots and toggle taps.
--
-- no-api-grants: public.talk_poll_scale -- reached only via talk_poll_scale_submit() and talk_poll_scale_results()

CREATE TABLE IF NOT EXISTS public.talk_poll_scale (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  poll_code  text        NOT NULL REFERENCES public.talk_polls (code) ON DELETE CASCADE,
  round      integer     NOT NULL,
  device_id  uuid        NOT NULL,
  form       text        NOT NULL CHECK (form ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  answers    smallint[]  NOT NULL CHECK (cardinality(answers) BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talk_poll_scale_poll_round
  ON public.talk_poll_scale (poll_code, round, form, device_id, created_at);

ALTER TABLE public.talk_poll_scale ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talk_poll_scale FROM anon, authenticated;

-- One set of answers. Each answer is 1-6 or NULL ("Prefer not to answer"), and
-- at least one must be given. Caps keep a stray script from flooding the room's
-- figure: 5 submissions per device per round, 5,000 per round.
CREATE OR REPLACE FUNCTION public.talk_poll_scale_submit(
  p_code text, p_device uuid, p_form text, p_answers integer[]
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
  IF p_device IS NULL OR p_form IS NULL OR p_form !~ '^[a-z0-9][a-z0-9-]{1,39}$'
     OR p_answers IS NULL OR cardinality(p_answers) NOT BETWEEN 1 AND 20
     OR EXISTS (SELECT 1 FROM unnest(p_answers) a WHERE a IS NOT NULL AND a NOT BETWEEN 1 AND 6)
     OR NOT EXISTS (SELECT 1 FROM unnest(p_answers) a WHERE a IS NOT NULL) THEN
    RETURN 'invalid';
  END IF;
  IF (SELECT count(*) FROM public.talk_poll_scale
       WHERE poll_code = p_code AND round = v_round AND device_id = p_device) >= 5
     OR (SELECT count(*) FROM public.talk_poll_scale
          WHERE poll_code = p_code AND round = v_round) >= 5000 THEN
    RETURN 'limit';
  END IF;
  INSERT INTO public.talk_poll_scale (poll_code, round, device_id, form, answers)
  VALUES (p_code, v_round, p_device, p_form, p_answers::smallint[]);
  RETURN 'ok';
END
$$;

-- The current round's latest answers per device for one form. Devices become a
-- small integer (order of first answer); no device id leaves the database.
CREATE OR REPLACE FUNCTION public.talk_poll_scale_results(p_code text, p_form text)
RETURNS TABLE (person integer, answers smallint[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cur AS (
    SELECT s.* FROM public.talk_poll_scale s
      JOIN public.talk_polls p ON p.code = s.poll_code AND p.round = s.round
     WHERE s.poll_code = p_code AND s.form = p_form
  ),
  people AS (
    SELECT device_id, row_number() OVER (ORDER BY min(created_at), device_id)::integer AS person
      FROM cur GROUP BY device_id
  ),
  latest AS (
    SELECT DISTINCT ON (device_id) device_id, answers
      FROM cur ORDER BY device_id, created_at DESC, id DESC
  )
  SELECT pp.person, l.answers
    FROM latest l JOIN people pp USING (device_id)
   ORDER BY pp.person
$$;

REVOKE ALL ON FUNCTION public.talk_poll_scale_submit(text, uuid, text, integer[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.talk_poll_scale_results(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talk_poll_scale_submit(text, uuid, text, integer[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.talk_poll_scale_results(text, text) TO anon, authenticated;

INSERT INTO public.talk_polls (code, title) VALUES
  ('mcc',           'MCC Summit, November 2026'),
  ('mcc-rehearsal', 'MCC Summit (rehearsal)')
ON CONFLICT (code) DO NOTHING;
