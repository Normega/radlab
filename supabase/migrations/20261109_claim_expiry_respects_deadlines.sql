-- radlab-academic. A gap claim never expires before the deadline it was claimed for.
--
-- Decided by Norm on 2026-11-09 ("reopen for a week"; "move expiry to the deadline"; "make
-- the broader migration"), after a PSY240 student's Green contribution scored zero although
-- she was submitting before the deadline.
--
-- What happened. claim_gap() gives every claim a fixed 14 days. A student who claimed early
-- could therefore see her claim expire before the contribution was due, and submit_claim()
-- refuses an expired claim before it writes anything, so the refusal leaves no trace. One
-- student claimed Sept 23 at 9:59 PM; her claim expired Oct 7 at 9:59 PM, two hours before
-- the Green deadline (Oct 7, 11:59 PM); her source was attached at 8:42 PM and her draft was
-- saved, but no submission or precheck was ever recorded. A second student's claim expired
-- the morning of the deadline with a saved draft. Neither has Green credit.
--
-- The same trap was open for Amber 1 (due Nov 11): 32 open amber claims expired before that
-- deadline, some weeks ago.
--
-- What this does:
--   1. contribution_deadlines: each course's contribution due dates, as data.
--   2. claim_expiry(): a claim lasts 14 days or until the next deadline for its kind of gap,
--      whichever is later, and further if the student has an approved extension for that
--      contribution in deadline_extensions. Courses with no deadlines recorded keep 14 days.
--   3. claim_gap() uses it.
--   4. Data, on Norm's decisions: the two Green claims are reopened for a week (to Nov 16);
--      open amber claims that would expire before Amber 1's deadline now expire at it,
--      including expired ones whose gap still has room. Expired claims whose slot someone
--      else has since taken are left expired, so no gap is overfilled.

-- 1. Deadlines -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contribution_deadlines (
  course_id  uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  item       text NOT NULL CHECK (item IN ('contribution_1', 'contribution_2', 'contribution_3')),
  difficulty text NOT NULL CHECK (difficulty IN ('green', 'amber')),
  due_at     timestamptz NOT NULL,
  PRIMARY KEY (course_id, item)
);

ALTER TABLE public.contribution_deadlines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read" ON public.contribution_deadlines;
CREATE POLICY "members read" ON public.contribution_deadlines
  FOR SELECT TO authenticated
  USING (public.is_course_member(course_id) OR public.is_course_staff(course_id));
DROP POLICY IF EXISTS "staff write" ON public.contribution_deadlines;
CREATE POLICY "staff write" ON public.contribution_deadlines
  FOR ALL TO authenticated
  USING (public.is_course_staff(course_id))
  WITH CHECK (public.is_course_staff(course_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contribution_deadlines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contribution_deadlines TO service_role;

-- PSY240 Fall 2026 (syllabus): Green Oct 7, Amber 1 Nov 11, Amber 2 Nov 27, 11:59 PM Toronto.
INSERT INTO public.contribution_deadlines (course_id, item, difficulty, due_at)
SELECT c.id, v.item, v.difficulty, v.due_at::timestamptz
  FROM public.courses c,
       (VALUES ('contribution_1', 'green', '2026-10-08 03:59:00+00'),
               ('contribution_2', 'amber', '2026-11-12 04:59:00+00'),
               ('contribution_3', 'amber', '2026-11-28 04:59:00+00')) v(item, difficulty, due_at)
 WHERE c.code = 'PSY240'
ON CONFLICT (course_id, item) DO UPDATE SET difficulty = excluded.difficulty, due_at = excluded.due_at;

-- 2. The expiry rule -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_expiry(p_course_id uuid, p_difficulty text, p_person_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  with next_due as (
    select d.item, d.due_at
      from contribution_deadlines d
     where d.course_id = p_course_id and d.difficulty = p_difficulty and d.due_at > now()
     order by d.due_at
     limit 1
  )
  select greatest(
           now() + interval '14 days',
           (select due_at from next_due),
           (select max(x.new_due)
              from deadline_extensions x
              join identity.roster r on r.id = x.roster_id
             where x.course_id = p_course_id and r.person_id = p_person_id
               and x.status = 'approved' and x.item = (select item from next_due)));
$$;

REVOKE ALL ON FUNCTION public.claim_expiry(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_expiry(uuid, text, uuid) TO authenticated;

-- 3. claim_gap() uses it (unchanged otherwise) -----------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_gap(p_gap_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
declare
  g record;
  me uuid := current_person_id();
  held int;
  unsubmitted int;
  has_green_done boolean;
  has_any boolean;
  existing record;
  v_expires timestamptz;
  v_id uuid;
begin
  select * into g from page_gaps where id = p_gap_id and status = 'open';
  if not found or not is_course_member(g.course_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No such open gap.');
  end if;

  if exists (select 1 from enrollments e
             where e.person_id = me and e.course_id = g.course_id
               and e.status = 'active' and e.role = 'observer') then
    return jsonb_build_object('ok', false, 'code', 'observer',
      'message', 'Observers can read every gap but don''t claim them — claims are for enrolled students.');
  end if;

  if g.difficulty = 'red' then
    return jsonb_build_object('ok', false, 'code', 'red_gap',
      'message', 'Red gaps are staff-written (clinical or legal content) and cannot be claimed.');
  end if;

  select * into existing from gap_claims where gap_id = p_gap_id and person_id = me;
  if found and existing.status <> 'withdrawn'
     and not (existing.status = 'claimed' and existing.expires_at is not null and existing.expires_at < now()) then
    return jsonb_build_object('ok', false, 'code', 'already_claimed',
      'message', 'You already hold this gap (' || existing.status || ').');
  end if;

  select count(*) into held from gap_claims x
  where x.gap_id = p_gap_id
    and (x.status in ('submitted','accepted')
         or (x.status = 'claimed' and (x.expires_at is null or x.expires_at > now())));
  if held >= g.capacity then
    return jsonb_build_object('ok', false, 'code', 'full',
      'message', 'This gap is fully claimed. Pick another — slots free up if a claim expires.');
  end if;

  select exists (select 1 from gap_claims x where x.person_id = me and x.status <> 'withdrawn')
    into has_any;
  select exists (
    select 1 from gap_claims x join page_gaps pg on pg.id = x.gap_id
    where x.person_id = me and x.status in ('submitted','accepted') and pg.difficulty = 'green')
    into has_green_done;

  if g.difficulty <> 'green' and not has_green_done then
    return jsonb_build_object('ok', false, 'code', 'green_first',
      'message', case when has_any
        then 'Amber gaps unlock once your green submission is in.'
        else 'Your first gap must be a green one — they are scaffolded for the first assignment.' end);
  end if;

  select count(*) into unsubmitted from gap_claims x
  where x.person_id = me and x.status = 'claimed'
    and (x.expires_at is null or x.expires_at > now());
  if unsubmitted >= 2 then
    return jsonb_build_object('ok', false, 'code', 'too_many_open',
      'message', 'You already hold 2 unsubmitted claims. Submit or release one first.');
  end if;

  -- 14 days, or the next deadline for this kind of gap (or the student's approved extension
  -- for it), whichever is later (20261109_claim_expiry_respects_deadlines).
  v_expires := claim_expiry(g.course_id, g.difficulty, me);

  perform set_config('radlab.claim_flow', '1', true);
  if existing.id is not null then
    update gap_claims
    set status = 'claimed', claimed_at = now(), expires_at = v_expires,
        submitted_at = null, precheck = null, precheck_at = null
    where id = existing.id;
    v_id := existing.id;
  else
    insert into gap_claims (gap_id, person_id, status, claimed_at, expires_at)
    values (p_gap_id, me, 'claimed', now(), v_expires)
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'claim_id', v_id, 'expires_at', v_expires);
end;
$function$;

-- 4. Data -------------------------------------------------------------------------------------
SELECT set_config('radlab.claim_flow', '1', true);

-- 4a. The two Green claims that expired on the deadline day with a saved draft: reopened for a
--     week, and on time if submitted by then.
UPDATE public.gap_claims
   SET status = 'claimed',
       expires_at = now() + interval '7 days',
       note = coalesce(note || ' · ', '') || 'reopened ' || now()::date
              || ' (Norm): the claim expired before the Oct 7 Green deadline; on time if submitted by '
              || (now() + interval '7 days')::date
 WHERE id IN ('c7ec3e38-9418-4bc0-b021-eb9bc3f55e1d', '72eebf1d-60ca-4b1c-919d-6b33d9b7feb5')
   AND status = 'withdrawn';

-- 4b. Open amber claims that would expire before Amber 1's deadline: expire at it instead.
--     Already-expired claims are revived only where their gap still has room.
UPDATE public.gap_claims gc
   SET expires_at = '2026-11-12 04:59:00+00'
  FROM public.page_gaps g, public.courses co
 WHERE g.id = gc.gap_id AND co.id = g.course_id AND co.code = 'PSY240'
   AND g.difficulty = 'amber' AND gc.status = 'claimed'
   AND gc.expires_at < '2026-11-12 04:59:00+00'
   AND (gc.expires_at > now()
        OR (select count(*) from public.gap_claims o
             where o.gap_id = gc.gap_id and o.id <> gc.id
               and (o.status in ('submitted', 'accepted')
                    or (o.status = 'claimed' and o.expires_at > now()))) < g.capacity);
