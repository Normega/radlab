-- 20260724_academic_init.sql
-- Initial migration for the radlab-academic Supabase project.
-- One project hosts many courses. Every activity row is scoped by course_id
-- and references an opaque person_id, never email or name.
-- Identity (PII) lives in its own schema, separated from activity data.

-- =====================================================================
-- 1. IDENTITY SCHEMA (PII lives here and only here)
-- =====================================================================

create schema if not exists identity;

create table identity.people (
  id uuid primary key default gen_random_uuid(),   -- opaque person_id used everywhere else
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  email text unique not null,
  full_name text,
  created_at timestamptz default now()
);

alter table identity.people enable row level security;

-- People can read only their own identity row
create policy "read own person row"
  on identity.people for select
  to authenticated
  using (auth_user_id = auth.uid());

-- Helper: resolve the caller's person_id without granting broad identity access.
-- SECURITY DEFINER so RLS policies elsewhere can call it.
create or replace function public.current_person_id()
returns uuid
language sql
security definer
set search_path = identity, public
stable
as $$
  select id from identity.people where auth_user_id = auth.uid()
$$;

-- =====================================================================
-- 2. COURSES AND ENROLLMENTS
-- =====================================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,              -- e.g. 'PSY240'
  name text not null,              -- e.g. 'Field Guide to Abnormal Psychology'
  term text not null,              -- e.g. '2026F'
  created_at timestamptz default now(),
  unique (code, term)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references identity.people (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  role text not null check (role in ('student', 'ta', 'instructor')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  unique (person_id, course_id)
);

alter table public.courses enable row level security;
alter table public.enrollments enable row level security;

-- Anyone authenticated can see course listings
create policy "read courses"
  on public.courses for select
  to authenticated
  using (true);

-- People can read their own enrollments only
create policy "read own enrollments"
  on public.enrollments for select
  to authenticated
  using (person_id = public.current_person_id());

-- =====================================================================
-- 3. STAFF INVITES (allowlist before registration)
-- =====================================================================
-- Solves the chicken-and-egg problem: you allowlist an email before the
-- person has registered. When they sign up with that email, a trigger
-- creates their identity row and consumes any matching invites into
-- enrollments. The same pattern extends to the student roster CSV later.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  course_id uuid not null references public.courses (id) on delete cascade,
  role text not null check (role in ('student', 'ta', 'instructor')),
  consumed_at timestamptz,
  created_at timestamptz default now(),
  unique (email, course_id)
);

alter table public.invites enable row level security;
-- No policies for authenticated: invites are managed by service role only.
-- (RLS enabled + no policy = invisible to clients, which is what we want here.)

-- On new auth signup: create identity row, consume matching invites
create or replace function identity.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = identity, public
as $$
declare
  new_person_id uuid;
begin
  insert into identity.people (auth_user_id, email)
  values (new.id, new.email)
  returning id into new_person_id;

  insert into public.enrollments (person_id, course_id, role)
  select new_person_id, i.course_id, i.role
  from public.invites i
  where i.email = new.email and i.consumed_at is null;

  update public.invites
  set consumed_at = now()
  where email = new.email and consumed_at is null;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function identity.handle_new_user();

-- =====================================================================
-- 4. INGEST JOBS (course-scoped, no PII)
-- =====================================================================

create table public.ingest_jobs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  created_by uuid not null references identity.people (id),  -- opaque person_id
  pdf_path text not null,
  pdf_mode text not null check (pdf_mode in ('native', 'extracted')),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'done', 'failed')),
  input_tokens int,
  output_tokens int,
  result_json jsonb,
  error text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.ingest_jobs enable row level security;

-- Staff of a course can read that course's jobs
create policy "staff read course jobs"
  on public.ingest_jobs for select
  to authenticated
  using (exists (
    select 1 from public.enrollments e
    where e.person_id = public.current_person_id()
      and e.course_id = ingest_jobs.course_id
      and e.role in ('ta', 'instructor')
      and e.status = 'active'
  ));

-- Inserts and updates happen via the serverless function (service role), no
-- authenticated write policies needed.

-- =====================================================================
-- 5. STORAGE POLICY (bucket 'ingest-pdfs' created in dashboard first)
-- =====================================================================

create policy "staff upload pdfs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ingest-pdfs'
    and exists (
      select 1 from public.enrollments e
      where e.person_id = public.current_person_id()
        and e.role in ('ta', 'instructor')
        and e.status = 'active'
    )
  );

-- =====================================================================
-- 6. SEED DATA (edit emails before running)
-- =====================================================================

insert into public.courses (code, name, term)
values ('PSY240', 'Field Guide to Abnormal Psychology', '2026F');

insert into public.invites (email, course_id, role)
select v.email, c.id, v.role
from (values
  ('norman.farb@utoronto.ca', 'instructor'),
  ('ta@utoronto.ca', 'ta')
) as v(email, role)
cross join public.courses c
where c.code = 'PSY240' and c.term = '2026F';
