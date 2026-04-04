-- ============================================================
-- RADlab · Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================


-- ── PROFILES ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  role                text not null default 'public' check (role in ('lab', 'participant', 'public')),
  display_name        text,
  study_id            uuid,   -- FK to studies added below after studies table exists
  created_at          timestamptz not null default now(),
  onboarding_complete bool not null default false
);

alter table public.profiles enable row level security;

-- ── HELPER: get current user's role (security definer bypasses RLS) ──────────
-- Must be created after profiles table exists.
create or replace function public.my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

-- Own profile: read + update
create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- Lab members: read all profiles
create policy "profiles: lab read all"
  on public.profiles for select
  using (public.my_role() = 'lab');

-- Lab members: update any profile (e.g. assign study_id, change role)
create policy "profiles: lab update all"
  on public.profiles for update
  using (public.my_role() = 'lab');


-- ── STUDIES ──────────────────────────────────────────────────────────────────
create table public.studies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references public.profiles(id),
  protocol   jsonb not null default '[]',
  active     bool not null default true
);

alter table public.studies enable row level security;

-- Lab members: full access
create policy "studies: lab full access"
  on public.studies for all
  using (public.my_role() = 'lab')
  with check (public.my_role() = 'lab');

-- Participants: read their assigned study
create policy "studies: participant read own"
  on public.studies for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.study_id = studies.id
    )
  );

-- Add FK from profiles → studies (now that studies exists)
alter table public.profiles
  add constraint profiles_study_id_fkey
  foreign key (study_id) references public.studies(id);


-- ── GAME SESSIONS ─────────────────────────────────────────────────────────────
create table public.game_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_name  text not null,
  study_id   uuid references public.studies(id),
  is_test    bool not null default false,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);

alter table public.game_sessions enable row level security;

create policy "game_sessions: own all"
  on public.game_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "game_sessions: lab read all"
  on public.game_sessions for select
  using (public.my_role() = 'lab');


-- ── TRIALS ───────────────────────────────────────────────────────────────────
create table public.trials (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.game_sessions(id) on delete cascade,
  trial_number     int not null,
  stimulus_type    text not null,
  is_target        bool not null,
  responded        bool not null,
  reaction_time_ms int
);

alter table public.trials enable row level security;

create policy "trials: own via session"
  on public.trials for all
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = trials.session_id and gs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = trials.session_id and gs.user_id = auth.uid()
    )
  );

create policy "trials: lab read all"
  on public.trials for select
  using (public.my_role() = 'lab');


-- ── PERFORMANCE ──────────────────────────────────────────────────────────────
create table public.performance (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.game_sessions(id) on delete cascade,
  hit_rate         float,
  false_alarm_rate float,
  d_prime          float,
  criterion        float,
  median_rt_ms     float,
  rt_sd_ms         float,
  accuracy         float,
  threshold        float,
  slope            float
);

alter table public.performance enable row level security;

create policy "performance: own via session"
  on public.performance for all
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = performance.session_id and gs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = performance.session_id and gs.user_id = auth.uid()
    )
  );

create policy "performance: lab read all"
  on public.performance for select
  using (public.my_role() = 'lab');


-- ── QUESTIONNAIRE RESPONSES ───────────────────────────────────────────────────
create table public.questionnaire_responses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  questionnaire_slug text not null,
  session_id         uuid references public.game_sessions(id),
  responses          jsonb not null default '{}',
  completed_at       timestamptz not null default now()
);

alter table public.questionnaire_responses enable row level security;

create policy "questionnaire_responses: own all"
  on public.questionnaire_responses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "questionnaire_responses: lab read all"
  on public.questionnaire_responses for select
  using (public.my_role() = 'lab');


-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    'public'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── BACKFILL EXISTING USERS ───────────────────────────────────────────────────
-- Creates profile rows for any auth users who signed up before this schema ran.
insert into public.profiles (id, display_name, role)
select
  au.id,
  au.raw_user_meta_data ->> 'display_name',
  'public'
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;
