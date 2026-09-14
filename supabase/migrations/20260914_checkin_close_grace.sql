-- Closing a check-in destroyed answers in progress — finding 1 of the
-- 2026-09-09 ramp test (scripts/loadtest/RESULTS-2026-09-09.md), and it hit
-- four real students during PSY240 L1. The student write policies gated on
-- status = 'open' alone, and closing is instant, so anyone still composing
-- got an RLS violation and lost their text. Now closes are all manual
-- (PSY309 dropped auto-close 2026-09-14), which makes the race the norm:
-- Stop is pressed the moment the room looks done, i.e. exactly while the
-- slowest writers are mid-sentence.
--
-- The fix: Stop still stops NEW entrants immediately (the student client
-- won't open a closed check-in), but a write that arrives within 90 s of
-- closed_at is accepted — finish-your-sentence grace. The grace is withheld
-- once quiz answers are revealed (quiz_revealed_at), so a revealed key can
-- never be typed back in as an answer.
--
-- Same change also makes the auto-close deadline real: the remote's comment
-- claimed "the checkin_responses RLS policies independently enforce the same
-- deadline server-side", but no policy ever did — a check-in left open with
-- no console alive to fire the close accepted writes forever. Now an open
-- check-in with auto_close_seconds stops accepting at
-- opened_at + auto_close_seconds + the same 90 s grace.

drop policy "checkin_responses: own write while open" on checkin_responses;
create policy "checkin_responses: own write while open"
  on checkin_responses for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from checkins c
      where c.id = checkin_responses.checkin_id
        and (
          (c.status = 'open'
            and (c.auto_close_seconds is null or c.opened_at is null
                 or now() < c.opened_at + make_interval(secs => c.auto_close_seconds + 90)))
          or (c.status in ('closed', 'results_ready')
            and c.closed_at > now() - interval '90 seconds'
            and c.quiz_revealed_at is null)
        )
    )
  );

drop policy "checkin_responses: own update while open" on checkin_responses;
create policy "checkin_responses: own update while open"
  on checkin_responses for update to authenticated
  using (
    profile_id = (select auth.uid())
    and exists (
      select 1 from checkins c
      where c.id = checkin_responses.checkin_id
        and (
          (c.status = 'open'
            and (c.auto_close_seconds is null or c.opened_at is null
                 or now() < c.opened_at + make_interval(secs => c.auto_close_seconds + 90)))
          or (c.status in ('closed', 'results_ready')
            and c.closed_at > now() - interval '90 seconds'
            and c.quiz_revealed_at is null)
        )
    )
  )
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from checkins c
      where c.id = checkin_responses.checkin_id
        and (
          (c.status = 'open'
            and (c.auto_close_seconds is null or c.opened_at is null
                 or now() < c.opened_at + make_interval(secs => c.auto_close_seconds + 90)))
          or (c.status in ('closed', 'results_ready')
            and c.closed_at > now() - interval '90 seconds'
            and c.quiz_revealed_at is null)
        )
    )
  );

-- The question box loses typed questions to the same race.
drop policy "class_questions: own write while open" on class_questions;
create policy "class_questions: own write while open"
  on class_questions for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from checkins c
      where c.id = class_questions.checkin_id
        and (
          (c.status = 'open'
            and (c.auto_close_seconds is null or c.opened_at is null
                 or now() < c.opened_at + make_interval(secs => c.auto_close_seconds + 90)))
          or (c.status in ('closed', 'results_ready')
            and c.closed_at > now() - interval '90 seconds')
        )
    )
  );
