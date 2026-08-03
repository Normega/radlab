# PSY240 Field Guide — session handoff

> Rewritten 2026-08-02, after Module 16 closed the textbook sweep and the companion volume closed
> 34 of the 36 gaps it left. Read this **plus**
> `psy240_wiki_plan.md` (architecture + sequencing), `psy240_taxonomy.md` (the catalogue) and
> **`psy240_wp4_runplan.md`** — the operational manual: **§9 is the working method**, **§10 is the
> brief for new sources**, §8 the gap map, §6 the sixteen citations. This file is the *state of play
> and open threads*; those three are the durable record. If they disagree with this file, they win —
> this one goes stale fastest.

---

## 0. What the next session is for

**The textbook is finished. The work is now (a) second sources and (b) the review pass.**

All sixteen modules are ingested. Every Tier A page the WSU textbook can support exists. What
remains is not more of the same sweep — it is four specific things, and run plan **§10** is the
brief for them. In yield order:

1. ~~Ingest *Behavioral Disorders of Childhood*~~ — **done 2026-08-02.** It filled Etiology and
   Treatment on **17 of the 18** Module 16 pages (all but `communication-disorders`, which has no
   chapter there either), taking corpus empty sections **142 → 108** and annotations **60 → 79**.
   Run plan §10.4 records the method and what it did *not* fix. Two consequences carry forward:
   `contested` is still empty on nine pages, and the companion's treatment sections are **entirely
   US-institutional**, so the Canadian requirement below is now sharper, not softer.
2. ~~Tier A~~ — **complete at 54/54.** `gambling-disorder` was the last, written from Menchón et al.
   (2018, CC BY) plus the NRC (1999) criteria history (§14). Overviews are complete at 16/16.
3. ~~`suicide-and-self-harm`~~ — **done from Davies ch 22 (§15).** ⚠ **One urgent follow-up:** the page
   gives the US crisis line (988) only. The **Canadian 9-8-8 Suicide Crisis Helpline** and provincial
   services must be added **with number and hours verified before anything is published** — it is the
   one line a student in distress might act on.
4. ~~The 13 unwritten overviews~~ — **10 done 2026-08-02**, taking overviews 3/16 → 13/16 with
   zero empty sections (run plan §10.5). The remaining three — `sleep-wake-disorders`,
   `paraphilic-disorders`, `sexual-dysfunctions` — are **blocked by item 2**: every one of their
   member pages is unwritten, so there is nothing to map. Check member coverage before scheduling
   an overview.

**Norm is supplying additional open-licensed material, including a Canadian text.** Run plan §10.2
lists where a US source is not merely foreign but *wrong for the course*: duty to warn (Tarasoff vs
*Smith v Jones*), all conduct/disruptive prevalence, provincial rather than US special-education
identification, CADDRA/CANMAT practice guidance, fetal alcohol spectrum disorder (absent from the
WSU book entirely), and Canadian suicide statistics.

**The review pass Norm asked for is still outstanding.** Modules 01–12, 14 and 15 were written
source-first, before the catalogue-first method existed. Run plan §8.2's six stubs are the known
cases. Module 16's corpus check already turned up one unknown case — a broken wikilink on
`historical-traditions`, now fixed — which is evidence the pass is worth running properly.

---

## 1. Where the work stands

| WP | State |
|---|---|
| WP0 decisions | ✔ done |
| WP1 schema | ✔ done, applied live |
| WP2 reader UI | ✔ done, click-tested, deployed — `/academic/fieldguide/wiki` |
| WP3 seed + review path + review UI + `reference` mode | ✔ done, heavily exercised |
| **WP4 content sprint** | **Module sweep ✔ complete — all 16 modules in.** ▶ now: second sources (run plan §10), the reference pass, and the review pass |
| WP5 roster & enrollment | ✘ not started. Email path configured; **one decision left** (§5) |
| WP6 student submission | ✘ not started — the ingest GUI is earmarked for it |
| WP7 export mirror | ✘ not started |

Everything is merged and pushed to `main`; nothing sits on a branch.

## 2. Live database state (radlab-academic, 2026-08-03, after the Lecture 8 block)

```
259 pages with bodies       0 published — no student can see anything yet
1,426 wikilinks             0 proposals pending — review queue clear
4 red links                 0 off-catalogue red links
0 duplicate headings        0 off-catalogue disorder pages
131 catalogue rows         169 ingest jobs
68 empty sections           major-tier gaps: 9 across 8 pages
298 annotations             3 catalogue pages not yet written (all Tier B)
```

**Catalogue coverage: Tier A 54/54, foundations 14/14, overviews 16/16 — all complete. Tier B 33/46 is the only incomplete tier.**

