# PSY240 Field Guide — session handoff

> Rewritten 2026-08-02, after Module 13 and the switch to direct parse. Read this **plus**
> `psy240_wiki_plan.md` (architecture + sequencing), `psy240_taxonomy.md` (the catalogue) and
> **`psy240_wp4_runplan.md`** — which is now the operational manual: **§9 is the working method**,
> §8 is the gap map, §6 the sixteen citations. This file is the *state of play and open threads*;
> those three are the durable record. If they disagree with this file, they win — this one goes
> stale fastest.

---

## 0. What the next session is for

**Work through the whole textbook by direct parse (§9), and review what already exists.**

Norm's decision, 2026-08-02, after the Module 13 pilot: the ingest GUI stops being the route for
bulk textbook content and becomes what it was designed for — student submissions of peer-reviewed
papers (WP6). Textbook pages are written in-session instead.

Two things follow that are **not** yet done and are the next session's job:

1. **Finish the book.** Module 16 is the only unrun module, and it is the cross-cutting one
   (neurodevelopmental + conduct, *plus* pieces of anxiety, OCD, trauma and eating that other
   modules already established). It was always scheduled last for that reason.
2. **Review what exists.** Modules 01–12, 14 and 15 were written by the pipeline, source-first,
   before the catalogue-first method existed. They have not been re-read against the catalogue.
   Run plan §8.2's six stubs are the known cases; there may be more.

**Additional sources are coming.** Norm plans to supply further open-licensed texts, **including a
Canadian one**. That matters beyond variety: `law-and-ethics` already declares
`canadian-law-and-other-jurisdictions` as a gap, the taxonomy flags Canadian relevance as a course
requirement, and run plan §4's eight uncovered Tier A pages need non-WSU sources anyway. Treat a new text as
a new `ingest_jobs` row with its own citation — the §9 recipe is source-agnostic.

---

## 1. Where the work stands

| WP | State |
|---|---|
| WP0 decisions | ✔ done |
| WP1 schema | ✔ done, applied live |
| WP2 reader UI | ✔ done, click-tested, deployed — `/academic/fieldguide/wiki` |
| WP3 seed + review path + review UI + `reference` mode | ✔ done, heavily exercised |
| **WP4 content sprint** | **▶ in progress.** 15 of 16 modules done. Method switched to direct parse (§9) after Module 13. Remaining: **Module 16**, then the reference pass |
| WP5 roster & enrollment | ✘ not started. Email path configured; **one decision left** (§5) |
| WP6 student submission | ✘ not started — but the ingest GUI is now earmarked for it |
| WP7 export mirror | ✘ not started |

Everything is merged and pushed to `main`; nothing sits on a branch.

## 2. Live database state (radlab-academic, 2026-08-02, after Module 13)

```
186 pages with bodies        0 published — no student can see anything yet
660 wikilinks                0 proposals pending — review queue clear
3 red links                  0 blue links to an empty page
0 duplicate headings         0 off-catalogue disorder pages
130 catalogue rows           37 ingest jobs, ~1.77M input / ~408k output tokens
```

**Catalogue coverage: Tier A 40/54, Tier B 14/46, foundations 13/14, overviews 1/16.**

Tier A by lecture — L3 **10/10**, L4 **4/4**, L5 **4/4**, L6 3/5, L7 **0/5**, L8 4/5, L9 **2/2**,
L10 3/9, L11 **10/10**. Six lectures complete.

The 3 red links are healthy: `adhd`, `conduct-disorder` and `brief-psychotic-disorder` are real
catalogue slugs not yet written. A red link to an unwritten catalogue page is the designed state.

Nothing has ever been published. Every accept is *accept as draft* — no students are enrolled, so
publishing buys nothing and is the harder direction to reverse.

## 3. How to work on this

**Use the `supabase-academic` MCP server** — it points at `qldgwpneygvgcvexlduz`. The plain
`supabase` server is the **main** radlab project; querying it for `wiki_pages` fails in a way that
looks exactly like a failed migration. This has cost time twice.

