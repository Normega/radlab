-- 20260811_workbench_sessions.sql
--
-- Workbench: sharing Claude Code sessions with lab members.
--
-- Capture is unconditional; *sharing* is what controls visibility. Every session
-- pushed by the hook lands here whether or not anyone can see it, because the
-- alternative — deciding at capture time — means a session becomes shareable only
-- if Norm predicted the interest before the work happened. Nothing is visible to
-- anyone but a super admin until a row exists in claude_session_shares or
-- claude_project_shares.
--
-- Note the tier this sits on: `profiles.role = 'lab'` already grants /admin/*, so
-- "is a lab member" is NOT a meaningful gate here — every student in the lab holds
-- that role. The share tables are the whole access control story, and the
-- association console is super-admin-only for the same reason.
--
-- Turns are append-only (PK on (session_id, seq)) rather than a snapshot column.
-- That buys three things at once: live updates are cheap inserts instead of
-- rewriting a growing blob, a re-push after a lost high-water mark is a no-op
-- instead of a duplicate, and session history is kept for free — nothing ever
-- overwrites a turn that was already published.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.claude_sessions (
  id             uuid primary key,        -- Claude Code's own session_id; NOT generated here
  project_key    text        not null,    -- normalized cwd (forward slashes, lowercased)
  project_label  text,                    -- last path segment, for display
  cwd            text,
  git_branch     text,
  title          text,                    -- distilled from the first user prompt
  turn_count     integer     not null default 0,
  started_at     timestamptz not null default now(),
  last_turn_at   timestamptz,
  last_push_at   timestamptz not null default now(),
  ended_at       timestamptz,
  end_reason     text
);

create index if not exists claude_sessions_project_key_idx on public.claude_sessions (project_key);
create index if not exists claude_sessions_last_turn_idx   on public.claude_sessions (last_turn_at desc nulls last);

comment on table public.claude_sessions is
  'One row per Claude Code session pushed by the workbench hook. Visibility is governed entirely by claude_session_shares / claude_project_shares.';

create table if not exists public.claude_session_turns (
  session_id  uuid        not null references public.claude_sessions (id) on delete cascade,
  seq         integer     not null,
  role        text        not null check (role in ('user', 'assistant')),
  body        text,                                        -- prose only; capped by the hook
  tools       jsonb       not null default '[]'::jsonb,     -- [{name, headline}] — headlines, never output
  at          timestamptz not null,
  primary key (session_id, seq)
);

comment on column public.claude_session_turns.tools is
  'Tool headlines only — name plus a one-line description of the input. Tool OUTPUT is never stored: that is the choice that keeps credentials, participant rows and file contents out of this table by construction rather than by scrubbing.';

create table if not exists public.claude_session_shares (
  session_id uuid        not null references public.claude_sessions (id) on delete cascade,
  profile_id uuid        not null references public.profiles (id) on delete cascade,
  shared_at  timestamptz not null default now(),
  shared_by  uuid        references public.profiles (id) on delete set null,
  primary key (session_id, profile_id)
);

create index if not exists claude_session_shares_profile_idx on public.claude_session_shares (profile_id);

-- A standing rule: everything in this project directory goes to this member,
-- past sessions included. Deliberately not a snapshot — revoking the rule
-- revokes the whole project, which is the behaviour the phrase "standing rule"
-- implies and the one that is safe to reason about under pressure.
create table if not exists public.claude_project_shares (
  project_key text        not null,
  profile_id  uuid        not null references public.profiles (id) on delete cascade,
  shared_at   timestamptz not null default now(),
  shared_by   uuid        references public.profiles (id) on delete set null,
  primary key (project_key, profile_id)
);

create index if not exists claude_project_shares_profile_idx on public.claude_project_shares (profile_id);

-- ---------------------------------------------------------------------------
-- Visibility helper
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER for the reason 20260806_staff_read_enrolled_people and
-- 20260807_gap_board both record: a policy predicate that reads an RLS-protected
-- table silently under-matches rather than erroring. This one reads
-- claude_sessions (to resolve project_key), which is itself the table being
-- policed — an invoker-rights version would recurse or return nothing.

create or replace function public.can_view_claude_session(sid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(is_super_admin(), false)
      or exists (
        select 1 from claude_session_shares s
        where s.session_id = sid and s.profile_id = auth.uid()
      )
      or exists (
        select 1
        from claude_sessions cs
        join claude_project_shares p on p.project_key = cs.project_key
        where cs.id = sid and p.profile_id = auth.uid()
      );
$$;

revoke all on function public.can_view_claude_session(uuid) from anon;
grant execute on function public.can_view_claude_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- No INSERT/UPDATE policy for `authenticated` on claude_sessions or
-- claude_session_turns: those are written only by /api/session-push under the
-- service role, which bypasses RLS. Super admins get a separate FOR ALL policy so
-- the console can delete a session that should never have been captured.

alter table public.claude_sessions       enable row level security;
alter table public.claude_session_turns  enable row level security;
alter table public.claude_session_shares enable row level security;
alter table public.claude_project_shares enable row level security;

drop policy if exists "view shared sessions" on public.claude_sessions;
create policy "view shared sessions"
  on public.claude_sessions
  for select
  to authenticated
  using (can_view_claude_session(id));

drop policy if exists "super admin manages sessions" on public.claude_sessions;
create policy "super admin manages sessions"
  on public.claude_sessions
  for all
  to authenticated
  using (coalesce(is_super_admin(), false))
  with check (coalesce(is_super_admin(), false));

drop policy if exists "view shared turns" on public.claude_session_turns;
create policy "view shared turns"
  on public.claude_session_turns
  for select
  to authenticated
  using (can_view_claude_session(session_id));

drop policy if exists "super admin manages turns" on public.claude_session_turns;
create policy "super admin manages turns"
  on public.claude_session_turns
  for all
  to authenticated
  using (coalesce(is_super_admin(), false))
  with check (coalesce(is_super_admin(), false));

-- A member may see that a session was shared with *them* (the workbench list
-- reads it), and nothing about who else holds it.
drop policy if exists "read own session shares" on public.claude_session_shares;
create policy "read own session shares"
  on public.claude_session_shares
  for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "super admin manages session shares" on public.claude_session_shares;
create policy "super admin manages session shares"
  on public.claude_session_shares
  for all
  to authenticated
  using (coalesce(is_super_admin(), false))
  with check (coalesce(is_super_admin(), false));

drop policy if exists "read own project shares" on public.claude_project_shares;
create policy "read own project shares"
  on public.claude_project_shares
  for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "super admin manages project shares" on public.claude_project_shares;
create policy "super admin manages project shares"
  on public.claude_project_shares
  for all
  to authenticated
  using (coalesce(is_super_admin(), false))
  with check (coalesce(is_super_admin(), false));

-- ---------------------------------------------------------------------------
-- Console support
-- ---------------------------------------------------------------------------
--
-- The association console needs the roster of people a session can be shared
-- with. profiles is locked down (20260611_super_admin_profiles_lockdown), so this
-- is a definer function that raises rather than a select the console could be
-- tempted to widen.

create or replace function public.workbench_shareable_members()
returns table (id uuid, display_name text, is_super_admin boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(is_super_admin(), false) then
    raise exception 'forbidden';
  end if;

  return query
    select p.id, p.display_name, coalesce(p.super_admin, false)
    from profiles p
    where p.role = 'lab'
    order by coalesce(p.super_admin, false) desc, p.display_name;
end;
$$;

revoke all on function public.workbench_shareable_members() from anon;
grant execute on function public.workbench_shareable_members() to authenticated;
