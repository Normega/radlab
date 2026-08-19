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

## Disabling a study — `active` is the switch, and it now works

Setting `studies.active = false` stops the study: `auto-enroll` refuses new joins, and
`check_schedule` skips it for sends, reminders and the fork-advance pass.

**This was not true until 2026-08-18.** `active` was read by nothing but a counter on the admin
dashboard, so "archiving" a study changed a label while the 06:00 cron kept emailing its
participants. Found when a superseded dry-run study was still running daily sessions for three
people — one of whom had joined it that morning, months after Norm believed he had archived it.

Turning the flag off stops *future* work but does not retract what is already in flight. To
disable a study properly:

```sql
UPDATE studies SET active = false, allow_external_enrollment = false, reminders_enabled = false
 WHERE id = '…';
-- rows already scheduled will otherwise sit waiting; 'missed' is the status the
-- scheduler itself uses for rows that can no longer be completed
UPDATE participant_schedule SET status = 'missed'
 WHERE study_id = '…' AND completed_at IS NULL AND status NOT IN ('missed','blocked');
-- and a link already sitting in someone's inbox still opens
UPDATE participant_links SET status='expired', ended_reason='admin_revoked', ended_at=now()
 WHERE study_id = '…' AND status='active';
```

Do **not** withdraw the enrollments as a way of stopping a study unless you mean it: withdrawal is
participant-facing and `processAdherenceWithdrawal` emails them.

---

## Participant data logging — four rules for every study

These began as fixes to Liliana Study 3, but none of them is study-specific. Each was a
*category* of defect that any study on the platform could reproduce, so they are policy.

**1. A response records WHERE it came from, not just when.** Every participant-data table
carries a `schedule_id` referencing `participant_schedule` (use `ON DELETE SET NULL` — deleting
a schedule row must never delete collected answers). `vas_responses` has had this since WP-L1;
`questionnaire_responses` gained it 2026-08-18. Without it the export can only guess a
timepoint from the order responses arrived, which breaks the moment anyone repeats, skips, or
re-enters a session.

**2. Terminal submits are guarded twice.** A synchronous ref lock in the client
(`src/lib/useSubmitLock.js` — a `saving` *state* flag is a race, not a lock, because
`setSaving(true)` lands only on re-render) **and** a database guard. The client layer is per
component instance and cannot survive a remount, so it alone is not enough: the duplicate that
prompted this was 643 ms apart, too slow for a double-click and too fast for a human. Release
the lock on failure, never on success — a completed submit must not repeat, but a failed one
must stay retryable.

**3. Export column names must come from recorded facts.** Never from occurrence order. `_t3`
meaning "the third time this person answered" silently drifts apart from `_t3` on any other
scale, and reads as a timepoint to everyone who opens the file. Name columns from the study day
or the session (`vas_stress_pre_d7`, `gad7_midpoint_3`).

**4. Never assert a label you cannot demonstrate.** Where a fact genuinely isn't recorded, fall
back to something visibly non-committal (`_x2`, `_unscheduled_1`) rather than inventing a
plausible one. A confidently wrong label is worse than an obviously vague one: the export once
emitted `gad7_final_*` for a participant whose final assessment was never sat.

**The through-line:** every one of these was invisible in the app and only showed up in the
exported data, months later, to the person trying to analyse it. Data-logging defects do not
announce themselves — so prefer the recorded fact over the clever inference, and check new
instruments against these four before a study recruits, not after.

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

## Live dev site — push to `dev`, promote to `main` on approval

The platform has a web-facing staging site. `main` is production (`radlab.zone`, auto-deploys on every push); **`dev`** is a long-lived staging branch that Vercel builds as a preview deployment on every push — reachable anywhere at **`dev.radlab.zone`** once the domain is assigned (until then, via the deployment's `*-git-dev-*.vercel.app` URL in the Vercel dashboard). Vercel serves every preview deployment with `X-Robots-Tag: noindex`, so the dev site is world-reachable but never search-indexed — no robots.txt to maintain, nothing to drift.

**The loop:**

1. Frontend work lands on `dev` — commit there directly, or merge a feature branch into `dev`. Do not push it to `main`.
2. Norm reviews it live on the dev URL.
3. Promotion is a git merge, nothing else: merge `dev` into `main` and push (doing the website.md check as part of that merge). **Never** use Vercel's "Promote to Production" on a dev build — production must always be exactly what `main` holds, or the silently-reverted-deploy hazard (Branch policy, below) returns.
4. After promoting — and after anything that goes to `main` directly — sync back: merge `main` into `dev` and push. `dev` should never trail `main` for long.

**The exception that matters — anything touching Supabase does not wait on `dev`.** The dev site talks to the *production* Supabase project: same database, same auth, same Edge Functions. There is no staging backend. A migration applied via MCP or an Edge Function deployed with the CLI is live for real participants the moment it happens, whichever branch the file sits on. So schema/Edge Function work and the frontend code coupled to it go to `main` together, at the time they are applied — exactly as Branch policy below says. Only pure-frontend work — UI, copy, layout, routes against the existing schema — waits on `dev` for approval.

Rule of thumb: touches `supabase/` → `main`. Touches only `src/`, `public/`, `api/`, docs → `dev` first. (`api/` serverless functions are safe on `dev`: they deploy per-branch with the Vercel build, so the preview runs its own copy.)

Two cautions. Don't casually exercise data-writing or destructive flows on the dev site — it writes to production tables. And treat `dev` as a promotion queue: if Norm rejects something sitting on it, revert it *on `dev`* promptly so it doesn't block promoting everyone else's approved work.

**Setup status: complete and confirmed working (2026-08-16).** Norm did the four dashboard steps (domain + DNS, Preview env vars, Supabase auth redirect, deployment protection), and the loop has now been used end to end for real: a CSS fix was pushed to `dev`, reviewed on `dev.radlab.zone` through a live participant link, and promoted to `main` on approval. Note that participant session links work on the dev host — same token, same Supabase — so a participant-facing screen can be reviewed there without touching production. Sessions still cannot reach the domain through the sandbox egress proxy, so Claude cannot see the dev site itself; a human has to look.

---

## Branch policy — finish the branch, and merge before you deploy

**Frontend work goes to `dev` first** (see *Live dev site* above); direct-to-`main` is for Supabase-coupled changes and the merges that promote `dev`. Feature branches beyond `dev` earn their keep when work is risky or genuinely parallel; for "fix it, verify it live, move on" they add a merge step and a chance to forget.

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
