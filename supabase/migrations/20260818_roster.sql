-- WP5: roster & enrollment (plan §2a). The roster is the single course-identity
-- authority: names and student numbers are PII, so it lives in the `identity`
-- schema with NO client-reachable policies — every read and write goes through
-- a staff-gated SECURITY DEFINER function or the service role (the serverless
-- invite/join endpoints), matching the get_class_participation pattern.
--
-- Status flow: added → invited → enrolled, plus bounced (a bad address must be
-- distinguishable from an unmotivated student) and dropped. `enrolled` means
-- one thing only: the person who controls that mailbox clicked a link
-- (enroll_from_roster runs under an authenticated session, and sessions on
-- this project only come from a clicked email link or a confirmed signup).

create table if not exists identity.roster (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references public.courses(id),
  full_name       text not null,
  student_number  text,
  email           text not null,
  email_match_key text not null,
  status          text not null default 'added'
                  check (status in ('added','invited','enrolled','bounced','dropped')),
  invited_at      timestamptz,
  last_invited_at timestamptz,
  invite_count    integer not null default 0,
  enrolled_at     timestamptz,
  person_id       uuid references identity.people(id),
  notes           text,
  created_at      timestamptz not null default now(),
  unique (course_id, email_match_key)
);

create index if not exists roster_course_status_idx on identity.roster (course_id, status);

-- The unmatched-QR-attempt queue (§2a.4): the commonest real failure is a
-- student typing a personal address. These land here for staff to resolve
-- rather than failing silently. IP is stored as a hash — enough to spot abuse,
-- not a browsing log.
create table if not exists identity.roster_match_attempts (
  id           uuid primary key default gen_random_uuid(),
  submitted    text not null,
  match_key    text not null,
  ip_hash      text,
  submitted_at timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references identity.people(id),
  note         text
);

alter table identity.roster enable row level security;
alter table identity.roster_match_attempts enable row level security;
-- No policies on either: service-role and SECURITY DEFINER access only.

-- Email normalization (§2a.5): ACORN gives @mail.utoronto.ca, students type
-- @utoronto.ca (same mailbox), alum. exists too. Collapse all three to one
-- canonical form and match on that, never on raw input.
create or replace function public.normalize_uoft_email(p_email text)
returns text language sql immutable
as $$
  select regexp_replace(
    lower(btrim(coalesce(p_email,''))),
    '@(mail\.|alum\.)?utoronto\.ca$',
    '@utoronto.ca'
  )
$$;

-- CSV import, staff-gated. Idempotent on (course_id, email_match_key): a
-- re-upload updates name/student number on existing rows and never regresses
-- status — so importing next week's ACORN export cannot un-enroll anyone.
create or replace function public.roster_upsert(p_course_id uuid, p_rows jsonb)
returns jsonb language plpgsql security definer
set search_path to 'public', 'identity'
as $$
declare
  v_inserted int := 0;
  v_updated  int := 0;
  v_skipped  int := 0;
  r jsonb;
  v_email text; v_key text; v_name text; v_num text;
  v_existing uuid;
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

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'skipped', v_skipped);
end;
$$;

-- Staff read of the roster. A function, not a view with policies, so the
-- gate is explicit and the table stays closed.
create or replace function public.roster_admin(p_course_id uuid)
returns table (
  id uuid, full_name text, student_number text, email text, status text,
  invited_at timestamptz, last_invited_at timestamptz, invite_count int,
  enrolled_at timestamptz, notes text
) language sql stable security definer
set search_path to 'public', 'identity'
as $$
  select r.id, r.full_name, r.student_number, r.email, r.status,
         r.invited_at, r.last_invited_at, r.invite_count, r.enrolled_at, r.notes
  from identity.roster r
  where r.course_id = p_course_id
    and is_course_staff(p_course_id)
  order by r.full_name
$$;

