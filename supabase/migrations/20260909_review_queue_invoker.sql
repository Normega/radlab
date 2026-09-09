-- radlab-academic. The security advisors' one ERROR, and a real one:
-- submission_review_queue was a definer-semantics view with SELECT granted
-- to anon and authenticated — anyone holding the public key, signed in or
-- not, could read the whole review queue (student names, emails, submitted
-- text), RLS bypassed. Found 2026-09-09, before any real student submission
-- existed.
--
-- security_invoker makes the CALLER's RLS govern the underlying tables:
-- staff policies already grant them everything the queue joins; a student
-- querying the view now sees only their own claims; anon (also revoked
-- outright) sees nothing.
--
-- Verified in rolled-back transactions with a claim forced to 'submitted':
-- staff (Maryam's uid) sees the row through the full join incl.
-- identity.people; a student uid sees 0; anon has no grant at all.
alter view public.submission_review_queue set (security_invoker = true);
revoke all on public.submission_review_queue from anon;

-- The invoker path reads identity.people through the view, which needs a
-- table-level grant (RLS still decides rows: own row, or staff reading
-- people enrolled in their course).
grant select on identity.people to authenticated;
grant usage on schema identity to authenticated;
