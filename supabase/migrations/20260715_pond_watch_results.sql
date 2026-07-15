-- PondWatch (Go/No-Go reaction-time task) — per-session results.
-- One row per completed game session. Wired into the study step flow via
-- GameStepWrapper (subcategory 'pond_watch'); the game self-persists here.
--
-- RLS follows the game-table convention (see CLAUDE.md): own-rows for the
-- authenticated participant, plus lab full access via my_role().

create table if not exists public.pond_watch_results (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  study_id            uuid,
  external_id         text,
  schedule_id         uuid,          -- participant_schedule row (distinguishes baseline vs post); null in standalone play
  started_at          timestamptz,
  ended_at            timestamptz,
  hit_rate            numeric,
  false_alarm_rate    numeric,
  d_prime             numeric,
  criterion           numeric,
  median_rt_ms        integer,
  rt_sd_ms            integer,
  accuracy            numeric,
  hits                integer,
  misses              integer,
  false_alarms        integer,
  correct_rejections  integer,
  n_trials            integer,
  trials              jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists pond_watch_results_user_idx     on public.pond_watch_results (user_id);
create index if not exists pond_watch_results_schedule_idx on public.pond_watch_results (schedule_id);

alter table public.pond_watch_results enable row level security;

-- Participant: full access to their own rows.
create policy "own rows"
  on public.pond_watch_results
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Lab: full access to all rows.
create policy "pond_watch_results: lab write"
  on public.pond_watch_results
  for all
  to authenticated
  using (my_role() = 'lab')
  with check (my_role() = 'lab');
