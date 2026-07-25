# PSY240 Field Guide — Wiki architecture & course-core plan

> Planning doc, 2026-07-25. Author: planning session with Norm.
> Scope: (1) how to build the wiki, (2) how to build the DSM-5-TR core of PSY240
> without a textbook, (3) how student contributions land in it.
>
> Context already built (see website.md §29a): `radlab-academic` Supabase project
> (courses / enrollments / invites / `identity` schema / `ingest_jobs`), `api/ingest.js`
> (PDF → Anthropic → wiki-page JSON, native mode default), staff portal at
> `/academic/fieldguide/ingest`. Phase 2 — student submission, review queue, wiki
> publishing — is designed but not built. **This doc is the Phase 2 plan of record.**

---

## 0. What the wiki actually has to do

The architecture question is not "which static site generator" — it's "which of these
requirements are cheap in which system." Requirements, derived from the course design:

| # | Requirement | |
|---|---|---|
| R1 | Read by ~200–400 undergrads, mobile-first, fast | table stakes |
| R2 | Access control tied to the **course roster** (or a deliberate decision to be public) | |
| R3 | Students contribute PDFs + their own annotation **without git literacy** | hard requirement |
| R4 | Instructor/TA **review before publish** — quality, copyright, contradiction resolution | hard requirement |
| R5 | **Attribution + participation evidence** per student, exportable for grading | hard requirement |
| R6 | Wikilinks, backlinks, search, graph — the things that make it a wiki | |
| R7 | Accumulates across terms; index survives and grows | |
| R8 | One person maintains it; near-zero marginal cost | |

R3–R5 are what separate a *course wiki* from a *notes site*. They are all database
problems. R6 is the only requirement a static generator wins on outright.

---

## 1. Architecture options

### A. Quartz + Cloudflare Pages (the current prototype)

Markdown files in git → Quartz build → Cloudflare Pages. Obsidian as the authoring tool.

**Pros**
- Already prototyped and working (`interoception.radlab.zone`), so the risk is known.
- The ingest prompt in `api/ingest.js` **already emits markdown with YAML frontmatter and
  lowercase-hyphenated wikilink filenames** — it was written for exactly this target.
- Backlinks, graph view, full-text search, ToC, tag pages: free, no build.
- Obsidian is an excellent instructor authoring environment (local, fast, vault-wide search).
- Content is plain files in git: permanent, portable, versioned, diffable, and it outlives
  the platform. This is a real and underrated advantage.
- Free hosting, static, fast, resilient. Publishing = a commit.

**Cons**
- **The write path is git.** Students cannot contribute without PRs. Building a bridge
  (portal → commit via GitHub API) means you're building the contribution system anyway,
  and now it spans two systems.
- **No roster-aware auth.** Cloudflare Access gates by email list or IdP, all-or-nothing;
  it does not know your `enrollments` table, roles, or course/term scoping.
- No review queue, no version-approval workflow, no participation metrics without a second
  system. `action: "update"` from the ingest becomes a *file merge in git* — much harder to
  present for review than a row diff.
- Every publish is a full site rebuild; 300 student page-sets means constant rebuilds.
- Per-page discussion needs a third party (giscus/utterances) — another auth realm.
- Second domain, second deploy target, second mental model, no integration with Lecture
  Lounge or the rest of the academic partition.

**Verdict:** best reader experience for the least build cost; worst contribution and
grading story. Good prototype, wrong production spine for a course with 300 contributors.

---

### B. Native React wiki in `src/academic/fieldguide/`, Postgres-backed — **recommended**

Wiki pages as rows in `radlab-academic`. Reader + editor + review queue as lazy-loaded
pages in the existing academic partition. `react-markdown` + `remark` for rendering.

**Pros**
- **One stack, one deploy, one design system, one auth realm.** Roster, roles, invites,
  and course scoping already exist and are already enforced by RLS.
- The ingest already writes its JSON **into this database**. Publishing becomes an
  `INSERT`/merge on review, not a git commit. `action: "update"` becomes a proposed row
  diff — reviewable in a UI you can actually build.
- R4/R5 are tables and one RPC. You have built this exact shape twice already: the
  Lecture Lounge participation matrix + CSV export (`get_class_participation`), and the
  admin review surfaces. The patterns are in the repo.
- Postgres full-text search (`tsvector`) for search; `pgvector` later for "related pages"
  and semantic clustering across student submissions — neither is possible in a static build.
- Cross-links into Lecture Lounge: a lecture check-in can point at a disorder page; a
  disorder page can show that class's poll results. Same DB, same term, same roster.
- Mobile handled by the platform's existing responsive system.

**Cons**
- **You build the wiki chrome**: markdown render, wikilink resolution, backlinks, ToC,
  search UI, page history, diff view, edit form. Bounded and well-understood — estimate
  ~4–5 work packages — but it is real work, and it's work Quartz gives away.