Tier A by lecture — L3 **10/10**, L4 **4/4**, L5 **4/4**, L6 3/5, L7 **0/5**, L8 4/5, L9 **2/2**,
L10 **9/9**, L11 **10/10**. Six lectures complete. **Every remaining Tier A gap is a page the
textbook does not cover** — the list is closed and is item 2 above.

All 19 red links point at real catalogue slugs not yet written (`suicide-and-self-harm` ×7 inbound,
`brief-psychotic-disorder`, `hypersomnolence-disorder`, `kleptomania`, `pyromania`). A red link to
an unwritten catalogue page is the designed state; a red link to a *non*-catalogue slug is a defect,
and there are now none.

**Empty sections went 95 → 142 → 108 in one day, and both moves were correct.** Module 16 added 36
holes that were its declared scope limit rather than an extraction failure (§4, run plan §9.7); the
companion volume then closed 34 of them (run plan §10.4). **Watch annotations, not just empty
sections** — instructor-sized holes become present prose carrying student-sized asks.

**Correction (2026-08-03): every annotation figure previously quoted here was a filtered subset.**
`reference_worklist.annotation_count` only counts annotations on pages that still have a derived
gap, so a page that closes its last empty section drops out of the view and its
`> **Needs research:**` markers stop being counted. The view reports **33**; the corpus actually
holds **298 across 139 pages** — more than half of it. Derived-gap tracking is unaffected and
remains sound, but closing the last major-tier gaps will not empty the backlog. Count directly:
`SELECT sum((length(content)-length(replace(content,'Needs research:','')))/length('Needs research:')) FROM wiki_pages WHERE content IS NOT NULL;`

Nothing has ever been published. Every accept is *accept as draft* — no students are enrolled, so
publishing buys nothing and is the harder direction to reverse.

**The major tier is nearly closed, and that changes what the binding constraint is.** Nine pages hold
the last 13 gaps (§6). Once they are done, "what to write next" stops being the question and
**publishing** becomes it — which carries the `student-support-resources` verification obligation
(every phone number and URL re-checked before students get access, and each term). Two things to
settle before a first publish: whether Tier B's 10 unwritten pages should land first, and that
**`norman@radlab.zone` has no enrollment** — it authenticates and is then denied. `kavabee@gmail.com`
is ta/active and `norman.farb@utoronto.ca` is instructor/active.

## 3. How to work on this

**Use the `supabase-academic` MCP server** — it points at `qldgwpneygvgcvexlduz`. The plain
`supabase` server is the **main** radlab project; querying it for `wiki_pages` fails in a way that
looks exactly like a failed migration. This has cost time twice.

**The MCP's `execute_sql` intermittently returns "Failed to execute SQL query"** on valid SQL. It is
transient — retry the same query. Do not start debugging the SQL.

**Two extractors, one converter.** `scripts/lib/pressbooks-md.mjs` holds the HTML→markdown logic;
both extractors use it, so two source formats cannot drift apart.

- **`scripts/wsu-module-extract.mjs`** — slices a module out of a Pressbooks **XHTML export**
  (the parent book). `--list` prints every chapter's byte offset and size. `WSU_BOOK_HTML` repoints it.
- **`scripts/pressbooks-wxr-extract.mjs`** — extracts chapters from a Pressbooks **WXR** export
  (`.xml`), for books that publish no XHTML. `--list` lists chapters; `--out DIR` writes one `.md` each.

Both convert `<img>` to a visible `[[IMAGE: file]]` marker — **do not reimplement that casually**, it
is what stops a figure vanishing silently. Read any marker off the native PDF page with the Read tool.

**If a source will not download, stop and ask Norm.** Standing rule from 2026-08-02: the companion
volume's XHTML export 500s, and rather than asking, the session built a nine-page live scraper as a
workaround. Norm had the WXR and the PDF and supplied both. The WXR is also strictly better — one
local file, reproducible, no site dependency.

**Read-only check scripts** live in `supabase/checks/` — `wp1_verify.sql`, `wp1_ingest_smoke.sql`,
`wp3_review_state.sql`, **`wiki_merge_health.sql`**, and the ⚠ dangerous
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
what `created_by` columns want). Accepting a batch is a `DO` block looping `review_proposal()`; make
it `RAISE EXCEPTION` with a count first to dry-run it, then swap to `RAISE NOTICE` to commit.

### Two derived signals, and the difference between them

- **`needs`** — sections that are **empty**, no prose at all. Instructor work.
- **`annotations`** — sections with real content that still carry a `Needs research` line naming a
  sub-gap. Computed on the fly by `extract_page_annotations(content)`. **Student work.**

