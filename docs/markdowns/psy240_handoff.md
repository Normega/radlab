# PSY240 Field Guide — session handoff

> Updated 2026-07-27 (WP2 built; roster decisions taken). Read this **plus**
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
| **WP2** reader UI | ✔ **built 2026-07-27** — verified offline against the live corpus, **not yet click-tested in a browser** |
| WP4 content sprint | ✘ not started — the critical path to day one |
| WP5 roster & enrollment | ✘ not started — **the schedule's real risk**; two of its four decisions are now taken (§4) |
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

From `psy240_wiki_plan.md` §2a:

1. ~~**Roster ownership**~~ — **decided 2026-07-27: R3.** radlab-academic is the
   single course-identity authority; Lecture Lounge verifies against it through
   `api/roster-check.js` under the service role. PII stays partitioned, one
   roster serves both systems.
2. **How PSY240 students avoid Ripple onboarding.** *Still open.* A magic-link
   user with no `ripples.name` currently routes into `/welcome`. This is the only
   work in the whole plan that touches the **main** project's auth path.
   Recommendation on the table: a course-origin flag on the account that
   `ProtectedRoute` skips onboarding for, rather than a new account tier.
3. ~~**Where the roster CSV comes from**~~ — **decided 2026-07-27: Quercus
   export.** Column names differ from ACORN's and the email column may be the
   institutional alias, so the importer maps columns explicitly and matches on
   the normalized key, never a literal string.
4. ~~**Resend domain verification**~~ — **done 2026-07-29, email is unblocked.** The
   verified Resend domain turned out to be **`mail.radlab.zone`** (not the
   apex), already fully configured and passing. **Superseded the same day:**
   Norm moved to the paid tier and added a second verified domain,
   **`course.radlab.zone`**, so PSY240 sends as `psy240@course.radlab.zone` on
   a reputation separate from participant mail — a 300-invite blast with
   bounces can no longer damage deliverability for a running study. Two
   corrections to
   the earlier framing: verifying a *new* domain was never the blocker, and a
   second domain would not have helped anyway — **Resend's sending quota is
   per account, not per domain**, so only the plan tier addresses a 300-invite
   day. Norm moved to the paid plan 2026-07-29, which settles it.

   **Configured and verified the same day** (values read back over the
   Management API, see website.md §11): Custom SMTP on radlab-academic
   (`smtp.resend.com:465`, user `resend`, sender `accounts@course.radlab.zone`
   / "RADlab Courses" — deliberately course-*neutral*, because that field is
   project-wide and this project hosts many courses; per-course sender identity
   belongs on the invite Edge Function, composed from `courses.code`).
   `mailer_autoconfirm` stays false, so clicking is what enrols.

   Three rate limits raised from their defaults, all per hour:
   `rate_limit_email_sent` 2 → 300, `rate_limit_otp` 30 → 300,
   `rate_limit_verify` 30 → 300. **The last two are the week-1 ones**, and the
   reason is the QR path: ~200 students scanning in one lecture would have hit
   `rate_limit_otp` after 30 sends and `rate_limit_verify` after 30 clicks,
   failing as generic errors on their phones mid-class. `rate_limit_verify`
   cannot be engineered around — every click verifies a token through Supabase
   auth however the email was sent — so raising it was mandatory, not optional.

   Still untested: whether mail actually *flows*. The settings being right and
   Resend accepting the credential are different claims; a password reset sent
   from radlab-academic is the cheapest end-to-end proof. Also unchanged:
   `mailer_otp_exp` is 3600, so links die after an hour — fine for the QR path,
   tight for a bulk invite a student opens after class.

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
- **0 red links across 45.** Every wikilink resolves. **But** (found 2026-07-27
  while building the reader) that graph is only the *body* links: a further **125
  relations are declared in frontmatter and none of them reach `wiki_links`**,
  because `sync_wiki_links()` reads the body only. 102 point at pages that exist.
  So connectedness is understated roughly 3×, and the red-link count that
  taxonomy §5's Tier B argument leans on is measured on a partial graph. Plan
  open question 12.
- **Some pages carry the disorder skeleton more than once.**
  `major-depressive-disorder` has Presentation/Diagnosis/…/Contested **three
  times**, `persistent-depressive-disorder` twice — one copy per accepted
  `update` proposal, plus H1 seams like `# Update from Fonagy (2015)`. The
  merge guard stops a delta *replacing* a page; it doesn't stop the skeleton
  accumulating. Worth an editing pass on those two before the first publish.

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

**WP4, the content sprint** — the reader now exists, so reviewing a page means
reading a rendered page with working links instead of markdown in a textarea,
which was the argument for building WP2 first. Shape from §5: ~15 module runs in
paper mode to lay down chapters, then targeted reference runs on Tier A pages
that still declare gaps (`reference_worklist` says which).

Two things to clear before or during it:

- **Click-test the reader on a deploy.** It is verified offline (link rules vs
  the DB graph, server-rendered anchors) but has never run in a browser —
  `npm run dev` can't serve the Field Guide (§6).
- **The two repeated-skeleton pages** (§5) want an editing pass.

**WP5 is still the schedule's real risk**, but its external dependency is gone:
three of its four decisions are settled and the whole email path is configured
(§4). **The Ripple-onboarding collision is now the only open one** — and it is
the item that touches the *main* project's auth path rather than adding to the
academic partition, so it wants deciding before WP5 starts rather than during.

One loose end, now with a proposed answer: the 18 pages from the Module 4
paper-mode run predate the attribution fix, so they carry no `sources:`
frontmatter of their own. They *are* attributed through `wiki_page_provenance`,
so nothing is unattributed. **Proposal (2026-07-27): leave them, and have WP7's
exporter synthesize `sources:` from provenance at export time** rather than
regenerating pages. The database stays the single source of truth for
attribution, every exported page gets a correct block regardless of what the
model emitted, and no page has to be rewritten to satisfy a file format. The
reader already takes this line — it shows *Built from* out of provenance, not
out of frontmatter.