- No Obsidian authoring unless you add a markdown import/export path (worth adding; see C).
- Content lives in a DB → needs a backup story. Nightly markdown export to git is the
  mitigation, and it happens to hand you option A for nearly free.
- Graph view is the one Quartz feature that's genuinely annoying to reimplement. Treat it
  as optional/nice-to-have, not a launch requirement.

**Verdict:** recommended. The expensive parts of this course — contribution, moderation,
attribution, grading, reuse across terms — are database problems, and the database, auth,
roster, and ingest pipeline are already built and live. The wiki chrome is the cheap part.

---

### C. Hybrid: Postgres is the source of truth, static export mirrors it publicly

B, plus a build step that renders published pages to markdown files → Quartz → public site.

**Pros**
- Authenticated authoring and review in-platform; polished public artifact for the world.
- The export is strictly **one-way and generated**, so there's no two-master sync problem —
  the failure mode that makes most hybrids a mistake.
- Gives you the permanent git archive (A's best property) and a public course artifact that
  is genuinely nice to point at: "here is what my class built."
- Also gives an Obsidian round-trip if you want one.

**Cons**
- Two deploy targets; publish latency; two URLs to explain to students.
- Only worth it if public reading actually matters to you.

**Verdict:** the right *end state* if you want a public wiki — but **sequence it**. Build B
for fall, add the exporter in term 2 once the content has been reviewed once by a human.
Do not build both at once.

---

### D. Off-the-shelf wiki — Wiki.js, BookStack, Outline, MediaWiki, Docmost

**Pros**
- Mature editing, revisions, permissions, comments, WYSIWYG, search — near-zero wiki build.
- Wiki.js and BookStack are genuinely good and self-hostable; Outline is the nicest UX.

**Cons**
- **Vercel cannot run any of them.** New container host + managed Postgres + ops + backups,
  and you're the ops team.
- A **third auth realm** to reconcile against `enrollments`. Most of these do OIDC/SAML,
  not "check this row in another project's table." Roster sync becomes a recurring chore.
- Ingest needs an API-write adapter per product, and `action: update` merge semantics have
  to be reimplemented against their API anyway.
- Visual and UX divergence from RADlab. Outline's per-seat pricing at 300 students is
  disqualifying. MediaWiki's markup and admin burden is a project of its own.

**Verdict:** only if you decide you want zero wiki-building and will accept the ops burden
and a disjoint auth story. Wiki.js is the least bad door if you go through it.

---

### E. Notion / Obsidian Publish / GitHub wiki / Google Sites

**Pros:** fastest path to something; Notion has comments, permissions, and databases, and
students already know it.

**Cons:** per-seat cost or open-permissions compromise; the Notion API is workable but slow
and awkward at 300 page-sets; content lock-in; no grading export; not infrastructure you
control or can extend.

**Verdict:** fine as a private staff scratchpad. Wrong for the deliverable.

---

### Recommendation

**B now, C in term 2.** The decisive argument is that `api/ingest.js` already produces
exactly the structured object a database wiki wants —
`{pages[{action, type, filename, content}], index_entries[], contradictions[], log_entry}`.
The markdown-files-in-git target was the prototype's convenience, not a requirement of the
schema. Storing pages as rows is a *smaller* step from where the code already is than
materializing and merging a git tree, and it's the only option where review, attribution,
and participation export are near-free.

**One thing to fix regardless of choice:** the wiki index is currently rebuilt by
re-aggregating `index_entries` out of every `done` job's `result_json` on every ingest
(`api/ingest.js`, "Wiki index" block). That is fine for four papers and will not survive
300. A real `wiki_pages` table is WP1 in every option above.

---

## 2. Building the DSM-5-TR core without a textbook

### 2.1 The copyright frame — three tiers

1. **Never reproduce.** DSM-5-TR criteria text, criteria tables, decision trees, and the
   manual's prose. That is the protected expression, and it is the *only* thing that's
   actually off limits. The existing system prompt already forbids verbatim reproduction
   and paraphrases criteria — keep that invariant and add a review gate (§2.4).
2. **Free to use structurally.** Disorder *names*, the *chapter/class groupings*, and
   ICD/DSM code numbers are facts and classification, not creative expression. The
   taxonomy skeleton is buildable without touching protected text.
3. **Link, don't copy.** U of T almost certainly licenses PsychiatryOnline / the DSM-5
   Library. Every disorder page should carry a deep link to the **official criteria** for
   authenticated students. That is the legitimate, zero-cost, zero-risk criteria path, and
   it's better pedagogy than a paraphrase — students learn to read the actual manual.
   *Action item: confirm U of T's PsychiatryOnline subscription and the stable link format.*

**Policy to state explicitly:** DSM-5-TR PDFs never enter the `ingest-pdfs` bucket and
never enter an Anthropic call. The pipeline ingests open literature and open reference
works only.

### 2.2 The source corpus, ranked by license utility

| Source | License | Use |
|---|---|---|
| **[Fundamentals of Psychological Disorders, 3rd ed.](https://opentext.wsu.edu/abnormal-psych/)** (Bridley & Daffin, WSU) — 15 modules, **updated through DSM-5-TR**, free PDF + [Pressbooks](https://wsu.pressbooks.pub/abnormal-psych/) + [LibreTexts](https://socialsci.libretexts.org/Bookshelves/Psychology/Fundamentals_of_Psychological_Disorders_(Bridley_and_Daffin)) | **CC BY-NC-SA 4.0** | **The textbook replacement and the scaffold's spine.** Remixable with attribution + share-alike; its module structure maps almost 1:1 onto a 12-week abnormal syllabus. |
| **[ICD-11 CDDR](https://www.who.int/publications/i/item/9789240077263)** (WHO, 2024) — essential features, boundaries with normality *and with other disorders*, course / developmental / gender / culture features, for every category | WHO open licence — **verify the copyright page**: WHO's standard is CC BY-NC-SA 3.0 IGO, but one catalogue listing says BY-NC-ND 3.0 IGO. Confirm before remixing. | Criteria-level scaffolding that is legally quotable and ~harmonized with DSM-5-TR. Bonus pedagogy: DSM-vs-ICD comparison is a real topic in the field. |
| **ICD-11 MMS browser / coding tool** | free to access | official category names, codes, hierarchy |
| **[NIMH health topics + statistics](https://www.nimh.nih.gov/health)** | **US public domain** ([policy](https://www.nimh.nih.gov/health/publications/reprinting-and-reusing-nimh-publications)) — text copyable without permission, **images excluded**, cite NIMH | prevalence, treatment overviews, plain-language sections. The only tier-1 source you can copy outright. |
| **MedlinePlus, NIH, CDC, SAMHSA** | public domain | epidemiology, public-health framing, service-use data |
| **[OpenStax Psychology 2e](https://openstax.org/) ch. 15–16; [Noba Project](https://nobaproject.com/) modules** | CC BY 4.0 / CC BY-NC-SA | intro-level framing, models of psychopathology, therapy chapter |
| **[StatPearls](https://www.ncbi.nlm.nih.gov/books/NBK430883/)** (NCBI Bookshelf) — an article for nearly every DSM disorder | **CC BY-NC-ND 4.0** | Read, cite, and paraphrase — **but ND forbids remixing the text.** Treat as a reading source, never a copy source. Worth encoding this distinction in the reference-ingest prompt. |
| **APA psychiatry.org DSM-5-TR fact sheets; APA free "Online Assessment Measures"** | copyrighted, free to read; the measures are free for clinical/research use | link + paraphrase; the cross-cutting measures and WHODAS are genuinely useful class material |
| **Open-access primary literature** (PMC, PLOS, eLife, Nature Communications) | mostly CC BY | etiology and treatment evidence — the ingest pipeline's home turf |
| **Cochrane reviews + plain-language summaries; NICE guidelines; CANMAT / CPA Canadian guidelines** | free to read | treatment evidence base, effect sizes, Canadian clinical relevance |

### 2.3 Method: a `reference` mode on the pipeline you already have

Do **not** build a second pipeline. Add a second system prompt and a `source_type`
discriminator to `api/ingest.js`.

1. **Fix the taxonomy first.** A seed file / `disorders` table: the 20 DSM-5-TR diagnostic
   classes → a **teaching subset of ~60–70 pages** for a 12-week course. Not all ~150–300
   codable diagnoses; that's a reference work, not a syllabus. Shape: every class gets a
   class-level overview page plus 2–5 anchor disorders. This list is the course outline, so
   it's an instructor decision, not a generated one.
2. **Assemble a source bundle per disorder** — the matching Bridley/Daffin module section,
   the CDDR entry, the NIMH topic page, 2–4 canonical papers, one guideline.
3. **Run `reference`-mode ingest** on each bundle. Same JSON output shape, plus a mandatory
   `sources:` frontmatter block and per-section provenance so every claim is traceable.
   **Cost: ~65 disorders × roughly $0.40–1.00 per run (bundles are larger than a single
   paper) ≈ $30–70 for the entire course core.** Less than one copy of the textbook it
   replaces. Budget baseline: the four-paper native runs averaged ~$0.39 each
   (`ingest-budget-estimate.md`).
4. **Instructor review pass — not optional.** This is where your expertise actually lands
   and where the paraphrase invariant gets enforced by a human. Side-by-side source ↔
   generated page, approve / edit / reject per page. At ~10–15 min/page that's ~15 hours
   for 65 pages: a plausible August sprint, and TAs can pre-screen.
5. **Then students layer on top.** Their contributions are *study*, *concept*, *debate*,
   and *treatment* pages plus annotations. **Ordering matters:** the disorder pages must
   exist before week 1 or student papers have nothing to attach to and the link graph
   never coheres.

### 2.4 Page structure — make the wiki *be* the syllabus

Each disorder page, fixed sections, mirroring the course's learning objectives:

- **What it looks like** — clinical presentation, paraphrased; a vignette
- **How it's diagnosed** — criteria *structure* paraphrased, CDDR essential features,
  **link to the licensed DSM-5-TR**, differential diagnosis, specifiers
- **Who gets it** — prevalence, onset, course, sex/gender, culture (NIMH + CDDR + GBD)
- **Why** — etiology: genetic/neuro, cognitive-behavioural, developmental, social
  determinants — explicitly **tiered by evidence strength**, which is itself the lesson
- **What helps** — treatments, effect sizes, guideline recommendations, and what *doesn't*
  work
- **Contested** — validity of the category, RDoC vs DSM, network vs latent-disease models,
  culture-bound presentations, medicalization critiques (`debate` pages already exist in
  the schema; note the prompt reserves `my_take` for instructor edits only)
- **Sources & student contributions** — auto-generated backlinks to student `study` pages

That last section is the pedagogical payoff: a student sees their paper appear on the
disorder page, and the class sees the wiki thicken week over week.

**Publish gate (§2.1 tier 1 enforcement):** an n-gram overlap check of generated text
against the source bundle, to catch over-copying from the ND-licensed sources, plus an
explicit reviewer checkbox on criteria language. Cheap, and it's the audit trail if anyone
ever asks.

---

## 3. Student contribution flow (Phase 2)

1. **Submit**: PDF + a *structured annotation* — why this paper, what it claims, what it
   challenges in the existing wiki, 3 discussion questions. The annotation is the graded
   artifact and it also gives the model the student's framing to work with.
2. **Ingest** → draft pages (`pending_review`).
3. **Review queue**: TA triage → instructor approve. `action: "update"` is applied as a
   **proposed diff, never auto-merged into a live page.** This is the single most important
   design rule in the whole system — an auto-merging wiki with 300 contributors degrades
   fast, and irreversibly.
4. **Publish** → page goes live, backlinks appear on the relevant disorder pages.
5. **Attribution + grading**: a `contributions` table (person_id, job_id, pages published,
   rubric score) → participation export, mirroring `get_class_participation`.
6. **Duplicate detection** on DOI + normalized title, or forty students submit Rosenhan 1973.
7. **Optional, high value, cheap**: a peer-review beat — each student comments on two other
   pages. It's a comments table and a rubric.

**Known pipeline caveat carried forward from the mode test:** filenames are unstable
run-to-run, so production must ingest **sequentially against the accumulated index**, never
in parallel and never twice for the same paper.

---

## 4. Sequencing

| WP | Work | When |
|---|---|---|
| **WP0** | **Decisions**: architecture (A–E), public vs roster-gated, scaffold scope (~65 pages?) | now |
| WP1 | `wiki_pages`, `wiki_page_versions`, `wiki_links`, `disorders` schema + RLS (CLAUDE.md pattern); retire the index-from-jobs aggregation | early Aug |
| WP2 | Reader UI — lazy-loaded pages, `ErrorBoundary label="Academic"`, wikilink resolution, backlinks, `tsvector` search, ToC | early Aug |
| WP3 | `reference` ingest mode + taxonomy seed + side-by-side review UI | mid Aug |
| WP4 | **Content sprint**: run the ~65-page scaffold, instructor review pass | mid–late Aug |
| WP5 | Student submission + annotation form + review queue + participation export | late Aug (before term) |
| WP6 | Optional/term 2: markdown+git export mirror (option C), `pgvector` related-pages, Lecture Lounge cross-links, peer review | Sept+ |

**Critical path to the first day of class is WP4**, not the code. The build is ~3 work
packages; the content review is ~15 instructor-hours and cannot be parallelized away. Start
the taxonomy decision (WP0, item 3) before the code is finished.

---

## 5. Open questions for Norm

1. **Architecture** — B (native, recommended), A (stay on Quartz), C (B then export), D?
2. **Public or roster-gated?** Gated is safer with student work and unreviewed content;
   public is a much better artifact and a recruiting tool for the course. C makes this a
   per-page toggle rather than a one-way decision.
3. **Scaffold scope** — ~65 anchor pages, or wider?
4. **Does U of T license PsychiatryOnline / DSM-5 Library?** Determines whether the
   "link to official criteria" path in §2.1 is available. Worth confirming early.
5. **Verify the CDDR licence** (BY-NC-SA vs BY-NC-ND IGO) before any remixing of its text.
