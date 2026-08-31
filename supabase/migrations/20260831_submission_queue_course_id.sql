-- Project: radlab-academic
--
-- Adds course_id to submission_review_queue so SubmissionsQueue can tell
-- api/claim-notify WHICH course a decision belongs to.
--
-- Why it is needed. That queue is deliberately NOT course-filtered: it selects
-- the view with no course predicate and lets RLS scope it to whatever the
-- caller staffs, so a person teaching PSY240 and PSY309 sees both courses'
-- submissions in one list. The notify call, however, was passing
-- `staffEnrollments[0]?.course_id` -- the caller's first enrollment by array
-- position, not the course the row belongs to. With course-routed Reply-To
-- (20260831, replyTo.ts) that means a PSY309 student's reply could be
-- addressed to psy240@radlab.zone.
--
-- A course picker is the wrong fix here, unlike the read-only queues: the list
-- spans courses by design, so the course has to come from the ROW, not from a
-- global selector the reviewer would have to remember to keep in sync with
-- whichever row they are acting on.
--
-- unnotified_decisions already exposes course_id; this brings the main queue
-- into line. Appended as the LAST column: CREATE OR REPLACE VIEW requires that
-- existing columns keep their names, types and order, and adding at the end is
-- the only shape it accepts. Backward compatible in both directions -- the old
-- client selects '*' and ignores the extra field, so this can be applied
-- before the frontend that reads it.

create or replace view public.submission_review_queue as
 SELECT c.id AS claim_id,
    c.status,
    COALESCE(NULLIF(btrim(pe.full_name), ''::text), pe.email) AS student,
    pe.email AS student_email,
    g.difficulty,
    g.tier,
    g.slug AS page_slug,
    g.section,
    ('/academic/fieldguide/wiki/'::text || g.slug) || COALESCE('#'::text || g.section, ''::text) AS review_url,
    ('https://radlab.zone/academic/fieldguide/wiki/'::text || g.slug) || COALESCE('#'::text || g.section, ''::text) AS review_url_full,
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
     JOIN identity.people pe ON pe.id = c.person_id
  WHERE c.status = 'submitted'::text;
