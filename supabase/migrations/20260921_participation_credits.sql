-- radlab-academic. Exceptional participation, recorded rather than remembered
-- (Norm, 2026-09-21).
--
-- The course promises credit for things the pipeline does not count: the first
-- verified report of a genuine error in a Guide page, a contribution to the
-- room that no check-in captures. Until now there was nowhere to put it, so
-- the promise lived in the instructor's memory and the student had no way to
-- see it had been honoured.
--
-- A table rather than a column on the roster, because a student can earn this
-- more than once and each award needs its own reason and its own author:
-- "exceptional participation: 3" with no note is not a record anyone can
-- defend at the end of term.
--
-- Access is through the two definer RPCs below and nothing else. RLS is on
-- with no policies BY DESIGN — the same shape as weekly_quiz_keys, not the
-- silent-block failure the platform's RLS rule warns about: no client path
-- reads or writes this table directly.

CREATE TABLE IF NOT EXISTS public.participation_credits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  person_id   uuid NOT NULL REFERENCES identity.people(id) ON DELETE CASCADE,
  note        text NOT NULL,
  report_id   uuid REFERENCES public.page_reports(id) ON DELETE SET NULL,
  awarded_by  uuid REFERENCES identity.people(id),
  awarded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS participation_credits_course_person
  ON public.participation_credits (course_id, person_id);

ALTER TABLE public.participation_credits ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.participation_credits IS
  'Instructor-awarded credit for participation the pipeline does not count. RLS on with no policies deliberately: reached only through award_participation_credit() and participation_credits_summary().';

-- Award. Staff only; the note is required, because a credit no one can explain
-- is a credit no one can defend.
CREATE OR REPLACE FUNCTION public.award_participation_credit(
  p_course_id uuid, p_person_id uuid, p_note text, p_report_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not is_course_staff(p_course_id) then
    raise exception 'staff only';
  end if;
  if v_note is null or length(v_note) < 10 then
    raise exception 'say what the credit is for, in at least a short sentence';
  end if;
  if not exists (select 1 from enrollments e
                 where e.course_id = p_course_id and e.person_id = p_person_id) then
    raise exception 'that person is not enrolled on this course';
  end if;

  insert into participation_credits (course_id, person_id, note, report_id, awarded_by)
  values (p_course_id, p_person_id, v_note, p_report_id, current_person_id())
  returning id into v_id;

  return v_id;
end $$;

-- Counts and the most recent reason, for the tracking table. Counts and notes
-- only; the caller already holds the roster it is joining to.
CREATE OR REPLACE FUNCTION public.participation_credits_summary(p_course_id uuid)
RETURNS TABLE (person_id uuid, credits int, last_note text, last_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if not is_course_staff(p_course_id) then
    raise exception 'staff only';
  end if;

  return query
  select pc.person_id,
         count(*)::int,
         (array_agg(pc.note ORDER BY pc.awarded_at DESC))[1],
         max(pc.awarded_at)
    from participation_credits pc
   where pc.course_id = p_course_id
   group by pc.person_id;
end $$;

REVOKE ALL ON FUNCTION public.award_participation_credit(uuid, uuid, text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.participation_credits_summary(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_participation_credit(uuid, uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.participation_credits_summary(uuid) TO authenticated, service_role;
