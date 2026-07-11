# RADlab — Claude Code guidance

## RLS policy pattern for game tables

Every table that game code writes to must have explicit RLS policies for the `authenticated` role. RLS is enabled on all tables by default — **a table with RLS enabled but no matching policy silently blocks all operations**, with no error surfaced to the client.

### When adding a new game table, always add at minimum:

**If the table has a `user_id` column:**
```sql
CREATE POLICY "own rows"
  ON your_table
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**If the table only has a `session_id` referencing `game_sessions`:**
```sql
CREATE POLICY "own rows"
  ON your_table
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM game_sessions WHERE id = your_table.session_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM game_sessions WHERE id = your_table.session_id AND user_id = auth.uid()
  ));
```

**If the table has a `participant_id` (text) column:**
```sql
CREATE POLICY "own rows"
  ON your_table
  FOR ALL
  TO authenticated
  USING (participant_id = auth.uid()::text)
  WITH CHECK (participant_id = auth.uid()::text);
```

### Auditing

To check for tables with RLS enabled but no policies (the broken state):
```sql
SELECT c.relname
FROM pg_class c
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE c.relkind = 'r'
  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND c.relrowsecurity = true
GROUP BY c.relname
HAVING COUNT(p.oid) = 0;
```

### Background

Discovered May 2026: `stillwater_responses` had an anon-only INSERT policy; `drift_performance` and `drift_trials` had no policies at all. Authenticated users were silently blocked from writing game data with no client-side error.

---

## Migration convention

All Supabase migrations live in `.\supabase\migrations\` and are named `YYYYMMDD_description.sql` (e.g. `20260606_compensation_form.sql`). **Never write migration SQL to the project root.** Run migrations manually in the Supabase SQL editor, or via the Supabase MCP `apply_migration` tool.

**Applied-status manifest**: `supabase/migrations/README.md` records that every migration file up to 2026-07-08 is confirmed applied to the live project (with evidence per file). Do not re-audit those; only migrations dated after 2026-07-08 need checking. When you apply a new migration, add a row to that manifest.

---

## Route code-splitting convention

Every route-level page component registered in `src/App.jsx` must be lazy-loaded — `const Foo = lazy(() => import('./pages/Foo'))` — never a static top-level `import Foo from './pages/Foo'`. A static import pulls that page (and everything it imports) into the single entry bundle that every visitor downloads on every route, regardless of whether they ever see that page.

### When adding a new route

1. Import the component with `lazy()`, not a plain `import`. `<Suspense fallback={<RouteFallback />}>` already wraps the whole `<Routes>` tree in `App.jsx` — no per-route Suspense needed.
2. After adding it, run `npm run build` and confirm the new page appears as its own `dist/assets/<ComponentName>-<hash>.js` file rather than inflating the size of `dist/assets/index-*.js`.
3. Small components used as route *wrappers* (guards, layouts consumed by many routes) can stay static imports — the value is in splitting page *content*, not every file that touches routing.

**Exception:** `Landing` (`/`) stays a static import — it's the first paint for nearly every visitor, so a Suspense flash on it buys nothing.

### Partitioning a distinct product area (e.g. Lecture Lounge)

When a feature area should be resilient to the rest of the site — a bug in it shouldn't blank other pages, and it shouldn't share a bundle with an unrelated section — go one step further than plain code-splitting:

- Every page in that area lazy-loaded (above) — this alone puts it in its own chunk group, verifiable by grep-ing `dist/assets/` for that area's component names after a build.
- Its own route guard component, not a shared one, even when the authorization *rule* is identical (e.g. `LectureLoungeAdminRoute` is a separate file from `AdminRoute`, not a shared import — see `src/components/`).
- Its own layout/chrome, not another section's (Lecture Lounge admin uses a plain `Nav` + wrapper, not `AdminLayout`'s sidebar).
- Wrap its route group in `<ErrorBoundary label="...">` (`src/components/ErrorBoundary.jsx`) so a render crash there shows a scoped error screen instead of unmounting the whole app.

Reference implementation: `/lecture-lounge/admin` vs `/admin/*` in `App.jsx`.

### Background

Discovered 2026-07-11: zero code-splitting existed anywhere in the app — every route (16+ games, 20+ admin pages, all of Lecture Lounge) shipped in one entry bundle, ~782 KB gzipped, downloaded by every visitor on every page regardless of route. Converting all non-Landing routes to `React.lazy()` cut the entry bundle to ~70 KB gzip. Caught because Lecture Lounge's few new files happened to push an unrelated pre-1.0 bundler (Rolldown, via `vite@8.0.3`) minification regression over some threshold — see `git log --grep=perf(app)` on `main` for the full investigation; that bundler issue itself is still open, tracked upstream as `vitejs/vite#22007`, not something to re-diagnose from scratch if bundle size creeps up again.

---

## website.md convention — required on every merge to main

`website.md` is the platform's living architecture record. **Every commit/merge to `main` must include a check of website.md, and an update when the change touches anything it documents.** Do this as part of the same commit, not as a follow-up.

The check, concretely:

1. Does the change add/alter behavior, schema, routes, files, or status that website.md describes? If yes, amend the relevant section(s) — status lines, file lists, verified behavior, key decisions.
2. For substantive work (a feature, a migration, a fix verified live), prepend a short clause to the `> Last updated:` header line (newest first, "Prior update:" chaining — see existing entries for the pattern).
3. Tick or add roadmap items in the Roadmap section (currently §31 — section numbers shift as content is inserted, so confirm the current number with `grep -n "^## " website.md` rather than trusting this note) if the work closes or opens one.
4. Docs-only, comment-only, or trivial changes that website.md doesn't describe need no update — but the check itself is not optional.

Rationale: website.md is the context handed to every new working session; a stale entry silently misleads the next session (and has — e.g. an implementation brief that predated a shipped primitive nearly caused a parallel reimplementation).
