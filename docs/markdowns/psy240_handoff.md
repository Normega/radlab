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
| **WP4 content sprint** | **▶ in progress — started 2026-07-31.** Modules 01, 02, 03 done (plus 04 earlier). Next: Module 15, then the disorder chapters |
| WP5 roster & enrollment | ✘ not started. Email path fully configured; **one decision left** (§4) |
| WP6 student submission | ✘ not started, depends on WP5 |
| WP7 export mirror | ✘ not started |

Everything is merged and pushed to `main`; nothing sits on a branch.

## 2. Live database state (radlab-academic, 2026-07-31, after Module 03)

```
66 live pages with bodies       0 published — no student can see anything yet
2 archived (abnormal-behavior,  0 proposals pending — review queue is clear
  classification-systems)       catalogue: 123 rows — 3 complete, 16 gaps, 104 no page yet
177 wikilinks, 0 red links      20 ingest jobs, ~1.11M input / ~182k output tokens to date
```

Two empty `proposed` page rows also linger — `history-of-mental-illness` and
`research-methods-in-psychopathology`, the rejected duplicate siblings from Module 01. Their
versions are correctly `rejected` and they hold no content, so they are invisible to the ingest
index and to students, but they squat on two slugs and inflate any raw page count. Worth clearing
before the first publish; harmless until then.

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
`F:\gits\radlab_project\PSY240resources\` as `BridleyDaffin-ModuleNN-Title.pdf`.

**Done (through run 5, as of 2026-08-01):** the whole foundations block — Module 01
(one paper run for 6 supporting pages, plus three reference runs filling
`what-is-abnormal`, `historical-traditions`, `research-methods`), Module 02
(`models-of-psychopathology`, `integrative-model`), Module 03 (`clinical-assessment`,
`diagnosis-and-classification`), Module 15 (`law-and-ethics`). Then the first disorder
chapter: **Module 07 (anxiety), paper mode — 14 pages, all triaged and accepted as
drafts.** Module 04 (mood) was done earlier.

**Next: run 6 — Module 09 (OCD), paper mode, native.** Then 08, 05, 06, 10, 11, 12,
14, 13, with Module 16 last.

**The 16 topic overviews will not come out of the module sweep.** Module 04 and Module
07 both ran paper mode over a whole disorder block and produced zero overviews between
them. Overview slugs are the catalogue's invention, so they behave like the foundations
did — they need reference mode, and they belong to the reference pass (run plan §5),
not to any chapter run. The run plan's table was corrected on 2026-08-01 to stop
promising them.

**Mode is per module and getting it wrong is expensive.** Reference mode only for
the foundations modules, because foundations slugs are *our invention* and paper
mode will never hit them — proven when Module 01's paper run produced six good pages
and zero foundations. Disorder chapters stay paper mode: disorder names are canonical
so the slugs converge, and one paper run yields ~18 pages where reference mode would need
one run per target (Module 13 alone would be 11 runs).

**Convergence holds for names, not for groupings** — Module 07 found the first exception.
It wrote `panic-disorder` and `agoraphobia` as two pages where the catalogue carried the
single slug `panic-disorder-and-agoraphobia`, and it was right: DSM-5 promoted agoraphobia
to an independent diagnosis, so the combined slug encoded how L3 *teaches* them rather than
how the manual *lists* them. The catalogue was split to match (migration
`20260731_split_panic_agoraphobia.sql`). Expect it again wherever the taxonomy bundled two
diagnoses into one row for lecture convenience — the model will un-bundle them, and it will
usually have the better case.

**Extracted mode for the foundations modules, native for the disorder chapters.** Measured
across five real runs: Modules 01–02 ran native at ~92k input tokens each, Module 03 ran
extracted at ~22k — a 4.2× saving on the same book, confirming the run plan's estimate. Prose
modules lose nothing to extraction; the disorder chapters must stay native because the criteria
and prevalence tables are the payload and a mangled table looks like a successful run.

**Triage between every run.** `api/ingest.js` builds the model's index from pages
with *accepted content only*, so an unreviewed page is invisible to the next run and
gets proposed afresh. Triage (accept-as-draft, ~5 min) is not the review; the real
~17-hour review happens later in the reader, where `edit_page` fixes things in place.

**Two reference targets against one module overlap, and there are two distinct ways it
happens.** See §7 — this is the main thing WP4 has taught so far, and both Module 02 and
Module 03 needed cleanup afterwards.

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
- **Reference mode used to duplicate its own target — fixed, and the fix holds.** Each
  Module 01 reference run produced its target *plus* a re-titled version of it
  (`history-of-mental-illness` alongside `historical-traditions`;
  `research-methods-in-psychopathology` alongside `research-methods`). Prompt fixed
  2026-07-31 and **confirmed on Modules 02 and 03**: four further reference runs, zero
  re-titled clones, every run landing on the exact catalogue slug and title. Consider this
  closed.
- **Reference mode does *not* suppress supporting pages** — an earlier version of this file
  claimed it did, and that was wrong. Module 02's two runs produced five (respondent and
  operant conditioning, observational learning, Little Albert, ECT, systematic
  desensitization); Module 03's produced three. They are good pages and the behaviour is
  welcome, but it is also what causes the collisions below, so plan for it.
- **Two reference targets against one module overlap. Two different mechanisms, both
  needing cleanup after the fact.**
  - *Concurrency* (Module 02). The two runs were launched 17 seconds apart, so neither saw
    the other's output and neither had been triaged. `electroconvulsive-therapy` and
    `systematic-desensitization` were each proposed twice, and the two target pages came
    back as near-duplicates — `models-of-psychopathology` and `integrative-model` shared
    three identically-titled sections and each covered the other's subject. **Run reference
    targets sequentially with triage between, broad target first.** The run plan's
    "reference mode is the exception to never-in-parallel" was written for conceptually
    disjoint targets and now says so.
  - *Pre-emption* (Module 03). Sequential with triage, and it still collided: run 1
    (`clinical-assessment`) invented a supporting page, `classification-systems`, whose
    content was a strict subset of `diagnosis-and-classification` — the catalogue target
    run 2 was always going to write. Archived afterwards. Triage-between-runs fixes
    duplicate *proposals*; it does nothing about a run-1 supporting page squatting on a
    slug the run plan already lists as a later target. **Guard: when a module feeds two
    catalogue slugs, check run 1's supporting pages against the next target's subject
    before accepting them.** `classification-systems` should have been rejected at triage.
- **A module can fail to support a catalogue page at all.** Module 02 produced a good
  `models-of-psychopathology` but cannot fill `integrative-model`: the textbook never states
  a formal integrative framework — no diathesis-stress, no biopsychosocial model, no
  RDoC/HiTOP — and offers no evidence that integrated accounts outperform single-model ones.
  `integrative-model` is now a ~2.8k-char page that is mostly a declared gap, which is the
  honest state. It needs a second source (NIMH's RDoC material is public domain), so treat it
  as a run-plan §4 uncovered topic rather than a completed page.
- **One gap, one page.** After Module 02 both `models-of-psychopathology` and
  `integrative-model` declared the same missing diathesis-stress material, so
  `reference_worklist` counted one hole against two pages and would have aimed a future run
  at whichever surfaced first. The gap now lives only on the page whose subject it is.
  Worth checking whenever two pages sit next to each other in the catalogue.
- **Gaps are derived from the page body**, not frontmatter (two migrations,
  2026-07-30). A section is a gap if it carries a `> **Needs research:**` marker or
  has no prose. This matters because `reference_worklist` reads it and that aims WP4.
- **Repeated skeletons are fixed at the source.** MDD once carried the six-section
  disorder skeleton three times, one copy per accepted `update`. Two prompt rules
  contradicted each other; paper mode now scopes the skeleton to `action: new`, and
  reference mode returns a whole page with `action: 'replace'`.
- **0 red links across 177** — but that graph is body links only; frontmatter
  relations are not in it (§4). This held through an archive: `archive_page` does *not*
  rebind inbound links the way `rename_page` does, so retiring `classification-systems`
  meant retargeting every reference first, then archiving. Do it in that order.
- **Tier A is now 53, Tier B 45** — all ten personality disorders promoted
  2026-07-31. Fall scope: 78 generated pages, ~17 review hours.
- **Review-then-edit is the working division of labour.** Norm runs the ingest and the
  accept/reject triage in the portal; Claude reviews the accepted pages afterwards and
  applies the trims with `edit_page` (or hands trimmed content straight to
  `review_proposal`, which avoids storing a bloated accepted version). Handing over a prose
  list of edits to re-key in the UI was tried once and produced a page with deleted headings
  but surviving body paragraphs. Prefer `position()`/`substr()` splicing over retyping long
  bodies — a missed anchor then raises instead of silently writing something mangled.

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

1. **Run Module 15 in reference mode** against `law-and-ethics`, extracted, citation row 15.
   Single target, so neither of the §7 overlap mechanisms can fire — the cleanest run left in
   the foundations set.
2. Then the disorder chapters in paper mode, lecture order, **native**, Module 16 last.
   Module 07 (anxiety) is the natural pilot for timing the real review — see run plan §7.
4. **Before the first publish**, decide open question 12 — whether frontmatter
   relations should join the link graph. It changes what "0 red links" means.
5. WP5 remains the schedule's real risk. Its external dependency is gone; the
   Ripple/`emailRedirectTo` decision and the R3 auto-verify are what's left.

One loose end: the 18 pages from the Module 04 paper run predate the attribution fix
and carry no `sources:` frontmatter of their own. They *are* attributed through
`wiki_page_provenance`. **Proposal: leave them, and have WP7's exporter synthesize
`sources:` from provenance at export time** — the database stays the single source of
truth and no page needs rewriting. The reader already takes this line.