Both come from one parser (`extract_page_sections`) so they cannot drift. **A section whose only
content is a `> **Needs research:**` blockquote still counts as empty** — the marker does not supply
prose. That is deliberate and useful: it lets an instructor gap say what is missing without
reclassifying itself as student work. Currently **142 empty sections and 60 annotations**.
`reference_worklist` and `wiki_gap_report` expose both.

## 4. The method — read run plan §9 before writing anything

Short version, because getting it wrong breaks the licence:

- Write into `ingest_jobs` + `kind='proposed'` versions + `review_proposal()`. **Never `edit_page()`
  for new content** — `wiki_page_provenance` joins on `kind='proposed'` and `job_id`, so an
  `edit_page` write shows **no sources** under *Built from*. (`edit_page()` is right for *fixing* an
  accepted page, as with the `historical-traditions` link.)
- **HTML primary, native PDF for images**, via `scripts/wsu-module-extract.mjs`.
- **Catalogue-first.** Pull the lecture's slugs, tiers and existing `needs` *before* writing. This is
  what eliminated the whole class of carve and slug failures in run plan §8. It also means
  **declining** material: Module 16 covers pica, rumination, enuresis, encopresis and stereotypic
  movement disorder at length, none of which has a catalogue slug, so none got a page.
- Run the run plan §8 checks before accepting; close the job afterwards.

**Know which kind of gap you are looking at** — three classes look identical in a count and have
different remedies:

| Class | Example | Remedy |
|---|---|---|
| Not in the source at all | `gambling-disorder` in Module 11 | A different source (§4 / §10.1b) |
| Present but carved differently | alcohol/cannabis/opioid/stimulant in Module 11 | Reference mode against the same source |
| **Out of the source's declared scope** | Module 16's etiology and treatment | The companion volume that holds it |

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
6. **Are the study pages worth keeping?** Eleven per-module `fundamentals-psychological-disorders-*`
   pages exist with **zero inbound links each**, while the journal-article study pages have 2–4.
   They are a pipeline artefact — **direct parse does not create them**, so Modules 13 and 16 have
   none, and the set is now permanently incomplete (missing 2, 3, 13, 15, 16). Either backfill or
   retire; leaving eleven of sixteen is the one option with nothing to recommend it.
7. **New — do pica, rumination, enuresis, encopresis and stereotypic movement disorder belong in the
   catalogue?** Module 16 covers all five substantively and none has a slug, so the material was
   deliberately dropped. That is correct under catalogue-first, and it is also the catalogue's call
   to revisit, not the sweep's. Cheap to add if wanted; the source text is already extracted.

Also open, not blocking: the **CDDR licence variant**, and **plan open question 12** — frontmatter
`related:` entries never reach `wiki_links`, so "0 off-catalogue red links" certifies the body graph
only.

## 6. What is left to write

**The major tier is down to 9 pages and 13 gaps**, and the list is closed:

| Page | Tier | Missing |
|---|---|---|
| `illness-anxiety-disorder` | A | etiology, treatment |
| `functional-neurological-symptom-disorder` | A | treatment |
| `adjustment-disorders` | A | etiology |
| `exhibitionistic-disorder` | A | etiology |
| `integrative-model` | foundation | comparative-evidence |
| `research-methods` | foundation | evaluating-the-evidence-base |
| `sleep-wake-disorders` | overview | contested |
| `elimination-disorders` | overview | encopresis |

**Three catalogue pages remain unwritten**, and two of them bundle with the sleep overview's last
gap: `hypersomnolence-disorder` and `circadian-rhythm-sleep-wake-disorders` (L6, DSM ch.12), plus
`brief-psychotic-disorder` (L9, DSM ch.2). Writing the sleep pair should be paired with
`sleep-wake-disorders`'s `contested` gap in one source pass.

`transvestic-disorder` needs its own search — it is **absent from the paraphilias pharmacological
review entirely** (run plan §24).

Older brief, largely worked through — run plan **§10**. In one line each:

- **The companion volume** — closes 36 etiology/treatment gaps across Module 16's 18 pages.
- **8 Tier A pages with no textbook source** — L7 entire (`erectile-disorder`,
  `female-sexual-interest-arousal-disorder`, `gender-dysphoria`, `exhibitionistic-disorder`,
  `pedophilic-disorder`), `insomnia-disorder`, `narcolepsy`, `gambling-disorder`. L7 also holds the
  two pages the taxonomy flagged for **rewrite-level** review at ~30 min each.
- **`suicide-and-self-harm`** — 7 inbound red links, no source in the textbook.
- **13 overviews** — reference pass. The three that exist came out at 9.4k–15.2k chars with zero
  empty sections, so the pattern holds.
