-- radlab-academic. Who owes what in the submissions queue (Norm, 2026-09-21).
--
-- The queue splits by student surname (review_sections: A-G, H-N, O-Z) and
-- decides which band to show by looking up the VIEWER's own email. A TA gets
-- "My section / Everyone"; an instructor is in no band, so the tabs never
-- render and there is no per-TA view of the queue at all. Asked how many
-- submissions each TA had addressed, the answer had to be assembled by hand.
--
-- One row per section: what is waiting, what has been waiting too long, and
-- how much that TA has decided (now that gap_claims.resolved_by exists).
--
-- SECURITY DEFINER because the banding needs the student's NAME, which lives
-- in identity.roster / identity.people — a schema deliberately not exposed to
-- PostgREST, since that is where the PII is. Only counts come back, never a
-- name, and the staff check is inside.
--
-- The surname rule mirrors SubmissionsQueue's rowInSection exactly: the LAST
-- whitespace-separated word of the student's name. A claim whose owner has no
-- usable name lands in no band, which is why the UI shows the queue total
-- beside the sections rather than assuming they add up.

CREATE OR REPLACE FUNCTION public.submission_sections_summary(p_course_id uuid)
RETURNS TABLE (ta_email text, label text, pending int, over_48h int, addressed int)
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
  with claims as (
    select gc.status,
           gc.submitted_at,
           upper(left(
             split_part(
               btrim(coalesce(r.full_name, pp.full_name, '')), ' ',
               greatest(array_length(
                 string_to_array(btrim(coalesce(r.full_name, pp.full_name, '')), ' '), 1), 1)
             ), 1)) as initial
      from gap_claims gc
      join page_gaps g on g.id = gc.gap_id and g.course_id = p_course_id
      join identity.people pp on pp.id = gc.person_id
      left join identity.roster r on r.person_id = pp.id and r.course_id = p_course_id
  )
  select s.ta_email,
         s.label,
         coalesce(pend.n, 0)::int,
         coalesce(pend.stale, 0)::int,
         coalesce(done.n, 0)::int
    from review_sections s
    left join lateral (
      select count(*) as n,
             count(*) filter (where c.submitted_at < now() - interval '48 hours') as stale
        from claims c
       where c.status = 'submitted'
         and c.initial <> ''
         and c.initial between upper(s.surname_from) and upper(s.surname_to)
    ) pend on true
    left join lateral (
      select count(*) as n
        from gap_claims gc
        join page_gaps g on g.id = gc.gap_id and g.course_id = p_course_id
        join identity.people tp on tp.id = gc.resolved_by
       where lower(tp.email) = lower(s.ta_email)
    ) done on true
   where s.course_id = p_course_id
   order by s.surname_from;
end $$;

REVOKE ALL ON FUNCTION public.submission_sections_summary(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submission_sections_summary(uuid) TO authenticated, service_role;
