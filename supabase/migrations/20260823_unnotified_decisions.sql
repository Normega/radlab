-- Decisions the student was never told about.
--
-- api/claim-notify.js can fail — provider outage, a bad address, or simply
-- being called before a deploy finished, which is how this was found. The
-- decision still stands (deliberately: the status write is never blocked on
-- mail), so without this view the student is left waiting on a submission that
-- was actually sent back days ago, and no one can see it.
--
-- Sent back = status 'claimed' AND it was once submitted AND a note exists.
-- A never-submitted claim has none of those and is not a decision.
create or replace view public.unnotified_decisions
with (security_invoker = true) as
  select c.id as claim_id,
         c.status,
         coalesce(nullif(btrim(pe.full_name), ''), pe.email) as student,
         pe.email as student_email,
         g.slug as page_slug,
         p.title as page_title,
         g.difficulty,
         c.note,
         c.submitted_at,
         c.resolved_at,
         g.course_id
  from gap_claims c
  join page_gaps g on g.id = c.gap_id
  join wiki_pages p on p.id = g.page_id
  join identity.people pe on pe.id = c.person_id
  where c.notified_at is null
    and (
      c.status = 'accepted'
      or (c.status = 'claimed' and c.submitted_at is not null and c.note is not null)
    );