**The MCP's `execute_sql` intermittently returns "Failed to execute SQL query"** on valid SQL. It is
transient — retry the same query. Confirmed transient again on 2026-08-01 (an identical retry
succeeded); do not start debugging the SQL.

**Read-only check scripts** live in `supabase/checks/` — `wp1_verify.sql`, `wp1_ingest_smoke.sql`,
`wp3_review_state.sql`, **`wiki_merge_health.sql`** (duplicate headings, unexplained shrinkage,
provenance leaking into headings, pending deltas that will collide), and the ⚠ dangerous
`wp3_reset_review_state.sql`.

**Migrations** go in `supabase/migrations/` as `YYYYMMDD_description.sql`, are applied via MCP
`apply_migration`, and get a row in `supabase/migrations/README.md` with evidence. Add the row.

**`npm run dev` cannot run the Field Guide** — the client fetches its Supabase config from
`GET /api/ingest`, which only exists on Vercel. Use a deploy.

### The write path (all staff-only SECURITY DEFINER functions)

`wiki_pages` has **no authenticated write policies**. Everything goes through one of these, each
with an internal `is_course_staff()` check:

| Function | Purpose |
|---|---|
| `review_proposal(version_id, decision, content, publish)` | Accept/reject a *pending* proposal. **Pass `false` for publish** — accepts are drafts |
| `edit_page(page_id, content, note)` | Correct an accepted page. History automatic; note required |
| `rename_page(page_id, new_slug, new_title)` | Move to a different slug; rebinds links, reports what it orphaned |
| `archive_page` / `restore_page` / `unpublish_page` | Retire, un-retire, unpublish. Reason mandatory |

Impersonate the instructor inside a transaction:
`SET LOCAL request.jwt.claims = '{"sub":"3cad8ace-5c5f-41d4-b624-4da49e0e375d","role":"authenticated"}'`
(that is `auth_user_id`; the `identity.people` id is `45db45f9-eebb-4d1b-991d-1829cdb71c2a`, which is
what `created_by` columns want).

### Two derived signals, and the difference between them

- **`needs`** — sections that are **empty placeholders**, no prose at all. Instructor work.
- **`annotations`** — sections with real content that still carry a `Needs research` line naming a
  sub-gap. Computed on the fly by `extract_page_annotations(content)`. **Student work.**

Both come from one parser (`extract_page_sections`) so they cannot drift. Currently **95 empty
sections and 52 annotations**. `reference_worklist` and `wiki_gap_report` expose both.

## 4. The method — read run plan §9 before writing anything

Short version, because getting it wrong breaks the licence:

- Write into `ingest_jobs` + `kind='proposed'` versions + `review_proposal()`. **Never `edit_page()`
  for new content** — `wiki_page_provenance` joins on `kind='proposed'` and `job_id`, so an
  `edit_page` write shows **no sources** under *Built from*.
- **HTML primary, native PDF for images.** The book HTML is
  `F:\gits\radlab_project\PSY240resources\Fundamentals-of-Psychological-Disorders-1721254433.html`.
  Replace `<img>` with a visible marker when converting so figures cannot be silently dropped, then
  read those PDF pages with the Read tool. Module 13's Table 13.1 was invisible to both text formats
  and supplied the epidemiology for ten pages.
- **Catalogue-first.** Pull the lecture's slugs, tiers and existing `needs` *before* writing. This is
  what eliminated the whole class of carve and slug failures in run plan §8.
- Run the run plan §8 checks before accepting; close the job afterwards.

## 5. Open decisions

1. ~~Roster ownership~~ — **R3** (radlab-academic owns it; Lecture Lounge verifies via
   `api/roster-check.js`).
