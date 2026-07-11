-- WP3b hardening, both explicitly called for by the brief:
--
-- 1. "Only one check-in may be staged/open per class at a time; enforce in
--    UI and with a guard on state transitions." A UI-only guard doesn't
--    survive two remote tabs/devices racing each other — this needs to be
--    a DB-level guard so it holds regardless of which client (or how many)
--    attempts the transition.
--
-- 2. "Closing is enforced server-side by timestamp comparison on submit,
--    not client timers alone." The remote's own countdown is what actually
--    calls UPDATE checkins SET status='closed' when it fires, but if that
--    client never gets the chance to (tab closed, connection dropped right
--    at the deadline), checkins.status would incorrectly stay 'open'
--    forever with no submission cutoff. This makes the checkin_responses
--    write policies independently check the auto-close deadline, so a late
--    submission is rejected even if the status row itself never flipped.

CREATE OR REPLACE FUNCTION public.enforce_single_live_checkin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_class_id uuid;
  v_conflict_count int;
BEGIN
  IF NEW.status NOT IN ('staged', 'open') THEN
    RETURN NEW;
  END IF;

  SELECT class_id INTO v_class_id FROM lectures WHERE id = NEW.lecture_id;

  SELECT count(*) INTO v_conflict_count
    FROM checkins c JOIN lectures l ON l.id = c.lecture_id
    WHERE l.class_id = v_class_id AND c.id <> NEW.id AND c.status IN ('staged', 'open');

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Another check-in is already staged or open for this class';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER enforce_single_live_checkin_trigger
  BEFORE UPDATE ON checkins
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_live_checkin();

DROP POLICY "checkin_responses: own write while open" ON checkin_responses;
CREATE POLICY "checkin_responses: own write while open"
  ON checkin_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM checkins c WHERE c.id = checkin_responses.checkin_id AND c.status = 'open'
        AND (c.auto_close_seconds IS NULL OR c.opened_at IS NULL
             OR now() < c.opened_at + (c.auto_close_seconds || ' seconds')::interval)
    )
  );

DROP POLICY "checkin_responses: own update while open" ON checkin_responses;
CREATE POLICY "checkin_responses: own update while open"
  ON checkin_responses FOR UPDATE
  TO authenticated
  USING (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM checkins c WHERE c.id = checkin_responses.checkin_id AND c.status = 'open'
        AND (c.auto_close_seconds IS NULL OR c.opened_at IS NULL
             OR now() < c.opened_at + (c.auto_close_seconds || ' seconds')::interval)
    )
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM checkins c WHERE c.id = checkin_responses.checkin_id AND c.status = 'open'
        AND (c.auto_close_seconds IS NULL OR c.opened_at IS NULL
             OR now() < c.opened_at + (c.auto_close_seconds || ' seconds')::interval)
    )
  );
