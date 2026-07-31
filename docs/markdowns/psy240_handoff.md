# PSY240 Field Guide — session handoff

> Rewritten 2026-07-31, mid-WP4. Read this **plus** `psy240_wiki_plan.md`
> (architecture + sequencing), `psy240_taxonomy.md` (the 123-page catalogue) and
> **`psy240_wp4_runplan.md`** (the ingest run order, module→chapter map, and the
> sixteen ready-to-paste citations). This file is the *state of play and open
> threads*; those three are the durable record. If they disagree with this file,
> they win — this one goes stale fastest.

---

## 1. Where the work stands

| WP | State |
|---|---|
| WP0 decisions | ✔ done |
| WP1 schema | ✔ done, applied live |
| WP2 reader UI | ✔ **done, click-tested, deployed** — `/academic/fieldguide/wiki` |
| WP3 seed + review path + review UI + `reference` mode | ✔ done, exercised on real content |
| **WP4 content sprint** | **▶ in progress — started 2026-07-31.** Module 01 done (paper + 3 reference runs). Next: Modules 02, 03, 15 |
| WP5 roster & enrollment | ✘ not started. Email path fully configured; **one decision left** (§4) |
| WP6 student submission | ✘ not started, depends on WP5 |
| WP7 export mirror | ✘ not started |

Everything is merged and pushed to `main`; nothing sits on a branch.

## 2. Live database state (radlab-academic, 2026-07-31)

```
54 live pages with bodies       0 published — no student can see anything yet
1 archived (abnormal-behavior)  0 proposals pending — review queue is clear
105 wikilinks, 0 red links      catalogue: 123 rows — 2 complete, 13 gaps, 108 no page yet
16 ingest jobs                  ~877k input / ~127k output tokens to date
```

Nothing has ever been published. Every accept so far is *accept as draft*, which is
deliberate: no students are enrolled, so publishing buys nothing and is the harder
direction to reverse.

## 3. How to work on this

**Use the `supabase-academic` MCP server** — it points at `qldgwpneygvgcvexlduz`.
The plain `supabase` server is the **main** radlab project; querying it for
`wiki_pages` fails in a way that looks exactly like a failed migration. This has
cost time twice.

**The MCP's `execute_sql` intermittently returns "Failed to execute SQL query"**
on perfectly valid SQL. It is transient — retry the same query, optionally with
`public.`-qualified table names. Do not start debugging the SQL.

**Read-only check scripts** live in `supabase/checks/` (`wp1_verify.sql`,
`wp1_ingest_smoke.sql`, `wp3_review_state.sql`, and the ⚠ dangerous
`wp3_reset_review_state.sql`). Email/DNS checks live in `scripts/`:
`check-email-dns.ps1` and `parse-dmarc-report.py`.

**Migrations** are applied via MCP `apply_migration` and recorded in
`supabase/migrations/README.md` with evidence. Add a row when you apply one.

**`npm run dev` cannot run the Field Guide** — the client fetches its Supabase
config from `GET /api/ingest`, which only exists on Vercel. Use a deploy.

### The write path (all staff-only SECURITY DEFINER functions)

`wiki_pages` has **no authenticated write policies**. Every change goes through one
of these, each with an internal `is_course_staff()` check:

| Function | Purpose |
|---|---|
| `review_proposal(version_id, decision, content, publish)` | Accept/reject a *pending* proposal |
| `edit_page(page_id, content, note)` | Correct an accepted page. History automatic |
| `rename_page(page_id, new_slug, new_title)` | Move to a different slug; rebinds links, reports what it orphaned |
| `archive_page(page_id, reason)` / `restore_page(page_id, reason)` | Retire / un-retire. Archived pages leave the model's ingest index too |
| `unpublish_page(page_id, reason)` | Published → draft |

To call any of them from a session, impersonate the instructor inside a `DO` block:
`set_config('request.jwt.claims', json_build_object('sub', <auth_user_id>, 'role','authenticated')::text, true)`.

## 4. Open decisions

1. ~~Roster ownership~~ — **R3** (radlab-academic owns it; Lecture Lounge verifies
   via `api/roster-check.js`).
2. **How PSY240 students avoid Ripple onboarding — the only one still open, and
   smaller than the plan claims.** Verified 2026-07-30: `/class/:slug` is wrapped in
   `AuthRoute`, not `ProtectedRoute`, so it never passes through the onboarding
   chain; and a magic-link signup gets a `profiles` row automatically from the
   `on_auth_user_created` trigger. **The decision reduces to which `emailRedirectTo`
   the invite uses.** The genuine main-project work in WP5 is not the onboarding
   bypass but the R3 **auto-verify** — a roster hit setting `utoronto_verified_at`
   through `verify_class_email()` or an equivalent SECURITY DEFINER path.
3. ~~Roster CSV source~~ — **Quercus** (map columns explicitly; match on the
   normalized key, never a literal string).
4. ~~Resend~~ — **done.** See §6.

Also open, not blocking: the **CDDR licence variant** (30-second check of the PDF's
copyright page), and **plan open question 12** — 125 frontmatter relations that never
reach `wiki_links`. That one bit in practice on 2026-07-31: archiving a page needed
six references retargeted across five pages, and four were frontmatter-only and so
invisible to any link-based check.

## 5. WP4 — exactly where the sprint is

