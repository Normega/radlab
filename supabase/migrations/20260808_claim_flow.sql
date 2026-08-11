-- 20260808_claim_flow.sql
--
-- WP6 Phase C, server side: claiming, drafting, and submitting against gaps.
-- Every rule Norm decided lives HERE, not in the client:
--
--   * green-first, enforced at claim time (first-ever claim must be green;
--     amber unlocks once a green claim is submitted or accepted)
--   * 14-day TTL on unsubmitted claims; expired claims stop counting against
--     capacity immediately (lazy) and are swept to withdrawn (hygiene)
--   * capacity is a live count: claimed-and-unexpired + submitted + accepted
--   * red gaps are unclaimable, period
--   * at most 2 unsubmitted claims held at once (anti-hoarding; scarcity is
--     1.24x on green)
--
-- WHY THE TRIGGER + COLUMN GRANTS EXIST — two holes the RLS policies left:
--   1. "members update own claims" let a student set status='accepted' on
--      their own row (self-grading) or overwrite precheck with [].
--   2. "members create own claims" let a student INSERT directly, bypassing
--      capacity, green-first, and the red block.
-- Fix: column grants take precheck/precheck_at away from the API entirely
-- (only definer functions, running as table owner, can write them), and a
-- guard trigger allows non-staff writes only through the sanctioned
-- transitions — inserts and withdrawn→claimed revivals only via claim_gap(),
-- claimed→submitted only via submit_claim(), both signalled by a
-- transaction-local set_config flag. Staff pass through untouched, so
-- SubmissionsQueue's accept / send-back keeps working as-is.

-- ---------------------------------------------------------------------------
-- 1. TTL column
-- ---------------------------------------------------------------------------

alter table gap_claims add column if not exists expires_at timestamptz;

comment on column gap_claims.expires_at is
  'Unsubmitted claims expire 14 days after claiming; expired claims free their slot immediately (counts ignore them) and are swept to withdrawn by expire_claims(). Null = no expiry (legacy/staff rows).';

-- ---------------------------------------------------------------------------
-- 2. Column grants: students (and staff) write through a named column list;
--    precheck fields become function-only
-- ---------------------------------------------------------------------------

revoke update on gap_claims from authenticated;
grant update (status, submitted_text, source_doi, source_url, limitation,
              submitted_at, note, resolved_at)
  on gap_claims to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The guard trigger
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so its own reads (page_gaps for the staff check) bypass
-- RLS — a student's trigger execution must still be able to see which course
-- the gap belongs to. is_course_staff()/current_person_id() read auth.uid(),
-- which is untouched by definer context.

create or replace function gap_claims_guard()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_staff boolean;
  v_flow  boolean := coalesce(current_setting('radlab.claim_flow', true), '') = '1';
