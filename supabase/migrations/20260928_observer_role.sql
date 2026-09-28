-- An observer role for course members who read along but are not students (radlab-academic).
--
-- PSY240's Facilitated Study Group staff (five leaders, then their coordinator on 2026-09-28)
-- were added as students because no other role existed. That worked for access and nothing
-- else: the 2026-09-21 roster reconcile listed all five as "absent from upload" (they are not on
-- the registrar's class list) and they were marked dropped; the tracking page and its CSV — the
-- grading export — listed them as students with zero contributions, distinguishable only by a
-- free-text note; and nothing stopped one from claiming a gap, which would take a slot from a
-- student. Norm asked for a real role (2026-09-28).
--
-- An observer is a course member (is_course_member is true: they read the Guide, the gap board,
-- the how-to pages) who is not staff (is_course_staff is false) and not a student:
--   * enrollments.role gains 'observer';
--   * identity.roster gains role ('student' | 'observer'), so an observer who first signs in
--     through the join door is enrolled AS an observer — enroll_from_roster() copies it;
--   * roster_upsert() never lists an observer as absent from an upload — they are not expected
--     on the registrar's list, so their absence says nothing;
--   * contribution_tracking() leaves observers out, so the tracking page and its CSV are
--     students only;
--   * claim_gap() refuses an observer with a plain message (they can still read every gap);
--   * roster_admin() returns role, and roster_set_role() lets staff switch a roster entry
--     between student and observer, carrying the change to the enrollment if one exists.
-- The six FSG rows are assigned at the end, and the five marked dropped by the reconcile are
-- restored to their real state (enrolled — each has an active enrollment and has signed in).

-- ── schema ───────────────────────────────────────────────────────────────────
alter table public.enrollments drop constraint enrollments_role_check;
alter table public.enrollments add constraint enrollments_role_check
  check (role = any (array['student', 'ta', 'instructor', 'observer']));

alter table identity.roster add column if not exists role text not null default 'student';
alter table identity.roster drop constraint if exists roster_role_check;
alter table identity.roster add constraint roster_role_check check (role in ('student', 'observer'));

-- ── enroll_from_roster: the roster row's role becomes the enrollment's ───────
create or replace function public.enroll_from_roster()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email  text;
  v_person uuid;
  v_row    identity.roster%rowtype;
  v_ids    uuid[] := '{}';
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then
    return jsonb_build_object('enrolled', false, 'reason', 'no session');
  end if;

  select p.id into v_person from identity.people p where p.auth_user_id = auth.uid();
  if v_person is null then
    insert into identity.people (auth_user_id, email) values (auth.uid(), v_email)
    returning id into v_person;
  end if;

  -- EVERY non-dropped roster row for this mailbox, not the first one found.
  for v_row in
    select * from identity.roster
    where email_match_key = normalize_uoft_email(v_email)
      and status <> 'dropped'
    order by course_id
  loop
    insert into public.enrollments (person_id, course_id, role)
    values (v_person, v_row.course_id, coalesce(v_row.role, 'student'))
    on conflict (person_id, course_id) do nothing;

    update identity.roster
    set status = 'enrolled', enrolled_at = coalesce(enrolled_at, now()), person_id = v_person
    where id = v_row.id;

    v_ids := v_ids || v_row.course_id;
  end loop;

  if array_length(v_ids, 1) is null then
    return jsonb_build_object('enrolled', false, 'reason', 'not on roster');
  end if;

  return jsonb_build_object('enrolled', true, 'course_id', v_ids[1], 'courses', to_jsonb(v_ids));
end;
$function$;

-- ── roster_upsert: observers are never "absent from upload" ─────────────────
create or replace function public.roster_upsert(p_course_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'identity'
as $function$
declare
  v_inserted int := 0;
  v_updated  int := 0;
  v_skipped  int := 0;
  r jsonb;
  v_email text; v_key text; v_name text; v_num text;
  v_existing uuid;
  v_keys text[] := '{}';
  v_absent   jsonb := '[]'::jsonb;
  v_returned jsonb := '[]'::jsonb;
begin
  if not is_course_staff(p_course_id) then
    raise exception 'staff only';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_email := btrim(coalesce(r->>'email',''));
    v_name  := btrim(coalesce(r->>'full_name',''));
    v_num   := nullif(btrim(coalesce(r->>'student_number','')),'');
    v_key   := normalize_uoft_email(v_email);
    if v_email = '' or v_name = '' or v_key !~ '@' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_keys := v_keys || v_key;

    select id into v_existing from identity.roster
    where course_id = p_course_id and email_match_key = v_key;

    if v_existing is null then
      insert into identity.roster (course_id, full_name, student_number, email, email_match_key)
      values (p_course_id, v_name, v_num, v_email, v_key);
      v_inserted := v_inserted + 1;
    else
      update identity.roster
      set full_name = v_name,
          student_number = coalesce(v_num, student_number),
          email = v_email
      where id = v_existing;
      v_updated := v_updated + 1;
    end if;
  end loop;

  -- The reconcile diff. Only when at least one row validated: an upload where
  -- every row was skipped says nothing about who is absent. Observers are not
  -- on the registrar's list by definition, so their absence is not news.
  if array_length(v_keys, 1) > 0 then
    select coalesce(jsonb_agg(
             jsonb_build_object('id', id, 'full_name', full_name, 'email', email, 'status', status)
             order by full_name), '[]'::jsonb)
      into v_absent
      from identity.roster
     where course_id = p_course_id
       and status <> 'dropped'
       and role <> 'observer'
       and not (email_match_key = any(v_keys));

    select coalesce(jsonb_agg(
             jsonb_build_object('id', id, 'full_name', full_name, 'email', email, 'status', status)
             order by full_name), '[]'::jsonb)
      into v_returned
      from identity.roster
     where course_id = p_course_id
       and status = 'dropped'
       and email_match_key = any(v_keys);
  end if;

  return jsonb_build_object(
    'inserted', v_inserted, 'updated', v_updated, 'skipped', v_skipped,
    'absent', v_absent, 'returned', v_returned
  );
end;
$function$;

-- ── contribution_tracking: students only ─────────────────────────────────────
create or replace function public.contribution_tracking(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'identity'
as $function$
BEGIN
  IF NOT is_course_staff(p_course_id) THEN
    RAISE EXCEPTION 'staff only';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'roster_id',   r.id,
      'full_name',   r.full_name,
      'email',       r.email,
      'status',      r.status,
      'person_id',   r.person_id,
      'open_claims', COALESCE(c.open_claims, 0),
      'pending',     COALESCE(c.pending, 0),
      'sent_back',   COALESCE(c.sent_back, 0),
      'approved',    COALESCE(c.approved, 0)
    ) ORDER BY r.full_name, r.email)
    FROM identity.roster r
    LEFT JOIN (
      SELECT gc.person_id,
        count(*) FILTER (WHERE gc.status = 'claimed'  AND gc.note IS NULL)     AS open_claims,
        count(*) FILTER (WHERE gc.status = 'submitted')                        AS pending,
        count(*) FILTER (WHERE gc.status = 'claimed'  AND gc.note IS NOT NULL) AS sent_back,
        count(*) FILTER (WHERE gc.status = 'accepted')                         AS approved
      FROM gap_claims gc
      GROUP BY gc.person_id
    ) c ON c.person_id = r.person_id
    WHERE r.course_id = p_course_id
      AND r.role <> 'observer'
  ), '[]'::jsonb);
