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
- Its own route guard component, not a shared one, even when the authorization *rule* is identical (e.g. `LectureLoungeAdminRoute` is a separate file from `AdminRoute`, not a shared import — see `src/academic/lecture-lounge/`).
- Its own layout/chrome, not another section's (Lecture Lounge admin uses a plain `Nav` + wrapper, not `AdminLayout`'s sidebar).
- Wrap its route group in `<ErrorBoundary label="...">` (`src/components/ErrorBoundary.jsx`) so a render crash there shows a scoped error screen instead of unmounting the whole app.

Reference implementation: `/academic/lecture-lounge/admin` vs `/admin/*` in `App.jsx`.

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

---

## Workbench — sharing this session with lab members

Norm can publish a Claude Code session to `/workbench`, where lab members he names can read it.
**Capture is per-session and off by default.** Creating the config file arms nothing; a session
publishes only when it is explicitly opted in.

**When Norm says any of these — "share this session", "push this to the workbench", "start
backing this up", "let the lab see this" — run:**

```bash
node scripts/workbench-share.mjs on <session-id>     # start (also: off, status)
```

`/workbench` is a slash command that does the same thing; `.claude/commands/workbench.md` carries
the full procedure and the caveats worth repeating back to him.

**The session id is the UUID in your own scratchpad directory path** — the same UUID as your
transcript filename. Do **not** take the newest `.jsonl` in the project directory: Norm runs
several sessions on this repo at once, so that is regularly a *different* session, and opting the
wrong one in publishes work he did not choose to share.

Three things to tell him when turning it on: the whole session publishes **from its start**, not
from that moment; it is visible to nobody until he shares it at `/workbench/admin`; and `off`
stops future pushes but does **not** unpublish what already went.

**What travels**: his prompts, your prose, and a one-line headline per tool call. Never tool
output — no file contents, no query results, no diffs, no thinking. That is the property the
whole feature rests on, so do not add tool output to the payload without a redaction review; it
is also ~98% of a raw transcript, so it would cost ~50x the storage.

Prose, however, is sent **verbatim**. The endpoint redacts its own credentials and common key
shapes as a backstop, not a guarantee. If a session contains a password, a participant name, or
anything else typed as ordinary text, say so *before* opting it in.

Full design: website.md §29c.

---

## Never `git add -A` — other sessions share this working tree

Norm runs several Claude Code sessions against this checkout at once. `git add -A` therefore stages
**their** uncommitted work along with yours.

**Stage explicit paths.** `git add website.md src/foo.jsx`, never `-A`, never `.`, never `-u`.

It is not a hypothetical tidiness rule. On 2026-08-11 an `add -A` swept up another session's
*in-progress merge* of `claude/sandy-study-3-prereg-5a335c`, whose `website.md` header conflict was
still unresolved. The commit therefore (a) silently became a **merge commit**, (b) published
`<<<<<<<` / `>>>>>>>` markers in website.md to `main`, which auto-deploys, and (c) attributed ~1,000
lines of someone else's study documentation to a commit message about slash commands. Nothing was
lost, but `main` carried a corrupted architecture record until it was noticed.

Two habits that would each have caught it:

- **`git status` before staging**, and if files you did not touch appear, stage only yours.
- **`git show --stat HEAD` after committing.** The file list is the cheapest possible check that you
  committed what you thought you committed — the merge-commit parents and the foreign files were
  both visible there immediately.

Also note `git pull --ff-only` printing *"fatal: Exiting because of an unresolved conflict"*: that is
not about the pull, it means the index **already** holds unmerged paths from another session. Stop
and look; do not stage past it.

---

## Branch policy — finish the branch, and merge before you deploy

**Work on `main` directly for small, verifiable changes.** Branches earn their keep when work is risky or genuinely parallel; for "fix it, verify it live, move on" they add a merge step and a chance to forget.

**If you do create a branch, end the task by merging it to `main` and deleting it** — or delete it unmerged if the work was abandoned. Do not leave it for later; later is how 52 branches accumulate.

**Never leave a change that is already live on an unmerged branch.** This is the rule that actually matters. A migration applied via the Supabase MCP, or an Edge Function deployed with the CLI, is *live* — but if the code or the migration file exists only on a branch, the next person who deploys that function from `main` silently reverts it. "Applied and verified live" is not durable until it is in `main`.

So: **merge first, deploy second.** A deploy takes whatever is in the working tree.

### Periodic cleanup

Safe because `-d` refuses anything unmerged — the worst case is that it declines:

```bash
git branch --merged main | grep -vE '^\*|main|backup/' | xargs -r git branch -d
```

Before deleting an *unmerged* branch, check what it actually holds — `git merge-tree --write-tree main <branch>` then diff that tree against `main`. "N commits ahead" and `git cherry` both overstate things: they count patch-ids, so a branch whose work reached `main` by another route still looks unmerged. Never judge a branch by its name or its age.

### Background

Discovered 2026-07-30 while triaging 52 local branches: 44 were fully merged (harmless noise), and of the 7 genuinely ahead, 4 were superseded, 1 held a preregistration document that existed nowhere else — and **1 held a consent-gate fix that had been applied live on 2026-07-17 and never merged**. Redeploying that Edge Function from `main` earlier the same day silently reverted it, so admin-generated participant links stopped showing the consent form. Proven by three `study_enrollments` rows: `consent_date` null (fixed) → stamped (reverted) → null again (re-merged and redeployed). The clutter was cosmetic; it was the clutter that kept that one branch invisible.
