-- TA review sections (Norm, 2026-09-08): the course divides into surname
-- ranges and each TA's Submissions queue defaults to their own third.
--
-- A SOFT division of labour, not a privacy boundary — staff can already see
-- every submission, and the queue keeps an "Everyone" tab so absence cover
-- needs no admin action. Stored as data so ranges can be rebalanced or
-- reassigned mid-term with an UPDATE, without touching code.
--
-- Rows are matched to the signed-in TA by email; students are matched by the
-- LAST word of their roster full name. Anything unclassifiable (missing
-- name, email-only fallback) deliberately shows in EVERY section's "mine"
-- view: a submission must never be invisible to its reviewer.

create table public.review_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  ta_email text not null,
  label text not null,
  surname_from text not null,  -- inclusive first letter, e.g. 'A'
  surname_to text not null,    -- inclusive last letter, e.g. 'G'
  created_at timestamptz not null default now(),
  unique (course_id, ta_email)
);

alter table public.review_sections enable row level security;

create policy "staff read sections"
  on public.review_sections for select
  to authenticated
  using (exists (
    select 1 from enrollments e
    where e.person_id = current_person_id()
      and e.course_id = review_sections.course_id
      and e.role in ('ta','instructor') and e.status = 'active'
  ));
-- No client write policies: sections are managed by service role only.

-- Seed PSY240's three sections from the actual roster distribution
-- (224 real students -> 69 / 77 / 78), TAs assigned alphabetically.
insert into public.review_sections (course_id, ta_email, label, surname_from, surname_to)
select c.id, v.email, v.label, v.f, v.t
from public.courses c
cross join (values
  ('nidal.chaudhry@mail.utoronto.ca',  'A–G', 'A', 'G'),
  ('maryam.fazili@mail.utoronto.ca',   'H–N', 'H', 'N'),
  ('whitney.mambou@mail.utoronto.ca',  'O–Z', 'O', 'Z')
) as v(email, label, f, t)
where c.code = 'PSY240' and c.term = '2026F';
