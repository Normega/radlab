-- Project: radlab-academic
--
-- Phase 4 of the course-scoped routing migration: the two database-side URL
-- emitters stop pointing at legacy /academic/fieldguide/* paths. Safe only
-- AFTER the /academic/:courseCode routes are in production (promoted
-- 2026-09-01) — before that, these URLs would 404 for students.
--
-- 1. submission_review_queue.review_url / review_url_full become
--    course-scoped (/academic/psy240/wiki/<slug>). Needs a courses join the
--    view didn't have; column names, types and order are unchanged, which is
--    the shape CREATE OR REPLACE VIEW requires.
--
-- 2. roster_find_by_key_in_course(p_match_key, p_course_code): the
--    course-scoped join door (/academic/psy240/join) matches ITS course's
--    roster first, so a student on two rosters gets the course whose door
--    they walked through. api/roster-join.js falls back to the unscoped
--    roster_find_by_key when this misses, so a student at the "wrong" door
--    still signs in — to their own course. Additive; same SECURITY DEFINER +
--    pinned search_path + service_role-only pattern as the other roster_*
--    functions. Newest term wins on a same-code tie, with the same explicit
--    season ranking as courseRoutes.termSortKey (a bare string sort puts
--    Winter above Fall).

create or replace view public.submission_review_queue as
 SELECT c.id AS claim_id,
    c.status,
    COALESCE(NULLIF(btrim(pe.full_name), ''::text), pe.email) AS student,
    pe.email AS student_email,
    g.difficulty,
    g.tier,
    g.slug AS page_slug,
    g.section,
    ('/academic/' || lower(co.code) || '/wiki/' || g.slug) || COALESCE('#'::text || g.section, ''::text) AS review_url,
    ('https://radlab.zone/academic/' || lower(co.code) || '/wiki/' || g.slug) || COALESCE('#'::text || g.section, ''::text) AS review_url_full,
    g.ask,
    c.source_doi,
    c.source_url,
    c.submitted_text,
    c.limitation,
        CASE
            WHEN jsonb_path_exists(COALESCE(c.precheck, '[]'::jsonb), '$[*]?(@."severity" == "block")'::jsonpath) THEN 'BLOCKED'::text
            WHEN jsonb_path_exists(COALESCE(c.precheck, '[]'::jsonb), '$[*]?(@."severity" == "warn")'::jsonpath) THEN 'warnings'::text
            WHEN c.precheck IS NULL THEN 'not checked'::text
            WHEN g.difficulty = 'green'::text THEN 'light check'::text
            ELSE 'full read'::text
        END AS route,
    COALESCE(jsonb_array_length(c.precheck), 0) AS finding_count,
    c.precheck AS findings,
    c.submitted_at,
    c.precheck_at,
    g.course_id
   FROM gap_claims c
     JOIN page_gaps g ON g.id = c.gap_id
     JOIN public.courses co ON co.id = g.course_id
     JOIN identity.people pe ON pe.id = c.person_id
  WHERE c.status = 'submitted'::text;

create or replace function public.roster_find_by_key_in_course(p_match_key text, p_course_code text)
returns table(id uuid, full_name text, email text, status text, invite_count integer, last_invited_at timestamptz)
language sql
security definer
set search_path to 'public', 'identity'
as $$
  select r.id, r.full_name, r.email, r.status, r.invite_count, r.last_invited_at
  from identity.roster r
  join public.courses c on c.id = r.course_id
  where r.email_match_key = p_match_key
    and upper(c.code) = upper(btrim(p_course_code))
    and r.status <> 'dropped'
  order by
    substring(c.term from 1 for 4) desc,
    case upper(substring(c.term from 5 for 1))
      when 'F' then 3 when 'S' then 2 when 'W' then 1 else 0
    end desc
  limit 1
$$;

revoke all on function public.roster_find_by_key_in_course(text, text) from public;
grant execute on function public.roster_find_by_key_in_course(text, text) to service_role;
