-- 20260803_academic_ta_invite.sql
-- TARGET: the separate `radlab-academic` Supabase project, NOT the main radlab
-- project.
--
-- Adds a TA-role invite for the Field Guide's first non-instructor account.
--
-- No new role is created, and no main-site `profiles.lab_member` change is
-- involved: the academic partition has carried its own three-role enrollment
-- system since 20260724_academic_init.sql
-- (`enrollments.role in ('student','ta','instructor')`), on its own Supabase
-- project with its own auth. `ta` is already the role every staff gate reads —
-- `is_course_staff()`, the `staff read all pages` policies, `review_proposal`,
-- the `ingest-pdfs` upload policy, and FieldGuideStaffRoute — so a TA gets the
-- ingest portal and review queue and sees unpublished pages, while a `student`
-- enrollment sees only `status = 'published'`.
--
-- The invite is the allowlist, not the account: `identity.handle_new_user()`
-- consumes any matching unconsumed invite when someone signs up with that
-- email at /academic/fieldguide, creating the enrollment. So this row does
-- nothing visible until she registers, and registering without it would leave
-- her on the "No staff access" screen.

insert into public.invites (email, course_id, role)
select 'kavabee@gmail.com', c.id, 'ta'
from public.courses c
where c.code = 'PSY240' and c.term = '2026F'
on conflict (email, course_id) do nothing;
