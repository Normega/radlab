-- Lobby cards for released class tests: once staff release a test's results, every
-- student who submitted it finds "Review your test" in the lobby. Built 2026-10-27.
--
-- get_lounge_test_card (20260928_class_tests.sql) only ever shows an OPEN test, so after
-- a test closed a student had no way back to it from the lobby. This is the other half:
-- one row per test that is released AND that the caller submitted, newest release first.
-- The same two conditions get_class_test_review checks before showing anything, so a
-- card never leads to "not available". Non-members get null; everyone else an array,
-- empty when there is nothing to review. Titles only: scores stay on the review page,
-- off a lobby a classmate can see over a shoulder.

create or replace function get_lounge_review_cards(p_class_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from class_members m where m.class_id = p_class_id and m.user_id = auth.uid())
              then null else coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'released_at', t.results_released_at)
                     order by t.results_released_at desc)
      from class_tests t
      join class_test_attempts a on a.test_id = t.id and a.profile_id = auth.uid()
     where t.class_id = p_class_id
       and t.results_released_at is not null
       and a.submitted_at is not null), '[]'::jsonb) end;
$$;

revoke all on function get_lounge_review_cards(uuid) from public, anon;
grant execute on function get_lounge_review_cards(uuid) to authenticated;
