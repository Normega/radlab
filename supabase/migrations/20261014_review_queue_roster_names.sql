-- radlab-academic. "My section" in the TA queue never filtered anything
-- (reported by all three PSY240 TAs, 2026-10-13).
--
-- submission_review_queue took the student's name from identity.people.full_name
-- and fell back to the email. That column is empty for every PSY240 submitter
-- (474 of 474 claims on 2026-10-14) — names were never collected at sign-up;
-- they live in identity.roster. So `student` was always an email, and
-- SubmissionsQueue's rowInSection deliberately puts an unclassifiable row in
-- EVERY section's "mine". Each TA's "My section" was the whole queue, the
-- sections were never divided, and whoever opened the queue first graded the
-- others' students: of the decisions on record, one TA had made 210, 129 of
-- them outside their own band. The instructor's oversight strip
-- (submission_sections_summary) read the roster and so looked right, which is
-- why the split appeared to work from the instructor's seat.
--
-- Fix: take the name from the course roster first, the same order
-- submission_sections_summary uses, so the TA tabs and the oversight strip band
-- by the same name. identity.roster is not readable by `authenticated` and this
-- view is security_invoker, so the lookup goes through a SECURITY DEFINER
-- helper that answers course staff only.
--
-- Same for previous_reviewer: TAs have no people.full_name either, so a
-- resubmission never said who sent it back, so a TA could not tell another's
-- feedback from their own. Fall back to the reviewer's email handle.

CREATE OR REPLACE FUNCTION public.roster_name(p_person_id uuid, p_course_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, identity
AS $$
  select nullif(btrim(r.full_name), '')
    from identity.roster r
   where r.person_id = p_person_id
     and r.course_id = p_course_id
     and public.is_course_staff(p_course_id)
   limit 1
$$;

REVOKE ALL ON FUNCTION public.roster_name(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.roster_name(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.submission_review_queue
WITH (security_invoker = true) AS
 SELECT c.id AS claim_id,
    c.status,
    COALESCE(public.roster_name(pe.id, g.course_id), NULLIF(btrim(pe.full_name), ''::text), pe.email) AS student,
    pe.email AS student_email,
    g.difficulty,
    g.tier,
    g.slug AS page_slug,
    g.section,
    ((('/academic/'::text || lower(co.code)) || '/wiki/'::text) || g.slug) || COALESCE('#'::text || g.section, ''::text) AS review_url,
    ((('https://radlab.zone/academic/'::text || lower(co.code)) || '/wiki/'::text) || g.slug) || COALESCE('#'::text || g.section, ''::text) AS review_url_full,
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
    g.course_id,
    c.source_fulltext IS NOT NULL AS has_source,
    c.integration_status,
    c.integration_note,
    c.integration_draft,
    c.integration_verdict,
    c.decided_at IS NOT NULL OR n.clean IS NOT NULL AS previously_sent_back,
    n.clean AS previous_note,
    c.decided_at AS previous_decided_at,
    COALESCE(NULLIF(btrim(rb.full_name), ''::text), split_part(rb.email, '@', 1)) AS previous_reviewer
   FROM gap_claims c
     JOIN page_gaps g ON g.id = c.gap_id
     JOIN courses co ON co.id = g.course_id
     JOIN identity.people pe ON pe.id = c.person_id
     LEFT JOIN identity.people rb ON rb.id = c.resolved_by
     CROSS JOIN LATERAL ( SELECT NULLIF(btrim(regexp_replace(COALESCE(c.note, ''::text), '(\s*·\s*)?expired \d{4}-\d{2}-\d{2} \(14-day claim TTL\)'::text, ''::text, 'g'::text)), ''::text) AS clean) n
  WHERE c.status = 'submitted'::text;
