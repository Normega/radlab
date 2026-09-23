-- my_claims(): two corrections found while building the dashboard on it (radlab-academic).
--
-- 1. 'returned' outlived a re-claim. claim_gap() re-opens the same row and keeps
--    decided_at (the history of the send-back), so a claim that was returned, expired and
--    was re-claimed read "Returned by … on <old date>" as if freshly sent back. A claim is
--    now 'returned' only while the decision is newer than the latest claim; after a
--    re-claim it is a 'draft' again (the dashboard still shows the old note and date in
--    its history).
-- 2. can_reclaim covered capacity and gap status but not claim_gap()'s other two refusals:
--    an amber before any submitted/accepted green, and a third open claim while two
--    unsubmitted ones are held. The button would appear and the server would refuse. It
--    now applies all four conditions, so the offer and the outcome agree.

create or replace function public.my_claims(p_course_code text default null)
returns table (
  claim_id uuid, gap_id uuid, course_code text,
  slug text, page_title text, section text, ask text, difficulty text, gap_status text,
  lecture_no integer,
  status text, display_state text, resubmitted boolean,
  claimed_at timestamptz, expires_at timestamptz, submitted_at timestamptz,
  decided_at timestamptz, resolved_at timestamptz,
  note text, reviewer_name text,
  source_citation text, source_doi text, source_url text,
  submitted_text text, limitation text,
  precheck jsonb, precheck_at timestamptz,
  on_page boolean,
  slots_remaining integer, can_reclaim boolean
)
language sql stable security definer
set search_path to 'public', 'identity'
as $$
  with me as (select current_person_id() as id),
  mine as (
    select
      exists (select 1 from gap_claims x join page_gaps pg on pg.id = x.gap_id, me
              where x.person_id = me.id and x.status in ('submitted','accepted')
                and pg.difficulty = 'green') as green_done,
      (select count(*) from gap_claims x, me
        where x.person_id = me.id and x.status = 'claimed'
          and (x.expires_at is null or x.expires_at > now())) as open_unsubmitted
  )
  select c.id, g.id, co.code,
         g.slug, p.title, g.section,
         coalesce(nullif(btrim(g.ask_display), ''), g.ask), g.difficulty, g.status,
         (select min(pl.lecture_no) from page_lectures pl where pl.page_id = p.id and pl.course_id = g.course_id),
         c.status,
         case
           when c.status = 'accepted'  then 'accepted'
           when c.status = 'submitted' then 'submitted'
           when c.status = 'claimed' and c.expires_at is not null and c.expires_at < now() then 'expired'
           when c.status = 'claimed' and c.decided_at is not null
                and (c.claimed_at is null or c.decided_at > c.claimed_at) then 'returned'
           when c.status = 'claimed' then 'draft'
           when c.status = 'withdrawn' and c.note ilike '%(14-day claim TTL)%' then 'expired'
           else 'released'
         end,
         (c.status = 'submitted' and c.decided_at is not null and c.submitted_at > c.decided_at),
         c.claimed_at, c.expires_at, c.submitted_at, c.decided_at, c.resolved_at,
         c.note,
         nullif(split_part(btrim(coalesce(rv.full_name, '')), ' ', 1), ''),
         c.source_citation, c.source_doi, c.source_url,
         c.submitted_text, c.limitation,
         c.precheck, c.precheck_at,
         (c.integration_version_id is not null),
         greatest(g.capacity - coalesce(held.n, 0)::int, 0),
         -- claim_gap()'s four refusals, in its order: gap open and not red; not full;
         -- green first; at most two unsubmitted claims held.
         ((c.status = 'withdrawn' or (c.status = 'claimed' and c.expires_at < now()))
           and g.status = 'open' and g.difficulty <> 'red'
           and g.capacity - coalesce(held.n, 0) > 0
           and (g.difficulty = 'green' or mine.green_done)
           and mine.open_unsubmitted < 2)
  from gap_claims c
  cross join mine
  join page_gaps g  on g.id = c.gap_id
  join wiki_pages p on p.id = g.page_id
  join courses co   on co.id = g.course_id
  left join identity.people rv on rv.id = c.resolved_by
  left join lateral (
    select count(*) as n from gap_claims x
    where x.gap_id = g.id and x.id <> c.id
      and (x.status in ('submitted','accepted')
           or (x.status = 'claimed' and (x.expires_at is null or x.expires_at > now())))
  ) held on true
  where c.person_id = current_person_id()
    and (p_course_code is null or co.code ilike p_course_code)
  order by coalesce(c.submitted_at, c.claimed_at) desc
$$;

revoke all on function public.my_claims(text) from public, anon;
grant execute on function public.my_claims(text) to authenticated;
