-- Submit guard for the Zerin daily check-ins and Pond Watch: a repeat insert for
-- the same schedule row updates the existing row instead of adding a second one.
--
-- WHY. Rule 2 of the data-logging policy in CLAUDE.md -- terminal submits are
-- guarded twice, in the client and in the database. `questionnaire_responses`
-- has had its database half since 2026-08-18; these two tables never did.
-- `MoodCheckinStep` and `WellnessTipStep` guarded their insert with a `saving`
-- state flag (a race, not a lock), and Pond Watch fired its insert without a
-- guard at all. Nothing in the database stopped a second row.
--
-- The stakes are the study's primary outcome. A participant produces up to 63
-- check-ins, and `zerin_daily_checkins` is analysed per schedule row; a
-- duplicate reads as an extra response at that timepoint. The July pilot
-- produced none in 84 check-ins and 6 Pond Watch runs, so this closes a gap
-- before it is hit rather than repairing damage -- nothing existing is touched.
--
-- KEY: (user_id, schedule_id). One check-in and one Pond Watch per schedule row
-- is the design: each daily session holds exactly one check-in node, and each
-- assessment session exactly one Pond Watch node. Rows with no schedule_id
-- (admin simulate runs) pass straight through, as the screener's do in the
-- questionnaire guard.
--
-- WHY A TRIGGER AND NOT A UNIQUE CONSTRAINT. A constraint would turn the
-- repeat into an error, and a legitimate repeat exists: a participant whose
-- check-in saved but whose session completion failed reopens the link and
-- answers again. Under a constraint that second save fails on every retry, and
-- they are stranded on "Could not save -- please try again" for a session the
-- database already holds. The trigger turns the repeat into a success, which is
-- also what the client already expects (it inserts without reading a row back).
--
-- KEEPS THE LATER COPY, matching questionnaire_responses_dedupe: if someone
-- answered again, the newer answers are the ones they meant. `created_at` keeps
-- the first attempt's time, so the redo stays visible.
--
-- CONCURRENCY. A double-tap sends two requests at once, i.e. two concurrent
-- transactions, and without serialisation both would see "no existing row" and
-- both insert. The advisory lock on (user, schedule) makes the second wait for
-- the first to commit; its lookup then runs on a fresh snapshot and finds the
-- row. Same pattern as draw_assignment.

CREATE OR REPLACE FUNCTION public.zerin_daily_checkins_dedupe()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  IF NEW.schedule_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('zerin_daily_checkins:' || NEW.user_id::text || ':' || NEW.schedule_id::text, 0));

  SELECT id INTO v_existing_id
    FROM zerin_daily_checkins
   WHERE user_id     = NEW.user_id
     AND schedule_id = NEW.schedule_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE zerin_daily_checkins
     SET study_id     = NEW.study_id,
         external_id  = NEW.external_id,
         study_day    = NEW.study_day,
         slot         = NEW.slot,
         arm          = NEW.arm,
         rating       = NEW.rating,
         direction    = NEW.direction,
         reason       = NEW.reason,
         tip_text     = NEW.tip_text,
         completed_at = COALESCE(NEW.completed_at, now())
   WHERE id = v_existing_id;

  RAISE NOTICE 'zerin_daily_checkins: collapsed repeat for user % schedule %', NEW.user_id, NEW.schedule_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.pond_watch_results_dedupe()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  IF NEW.schedule_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('pond_watch_results:' || NEW.user_id::text || ':' || NEW.schedule_id::text, 0));

  SELECT id INTO v_existing_id
    FROM pond_watch_results
   WHERE user_id     = NEW.user_id
     AND schedule_id = NEW.schedule_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE pond_watch_results
     SET study_id           = NEW.study_id,
         external_id        = NEW.external_id,
         started_at         = NEW.started_at,
         ended_at           = NEW.ended_at,
         hit_rate           = NEW.hit_rate,
         false_alarm_rate   = NEW.false_alarm_rate,
         d_prime            = NEW.d_prime,
         criterion          = NEW.criterion,
         median_rt_ms       = NEW.median_rt_ms,
         rt_sd_ms           = NEW.rt_sd_ms,
         accuracy           = NEW.accuracy,
         hits               = NEW.hits,
         misses             = NEW.misses,
         false_alarms       = NEW.false_alarms,
         correct_rejections = NEW.correct_rejections,
         n_trials           = NEW.n_trials,
         trials             = NEW.trials,
         pauses             = NEW.pauses
   WHERE id = v_existing_id;

  RAISE NOTICE 'pond_watch_results: collapsed repeat for user % schedule %', NEW.user_id, NEW.schedule_id;
  RETURN NULL;
END;
$$;

-- Trigger functions are not API surface (security advisor pass, 2026-09-09).
-- Firing a trigger does not check EXECUTE, so participants' inserts still run it.
REVOKE EXECUTE ON FUNCTION public.zerin_daily_checkins_dedupe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pond_watch_results_dedupe()   FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zerin_daily_checkins_dedupe_trg ON public.zerin_daily_checkins;
CREATE TRIGGER zerin_daily_checkins_dedupe_trg
  BEFORE INSERT ON public.zerin_daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.zerin_daily_checkins_dedupe();

DROP TRIGGER IF EXISTS pond_watch_results_dedupe_trg ON public.pond_watch_results;
CREATE TRIGGER pond_watch_results_dedupe_trg
  BEFORE INSERT ON public.pond_watch_results
  FOR EACH ROW EXECUTE FUNCTION public.pond_watch_results_dedupe();