- **The mood block.** `bipolar-i-disorder` (2,845 chars), `bipolar-ii-disorder` (1,914) and
  `persistent-depressive-disorder` are thin and **Module 04 has already run** — nothing scheduled
  will revisit them. Top of the core-text list in run plan §8.6.
- **The review pass** on Modules 01–12, 14, 15.

**`adhd` held up.** It was the last abbreviated catalogue slug, kept deliberately because the
abbreviation is canonical in the field — unlike `-ncd`, retired on 2026-08-02 after three runs
missed it. Module 16 hit it correctly, so the judgement stands.

## 7. Lessons that still bind

These were paid for. Direct parse removes the *cause* of several, but the corpus-shape rules apply
regardless of who writes the page.

- **One gap, one page.** After Module 02 both `models-of-psychopathology` and `integrative-model`
  declared the same missing diathesis-stress material, so `reference_worklist` counted one hole
  against two pages. A gap belongs on the page whose subject it is.
- **A source can fail to support a catalogue page at all** — and it can also *declare* that it will
  not. `integrative-model` is the first kind (the textbook states no formal integrative framework).
  Module 16's etiology and treatment are the second, and the difference matters: the second names
  its own remedy. Both are honest states, not defects.
- **Check a supporting page against later catalogue targets before accepting it.** Module 03's first
  run invented `classification-systems`, a strict subset of `diagnosis-and-classification`. Archived
  afterwards.
- **`archive_page` does not rebind inbound links** the way `rename_page` does. Retarget every
  inbound reference *first*, then archive. In that order.
- **Gaps are derived from the page body**, never frontmatter.
- **Review-then-edit is the working division of labour.** Norm runs ingest and triage in the portal;
  Claude reviews afterwards and applies trims. Handing over a *prose list* of edits to re-key was
  tried once and produced a page with deleted headings but surviving body paragraphs. Prefer
  `position()`/`substr()` splicing over retyping long bodies — a missed anchor raises instead of
  silently writing something mangled.
- **Attribution must not depend on the model.** It is derived from the ingest record via
  `wiki_page_provenance`, so a citation is correctable after the fact **at the job**, and every page
  built from it updates itself. This is the whole reason §4's `edit_page` prohibition matters.

## 8. Gotchas that cost time

- **`update` proposals are DELTAS** — accepting one verbatim replaces the page with the addendum.
  Guarded server-side and pre-merged in the UI, but if you call `review_proposal()` yourself,
  **pass the merged content, not the delta**. This truncated `biofeedback` 2,428 → 1,565 chars.
- **`ingest_jobs.status` has no `'running'` value** — the check constraint allows only `uploaded`,
  `processing`, `done`, `failed`.
- **Views default to security-definer in Postgres.** Every view over a roster-gated table must set
  `security_invoker=true`. Narrow privileged reads are SECURITY DEFINER *functions* with a
  membership check, never views.
- **`CREATE OR REPLACE VIEW` cannot reorder or rename existing columns** — new ones append last.
- **A data-modifying CTE's rows are invisible to the rest of the same statement**, and the
  Management API returns only the last statement's result set. Create shells in one statement,
  insert versions in the next.
- **`FROM a, b JOIN c ON … a.col` does not parse** — `JOIN` binds tighter than the comma. Use
  `CROSS JOIN`.
- **`wiki_pages_bind_links()` only binds, never unbinds** — hence `rename_page` cleaning up after
  itself and reporting orphans. `link_disorder_page()` has the same gap.
- **DOI slugs are opaque** — harvest them, never compute them. `wp1_verify.sql` check 5 guards it.
- **The working copy is CRLF** (`core.autocrlf`). `\n`-based anchors in scripts fail silently.
- **Content with backticks must go through a file**, not an inline shell string — command
  substitution eats it. Dollar-quoted SQL through the MCP is fine and is how the module batches go in.

## 9. Infrastructure that is done and shouldn't be re-litigated

- **Model: `claude-opus-5`** at **`effort: medium`** — measured better than `high` here, not merely
  cheaper (run plan §5). A refusal retries once on `claude-opus-4-8`; the syllabus is full of
  material that can false-positive a safety classifier.
- **The 300s Vercel ceiling is real** — Hobby plan, cannot be raised. Direct parse sidesteps it.
- **Guards that took real incidents to build**, all still live and all still wanted for WP6:
  `reconcileCollidingUpdate`, the placeholder-aware wiki index, the reject-drops-the-shell fix, and
  `wiki_merge_health.sql`. **The pipeline is no longer exercised by module runs** and needs a
  deliberate test pass before students touch it.
- **Email:** radlab-academic sends via Resend SMTP.
