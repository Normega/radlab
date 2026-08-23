-- The submissions queue was showing claimed rows as well as submitted ones.
--
-- Found by Norm sending a submission back: the card did not disappear, because
-- send-back sets gap_claims.status = 'claimed' and the view returned claimed
-- rows too. The same filter made the home-page badge count every in-flight
-- claim as "awaiting review" — at 200 students that reads in the hundreds while
-- the queue actually has nothing in it, which is the kind of number a TA learns
-- to ignore.
--
-- `submitted` is the only status that means "a human owes this a decision".
-- A claimed row is the student's to work on; an accepted one is finished.
create or replace view public.submission_review_queue
with (security_invoker = true) as
  select c.id as claim_id,
    c.status,
    coalesce(nullif(btrim(pe.full_name), ''), pe.email) as student,
    pe.email as student_email,
    g.difficulty,
    g.tier,
    g.slug as page_slug,
    g.section,
    '/academic/fieldguide/wiki/' || g.slug || coalesce('#' || g.section, '') as review_url,
    'https://radlab.zone/academic/fieldguide/wiki/' || g.slug || coalesce('#' || g.section, '') as review_url_full,
    g.ask,
    c.source_doi,
    c.source_url,
    c.submitted_text,
    c.limitation,
    case
      when jsonb_path_exists(coalesce(c.precheck, '[]'::jsonb), '$[*]?(@."severity" == "block")'::jsonpath) then 'BLOCKED'
      when jsonb_path_exists(coalesce(c.precheck, '[]'::jsonb), '$[*]?(@."severity" == "warn")'::jsonpath) then 'warnings'
      when c.precheck is null then 'not checked'
      when g.difficulty = 'green' then 'light check'
      else 'full read'
    end as route,
    coalesce(jsonb_array_length(c.precheck), 0) as finding_count,
    c.precheck as findings,
    c.submitted_at,
    c.precheck_at
  from gap_claims c
  join page_gaps g on g.id = c.gap_id
  join identity.people pe on pe.id = c.person_id
  where c.status = 'submitted';
