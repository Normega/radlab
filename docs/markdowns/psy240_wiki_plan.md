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
>
> **Resuming work? Read [`psy240_handoff.md`](./psy240_handoff.md) first** — current state, live database numbers, open decisions, and the gotchas that cost time.

---

## Decisions (Norm, 2026-07-25)

1. **Architecture: option B + C together** — native Postgres-backed wiki in
   `src/academic/fieldguide/`, *and* the markdown/git export mirror, both before the term.
2. **Access: roster-gated for fall.** Only enrolled students/TAs/instructors read it.
3. **Scaffold scope: ~65 anchor pages** (20 class overviews + 2–5 anchor disorders each).
4. **U of T DSM access: confirmed** — see §2.1, the link-don't-copy path is available.

**Decisions (Norm, 2026-07-27)**

5. **Roster ownership: R3** — radlab-academic is the single course-identity authority;
   Lecture Lounge verifies against it through a serverless check (§2a.2). Closes open
   question 8. R1 remains the safe fallback if August compresses, and is a strict subset.
6. **Roster CSV comes from Quercus** (§2a, open question 10). Column names differ from an
   ACORN export and the email column may be the institutional alias rather than the
   `@mail.` form, so the importer maps columns explicitly and normalizes to the match key
   in §2a.5 rather than trusting a fixed header row. Re-upload stays idempotent on
   `student_number`.

**Consequence of pairing (1) with (2):** for the fall the export mirror is a **private
archive**, not a public site — it targets a private git repo (and optionally an
Access-gated or simply undeployed Quartz build), which buys the permanent markdown archive,
the Obsidian round-trip, and off-platform backup from day one. Making it public later is a
deploy decision, not a rebuild. Because the export is strictly one-way and generated,
building it now costs no sync complexity; the thing to avoid is ever editing the exported
files as a second master.

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
3. **Link, don't copy — confirmed available (checked 2026-07-25).** U of T licenses the
   PsychiatryOnline DSM Library through EZproxy: the rewritten host
   `dsm-psychiatryonline-org.myaccess.library.utoronto.ca` is live, which only exists if the
   subscription is configured in myaccess. And PsychiatryOnline exposes **stable
   chapter-level DOIs**, so each disorder page can deep-link the official criteria rather
   than paraphrasing them.

   Pattern — DSM-5-TR is book DOI `10.1176/appi.books.9780890425787`, chapters are
   `…9780890425787.x##_Chapter_Name`:

   ```
   public:   https://psychiatryonline.org/doi/10.1176/appi.books.9780890425787.x05_Anxiety_Disorders
   proxied:  https://dsm-psychiatryonline-org.myaccess.library.utoronto.ca/doi/10.1176/appi.books.9780890425787.x05_Anxiety_Disorders
   ```

   Chapter slugs confirmed by search: `.Introduction`, `.x05_Anxiety_Disorders`,
   `.x06_Obsessive_Compulsive_and_Related_Disorders`,
   `.x09_Somatic_Symptom_and_Related_Disorders`. The `x##` numbers appear to run in
   manual chapter order, but **the remaining ~16 were not verified** — enumerate them
   once against the live DSM Library ToC and store the map alongside the taxonomy seed
   (a `dsm_chapter_doi` column on `disorders`), rather than generating slugs by guesswork.

   This is the legitimate, zero-cost, zero-risk criteria path, and it's better pedagogy
   than a paraphrase — students learn to read the actual manual. It also means the wiki
   never needs to carry criteria text at all.

**Policy to state explicitly:** DSM-5-TR PDFs never enter the `ingest-pdfs` bucket and
never enter an Anthropic call. The pipeline ingests open literature and open reference
works only.

### 2.2 The source corpus, ranked by license utility

