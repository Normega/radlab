-- Step 0: add 'audio' to task_type enum (if using an enum type)
-- alter type task_type add value 'audio';

-- Step 1: audio tables, RLS, and completion RPC

create table study_audios (
  id uuid primary key default gen_random_uuid(),
  study_task_id uuid references study_tasks(id) on delete set null,
  storage_path text not null,
  duration_seconds integer,
  required_listen_pct numeric default 0.90,
  title text,
  created_at timestamptz default now()
);

create table participant_audio_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references profiles(id) on delete cascade,
  audio_id uuid references study_audios(id) on delete cascade,
  started_at timestamptz default now(),
  completed_at timestamptz,
  seconds_listened integer default 0,
  listen_pct numeric default 0,
  focus_loss_count integer default 0,
  is_complete boolean default false
);

create table participant_audio_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references participant_audio_sessions(id) on delete cascade,
  event_type text check (event_type in ('started','focus_lost','focus_returned','completed')),
  audio_position_seconds numeric,
  created_at timestamptz default now(),
  metadata jsonb
);

alter table study_audios enable row level security;
alter table participant_audio_sessions enable row level security;
alter table participant_audio_events enable row level security;

create policy "authenticated read study_audios"
  on study_audios for select to authenticated using (true);

create policy "admin manage study_audios"
  on study_audios for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "own audio sessions"
  on participant_audio_sessions for all to authenticated
  using (participant_id = auth.uid());

create policy "own audio events"
  on participant_audio_events for all to authenticated
  using (exists (
    select 1 from participant_audio_sessions s
    where s.id = session_id and s.participant_id = auth.uid()
  ));

create or replace function complete_audio_session(
  p_session_id uuid,
  p_seconds_listened integer,
  p_listen_pct numeric
)
returns void
language plpgsql
security definer
as $$
begin
  update participant_audio_sessions
  set
    completed_at = now(),
    seconds_listened = p_seconds_listened,
    listen_pct = p_listen_pct,
    is_complete = true
  where id = p_session_id
    and participant_id = auth.uid();
end;
$$;
