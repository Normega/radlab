-- Display element: participant-facing content pages (instructions, feedback)
-- placeable as session steps. Block-based so richer block types (video, audio,
-- embedded questions) can be added later without schema changes; P1 ships
-- text blocks only.
--
-- blocks jsonb shape (ordered array):
--   { "type": "text",
--     "markdown": "You scored {{game.aptitude_suite.avg_pct}}%...",
--     "showIf": { "slot": "condition", "in": ["treatment"] } | null }
--
-- Variables resolve client-side from the session context:
--   {{condition}} (or any slot key)        — from draw_assignment
--   {{slider.<slug>.value}}                — slider step output
--   {{vas.<slug>.value}}                   — VAS step output
--   {{game.<slug>.<key>}}                  — game onSessionComplete payload
-- See src/lib/elementOutputs.js for the per-element output manifest.

create table if not exists displays (
  id         uuid        primary key default gen_random_uuid(),
  slug       text        not null unique,
  name       text        not null,
  blocks     jsonb       not null default '[]'::jsonb,
  created_by uuid        references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table displays enable row level security;

-- Participants read displays during sessions (isolated authenticated client).
create policy "authenticated read"
  on displays for select
  to authenticated
  using (true);

create policy "lab write"
  on displays for all
  to authenticated
  using (my_role() = any (array['lab'::text, 'admin'::text]))
  with check (my_role() = any (array['lab'::text, 'admin'::text]));
