-- The one-door fallback (staff / enrolled people with no roster row) picked
-- its course by alphabetical code, so anyone enrolled in both 2026F courses
-- got a PSY240-branded sign-in from the PSY309 door (Norm, 2026-09-05: "no
-- way to log in to psy309"). The lookup now honors the door: the requested
-- course's enrollment wins; everything else keeps the old ordering. Dropped
-- and recreated to avoid a PostgREST overload ambiguity.
drop function if exists public.enrolled_person_by_key(text);

create function public.enrolled_person_by_key(p_match_key text, p_course_code text default null)
returns table(email text, course_code text)
language sql security definer
set search_path to 'public', 'identity'
as $function$
  select p.email, c.code
  from identity.people p
  join public.enrollments e on e.person_id = p.id and e.status = 'active'
  join public.courses c on c.id = e.course_id
  where lower(p.email) = p_match_key
     or lower(regexp_replace(p.email, '@(mail\.|alum\.)?utoronto\.ca$', '@utoronto.ca')) = p_match_key
  order by (upper(c.code) = upper(coalesce(p_course_code, ''))) desc,
           (e.role in ('instructor','ta')) desc,
           c.code
  limit 1
$function$;

revoke all on function public.enrolled_person_by_key(text, text) from public, anon, authenticated;
grant execute on function public.enrolled_person_by_key(text, text) to service_role;
