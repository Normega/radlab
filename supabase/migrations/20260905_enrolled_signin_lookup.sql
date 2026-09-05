-- One door for everyone on academic (Norm, 2026-09-05): the email sign-in
-- door must also vouch for people who are past the roster stage — staff above
-- all (TAs and instructors are never ON a student roster), and any enrolled
-- person whose roster row is gone. api/roster-join calls this after the
-- roster lookup misses; a match gets the same scanner-proof sign-in email.
--
-- SECURITY DEFINER because identity is deliberately off PostgREST's
-- exposed-schema list. Staff-role matches win over student ones so a person
-- who is both (Norm's identities) signs into their staff standing's course.
create or replace function public.enrolled_person_by_key(p_match_key text)
returns table(email text, course_code text)
language sql
security definer
set search_path = public, identity
as $$
  select p.email, c.code
  from identity.people p
  join public.enrollments e on e.person_id = p.id and e.status = 'active'
  join public.courses c on c.id = e.course_id
  where lower(p.email) = p_match_key
     or lower(regexp_replace(p.email, '@(mail\.|alum\.)?utoronto\.ca$', '@utoronto.ca')) = p_match_key
  order by (e.role in ('instructor','ta')) desc, c.code
  limit 1
$$;

revoke all on function public.enrolled_person_by_key(text) from public, anon, authenticated;
grant execute on function public.enrolled_person_by_key(text) to service_role;
