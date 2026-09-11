-- Screener results join the append-only response tables.
--
-- Second half of 20260911_responses_never_overwrite.sql. `screener_results` had a
-- UNIQUE (participant_id, study_id) key and ScreenerPage upserted onto it, so a
-- second screening attempt replaced the first. Under the never-overwrite policy
-- each attempt is its own row; SessionEntry reads the latest attempt.
--
-- ORDER MATTERS. Apply only after the frontend that INSERTs screener results (and
-- reads the latest row) is deployed. Dropping the unique key while the old upsert
-- is live makes every screener save fail ("no unique or exclusion constraint
-- matching the ON CONFLICT specification"), and the update guard would refuse the
-- upsert's UPDATE path.

ALTER TABLE public.screener_results DROP CONSTRAINT IF EXISTS screener_results_participant_id_study_id_key;
DROP INDEX IF EXISTS public.screener_results_participant_id_study_id_key;

CREATE INDEX IF NOT EXISTS screener_results_participant_study_time
  ON public.screener_results (participant_id, study_id, screened_at DESC);

ALTER TABLE public.screener_results ADD COLUMN IF NOT EXISTS received_at timestamptz;
ALTER TABLE public.screener_results ALTER COLUMN received_at SET DEFAULT now();
ALTER TABLE public.screener_results ADD COLUMN IF NOT EXISTS resubmission_of uuid;

COMMENT ON COLUMN public.screener_results.received_at IS
  'Server clock at insert (set by note_response_trg). NULL on rows collected before 2026-09-11.';
COMMENT ON COLUMN public.screener_results.resubmission_of IS
  'Set when this row is a byte-identical copy of the participant''s immediately preceding submission, same study, within 5 s. The row is kept; the id points at the original.';

DROP TRIGGER IF EXISTS note_response_trg ON public.screener_results;
CREATE TRIGGER note_response_trg BEFORE INSERT ON public.screener_results
  FOR EACH ROW EXECUTE FUNCTION public.note_response_trg();

DROP TRIGGER IF EXISTS forbid_response_overwrite_trg ON public.screener_results;
CREATE TRIGGER forbid_response_overwrite_trg BEFORE UPDATE ON public.screener_results
  FOR EACH ROW EXECUTE FUNCTION public.forbid_response_overwrite();