begin
  select is_course_staff(g.course_id) into v_staff
  from page_gaps g where g.id = coalesce(new.gap_id, old.gap_id);
  if coalesce(v_staff, false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not v_flow then
      raise exception 'claims are created through claim_gap(), not direct insert';
    end if;
    return new;
  end if;

  -- UPDATE, non-staff. RLS already restricts to own rows; belt and braces:
  if old.person_id is distinct from current_person_id() and not v_flow then
    raise exception 'not your claim';
  end if;

  if old.status = 'accepted' then
    raise exception 'accepted claims are read-only';
  end if;

  if old.status = 'submitted' then
    raise exception 'submitted claims are locked while under review';
  end if;

  if old.status = 'withdrawn' then
    if new.status = 'claimed' and v_flow then
      return new;  -- revival, via claim_gap() only
    end if;
    raise exception 'withdrawn claims are re-opened through claim_gap()';
  end if;

  -- old.status = 'claimed'
  if new.status = 'claimed' or new.status = 'withdrawn' then
    return new;  -- draft edits, or releasing the claim
  end if;
  if new.status = 'submitted' then
    if not v_flow then
      raise exception 'submissions go through submit_claim(), which runs the precheck';
    end if;
    if old.expires_at is not null and old.expires_at < now() then
      raise exception 'this claim expired on % — re-claim the gap if slots remain', old.expires_at::date;
    end if;
    new.submitted_at := coalesce(new.submitted_at, now());
    return new;
  end if;

  raise exception 'transition % -> % is not allowed', old.status, new.status;
end;
$$;

drop trigger if exists gap_claims_guard on gap_claims;
create trigger gap_claims_guard
  before insert or update on gap_claims
  for each row execute function gap_claims_guard();

-- ---------------------------------------------------------------------------
-- 4. claim_gap(): the only door in
-- ---------------------------------------------------------------------------

create or replace function public.claim_gap(p_gap_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
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

  -- one row per (gap, person): revive a withdrawn claim rather than insert
  select * into existing from gap_claims where gap_id = p_gap_id and person_id = me;
  if found and existing.status <> 'withdrawn' then
    return jsonb_build_object('ok', false, 'code', 'already_claimed',
      'message', 'You already hold this gap (' || existing.status || ').');
  end if;

  -- capacity: live count, expired claims free their slot without waiting
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

  -- green-first, both halves: the first claim must be green, and amber stays
  -- locked until a green submission is in
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

-- ---------------------------------------------------------------------------
-- 5. submit_claim(): precheck first, submit only if no blocks
-- ---------------------------------------------------------------------------
-- Blocks keep the claim in 'claimed' so the student can fix and retry —
-- discovering a mechanical fault must cost an edit, not the claim.

create or replace function public.submit_claim(p_claim_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  c record;
  findings jsonb;
  has_block boolean;
begin
  select * into c from gap_claims where id = p_claim_id and person_id = current_person_id();
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'No such claim of yours.');
  end if;
  if c.status <> 'claimed' then
    return jsonb_build_object('ok', false, 'code', 'wrong_status',
      'message', 'Only an open claim can be submitted (this one is ' || c.status || ').');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired',
      'message', 'This claim expired on ' || c.expires_at::date || '. Re-claim the gap if slots remain.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('severity', severity, 'code', code, 'detail', detail)), '[]'::jsonb)
    into findings from precheck_submission(p_claim_id);
  has_block := jsonb_path_exists(findings, '$[*] ? (@."severity" == "block")');

  perform set_config('radlab.claim_flow', '1', true);
  if has_block then
    -- record what was found, stay claimed
    update gap_claims set precheck = findings, precheck_at = now() where id = p_claim_id;
    return jsonb_build_object('ok', false, 'code', 'blocked', 'findings', findings,
      'message', 'The precheck found problems that must be fixed before submitting.');
  end if;

  update gap_claims
  set status = 'submitted', submitted_at = now(), precheck = findings, precheck_at = now()
  where id = p_claim_id;

  return jsonb_build_object('ok', true, 'findings', findings);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. check_doi(): the immediate check, run the moment a DOI is pasted —
--    finding out a source is redundant must happen BEFORE 150 words are
--    written, not at submit
-- ---------------------------------------------------------------------------

create or replace function public.check_doi(p_gap_id uuid, p_doi text)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  g record;
  doi text := btrim(coalesce(p_doi, ''));
  out_ jsonb := '[]'::jsonb;
begin
  select * into g from page_gaps where id = p_gap_id;
  if not found or not is_course_member(g.course_id) then
    return jsonb_build_object('findings', jsonb_build_array(jsonb_build_object(
      'severity','block','code','not_found','detail','No such gap.')));
  end if;
  if doi = '' then
    return jsonb_build_object('findings', '[]'::jsonb);
  end if;

  if doi !~* '^(https?://(dx\.)?doi\.org/)?10\.[0-9]{4,9}/\S+$' then
    out_ := out_ || jsonb_build_object('severity','warn','code','doi_malformed',
      'detail','That does not look like a DOI (expected 10.xxxx/…).');
  end if;

  if exists (
    select 1 from wiki_page_versions v
    join ingest_jobs j on j.id = v.job_id
    where v.page_id = g.page_id and v.review_status = 'accepted'
      and j.source_citation ilike '%' || doi || '%')
  then
    out_ := out_ || jsonb_build_object('severity','warn','code','duplicate_source',
      'detail','This page already cites that source. It can still be right for a different claim — but bring something the page does not have if you can.');
  end if;

  if exists (
    select 1 from gap_claims o
    where o.gap_id = p_gap_id and o.person_id <> current_person_id()
      and o.status in ('submitted','accepted')
      and o.source_doi = doi)
  then
    out_ := out_ || jsonb_build_object('severity','block','code','duplicate_claim_source',
      'detail','Another submission for this gap already uses that source. Find a different one.');
  end if;

  return jsonb_build_object('findings', out_);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. gap_page_sources(): what the page already cites, shown in the claim
--    panel at the moment of choosing
-- ---------------------------------------------------------------------------

create or replace function public.gap_page_sources(p_gap_id uuid)
returns table(citation text)
language sql stable security definer set search_path to 'public'
as $$
  select distinct j.source_citation
  from page_gaps g
  join wiki_page_versions v on v.page_id = g.page_id and v.review_status = 'accepted'
  join ingest_jobs j on j.id = v.job_id
  where g.id = p_gap_id
    and is_course_member(g.course_id)
    and j.source_citation is not null
  order by 1
$$;

-- ---------------------------------------------------------------------------
-- 8. expire_claims(): hygiene sweep (counts already ignore expired rows, so
--    nothing breaks if this never runs)
-- ---------------------------------------------------------------------------

create or replace function public.expire_claims()
returns int
language plpgsql security definer set search_path to 'public'
as $$
declare n int;
begin
  perform set_config('radlab.claim_flow', '1', true);
  update gap_claims c
  set status = 'withdrawn',
      note = coalesce(c.note || ' · ', '') || 'expired ' || now()::date || ' (14-day claim TTL)'
  from page_gaps g
  where g.id = c.gap_id
    and is_course_staff(g.course_id)          -- caller must be staff for that course
    and c.status = 'claimed'
    and c.expires_at is not null and c.expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- withdrawn→claimed revival in the guard: expire_claims goes claimed→withdrawn,
-- allowed for non-staff too, but the staff join above scopes the sweep.

grant execute on function public.claim_gap(uuid)         to authenticated;
grant execute on function public.submit_claim(uuid)      to authenticated;
grant execute on function public.check_doi(uuid, text)   to authenticated;
grant execute on function public.gap_page_sources(uuid)  to authenticated;
grant execute on function public.expire_claims()         to authenticated;

-- ---------------------------------------------------------------------------
-- 9. gap_board() learns about expiry and hands the client its claim ids
-- ---------------------------------------------------------------------------

drop function if exists public.gap_board();
create or replace function public.gap_board()
returns table(
  lecture_no    int,
  week_no       int,
  meeting_date  date,
  lecture_title text,
  gap_id        uuid,
  slug          text,
  page_title    text,
  section       text,
  ask           text,
  difficulty    text,
  capacity      int,
  claims_active bigint,
  remaining     int,
  my_status     text,
  my_claim_id   uuid,
  my_expires_at timestamptz
)
language sql stable security definer set search_path to 'public'
as $$
  select cs.lecture_no, cs.week_no, cs.meeting_date, cs.title,
         g.id, g.slug, p.title, g.section, g.ask,
         g.difficulty, g.capacity,
         coalesce(held.n, 0),
         greatest(g.capacity - coalesce(held.n, 0)::int, 0),
         mine.status, mine.id, mine.expires_at
  from page_gaps g
  join wiki_pages p    on p.id = g.page_id
  join page_lectures pl on pl.page_id = p.id
  join course_structure cs
    on cs.course_id = pl.course_id and cs.lecture_no = pl.lecture_no
  left join lateral (
    select count(*) as n
    from gap_claims x
    where x.gap_id = g.id
      and (x.status in ('submitted','accepted')
           or (x.status = 'claimed' and (x.expires_at is null or x.expires_at > now())))
  ) held on true
  left join lateral (
    select x.id, x.status, x.expires_at
    from gap_claims x
    where x.gap_id = g.id
      and x.person_id = current_person_id()
      and x.status <> 'withdrawn'
    limit 1
  ) mine on true
  where g.status = 'open'
    and is_course_member(g.course_id)
  order by cs.week_no,
           case g.difficulty when 'green' then 0 when 'amber' then 1 else 2 end,
           g.slug, g.section nulls first
$$;

grant execute on function public.gap_board() to authenticated;
