-- main radlab. QotW accessibility (Norm, 2026-09-09):
-- enforce_single_live_checkin counted ALL check-ins, so an open Question of
-- the Week occupied the class's one live slot -- opening any lecture
-- check-in failed with "Another check-in is already staged or open", and
-- closing the QotW to run lecture made its wall card vanish from the
-- lounge. Both classes' QotWs were sitting open the night before PSY240 L1;
-- every break check-in would have refused to open mid-lecture.
--
-- The exclusivity rule exists so students' lounge screens show one live
-- activity at a time. Weeklies never appear in the live flow (the room
-- filters .neq kind weekly; the wall is its own page), so they belong
-- outside the rule entirely: a weekly neither blocks nor is blocked.
--
-- Verified in rolled-back transactions: with the psy240 weekly open, a live
-- check-in stages successfully; a SECOND live check-in is still refused.
create or replace function enforce_single_live_checkin()
returns trigger
language plpgsql
set search_path = public
as $$
DECLARE
  v_class_id uuid;
  v_conflict_count int;
BEGIN
  IF NEW.status NOT IN ('staged', 'open') OR NEW.kind <> 'live' THEN
    RETURN NEW;
  END IF;

  SELECT class_id INTO v_class_id FROM lectures WHERE id = NEW.lecture_id;

  SELECT count(*) INTO v_conflict_count
    FROM checkins c JOIN lectures l ON l.id = c.lecture_id
    WHERE l.class_id = v_class_id AND c.id <> NEW.id
      AND c.status IN ('staged', 'open') AND c.kind = 'live';

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Another check-in is already staged or open for this class';
  END IF;

  RETURN NEW;
END;
$$;

revoke execute on function enforce_single_live_checkin() from public, anon, authenticated;
