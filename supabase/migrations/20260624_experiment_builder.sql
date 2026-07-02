-- Experiment Builder Phase 1: additive migration
-- Nothing dropped or renamed. study_protocols family left orphaned until WP6 verified.

-- studies: design graph columns + max_attempts
-- reminder_interval_hours already exists (no default); set the default now.
alter table studies
  add column if not exists design_graph   jsonb,
  add column if not exists design_seed    text,
  add column if not exists design_version int default 1,
  add column if not exists max_attempts   int default 1;

alter table studies
  alter column reminder_interval_hours set default 24;

-- participant_schedule: realized day number for {{study_day}} email var
alter table participant_schedule
  add column if not exists study_day int;

-- study_sessions: map compiled slot back to its graph node
alter table study_sessions
  add column if not exists node_key text;

-- participant_assignments: audit + reproducibility for forks (written from Phase 2)
create table if not exists participant_assignments (
  id             uuid        primary key default gen_random_uuid(),
  participant_id uuid        not null references profiles(id),
  study_id       uuid        not null references studies(id) on delete cascade,
  node_id        text        not null,
  kind           text        not null check (kind in ('randomize','counterbalance')),
  value          jsonb       not null,
  draw_index     int         not null,
  created_at     timestamptz default now(),
  unique (study_id, node_id, draw_index)
);

alter table participant_assignments enable row level security;

create policy "lab all"
  on participant_assignments for all
  to authenticated
  using  (exists (select 1 from profiles where id = auth.uid() and role = 'lab'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'lab'));

create policy "participant select own"
  on participant_assignments for select
  to authenticated
  using (participant_id = auth.uid());

-- study_enrollments: email opt-out flag
-- 20260602 consolidated consent onto study_enrollments; opt-out joins it here.
alter table study_enrollments
  add column if not exists email_reminders       bool default true,
  add column if not exists email_unsubscribed_at timestamptz;