-- Manual status control (bounced / dropped / back to added). Never sets
-- 'enrolled' — that transition belongs to enroll_from_roster alone.
create or replace function public.roster_set_status(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer
set search_path to 'public', 'identity'
as $$
declare v_course uuid;
begin
  select course_id into v_course from identity.roster where id = p_id;
  if v_course is null then raise exception 'no such roster row'; end if;
  if not is_course_staff(v_course) then raise exception 'staff only'; end if;
  if p_status not in ('added','invited','bounced','dropped') then
    raise exception 'status must be added, invited, bounced or dropped — enrolled is earned by clicking the link, not assigned';
  end if;
  update identity.roster
  set status = p_status,
      notes = case when p_note is null then notes
                   else coalesce(notes,'') || ' | ' || p_note end
  where id = p_id;
end;
$$;

-- The enrollment moment (§2a.4): runs as the signed-in user, whose session
-- exists only because they clicked an emailed link (magic link) or confirmed
-- a signup — either way the mailbox is proven. Matches the auth email against
-- the roster on the normalized key and grants the student enrollment.
create or replace function public.enroll_from_roster()
returns jsonb language plpgsql security definer
set search_path to 'public', 'identity'
as $$
declare
  v_email text;
  v_person uuid;
  v_row identity.roster%rowtype;
begin
  select u.email into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then
    return jsonb_build_object('enrolled', false, 'reason', 'no session');
  end if;

  select p.id into v_person from identity.people p where p.auth_user_id = auth.uid();
  if v_person is null then
    -- handle_new_user creates people rows for every auth user; this is a
    -- belt-and-braces path for accounts that predate that trigger.
    insert into identity.people (auth_user_id, email) values (auth.uid(), v_email)
    returning id into v_person;
  end if;

  select * into v_row from identity.roster
  where email_match_key = normalize_uoft_email(v_email)
    and status <> 'dropped'
  limit 1;
  if v_row.id is null then
    return jsonb_build_object('enrolled', false, 'reason', 'not on roster');
  end if;

  insert into public.enrollments (person_id, course_id, role)
  values (v_person, v_row.course_id, 'student')
  on conflict (person_id, course_id) do nothing;

  update identity.roster
  set status = 'enrolled', enrolled_at = coalesce(enrolled_at, now()), person_id = v_person
  where id = v_row.id;

  return jsonb_build_object('enrolled', true, 'course_id', v_row.course_id);
end;
$$;

-- The unmatched queue, staff side.
create or replace function public.roster_attempts(p_course_id uuid)
returns table (id uuid, submitted text, submitted_at timestamptz, resolved_at timestamptz, note text)
language sql stable security definer
set search_path to 'public', 'identity'
as $$
  select a.id, a.submitted, a.submitted_at, a.resolved_at, a.note
  from identity.roster_match_attempts a
  where is_course_staff(p_course_id)
  order by a.submitted_at desc
  limit 200
$$;

create or replace function public.roster_resolve_attempt(p_course_id uuid, p_id uuid, p_note text default null)
returns void language plpgsql security definer
set search_path to 'public', 'identity'
as $$
begin
  if not is_course_staff(p_course_id) then raise exception 'staff only'; end if;
  update identity.roster_match_attempts
  set resolved_at = now(),
      resolved_by = current_person_id(),
      note = coalesce(p_note, note)
  where id = p_id;
end;
$$;

do $$ begin
  revoke all on function public.roster_upsert(uuid, jsonb) from public, anon;
  revoke all on function public.roster_admin(uuid) from public, anon;
  revoke all on function public.roster_set_status(uuid, text, text) from public, anon;
  revoke all on function public.enroll_from_roster() from public, anon;
  revoke all on function public.roster_attempts(uuid) from public, anon;
  revoke all on function public.roster_resolve_attempt(uuid, uuid, text) from public, anon;
  grant execute on function public.roster_upsert(uuid, jsonb) to authenticated;
  grant execute on function public.roster_admin(uuid) to authenticated;
  grant execute on function public.roster_set_status(uuid, text, text) to authenticated;
  grant execute on function public.enroll_from_roster() to authenticated;
  grant execute on function public.roster_attempts(uuid) to authenticated;
  grant execute on function public.roster_resolve_attempt(uuid, uuid, text) to authenticated;
end $$;