**Run plan: `psy240_wp4_runplan.md`.** All 16 module PDFs are split out in
`F:\gits\Handbook\Resources\` as `BridleyDaffin-ModuleNN-Title.pdf`.

**Done:** Module 01 — one paper run (6 supporting pages) and three reference runs
filling `what-is-abnormal`, `historical-traditions`, `research-methods`. Module 04
(mood) was done earlier.

**Next:** Modules 02, 03, 15 in **reference** mode, then the disorder chapters in
**paper** mode (runs 5–15), Module 16 last.

**Mode is per module and getting it wrong is expensive.** Reference mode only for
the foundations modules, because foundations slugs are *our invention* and paper
mode will never hit them — proven when Module 01's paper run produced six good pages
and zero foundations. Disorder chapters stay paper mode: disorder names are canonical
so the slugs converge, one paper run yields ~18 pages where reference mode would need
one run per target (Module 13 alone would be 11 runs), and reference mode
deliberately suppresses the supporting concept/treatment/debate pages.

**Triage between every run.** `api/ingest.js` builds the model's index from pages
with *accepted content only*, so an unreviewed page is invisible to the next run and
gets proposed afresh. Triage (accept-as-draft, ~5 min) is not the review; the real
~17-hour review happens later in the reader, where `edit_page` fixes things in place.

**Citations:** paste from run plan §6 — sixteen ready-made strings. Don't retype.

## 6. Infrastructure that is done and shouldn't be re-litigated

- **Model: `claude-opus-5`** (moved from Opus 4.8, 2026-07-31; same $5/$25). A
  refusal retries once on `claude-opus-4-8` (`FALLBACK_MODEL`) — this syllabus is full
  of material that can false-positive a safety classifier (suicide, substance use,
  paraphilias, gender dysphoria). Client-side retry, deliberately not the server-side
  `fallbacks` beta.
- **Email:** radlab-academic sends via Resend SMTP. Verified domains are
  `mail.radlab.zone` (platform) and `course.radlab.zone` (PSY240). Sender is
  course-*neutral* (`accounts@course.radlab.zone`) because Supabase allows one sender
  per project; per-course identity belongs on the invite Edge Function.
  `rate_limit_email_sent`/`otp`/`verify` all raised to 300/hour — the latter two are
  the week-1 QR-burst limits, not the invite send. **Never exercised with a real
  send.**
- **Prompt caching: investigated and declined** (numbers in run plan §5). Extracted
  mode is the bigger, free lever on prose modules. Recorded there: the PDF already
  sits before the volatile text in the request, so enabling caching later is a
  one-line `cache_control` with no reordering.

## 7. What the live work established

- **Both ingest modes have a job**, and the split is by *slug canonicality*, not by
  source type. See §5.
- **Reference mode duplicates its own target.** Each Module 01 reference run produced
  its target *plus* a re-titled version of it (`history-of-mental-illness` alongside
  `historical-traditions`; `research-methods-in-psychopathology` alongside
  `research-methods`). Both rejected. **Prompt fixed 2026-07-31** — watch whether the
  fix holds on Module 02.
- **Gaps are derived from the page body**, not frontmatter (two migrations,
  2026-07-30). A section is a gap if it carries a `> **Needs research:**` marker or
  has no prose. This matters because `reference_worklist` reads it and that aims WP4.
- **Repeated skeletons are fixed at the source.** MDD once carried the six-section
  disorder skeleton three times, one copy per accepted `update`. Two prompt rules
  contradicted each other; paper mode now scopes the skeleton to `action: new`, and
  reference mode returns a whole page with `action: 'replace'`.
- **0 red links across 105** — but that graph is body links only; frontmatter
  relations are not in it (§4).
- **Tier A is now 53, Tier B 45** — all ten personality disorders promoted
  2026-07-31. Fall scope: 78 generated pages, ~17 review hours.

## 8. Gotchas that cost time

- **`update` proposals are DELTAS** — accepting one verbatim replaces the page with
  the addendum. Guarded server-side, pre-merged in the UI.
- **Views default to security-definer in Postgres.** Every view over a roster-gated
  table must set `security_invoker`. Narrow privileged reads are SECURITY DEFINER
  *functions* with a membership check, never views.
- **`wiki_pages_bind_links()` only binds, never unbinds** — which is why
  `rename_page` cleans up after itself and reports orphans. `link_disorder_page()`
  has the same gap.
- **Attribution must not depend on the model.** Derived from the ingest record via
  `wiki_page_provenance`; citations are correctable after the fact at the job, and
  every page built from it updates itself.
- **DOI slugs are opaque** — harvest, never compute. `wp1_verify.sql` check 5 guards it.
- **The Management API returns only the last statement's result set**, and a volatile
  function's writes are invisible to other branches of the same statement. Multi-step
  SQL tests need separate statements, or a self-aborting `DO` block that `raise`s a
  summary (the pattern used throughout this project's verification).

## 9. Suggested next move

1. **Run Module 02 in reference mode** against `models-of-psychopathology` and
   `integrative-model`, and check whether the duplicate-sibling prompt fix held.
2. Then Module 03 (`clinical-assessment`, `diagnosis-and-classification`) and
   Module 15 (`law-and-ethics`).
3. Then the disorder chapters in paper mode, lecture order, Module 16 last.
4. **Before the first publish**, decide open question 12 — whether frontmatter
   relations should join the link graph. It changes what "0 red links" means.
5. WP5 remains the schedule's real risk. Its external dependency is gone; the
   Ripple/`emailRedirectTo` decision and the R3 auto-verify are what's left.

One loose end: the 18 pages from the Module 04 paper run predate the attribution fix
and carry no `sources:` frontmatter of their own. They *are* attributed through
`wiki_page_provenance`. **Proposal: leave them, and have WP7's exporter synthesize
`sources:` from provenance at export time** — the database stays the single source of
truth and no page needs rewriting. The reader already takes this line.
