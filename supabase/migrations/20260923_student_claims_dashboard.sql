-- Student contributions dashboard, and two expiry traps it exposed (radlab-academic).
--
-- Norm, 2026-09-23: students need to see what they submitted — including recovering the
-- text — and where it is in the system. Until now the only view was the gap board's
-- "Your claims" strip, built on gap_board(), which drops a claim the moment it is
-- withdrawn (released or expired) and drops the whole gap once it stops being open. A
-- student's own words were still in gap_claims (RLS lets them read every row of theirs);
-- nothing showed them.
--
-- 1. my_claims(p_course_code): every claim the caller has ever held in the course, any
--    status, any gap status, with the text, the reviewer's note and first name, and a
--    display_state derived only from recorded facts:
--      accepted   status = 'accepted'
--      submitted  status = 'submitted'   (resubmitted = decided_at before submitted_at)
--      returned   status = 'claimed', decided_at set, not past expiry (sent back by a TA)
--      expired    status = 'claimed' past expires_at, or withdrawn by expire_claims()
--                 (which writes "expired … (14-day claim TTL)" into note)
--      released   withdrawn any other way
--      draft      status = 'claimed', never decided, not past expiry
--
-- 2. A sent-back claim keeps its original 14-day expires_at — decide() in the review
--    queue patches only status and note — so a claim returned late in its window arrives
--    already expired, and submit_claim() then refuses the resubmission. On 2026-09-23 one
--    of three returned claims was already expired and one had under three days. The
--    decision trigger now gives a returned claim a fresh 14 days; the three open ones are
--    repaired below.
--
-- 3. claim_gap() re-opened only WITHDRAWN claims, but nothing withdraws an expired draft
--    unless staff run expire_claims() — so a student past expiry could neither submit
--    (expired) nor re-claim ("You already hold this gap (claimed)"). Eleven claims were in
--    that state. An expired 'claimed' row is now re-claimable exactly like a withdrawn one:
--    same row, text kept, new 14-day window, capacity rules unchanged.

-- ── 1. my_claims ─────────────────────────────────────────────────────────────
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
  select c.id, g.id, co.code,
         g.slug, p.title, g.section,
         coalesce(nullif(btrim(g.ask_display), ''), g.ask), g.difficulty, g.status,
         (select min(pl.lecture_no) from page_lectures pl where pl.page_id = p.id and pl.course_id = g.course_id),
         c.status,
         case
           when c.status = 'accepted'  then 'accepted'
           when c.status = 'submitted' then 'submitted'
           when c.status = 'claimed' and c.expires_at is not null and c.expires_at < now() then 'expired'
           when c.status = 'claimed' and c.decided_at is not null then 'returned'
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
         -- the same conditions claim_gap() will apply, so the button never offers a
         -- re-claim the server then refuses for capacity or gap status
         ((c.status = 'withdrawn' or (c.status = 'claimed' and c.expires_at < now()))
           and g.status = 'open' and g.difficulty <> 'red'
           and g.capacity - coalesce(held.n, 0) > 0)
  from gap_claims c
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

-- ── 2. a returned claim gets a fresh window ──────────────────────────────────
create or replace function public.note_claim_decision()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_person uuid;
begin
  if OLD.status = 'submitted' and NEW.status is distinct from OLD.status then
    v_person := current_person_id();
    if v_person is not null then
      NEW.resolved_by := v_person;
    end if;
    NEW.decided_at := now();
    -- Sent back: the student must be able to resubmit. Without this the claim kept the
    -- expiry it was given when first claimed, and could arrive already expired.
    if NEW.status = 'claimed' then
      NEW.expires_at := greatest(coalesce(NEW.expires_at, now()), now() + interval '14 days');
    end if;
  end if;
  return NEW;
end $$;

-- repair the returned claims open today
select set_config('radlab.claim_flow', '1', true);
update gap_claims
   set expires_at = greatest(coalesce(expires_at, now()), now() + interval '14 days')
 where status = 'claimed' and decided_at is not null;

-- ── 3. an expired draft can be re-claimed ────────────────────────────────────
create or replace function public.claim_gap(p_gap_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  g record;
  me uuid := current_person_id();
  held int;
  unsubmitted int;
  has_green_done boolean;
  has_any boolean;
  existing record;
  v_expires timestamptz := now() + interval '14 days';
  v_id uuid;
begin
  select * into g from page_gaps where id = p_gap_id and status = 'open';
  if not found or not is_course_member(g.course_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No such open gap.');
  end if;

  if g.difficulty = 'red' then
    return jsonb_build_object('ok', false, 'code', 'red_gap',
      'message', 'Red gaps are staff-written (clinical or legal content) and cannot be claimed.');
  end if;

  select * into existing from gap_claims where gap_id = p_gap_id and person_id = me;
  if found and existing.status <> 'withdrawn'
     and not (existing.status = 'claimed' and existing.expires_at is not null and existing.expires_at < now()) then
    return jsonb_build_object('ok', false, 'code', 'already_claimed',
      'message', 'You already hold this gap (' || existing.status || ').');
  end if;

  select count(*) into held from gap_claims x
  where x.gap_id = p_gap_id
    and (x.status in ('submitted','accepted')
         or (x.status = 'claimed' and (x.expires_at is null or x.expires_at > now())));
  if held >= g.capacity then
    return jsonb_build_object('ok', false, 'code', 'full',
      'message', 'This gap is fully claimed. Pick another — slots free up if a claim expires.');
  end if;

  select exists (select 1 from gap_claims x where x.person_id = me and x.status <> 'withdrawn')
    into has_any;
  select exists (
    select 1 from gap_claims x join page_gaps pg on pg.id = x.gap_id
    where x.person_id = me and x.status in ('submitted','accepted') and pg.difficulty = 'green')
    into has_green_done;

  if g.difficulty <> 'green' and not has_green_done then
    return jsonb_build_object('ok', false, 'code', 'green_first',
      'message', case when has_any
        then 'Amber gaps unlock once your green submission is in.'
        else 'Your first gap must be a green one — they are scaffolded for the first assignment.' end);
  end if;

  select count(*) into unsubmitted from gap_claims x
  where x.person_id = me and x.status = 'claimed'
    and (x.expires_at is null or x.expires_at > now());
  if unsubmitted >= 2 then
    return jsonb_build_object('ok', false, 'code', 'too_many_open',
      'message', 'You already hold 2 unsubmitted claims. Submit or release one first.');
  end if;

  perform set_config('radlab.claim_flow', '1', true);
  if existing.id is not null then
    update gap_claims
    set status = 'claimed', claimed_at = now(), expires_at = v_expires,
        submitted_at = null, precheck = null, precheck_at = null
    where id = existing.id;
    v_id := existing.id;
  else
    insert into gap_claims (gap_id, person_id, status, claimed_at, expires_at)
    values (p_gap_id, me, 'claimed', now(), v_expires)
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'claim_id', v_id, 'expires_at', v_expires);
end;
$$;
