-- radlab-academic. A claim decision now records WHO made it (Norm, 2026-09-21).
--
-- gap_claims recorded `resolved_at` and nothing else about a decision, so
-- "how many submissions has each TA addressed?" had no answer in the data.
-- The one accepted claim could be attributed only by inference — the section
-- that accepting drafts carries wiki_page_versions.created_by — and a
-- SEND-BACK left no trace at all: it writes status and note, produces no
-- version, and explicitly nulls resolved_at. With three TAs splitting a
-- 200-student queue by surname and the first deadline on Oct 7, both workload
-- and "who reviewed me?" need a real record.
--
-- Two columns:
--   resolved_by — the person who made the most recent decision, accept or send-back.
--   decided_at  — when that decision was made. Separate from resolved_at, which
--                 keeps its existing meaning (set on accept, nulled when a claim
--                 goes back to the student) and is read elsewhere.
--
-- Stamped by a trigger, not by the client: the queue writes the decision as a
-- plain table UPDATE, so a client-supplied reviewer id would be both forgeable
-- and easy to omit on a new path, while current_person_id() inside a BEFORE
-- UPDATE can be neither. A server-side write (auth.uid() null) leaves
-- resolved_by null rather than inventing an actor.
--
-- gap_claims_guard fires first (trigger order is alphabetical) and returns
-- early for course staff, so a real TA decision reaches this trigger untouched.

ALTER TABLE public.gap_claims
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES identity.people(id),
  ADD COLUMN IF NOT EXISTS decided_at  timestamptz;

COMMENT ON COLUMN public.gap_claims.resolved_by IS
  'Person who made the most recent decision on this claim (accept or send-back). Stamped by note_claim_decision_trg, never by the client.';
COMMENT ON COLUMN public.gap_claims.decided_at IS
  'When that decision was made. Unlike resolved_at, survives a send-back.';

CREATE OR REPLACE FUNCTION public.note_claim_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_person uuid;
begin
  -- A decision is: submitted -> accepted, or submitted -> claimed (send-back).
  if OLD.status = 'submitted' and NEW.status is distinct from OLD.status then
    v_person := current_person_id();
    if v_person is not null then
      NEW.resolved_by := v_person;
    end if;
    NEW.decided_at := now();
  end if;
  return NEW;
end $$;

DROP TRIGGER IF EXISTS note_claim_decision_trg ON public.gap_claims;
CREATE TRIGGER note_claim_decision_trg
  BEFORE UPDATE ON public.gap_claims
  FOR EACH ROW EXECUTE FUNCTION public.note_claim_decision();

-- gap_claims_guard, copied verbatim from the live prosrc with ONE change: the
-- two new columns join v_book, the list of server-side bookkeeping fields that
-- may be written through the radlab.claim_flow escape without counting as a
-- state transition. Without this the guard refuses to correct an attribution
-- on an accepted claim ("accepted claims are read-only") even from a migration
-- — which is exactly what it did to the backfill below on the first attempt.
-- integration_* are already on this list for the same reason.
CREATE OR REPLACE FUNCTION public.gap_claims_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_staff boolean;
  v_flow  boolean := coalesce(current_setting('radlab.claim_flow', true), '') = '1';
  v_book  text[] := array['notified_at', 'source_kind', 'source_fulltext', 'source_url_full',
                          'source_captured_at', 'integration_status', 'integration_note',
                          'integration_version_id', 'integration_draft', 'integration_verdict',
                          'resolved_by', 'decided_at'];
begin
  select is_course_staff(g.course_id) into v_staff
  from page_gaps g where g.id = coalesce(new.gap_id, old.gap_id);
  if coalesce(v_staff, false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not v_flow then
      raise exception 'claims are created through claim_gap(), not direct insert';
    end if;
    return new;
  end if;

  if (to_jsonb(new) - 'notified_at') = (to_jsonb(old) - 'notified_at') then
    return new;
  end if;

  if v_flow and (to_jsonb(new) - v_book) = (to_jsonb(old) - v_book) then
    return new;
  end if;

  if old.person_id is distinct from current_person_id() and not v_flow then
    raise exception 'not your claim';
  end if;

  if old.status = 'accepted' then
    raise exception 'accepted claims are read-only';
  end if;

  if old.status = 'submitted' then
    raise exception 'submitted claims are locked while under review';
  end if;

  if old.status = 'withdrawn' then
    if new.status = 'claimed' and v_flow then
      return new;
    end if;
    raise exception 'withdrawn claims are re-opened through claim_gap()';
  end if;

  if new.status = 'claimed' or new.status = 'withdrawn' then
    return new;
  end if;
  if new.status = 'submitted' then
    if not v_flow then
      raise exception 'submissions go through submit_claim(), which runs the precheck';
    end if;
    if old.expires_at is not null and old.expires_at < now() then
      raise exception 'this claim expired on % — re-claim the gap if slots remain', old.expires_at::date;
    end if;
    new.submitted_at := coalesce(new.submitted_at, now());
    return new;
  end if;

  raise exception 'transition % -> % is not allowed', old.status, new.status;
end;
$$;

-- Backfill the single decision made before this existed. The attribution is an
-- INFERENCE, not a record: accepting drafts a section, and that version's
-- created_by is the reviewer who pressed Accept. Recorded so the one
-- historical row is not silently blank; decided_at takes resolved_at.
SELECT set_config('radlab.claim_flow', '1', true);

UPDATE public.gap_claims gc
   SET resolved_by = v.created_by,
       decided_at  = coalesce(gc.decided_at, gc.resolved_at)
  FROM public.wiki_page_versions v
 WHERE v.id = gc.integration_version_id
   AND gc.status = 'accepted'
   AND gc.resolved_by IS NULL
   AND v.created_by IS NOT NULL;