2. **How PSY240 students avoid Ripple onboarding — still open.** Verified 2026-07-30: `/class/:slug`
   is wrapped in `AuthRoute`, not `ProtectedRoute`, so it never passes through the onboarding chain,
   and magic-link signup gets a `profiles` row from the `on_auth_user_created` trigger. **The
   decision reduces to which `emailRedirectTo` the invite uses.** The genuine main-project work in
   WP5 is the R3 **auto-verify** — a roster hit setting `utoronto_verified_at`.
3. ~~Roster CSV source~~ — **Quercus**.
4. ~~Resend~~ — **done**.
5. **Does a linked debate page discharge a `contested` gap?** Raised by Module 06, unresolved — run
   plan §8.8 states both options. It changes what the student list contains, so settle it before
   publishing that list.
6. **Are the study pages worth keeping?** Five per-module `fundamentals-psychological-disorders-*`
   pages now exist with **zero inbound links each**, while the journal-article study pages have 2–4.
   Norm has accepted them each time; flagged, not re-litigated.

Also open, not blocking: the **CDDR licence variant** (30-second check of the PDF's copyright page),
and **plan open question 12** — frontmatter `related:` entries never reach `wiki_links`, so
"0 red links" certifies the body graph only.

## 6. What is left to write

**Module 16, by direct parse.** The cross-cutting one: neurodevelopmental (intellectual disability,
learning, autism, tics) and ADHD; conduct/ODD/intermittent explosive; *plus* pieces of anxiety
(selective mutism, separation anxiety), OCD (trichotillomania, excoriation), trauma (RAD,
disinhibited social engagement) and eating (pica, rumination, ARFID). Run last deliberately so it
writes **updates onto pages the proper chapter module already established** — expect many small
deltas and a fuller triage. It closes 6 of L10's 9 Tier A entries.

**Watch `adhd`.** It is the last abbreviated catalogue slug, kept deliberately because the
abbreviation is canonical in the field — unlike `-ncd`, which was retired on 2026-08-02 after three
consecutive runs missed it. Module 16 tests whether that judgement holds.

**Then the reference pass:**

- **The 16 overviews.** Only `neurocognitive-disorders` exists, written 2026-08-02 — and by accident,
  when a run aimed at `vascular-ncd` targeted the overview slug instead. It came out at 15,174 chars
  with zero empty sections, which is good evidence the rest will go well.
- **The 8 Tier A pages with no textbook source** (run plan §4): all of Lecture 7 (sexual dysfunctions, gender
  dysphoria, paraphilic disorders), sleep-wake, and `gambling-disorder` — gambling appears **zero
  times** in Module 11, verified over the whole extraction. L7 also holds the two pages the taxonomy
  flagged for **rewrite-level** review at ~30 min each.
- **The mood block.** `bipolar-i-disorder` (2,845 chars), `bipolar-ii-disorder` (1,914) and
  `persistent-depressive-disorder` are thin, and **Module 04 has already run** — no scheduled work
  will revisit them. Top of the core-text list in run plan §8.6.
- **`suicide-and-self-harm`** — the only unwritten foundation, uncovered by the textbook.

**And the review pass Norm asked for**: Modules 01–12, 14, 15 were written source-first, before the
catalogue-first method. The six stubs in run plan §8.2 are the known cases. Re-reading them against the
catalogue is explicitly part of the next session's scope.

## 7. Lessons that still bind

These were paid for. Direct parse removes the *cause* of several (it is not one-shot, so a run
cannot pre-empt itself), but the corpus-shape rules apply regardless of who writes the page.

- **One gap, one page.** After Module 02 both `models-of-psychopathology` and `integrative-model`
  declared the same missing diathesis-stress material, so `reference_worklist` counted one hole
  against two pages. A gap belongs on the page whose subject it is. Check this whenever two pages
  sit adjacent in the catalogue.
- **A source can fail to support a catalogue page at all.** The textbook never states a formal
  integrative framework — no diathesis-stress, no biopsychosocial model, no RDoC/HiTOP — so
  `integrative-model` is a ~2.8k-char page that is mostly a declared gap. That is the honest state,
  not a defect. It needs a second source (NIMH's RDoC material is public domain). **A new
  Canadian/open text is the natural fix for pages in this class.**
- **Check a supporting page against later catalogue targets before accepting it.** Module 03's
  first run invented `classification-systems`, a strict subset of `diagnosis-and-classification`,
  which the second run was always going to write. Archived afterwards. Catalogue-first makes this
  much less likely — you can see the later targets — but the check is still the guard.
- **`archive_page` does not rebind inbound links** the way `rename_page` does. Retarget every
  inbound reference *first*, then archive. In that order.
- **Gaps are derived from the page body**, never frontmatter: a section is a gap if it carries a
  `> **Needs research:**` marker or has no prose. `reference_worklist` reads this, and that aims
  the reference pass.
- **Review-then-edit is the working division of labour** — and it now has a new shape. Norm ran
  the ingest and triage in the portal; Claude reviewed afterwards and applied trims. Handing over a
  *prose list* of edits to re-key was tried once and produced a page with deleted headings but
  surviving body paragraphs. Prefer `position()`/`substr()` splicing over retyping long bodies — a
  missed anchor raises instead of silently writing something mangled.
- **Attribution must not depend on the model.** It is derived from the ingest record via
  `wiki_page_provenance`, so a citation is correctable after the fact **at the job**, and every
  page built from it updates itself. This is the whole reason §4's `edit_page` prohibition matters.

## 8. Gotchas that cost time

- **`update` proposals are DELTAS** — accepting one verbatim replaces the page with the addendum.
  Guarded server-side and pre-merged in the UI, but if you call `review_proposal()` yourself,
  **pass the merged content, not the delta**. This truncated `biofeedback` 2,428 → 1,565 chars.
- **Views default to security-definer in Postgres.** Every view over a roster-gated table must set
  `security_invoker=true`. Narrow privileged reads are SECURITY DEFINER *functions* with a
  membership check, never views.
- **`CREATE OR REPLACE VIEW` cannot reorder or rename existing columns** — new ones append last.
- **A data-modifying CTE's rows are invisible to the rest of the same statement**, and the
  Management API returns only the last statement's result set. Multi-step SQL needs separate
  statements, or a self-aborting `DO` block that `raise`s a summary.
- **`FROM a, b JOIN c ON … a.col` does not parse** — `JOIN` binds tighter than the comma. Use
  `CROSS JOIN`.
- **`wiki_pages_bind_links()` only binds, never unbinds** — hence `rename_page` cleaning up after
  itself and reporting orphans. `link_disorder_page()` has the same gap.
- **DOI slugs are opaque** — harvest them, never compute them. `wp1_verify.sql` check 5 guards it.
- **The working copy is CRLF** (`core.autocrlf`). `\n`-based anchors in scripts fail silently.
- **Content with backticks must go through a file**, not an inline shell string — command
  substitution eats it. This cost three separate attempts in one session.

## 9. Infrastructure that is done and shouldn't be re-litigated

- **Model: `claude-opus-5`** at **`effort: medium`** — measured better than `high` here, not merely
  cheaper (2.21 chars of page per output token against 2.08, run plan §5). A refusal retries once on
  `claude-opus-4-8`; the syllabus is full of material that can false-positive a safety classifier.
- **The 300s Vercel ceiling is real** — Hobby plan, cannot be raised. `api/ingest.js` now fails
  itself on a shared wall-clock deadline rather than being killed silently. Direct parse sidesteps
  it entirely.
- **Guards that took real incidents to build**, all still live and all still wanted for WP6:
  `reconcileCollidingUpdate` (a delta restating existing sections becomes a `replace`), the
  placeholder-aware wiki index (`existing sections` + `empty placeholder sections`), the
  reject-drops-the-shell fix, and `wiki_merge_health.sql`.
- **Email:** radlab-academic sends via Resend SMTP.