| Source | License | Use |
|---|---|---|
| **[Fundamentals of Psychological Disorders, 3rd ed.](https://opentext.wsu.edu/abnormal-psych/)** (Bridley & Daffin, WSU) — 15 modules, **updated through DSM-5-TR**, free PDF + [Pressbooks](https://wsu.pressbooks.pub/abnormal-psych/) + [LibreTexts](https://socialsci.libretexts.org/Bookshelves/Psychology/Fundamentals_of_Psychological_Disorders_(Bridley_and_Daffin)) | **CC BY-NC-SA 4.0** | **The textbook replacement and the scaffold's spine.** Remixable with attribution + share-alike; its module structure maps almost 1:1 onto a 12-week abnormal syllabus. |
| **[ICD-11 CDDR](https://www.who.int/publications/i/item/9789240077263)** (WHO, 2024) — essential features, boundaries with normality *and with other disorders*, course / developmental / gender / culture features, for every category | WHO open licence, **exact variant still unverified** — see the note below | Criteria-level scaffolding that is legally quotable and ~harmonized with DSM-5-TR. Bonus pedagogy: DSM-vs-ICD comparison is a real topic in the field. |
| **ICD-11 MMS browser / coding tool** | free to access | official category names, codes, hierarchy |
| **[NIMH health topics + statistics](https://www.nimh.nih.gov/health)** | **US public domain** ([policy](https://www.nimh.nih.gov/health/publications/reprinting-and-reusing-nimh-publications)) — text copyable without permission, **images excluded**, cite NIMH | prevalence, treatment overviews, plain-language sections. The only tier-1 source you can copy outright. |
| **MedlinePlus, NIH, CDC, SAMHSA** | public domain | epidemiology, public-health framing, service-use data |
| **[OpenStax Psychology 2e](https://openstax.org/) ch. 15–16; [Noba Project](https://nobaproject.com/) modules** | CC BY 4.0 / CC BY-NC-SA | intro-level framing, models of psychopathology, therapy chapter |
| **[StatPearls](https://www.ncbi.nlm.nih.gov/books/NBK430883/)** (NCBI Bookshelf) — an article for nearly every DSM disorder | **CC BY-NC-ND 4.0** | Read, cite, and paraphrase — **but ND forbids remixing the text.** Treat as a reading source, never a copy source. Worth encoding this distinction in the reference-ingest prompt. |
| **APA psychiatry.org DSM-5-TR fact sheets; APA free "Online Assessment Measures"** | copyrighted, free to read; the measures are free for clinical/research use | link + paraphrase; the cross-cutting measures and WHODAS are genuinely useful class material |
| **Open-access primary literature** (PMC, PLOS, eLife, Nature Communications) | mostly CC BY | etiology and treatment evidence — the ingest pipeline's home turf |
| **Cochrane reviews + plain-language summaries; NICE guidelines; CANMAT / CPA Canadian guidelines** | free to read | treatment evidence base, effect sizes, Canadian clinical relevance |

**CDDR licence — attempted 2026-07-25, not resolved.** `who.int` and `iris.who.int` are
blocked by this environment's network policy (agent-proxy `connect_rejected`), and every
third-party mirror of the PDF also refused fetching, so the copyright page could not be read
directly. Available evidence is conflicting: a search-engine reading of the WHO IRIS record
reports **CC BY-NC-SA 3.0 IGO** (which is WHO's standard licence for publications), while a
scraped catalogue listing says BY-NC-**ND** 3.0 IGO — that latter source is a low-quality
book-scrape site and I'd weight it lightly. **30-second check for Norm:** open the CDDR PDF,
page ~2, read the "Some rights reserved" block.

**This does not gate the build.** Under *either* variant the CDDR may be read, cited, and
**paraphrased** — paraphrase creates new expression, and facts and ideas aren't protected in
the first place. Only verbatim remixing differs between SA and ND. Since the pipeline's
standing invariant is already "paraphrase, never reproduce verbatim," the distinction only
matters if we later decide to quote CDDR passages directly. Resolve it before doing that;
don't block WP3 on it.

### 2.3 Method: a `reference` mode on the pipeline you already have

Do **not** build a second pipeline. Add a second system prompt and a `source_type`
discriminator to `api/ingest.js`.

1. **Fix the taxonomy first.** A seed file / `disorders` table: the 20 DSM-5-TR diagnostic
   classes → a **teaching subset of ~60–70 pages** for the course. Not all ~150–300
   codable diagnoses; that's a reference work, not a syllabus. Shape: every class gets a
   class-level overview page plus 2–5 anchor disorders. This list is the course outline, so
   it's an instructor decision, not a generated one. **Drafted 2026-07-25 —
   [`psy240_taxonomy.md`](./psy240_taxonomy.md)**: 71 generated pages for fall (16 topic
   overviews + 9 foundations + 46 Tier A disorders), 11 hand-written lecture pages, and 52
   Tier B stubs generated from the seed without a model call. See open question 6 for how that
   amends the shape assumed here.
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

## 2a. Roster, invitation, and enrollment

Norm's spec (2026-07-25). This was a gap in the first draft of this plan — it was folded
into the student-submission WP as if incidental. It isn't: no student can submit anything
until they have an account, and nothing in the repo currently gets 300 students accounts.
`invites` is service-role-only and seeded with exactly two staff rows.

### 2a.1 The flow as specified

1. Instructor uploads a roster CSV: **name, student ID, email**.
2. It populates a roster table with a status column flowing
   **`added` → `invited` → `enrolled`**, with two send actions: **bulk** (all not-yet-enrolled)
   and **per-row** (for a student added manually after a mass invite).
3. Students confirm by clicking a unique link in the email.
4. **QR path** for the first class or two: QR → form → student enters their U of T email →
   a match against the roster enrolls them.
5. Enrolled students get a persistent login and can sign in any time by entering their email
   and having it verified against the roster — using Lecture Lounge infrastructure.

All of this is sound and mostly maps onto primitives that already exist. Four things need
decisions or corrections before it's buildable.

### 2a.2 The cross-project question — the one real decision

Requirement 5 crosses a deliberate architectural boundary. **Lecture Lounge lives on the
main radlab project** (`class_members.user_id` → main-project `auth.uid()`, verification via
`verify_class_email()` + the `send-class-verification-email` Edge Function, export keyed on
`class_members.utoronto_email`). **The Field Guide lives on radlab-academic**, a separate
project with a separate auth realm, chosen specifically to keep course PII off the research
platform. One roster has to serve both.

| | Approach | Trade-off |
|---|---|---|
| **R1** | Roster on radlab-academic; Lecture Lounge keeps its current self-join + verify | Least work, no cross-project plumbing. **Does not deliver requirement 5** — the roster wouldn't gate Lecture Lounge. Two unrelated accounts per student. |
| **R2** | Roster on the main radlab project so Lecture Lounge reads it directly | Delivers requirement 5 natively, but puts names + student IDs on the research platform — exactly what radlab-academic was created to avoid, and against §29's own governance boundary. **Not recommended.** |
| **R3** | **Roster on radlab-academic as the single course-identity authority; Lecture Lounge verifies against it through a serverless function** (`api/roster-check.js`: email → match/no-match under the service role) | **Recommended.** One roster for 300 students instead of two to reconcile, PII stays partitioned, and it delivers requirement 5. Costs one function plus a call in the Lecture Lounge join flow. |

Under R3, a roster match should be allowed to **auto-verify** the Lecture Lounge email: a
roster hit plus a clicked magic link is strictly stronger evidence than today's
self-asserted email plus magic link. That must still go through `verify_class_email()` or an
equivalent SECURITY DEFINER path — the existing lockdown migration (`20260710_lecture_lounge_email_verify_lockdown.sql`)
deliberately makes it structurally impossible for a client to set `utoronto_verified_at`, and
that invariant should not be weakened for roster users.

**R1 is the safe fallback if August compresses** — it's a subset of R3, so starting on R3
and stopping short leaves nothing stranded.

### 2a.3 Integration risk worth naming early

Requirement 5 — "sign in by entering an email" — is **passwordless magic-link auth**, and
Lecture Lounge today is *account-level*: students link a verified email to an **existing
radlab account** created through the normal signup. Supabase supports this natively
(`signInWithOtp`), so the auth mechanism is free, but a magic-link user arrives with no
password, no `display_name`, and no profile history, and the main project's
`ProtectedRoute` / `fetchRole` / Ripple-onboarding chain makes assumptions about new users
(a public-tier user with no `ripples.name` gets routed into `/welcome` and the Ripple naming
beat). **A PSY240 student signing in for a lecture activity must not land in Ripple
onboarding.** This needs a deliberate decision — a course-scoped account flavour, or an
onboarding bypass for roster-originated accounts — and it is the highest-risk unknown in
this WP, because it touches the main project's auth path rather than adding to the academic
partition.

### 2a.4 Corrections to the flow

- **The QR form must not flip status to `enrolled`.** Submitting a form only proves someone
  typed an email. Under requirement 5 `enrolled` is the thing that grants a persistent
  login, so it has to mean "the person who controls that mailbox clicked the link."
  The form should *send* the magic link on a roster match; **clicking it enrolls.** This
  also makes the QR path and the email path converge on one guarantee instead of two.
- **The QR form is a public, unauthenticated endpoint that triggers email sends** — rate
  limit per IP and per email address, and cap resends per roster row. Worst case today is
  mild (a mistyped email sends a link to its real owner, who ignores it), but an unlimited
  send endpoint is an abuse vector regardless.
- **Unmatched form attempts need a destination.** The most common real failure is a student
  entering a personal address. Log these to a small instructor-resolvable queue and show the
  student "we couldn't match that — see the instructor," rather than failing silently.
  **Do not** offer student-ID entry as a public fallback: it puts a durable institutional
  identifier into an unauthenticated form for no real gain.
- **More statuses than three.** `added → invited → enrolled` plus at minimum `bounced`
  (otherwise a bad address is indistinguishable from an unmotivated student) and
  `dropped`/`inactive` for drops — `enrollments.status` already models active/inactive, so
  the roster should mirror it. Also store `invited_at`, `last_invited_at`, and
  `invite_count` so a bulk send doesn't re-spam someone invited ten minutes earlier.

### 2a.5 Email matching — broader is fine, normalize hard

Accept `@mail.utoronto.ca`, `@utoronto.ca`, and `@alum.utoronto.ca`. ACORN rosters generally
give the `mail.` form, but students routinely use the shorter alias for the same mailbox, so
matching on the literal string will generate support email all term.

Store a **normalized match key** on each roster row: lowercase, trimmed, and with any
utoronto domain collapsed to a single canonical form, so `norman.farb@utoronto.ca` matches a
roster entry of `norman.farb@mail.utoronto.ca`. Match on that key, never on raw input.

### 2a.6 Practical blocker: bulk email

Supabase's built-in auth email has a low hourly rate limit — a few messages per hour — which
will not send 300 invites. **Custom SMTP is required**, not optional. The platform already
uses **Resend** (the reminder cron and the Lecture Lounge verification function), so this is
a configuration step on radlab-academic plus reusing an established sender identity, not new
infrastructure. Worth confirming Resend's own send limits and domain verification for the
academic project before the first bulk send, and doing a staged send (a handful, then the
rest) rather than 300 at once.

### 2a.7 Schema sketch

PII placement follows the project's own invariant: **names and student IDs are PII, so the
roster belongs in the `identity` schema**, not `public`. Student ID is the most sensitive
field here — a durable institutional identifier — and is worth carrying only because grade
upload eventually needs it.

- `identity.roster` — `course_id`, `full_name`, `student_number`, `email`, `email_match_key`,
  `status`, `invited_at`, `last_invited_at`, `invite_count`, `enrolled_at`, `person_id`
  (null until enrolled), `notes`. Service-role writes only; staff read via a narrow
  SECURITY DEFINER view or RPC scoped by `enrollments`, matching the `get_class_participation`
  pattern rather than exposing the table.
- `identity.roster_match_attempts` — the unmatched-QR-attempt queue: submitted email,
  timestamp, IP hash, resolution.
- Reuse the existing `public.invites` + `identity.handle_new_user()` trigger for the actual
  enrollment write — the roster drives invite creation; it doesn't replace that mechanism.

### 2a.8 Governance

Roster data — names, student numbers, participation — is **course administration data under
FIPPA, not research data**, the same boundary §29 already draws for Lecture Lounge
participation. It must not enter any research analysis without a separate REB protocol.
Separately: Lecture Lounge's design principle is anonymous-but-embodied participation
(avatars, never names). Loading real names into a roster the classroom system can now query
makes it newly possible to display them — **don't**. Names are for the instructor's roster
view and grade export only.

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

Revised against the 2026-07-25 decisions (the exporter moves into fall scope; access is
roster-gated, so no public-visibility UI is needed yet).

| WP | Work | When |
|---|---|---|
| ~~WP0~~ | ~~Decisions~~ — **done 2026-07-25**, see the Decisions section above | ✔ |
| ~~WP1~~ | ~~Schema~~ — **done 2026-07-25**, `supabase/migrations/20260725_academic_wiki_schema.sql`, applied live to `radlab-academic`. See the WP1 note below. | ✔ |
| ~~WP2~~ | ~~Reader UI~~ — **done 2026-07-27**, see the WP2 note below | ✔ |
| ~~WP3~~ | ~~Seed + review path + review UI + `reference` mode~~ — **done 2026-07-26**, all applied live. See the WP3 notes below. | ✔ |
| WP4 | **Content sprint**: run the ~65-page scaffold, instructor review pass (~15 h) | mid–late Aug |
| **WP5** | **Roster & enrollment (§2a)** — CSV upload, `identity.roster` + status flow, bulk/per-row invite via Resend SMTP, magic-link enrollment, QR self-match form + unmatched queue, `api/roster-check.js`, Lecture Lounge integration (R3) | mid Aug — **ahead of WP6** |
| WP6 | Student submission + annotation form + review queue + participation export | late Aug (before term) |
| WP7 | **Export mirror**: published pages → markdown + YAML frontmatter → private git repo; one-way and generated, never edited in place. Quartz build optional/undeployed until the wiki goes public | late Aug, parallel to WP4 |
| WP8 | Term 2 / opportunistic: flip the mirror public, `pgvector` related-pages, Lecture Lounge cross-links, peer-review beat | Sept+ |

### WP2 as built: the reader (2026-07-27)

No migration — WP2 is read-only, and the RLS split written in WP1 turned out to be the whole
access design. `src/academic/fieldguide/wiki/`: `WikiIndex` (`/academic/fieldguide/wiki`) and
`WikiPage` (`…/wiki/:slug`), both lazy, both under a new `FieldGuideMemberRoute`.

**One reader for students and staff.** The guard takes any active enrollment; what comes back
is decided by `members read published pages` vs `staff read all pages`. Nothing in the UI
filters on status defensively — a draft is invisible to a student because the database never
returns it. The same fact drives link colouring: the resolution set is *this reader's*
readable pages, so a link to an unpublished page renders unresolved for a student and live
for staff, which is the honest state in both cases. `FieldGuideStaffRoute` and the new member
guard are now thin wrappers over a shared `FieldGuideAuthRoute`; duplicating a full sign-in
flow between them would have meant two places to fix an auth bug.

**Link rules are duplicated by necessity, so they're documented as a pair.** `wikiText.js`
decides what renders as a link; `sync_wiki_links()` decides what becomes a row in
`wiki_links`. Both implement the same narrow rule (`[[slug]]`, `[[slug|label]]`,
`[[slug#section]]`, `[label](slug.md)`; nothing with a scheme or a path separator). Checked
against all 44 live page bodies: **zero mismatches over the 45 edges the trigger derived** —
every reference the reader makes clickable is one the graph knows about, and vice versa.

Three things that only showed up against real content:

- **Anchors have to be unique, and on real pages they aren't.** `major-depressive-disorder`
  carries the six-section disorder skeleton **three times** and
  `persistent-depressive-disorder` twice — one copy per accepted `update` proposal. So
  "presentation" is not a unique id. Ids are now uniquified (`-2`, `-3`) and handed to the
  renderer *by source line* (mdast reports a position for every node) rather than by a
  counter, which re-renders would desynchronise. The repetition itself is a content problem
  for the review pass, not a rendering one.
- **Content uses H1 as a section heading**, e.g. `# Update from Fonagy (2015)` — a merge
  seam. Scanning only h2/h3 for the contents left 15 of 44 pages with an empty ToC while
  their headings were still anchored, so the scan takes h1 too and the renderer demotes it.
- **125 relations live only in frontmatter** (`related_disorders`, `key_studies`,
  `concepts_touched`, …) and **none of them are in `wiki_links`**, because the trigger reads
  the body only. 102 of the 125 point at pages that already exist. The reader renders them
  as a *Related* strip — navigable, but deliberately not presented as graph edges. Whether
  the graph should carry them is a database question; see open question 12.

Also on the page: ToC, backlinks (`Referenced by`), the self-declared `needs` list shown to
everyone (for a student it's the assignment list), derived attribution from
`wiki_page_provenance`, and — for `disorder` pages — the `disorder_criteria_links` deep link,
which is where the §2.1 link-don't-copy decision finally becomes something a student clicks.
The index browses by DSM chapter rather than by page type, with `tsvector` search over
title+summary+content, and unwritten catalogue rows shown by default for staff (the worklist)
and hidden by default for students.

Verified by build (`WikiIndex`/`WikiPage` emit as their own chunks; `react-markdown` lands in
the WikiPage chunk, entry bundle unchanged at ~235 KB raw) and by two offline checks against
the live corpus: the link-rule comparison above, and a server-render of `WikiMarkdown` over
three real pages plus a synthetic one exercising every link form, asserting that each ToC
anchor exists in the output, ids are unique, no `[[wikilink]]` survives, and each of the six
link shapes resolves correctly. That last check earned its keep: section links
(`slug.md#Section`) were being sent down the external-link branch, because such an href
doesn't end in `.md` — the database rule stops at the hash and the reader now does too, and
the section is slugified so it matches the heading id it points at. Real content happens not
to use section links yet, so nothing on the live corpus would have caught it. **Not yet
click-tested in a browser** — `npm run dev` can't run the Field Guide (§6 of the handoff),
so that needs a deploy.

### WP2 follow-up: the gap mechanism was wrong, and why (2026-07-30)

Migration `20260730_wiki_body_needs_and_replace.sql`. Found by click-testing the reader, which
made duplicated disorder skeletons visible for the first time — `major-depressive-disorder`
carried the six H2 sections **three times**, `persistent-depressive-disorder` twice.

**Two prompt rules in this plan contradicted each other.** §2.4's fixed section structure became
"disorder pages MUST carry all six H2 sections, ALWAYS", while §3's contribution flow makes an
`update` "only the new information to merge". Both at once means every update to a disorder page
emits a full skeleton, which the review UI's merge pre-fill appends. This plan's WP4 is ~15
paper-mode module runs *followed by targeted reference runs on Tier A pages that still declare
gaps* — i.e. dozens of updates against pages that already exist — so left alone it would have
recurred across all 46 Tier A pages.

Fixed on both sides. Paper mode scopes the skeleton to `action: new` and states that an update is
appended rather than merged section-by-section. **Reference mode now returns a complete page with
a new `action: 'replace'`** that overwrites instead of appending: it already names its target and
receives the current body, so "rewrite this page with the gaps filled" is simpler than a merge and
reads as one voice rather than two stitched together. A distinct action rather than a heuristic on
content shape, because the review UI must not pre-merge it — it shows a banner saying the current
body will be overwritten, and keeps the previous body as an accepted version.

**The more consequential half: `needs` was lying, and `needs` aims WP4.** `extract_page_needs()`
parsed the frontmatter `needs:` list, taking the first match in the document, while the merge
pre-fill strips an addendum's frontmatter (correctly — two YAML blocks in one file is invalid). So
the gap list froze at the first source's assessment while content kept growing. Measured live: MDD
declared 4 gaps and PDD 1, and **all five were already filled further down the same page**. Since
`reference_worklist` reads `needs`, the content sprint would have been aimed by data wrong in both
directions.

Gaps are now derived from the body — a section is a gap when no copy of it holds prose. This is
self-correcting, needs nothing from the model, and caught two gaps the model had written
placeholders for but never declared (`cyclothymic-disorder` etiology,
`disruptive-mood-dysregulation-disorder` epidemiology). Built as a shadow function and diffed
against all 44 live pages before the swap: 40 unchanged, the 4 that moved were exactly the
corrections.

**A missing primitive this plan never called for, now added** (`20260730_wiki_edit_page.sql`):
there was no way to edit an accepted page at all. `review_proposal()` needs a pending version so it
can only accept what an ingest proposed, `unpublish_page()` only hides a page, and `wiki_pages` has
no authenticated write policies — so nothing on a page 300 students read could be corrected without
service-role SQL. `edit_page(page_id, content, note)` follows the same one-audited-function shape as
the other two write paths, with a staff-only **Edit page** button on the reader. History is
automatic (the snapshot trigger already keeps the previous body, so every save is recoverable —
which is why the UI can be a plain textarea); blanking is refused because a bodiless page is a
*shell* awaiting its first proposal, making that a retirement rather than a correction; and the
note is optional, unlike unpublish's mandatory reason, because an edit leaves a diff.

Worth folding into §3's contribution flow when WP6 is built: the review queue is the gate for
*proposed* content, and `edit_page` is now the gate for *accepted* content. Both are staff-only
SECURITY DEFINER functions rather than table grants, which is the pattern to keep.

**Still open:** MDD and PDD themselves. They no longer misreport their gaps but still read as three
copies and two. For MDD, copy 3 is a complete page and copy 1 contributes a substantial Treatment
section from a different source, so the merge is copy 3 as spine plus copy 1's Treatment, with every
placeholder dropped; PDD is copy 1 as spine plus copy 2's three short increments. That is editorial
judgement about which prose survives where copies overlap, not a mechanical merge.

### WP3 as built — part 1: taxonomy seed + review path (2026-07-25)

Migration: `supabase/migrations/20260725_academic_wiki_wp3.sql`, applied live.

**Seed.** All 123 catalog rows from taxonomy §6 — 46 Tier A, 52 Tier B, 16 overviews,
9 foundations, across 18 DSM chapters (11 and 20 aren't taught). Idempotent on
`(course_id, slug)`, so re-running never clobbers later edits. Two departures from a literal
reading of §6, both noted in `tier_review_note` on the rows themselves: the mood overview
covers DSM chapters 3 *and* 4 and is filed under 3 (L5 teaches them as one block), and chapter
14 gets no overview row because a one-disorder chapter needs one page.

**Slug convention validated independently.** The seed links catalog rows to pages that already
exist by slug. Exactly 2 of the 22 ingested pages are `type='disorder'`
(`borderline-personality-disorder`, `persistent-depressive-disorder`) and **both matched
hand-written catalog slugs exactly** — the model's independent slug choices and the taxonomy's
agree. The other 20 pages are concept/study/treatment/debate, correctly outside the catalog.
That's the drift check taxonomy §5 worried about, passing on live data.

**Review path.** `review_proposal(version_id, decision, content, publish)` — SECURITY DEFINER
with an internal staff check, so `wiki_pages` still has **no** authenticated write policies. The
write surface is one audited function rather than a broad UPDATE grant, matching
`get_class_participation` / `verify_class_email`. Accepting sets page content (the reviewer's
edit via `p_content`, or the proposal as-is), which fires the existing triggers for the accepted
snapshot and link extraction. Plus a `review_queue` view joining each pending proposal to its
target page, the current body to diff against, and the catalog's `tier_review_note` — so the
rewrite-level flags surface in the UI rather than living only in a markdown file.

**Verified against live data in a rolled-back transaction**, impersonating the instructor's JWT:
accept published a page (1886 chars, v1), the trigger wrote the accepted snapshot, and 3
wikilinks were extracted *and all 3 resolved* — the graph closing because the targets already
exist. Reject left the page body null. Queue went 26 → 24. Then rolled back, so nothing is
actually published yet.

One testing note worth keeping: an earlier version of that test put the RPC call and its
assertions in one `UNION ALL` statement and appeared to show the RPC doing nothing. That was the
single-statement snapshot, not a bug — a volatile function's writes aren't visible to other
branches of the same statement. Assertions have to be separate statements.

### WP1 as built (2026-07-25)

Migration: `supabase/migrations/20260725_academic_wiki_schema.sql`. Three decisions differ from
the one-line spec above, each deliberate:

1. **`dsm_chapters` lookup instead of a `disorders.dsm_chapter_doi` column.** The DOI is
   per-chapter, so a column would store 123 copies of 20 strings — and since five slugs are
   irregular (§7 above), each copy is a chance to "fix" one. `disorders.dsm_chapter` FKs to the
   lookup; the `disorder_criteria_links` view assembles the proxied URL.
2. **Proposals live in `wiki_page_versions`, not in `wiki_pages.content`.** The ingest never
   writes page bodies. A page the model invents is created as a *shell* (slug/type/title/summary,
   null content) so it appears in the index and resolves inbound wikilinks, while its body waits
   as a `kind='proposed'` version. The invariant this buys: anything in `wiki_pages.content` has
   been reviewed — which is what students read and what WP7 exports.
3. **Link extraction is a database trigger, not function code.** Links derive from accepted
   content; doing it in `api/ingest.js` would put unreviewed proposals into the graph and skew
   the red-link count that the Tier B argument in taxonomy §5 depends on.

Retiring the index-from-jobs aggregation needed (2) to be safe: the old index replayed
`index_entries` from every done job, so it was a function of ingest *history* rather than of the
wiki. Reading `wiki_pages` instead is only equivalent if something writes a row per page — hence
the shells. A page edited or retired after ingest now stops advertising its stale summary, and
pages created any other way become visible to the model.

**Verified locally, then applied live.** Postgres 16 with stubbed `auth`/`storage`: applies clean
on the init migration; versioning, both directions of link resolution, proposal isolation,
criteria-URL assembly, `tsvector` search, and the student/staff/outsider RLS split all behave as
intended, and authenticated writes are correctly refused. Applied to `radlab-academic` by Norm on
2026-07-25 and confirmed with `supabase/checks/wp1_verify.sql` — a read-only, re-runnable check that
reports per-object status in either state. Re-run it after any schema change to that project: its
last check is the CLAUDE.md RLS-enabled-but-no-policy audit, and its slug check catches anyone
"correcting" the five irregular DOI slugs back into 404s.

**WP5 is now the schedule's real risk, not WP6.** It gates student submission (no accounts,
no submissions), it has a hard external deadline (the QR path has to work in week 1, and
invites should land before term starts), and §2a.3 — the magic-link/Ripple-onboarding
collision — is the only work in this plan that modifies the **main** project's auth path
rather than adding to the academic partition. Everything else here is additive and reversible.
Sequence WP5's Lecture Lounge integration early enough to discover that problem in August
rather than in a lecture hall.

**Critical path to the first day of class is WP4**, not the code. The build is ~4 work
packages; the content review is ~15 instructor-hours and cannot be parallelized away.

Two scheduling notes given the "both at once" decision:

- **WP6 is the one piece that can slip without hurting the course.** It's backup and
  archive, not student-facing, so if August compresses, it yields to WP4/WP5 — the term can
  start without it. Sequencing it parallel to the content sprint (rather than before it) is
  deliberate for that reason.
- ~~**Start the taxonomy list now**, ahead of WP1~~ — **done 2026-07-25**:
  [`psy240_taxonomy.md`](./psy240_taxonomy.md). WP3 and WP4 now have their input; what's left is
  an instructor sign-off pass on the tier calls, not authoring. Two review-budget notes carried
  over from it: the gender dysphoria page and the paraphilic overview need **rewrite-level**
  review (~30 min each, not 15) because the source deck's terminology is dated in the first case
  and the framing is lecture-hall-provocative in the second; and the ten personality disorders
  are the cheapest place to spend a spare review hour (promoting the seven Tier B PDs to Tier A
  is +1.5 h).

---

## 5. Open questions

1. ~~Architecture~~ — **resolved**: native + export mirror, both before the term.
2. ~~Public or roster-gated~~ — **resolved**: roster-gated for fall.
3. ~~Scaffold scope~~ — **resolved**: ~65 anchor pages.
4. ~~Does U of T license PsychiatryOnline / DSM-5 Library?~~ — **resolved 2026-07-25: yes**,
   via myaccess EZproxy, with stable chapter-level DOIs (§2.1).
5. **CDDR licence variant** — still open; blocked from verification in-session (§2.2 note).
   Doesn't gate WP1–WP4; resolve before quoting CDDR text verbatim.
6. ~~The ~65-page taxonomy list itself~~ — **drafted 2026-07-25:
   [`psy240_taxonomy.md`](./psy240_taxonomy.md)**, built from the eleven Fall 2025 lecture decks
   rather than a generic syllabus. Awaiting instructor sign-off on the tier calls; the list
   itself is buildable now. Three findings that amend this plan:
   - The course is **11 × 3-hour lectures**, not ~20 classes, so the content anchor is the
     **DSM-5-TR diagnostic class** (18 of 20 are taught) and the *lecture* page becomes thin
     hand-written navigation over it — a fourth page type this plan didn't have.
   - Complete coverage of what's actually taught is ~123 pages, which doesn't fit a 15-hour
     review. Resolved by a **Tier A / Tier B split**: 71 fully-generated pages for fall
     (~15.5 h review, $28–71 — same order as the ~65 estimated here), and 52 Tier B stubs
     generated mechanically from the seed with no model call, so no wikilink is dead on day
     one and the stubs become WP6's student-contribution targets.
   - `disorders` seed columns implied: `slug`, `title`, `dsm_chapter` (1–20),
     `dsm_chapter_doi`, `tier`, `lecture` (1–11).
7. ~~Which DSM-5-TR chapter `x##` slugs map to which class~~ — **resolved 2026-07-25**: all 18
   taught chapters verified, [taxonomy §4](./psy240_taxonomy.md). No myaccess pass was needed —
   PsychiatryOnline 403s automated fetches but its chapter pages are search-indexed, so each real
   slug came out of the index by exact-phrase search on the DOI stem. The ordinal half of the
   prediction held (chapters 1–19 = `x01`–`x19`); the *name* half was wrong for 5 of 19, in ways
   no rule generates — three truncations (`x02_Schizophrenia_Spectrum`,
   `x15_Disruptive_Impulse_Control`, `x16_Substance_Related_Disorders`), one retained hyphen
   (`x12_Sleep-Wake_Disorders`), and one **misspelling in APA's own DOI**
   (`x14_Gender_Dysophoria`). Generating slugs from titles would have shipped five 404s. Standing
   rule: DOI slugs are opaque identifiers, harvest them, never compute them. The proxied path is
   confirmed too (Norm, 2026-07-25: login wall when signed out, chapter when signed in, tested on
   the misspelled slug), via `psychiatryonline-org.myaccess.library.utoronto.ca` — the un-prefixed
   host. Only residual is chapter 20 ("Other Mental Disorders"), which the course doesn't teach.
   Note for future sessions: these links can't be agent-verified by retrieval and shouldn't be —
   403 to automation, human sessions don't transfer, and bulk EZproxy fetching both breaches library
   terms and contradicts the link-don't-copy decision in §2.1.
8. ~~**Roster: R1, R2, or R3?**~~ — **resolved 2026-07-27: R3.** One roster on
   radlab-academic serves both systems; Lecture Lounge verifies through `api/roster-check.js`
   under the service role. See the Decisions section.
9. **Roster: how do PSY240 students avoid Ripple onboarding?** (§2a.3) — course-scoped
   account flavour vs. an onboarding bypass for roster-originated accounts. Needs a decision
   before WP5 touches the main project's auth path.
10. ~~**Where does the roster CSV come from**~~ — **resolved 2026-07-27: Quercus export.**
    Its column names differ from ACORN's and its email column may be the institutional
    alias, so WP5's importer maps columns explicitly and matches on the normalized key
    (§2a.5), not on a fixed header row or a literal string. Re-upload idempotent on
    `student_number`.
11. ~~**Resend limits + domain verification**~~ — **resolved 2026-07-29.** The verified
    domain for platform mail is `mail.radlab.zone` (not the apex), and a second domain
    **`course.radlab.zone`** was added the same day on the paid tier, so PSY240 sends as
    `psy240@course.radlab.zone` — on a reputation separate from participant email, which
    matters because a 300-invite blast produces bounces. The framing in §2a.6 was
    wrong in one respect worth recording: **Resend's quota is per account, not per domain**,
    so a course-specific domain buys reputation isolation and *no* volume relief — only the
    plan tier does, and Norm moved to it on 2026-07-29. Custom SMTP on radlab-academic was
    configured the same day and three rate limits raised (`rate_limit_email_sent` 2 → 300,
    `rate_limit_otp` and `rate_limit_verify` 30 → 300 per hour) — the latter two sized for
    the **week-1 QR burst**, not the invite send, since ~200 students requesting and clicking
    links inside one lecture would otherwise fail after 30 of each. §2a.6's "custom SMTP is
    required" is right but incomplete: enabling it does not raise the cap, it only makes the
    cap raisable, and two adjacent counters it does not cover are what the QR path actually
    hits. Not yet exercised: an actual send. Tooling and full survey: website.md §11,
    `scripts/check-email-dns.ps1`, `scripts/parse-dmarc-report.py`.
12. **Should frontmatter relations become graph edges?** (new, 2026-07-27) — 125 relations
    are declared in frontmatter (`related_disorders`, `key_studies`, `concepts_touched`,
    `disorders_touched`, `related_concepts`, `target_disorders`) and none reach `wiki_links`,
    because `sync_wiki_links()` reads the body only. 102 of them point at pages that exist.
    Consequences if left as-is: backlink counts understate connectedness by roughly 3×, and
    the red-link count that taxonomy §5's Tier B argument rests on is measured on a partial
    graph. Extending the trigger is a small change; the reason to think first is that it
    would fold a *model-declared* relation into the same graph as an author's explicit
    in-text link, and the two aren't the same claim. The reader currently shows them
    separately, which keeps the option open either way.