END;
$function$;

-- ── roster_admin: return role (a new column, so drop and recreate) ──────────
drop function if exists public.roster_admin(uuid);
create function public.roster_admin(p_course_id uuid)
returns table (id uuid, full_name text, student_number text, email text, status text,
               invited_at timestamptz, last_invited_at timestamptz, invite_count integer,
               enrolled_at timestamptz, notes text, role text)
language sql
stable
security definer
set search_path to 'public', 'identity'
as $function$
  select r.id, r.full_name, r.student_number, r.email, r.status,
         r.invited_at, r.last_invited_at, r.invite_count, r.enrolled_at, r.notes, r.role
  from identity.roster r
  where r.course_id = p_course_id
    and is_course_staff(p_course_id)
  order by r.full_name
$function$;
revoke all on function public.roster_admin(uuid) from public, anon;
grant execute on function public.roster_admin(uuid) to authenticated, service_role;

-- ── roster_set_role: staff switch student <-> observer ───────────────────────
create or replace function public.roster_set_role(p_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path to 'public', 'identity'
as $function$
declare
  v_row identity.roster%rowtype;
begin
  select * into v_row from identity.roster where id = p_id;
  if not found then raise exception 'no such roster row'; end if;
  if not is_course_staff(v_row.course_id) then raise exception 'staff only'; end if;
  if p_role not in ('student', 'observer') then
    raise exception 'role must be student or observer';
  end if;

  update identity.roster
     set role = p_role,
         notes = coalesce(notes || ' | ', '') || 'role ' || p_role || ' ' || current_date
   where id = p_id and role <> p_role;

  -- Carry it to the enrollment when there is one; a TA or instructor
  -- enrollment is never demoted from here.
  if v_row.person_id is not null then
    update public.enrollments
       set role = p_role
     where person_id = v_row.person_id and course_id = v_row.course_id
       and role in ('student', 'observer');
  end if;
end;
$function$;
revoke all on function public.roster_set_role(uuid, text) from public, anon;
grant execute on function public.roster_set_role(uuid, text) to authenticated, service_role;

-- ── claim_gap: observers read the board but do not claim ─────────────────────
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

  if exists (select 1 from enrollments e
             where e.person_id = me and e.course_id = g.course_id
               and e.status = 'active' and e.role = 'observer') then
    return jsonb_build_object('ok', false, 'code', 'observer',
      'message', 'Observers can read every gap but don''t claim them — claims are for enrolled students.');
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

-- ── assign PSY240's Facilitated Study Group staff ────────────────────────────
update identity.roster r
   set role = 'observer',
       status = case when r.status = 'dropped' and r.person_id is not null then 'enrolled' else r.status end,
       notes = coalesce(r.notes || ' | ', '') || 'role observer 2026-09-28'
         || case when r.status = 'dropped' and r.person_id is not null
                 then ' (restored from reconcile drop: observers are not on the registrar list)' else '' end
  from public.courses c
 where c.id = r.course_id and c.code = 'PSY240'
   and r.email_match_key in ('ysamson.girma@utoronto.ca', 'amrita.sekhon@utoronto.ca',
                             'vedika.awtani@utoronto.ca', 'humnah.tanveer@utoronto.ca',
                             'umme.rizvi@utoronto.ca', 'tishyaa.kapoor@utoronto.ca');

update public.enrollments e
   set role = 'observer'
  from identity.roster r
 where r.role = 'observer' and r.person_id = e.person_id and r.course_id = e.course_id
   and e.role = 'student';
