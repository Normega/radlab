-- Notify a student when staff decide on their submission (Norm, 2026-08-23).
--
-- Without this, a send-back note reaches nobody: the reviewer's feedback lands
-- on the gap board, and no student refreshes a board on the off-chance. The
-- email is strictly transactional — one message per decision the student's own
-- submission triggered — not a reminder class.
--
-- `notified_at` makes the send idempotent and, more usefully, answerable:
-- "was this student actually told?" is a question that will be asked about a
-- grade, and it should not depend on a mail provider's dashboard.

alter table public.gap_claims
  add column if not exists notified_at timestamptz;

-- Everything the notifier needs, in one call. identity.people is not on
-- PostgREST's exposed-schema list (the WP5 lesson), so the endpoint cannot
-- read the student's address directly.
create or replace function public.claim_notification_payload(p_claim_id uuid)
returns table (
  student_email text, student_name text, status text, note text,
  page_slug text, page_title text, section text, ask text,
  difficulty text, notified_at timestamptz
)
language sql security definer
set search_path to 'public', 'identity'
as $$
  select pe.email,
         coalesce(nullif(btrim(pe.full_name), ''), split_part(pe.email, '@', 1)),
         c.status, c.note, g.slug, p.title, g.section, g.ask, g.difficulty, c.notified_at
  from gap_claims c
  join page_gaps g on g.id = c.gap_id
  join wiki_pages p on p.id = g.page_id
  join identity.people pe on pe.id = c.person_id
  where c.id = p_claim_id
$$;

create or replace function public.mark_claim_notified(p_claim_id uuid)
returns void language sql security definer set search_path to 'public'
as $$
  update gap_claims set notified_at = now() where id = p_claim_id
$$;

do $$ begin
  revoke all on function public.claim_notification_payload(uuid) from public, anon, authenticated;
  revoke all on function public.mark_claim_notified(uuid) from public, anon, authenticated;
  grant execute on function public.claim_notification_payload(uuid) to service_role;
  grant execute on function public.mark_claim_notified(uuid) to service_role;
end $$;
