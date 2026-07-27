# PSY240 Field Guide — session handoff

> Written 2026-07-27, end of the WP1/WP3 build sessions. Read this **plus**
> `psy240_wiki_plan.md` (architecture + sequencing) and `psy240_taxonomy.md`
> (the 123-page catalogue). This file is the *state of play and open threads*;
> those two are the durable record. If they disagree with this file, they win —
> this one goes stale fastest.

---

## 1. Where the work stands

| WP | State |
|---|---|
| WP0 decisions | ✔ done |
| WP1 schema | ✔ done, applied live |
| **WP3** seed + review path + review UI + `reference` mode | ✔ **done, applied live, exercised on real content** |
| WP2 reader UI | ✘ not started — **recommended next build** |
| WP4 content sprint | ✘ not started — the critical path to day one |
| WP5 roster & enrollment | ✘ not started — **the schedule's real risk**, and blocked on four decisions (§4) |
| WP6 student submission | ✘ not started, depends on WP5 |
| WP7 export mirror | ✘ not started |

`main` was at `b6adf9d` when this was written. Everything described here is
merged and pushed; nothing is sitting on a branch.

## 2. Live database state (radlab-academic)

```
57 proposals accepted, 0 pending      44 pages with accepted bodies, all DRAFT
45 wikilinks, 0 red links             nothing published — no student can see anything
catalogue: 123 rows — 12 with gaps, 111 with no page yet
```

Nothing has ever been published. Every accept so far has been *accept as draft*,
which is deliberate: there is no reader UI and no enrolled students, so
publishing buys nothing and is the harder direction to reverse.

## 3. How to work on this

**Use the `supabase-academic` MCP server.** It was registered at user scope on
2026-07-25 and points at `qldgwpneygvgcvexlduz` (radlab-academic). The plain
`supabase` server points at the **main** radlab project — querying it for
`wiki_pages` fails in a way that looks exactly like a failed migration. This
cost time; don't repeat it.

Fallback if the MCP is unavailable: the Supabase Management API query endpoint
(`POST /v1/projects/qldgwpneygvgcvexlduz/database/query`) with the access token
from the MCP args in `~/.claude.json`. Note that file breaks PowerShell's
`ConvertFrom-Json` (duplicate keys) — extract the token by regex. A working
helper script pattern is in the scratchpad as `acq.ps1`.

**Read-only check scripts** live in `supabase/checks/`:

| Script | Answers |
|---|---|
| `wp1_verify.sql` | is the WP1 schema applied? (7 checks, works either way) |
| `wp1_ingest_smoke.sql` | did an ingest write shells + proposals correctly, and did the index reach the model? |
| `wp3_review_state.sql` | where does the review queue stand right now? |
| `wp3_reset_review_state.sql` | **undo** — puts reviewed proposals back to pending. Ships wrapped in `BEGIN…ROLLBACK`. ⚠ It cannot tell test reviews from real ones; dangerous now that real review has happened. |

**Migrations are applied manually** (Management API or SQL editor) and recorded
in `supabase/migrations/README.md` with evidence. Every migration listed there
for radlab-academic is applied. Add a row when you apply one.

## 4. Open decisions — these need Norm, and two have external lead time

From `psy240_wiki_plan.md` §2a, still unanswered:

1. **Roster ownership: R1 / R2 / R3.** Which project owns the student roster.
   R3 recommended (radlab-academic as the single course-identity authority,
   Lecture Lounge verifying through a serverless check).
2. **How PSY240 students avoid Ripple onboarding.** A magic-link user with no
   `ripples.name` currently routes into `/welcome`. This is the only work in the
   whole plan that touches the **main** project's auth path.
3. **Where the roster CSV comes from** — ACORN, Quercus, or hand-built. Sets the
   expected columns and how late adds arrive.
4. **Resend domain verification for radlab-academic.** External, has lead time,
   and Supabase's built-in auth email cannot send ~300 invites.

Also open but not blocking: the **CDDR licence variant** (BY-NC-SA vs BY-NC-ND
3.0 IGO). A 30-second check of the PDF's copyright page. Doesn't gate anything —
under either variant it can be read, cited and paraphrased, which is already the
pipeline's invariant.

## 5. What the live testing established

These were learned by running real content through, not by reasoning:

- **Both ingest modes have a job.** Paper mode on a *textbook module* produced 7
  disorder pages plus 11 supporting pages in one pass — cheap breadth, a whole
  DSM chapter at a time. Reference mode on a *single page* produced one page at
  2.5× the depth with full provenance and every gap closed, at a quarter of the
  output tokens. The WP4 shape that follows: ~15 module runs in paper mode to lay
  down chapters, then targeted reference runs on Tier A pages that still declare
  gaps. `reference_worklist` tells you which.
- **The gap mechanism works and discriminates.** Pages declare their own missing
  sections; `persistent-depressive-disorder` came back needing only `etiology`
  while treatment-only mentions correctly needed four sections. It is not
  emitting a boilerplate list.
- **Slug convention holds across independent sources.** Both `type='disorder'`
  pages the model invented matched hand-written catalogue slugs exactly. No drift
  at 44 pages.
- **0 red links across 45.** Every wikilink resolves.

## 6. Gotchas that cost time this session

- **`update` proposals are DELTAS.** The prompt asks for "only the new
  information to merge". Accepting one verbatim replaces the page with the
  addendum. Now guarded server-side in `review_proposal`, pre-merged in the UI,
  and the queue groups by page so a `new` and its `update` sit together. Two
  pages were published as fragments before this was caught.
- **Views default to security-definer in Postgres.** Both views shipped without
  `security_invoker`, so any authenticated account with **no enrollment** could
  read all 26 unreviewed proposals and the whole catalogue. Convention now:
  every view over a roster-gated table sets `security_invoker`. The
  narrow-privileged-read pattern here is a SECURITY DEFINER *function* with a
  membership check, never a view.
- **Attribution must not depend on the model.** For CC BY-NC-SA sources it is a
  licence condition. It is now derived from the ingest record
  (`wiki_page_provenance`), and the portal requires a citation at upload.
- **DOI slugs are opaque.** Five of the nineteen DSM chapter slugs are not the
  title slugified — three truncations, one retained hyphen, and
  `x14_Gender_Dysophoria`, a misspelling in APA's own DOI. Harvest them, never
  compute them. `wp1_verify.sql` check 5 guards this.
- **The Management API returns only the last statement's result set.** Multi-step
  SQL tests must capture intermediate state into a temp table or they silently
  prove nothing. A volatile function's writes are also invisible to other
  branches of the same `UNION ALL` statement.
- **`npm run dev` cannot run the Field Guide.** The client fetches its Supabase
  config from `GET /api/ingest`, which only exists on Vercel. Use a deploy.

## 7. Suggested next move

**WP2, the reader UI.** 44 pages exist and nobody can read them, and reviewing
71 more in a raw-markdown textarea is the expensive part of WP4 — rendered
markdown with working wikilinks and backlinks makes the most costly hours
cheaper. Doing it *before* the content sprint rather than after is the argument.
Roughly one session: render, wikilink resolution, backlinks, `tsvector` search,
ToC.

In parallel, put §4's four roster decisions to Norm, since two have external
lead time and WP5 is the schedule's real risk.

One loose end worth clearing early: the 18 pages from the Module 4 paper-mode
run predate the attribution fix, so they carry no `sources:` frontmatter of
their own. They *are* attributed through `wiki_page_provenance`, so nothing is
unattributed — but if `sources:` in frontmatter matters for the WP7 export,
those pages want regenerating or hand-editing before the first publish.
