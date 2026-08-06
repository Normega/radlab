# PSY240 Field Guide — handoff to a new session

> Rewritten 2026-08-06. Live state verified against `radlab-academic` at time of writing.
> The companion document is `docs/markdowns/psy240_wp4_runplan.md` — this file is the orientation,
> the run plan is the reference. Read §0–§2 here before doing anything.

---

## 0. Read this first — the three things that will bite you

1. **There are two Supabase MCP servers and they are not interchangeable.**
   `supabase-academic` = **radlab-academic** (`qldgwpneygvgcvexlduz`) — the Field Guide. Everything in
   this document happens there.
   `supabase` = the **main radlab project** — the participant-facing site, studies, games, real
   research data. **Never write to it for Field Guide work.** Norm's standing instruction, verbatim:
   *"please don't get rid of my superuser account at radlab.zone though!"* When a destructive
   operation is unavoidable, **target by id, never by email** — the same address exists in both
   projects and an email-keyed `DELETE` will hit the wrong one.

2. **Prose containing backticks must go through the Write tool to a file.** The shell may only *read*
   that file. Inlining markdown into a bash-embedded `python -c` or `node -e` broke **five separate
   times** this project, and once committed silently against the wrong parent. This is not a style
   preference; it is the single most expensive recurring mistake in the log.

3. **Publishing is all-or-nothing and has not happened yet.** 262 pages, **0 published**. See §7.

---

## 1. Why `/academic/fieldguide/submissions` says "nothing awaiting review"

**This is correct behaviour, not a bug.** Two independent reasons:

- `gap_claims` has **0 rows**. The two test fixtures used to verify the precheck were deleted after
  the check passed.
- **There is no student-facing submission form.** The submissions queue is the *receiving* end of a
  pipeline whose *sending* end does not exist yet.

**Building that form is the single most important remaining task.** Everything else — 737 catalogued
gaps, the precheck, the review queue, the capacity arithmetic — is infrastructure waiting on it. See
§6 for the contract it has to satisfy.

---

## 2. Live state — verified 2026-08-06

```
pages            262   (all written; 0 red links — 244/244 link targets resolve)
published          0   ← nothing is visible to students yet
wiki_links      1477
ingest_jobs      203
page_gaps        737   (666 anchored to a section; 71 page-level)
student slots    860   (green 134 gaps · amber 592 · red 11)
gap_claims         0
empty sections    62   (deliberate — see §7)
major-tier gaps    0   ← was 8; all closed
unwritten pages    0
```

Enrolments (all `active`):

| email | role | notes |
|---|---|---|
| `norman.farb@utoronto.ca` | instructor | primary |
| `norman@radlab.zone` | instructor | re-signed up 2026-08-06 after account reset; auto-enrolled via `invites` |
| `kavabee@gmail.com` | ta | |

**Capacity check for ~200 students × 3 articles = 600 submissions:** 860 slots available, so there is
headroom. The 134 green gaps at capacity 2 give **268 slots**, enough that every student's *first*
submission can be a scaffolded one.

---

## 3. What this is

A course reference wiki for **PSY240, abnormal psychology, University of Toronto Mississauga**. Not
St. George — UTM-specific resources (crisis supports especially) are the priority and were sourced
deliberately.

262 pages built from the DSM-5-TR, the course textbook, and ~200 ingested sources, each page carrying
machine-derived provenance back to the job that produced it. Students will contribute peer-reviewed
sources against catalogued gaps.

**Excluded by instruction:** DSM-5-TR **Chapter 20** (Other Mental Disorders) — *"let's leave chapter
20 out."*

**Student contribution categories** (Norm's design, keep them separate):
- **Mandatory:** 3 peer-reviewed research articles.
- **Separate participation category:** original artwork, and links to works of art (visual, audio,
  film) the student thinks are relevant. Not a substitute for the three articles.

---

## 4. The method — direct parse

Full detail in run plan **§9**. The short version, and the rules that make it safe:

1. Insert an `ingest_jobs` row for the source.
2. Insert a `kind='proposed'` version carrying that `job_id`.
3. Accept it via `review_proposal(p_version_id, p_decision, p_content, p_publish)`.

**Non-negotiables:**

- **One accepted version per source.** Never combine two sources into one version — it breaks
  `wiki_page_provenance` and the page's citations become unattributable. This was violated once
  (`kleptomania`), and fixing it required rejecting the version, which **deleted the shell page**.
- `review_proposal()` needs a JWT identity **in the same MCP call**:
  ```sql
  SELECT set_config('request.jwt.claims',
    '{"sub":"3cad8ace-5c5f-41d4-b624-4da49e0e375d","role":"authenticated"}', true);
  ```
- `wiki_page_versions.action` is `'new' | 'update' | 'replace'` — **not** `'create'`.
- Rejecting the **only** version of a new page returns `page_dropped: true` and deletes the shell.
- **`edit_page` is prohibited for content that should carry provenance.** Attribution is derived from
  the ingest record, so a citation stays correctable at the job and every page rebuilds from it.
  `edit_page` severs that.

**IDs you will need:**

| what | value |
|---|---|
| `course_id` | `35e9842a-51a5-4f1e-aa5f-3a52f938196f` |
| `created_by` (person_id) | `45db45f9-eebb-4d1b-991d-1829cdb71c2a` |
| jwt `sub` (auth id) | `3cad8ace-5c5f-41d4-b624-4da49e0e375d` |

---

## 5. Derived gaps vs annotations — the distinction that matters

Two different things both look like "a gap":

- **Derived**: `extract_page_sections()` keys on any `##` heading; `extract_page_needs()` returns
  sections with **no prose**. Purely structural.
- **Annotated**: a `> **Needs research:**` line inside prose. **Invisible to the extractor** — the
  section has prose, so it reads as filled.

`page_gaps` (see §6) unifies both. Note that **`reference_worklist.annotation_count` under-reports** —
it showed 33 when the corpus actually held **302 annotations across 139 pages**, because the view only
counts annotations on pages that still have *derived* gaps. Don't trust it as a total.

---

## 6. The contribution pipeline — built, live, and half-connected

### Schema (`supabase/migrations/20260805_page_gaps.sql`, applied)

- **`page_gaps`** — 737 rows. Keyed on `(page_id, ask_hash)` where `ask_hash` is md5 of the normalised
  ask, so **claims survive prose edits to the surrounding page**.
- **`gap_claims`** — a student claiming a gap and submitting against it.
- **`open_gaps`** — the view students browse.
- **`populate_page_gaps(course_id)`** — idempotent, **never deletes**. Asks that vanish surface in
  `stale_gaps` for a human to adjudicate rather than disappearing.

Difficulty tiers: **green** (scaffolded, capacity 2), **amber**, **red** (hard; not counted toward
student slots).

### Precheck and review (applied live — ⚠ **no migration file on disk**, see §7)

- **`precheck_submission()` / `run_precheck()`** — mechanical validation before a human looks.
- **`submission_review_queue`** — staff view; joins `identity.people` for the student's name.
- **`gap_review_queue`** — staff view over gaps.
- `gap_claims` gained: `submitted_text`, `source_doi`, `source_url`, `limitation`, `precheck`,
  `precheck_at`.

### UI

`src/academic/fieldguide/SubmissionsQueue.jsx` → `/academic/fieldguide/submissions`. Groups by
`route`: **BLOCKED** / warnings / full read / light check. `review_url` deep-links to
`/academic/fieldguide/wiki/<slug>#<section>` in a new tab. Accept / send-back write only to
`gap_claims.status`.

**Why the precheck exists:** 600 submissions × 5–10 min of TA time = **50–100 hours per term**. The
precheck strips mechanical failures (no DOI, dead URL, wrong page, non-peer-reviewed) before a human
spends attention on them.

### What is missing

**The student-facing form.** It needs to: let a student browse `open_gaps`, claim one (respecting
`capacity`), submit text + DOI/URL + a stated limitation, and trigger `run_precheck()`. Until it
exists, `gap_claims` stays empty and §1 stays true.

---

## 7. What is left before the term

**Ordered by what blocks what.**

1. **Build the student submission form** (§6). Blocks the entire contribution model.
2. **Write the missing migration file.** `gap_review_queue`, `precheck_submission()`,
   `run_precheck()`, `submission_review_queue`, and the `gap_claims` submission columns **exist only
   in the live database**. `supabase/migrations/README.md` references a
   `20260806_gap_submission_precheck.sql` that **was never created on disk**. This is the same class
   of risk as CLAUDE.md's unmerged-branch rule: live but not durable.
3. **Publish — and it must be all 260 drafts at once.** With a single page published, all 13 of its
   outbound links render as broken to a student, because `wiki_links` is member-readable while
   *unpublished targets are not*. A partial publish looks like a broken site.
4. **Adjudicate the 11 `MAYBE NOT GREEN` rows + 1 `MAYBE NOT RED`.** Norm: *"i'm happy to work through
   the rows."* These are difficulty-tier judgements, not content work.
5. **Two unused Handbook chapters** — Kaylor & Jeglic (exhibitionism rehabilitation) and Heffernan &
   Ward ch. 31 (Good Lives Model). Both would close open treatment annotations on
   `exhibitionistic-disorder` and `paraphilic-disorders`.
6. **Currency audit**, including swapping in the **HiTOP 2022 primer**.
7. **Test the ingest pipeline deliberately.** It is no longer exercised by module runs (direct parse
   replaced it) but students will hit it. See §11.
8. **Consider a page-level content flag** for suicide, self-harm, and eating-disorder pages —
   pastoral, not classificatory. Norm has not decided on this.

**The 62 empty sections are deliberate**, not debt: they are the visible surface students contribute
into. Do not "fix" them.

---

## 8. Standing instructions from Norm

Preserve these verbatim in spirit:

- *"from now on if you have trouble downloading something that would make you compromise your
  approach, please stop and ask me"* — **do not substitute a degraded workaround.** Ask.
- *"please don't get rid of my superuser account at radlab.zone"* (§0).
- *"let's leave chapter 20 out."*
- **Review-then-edit** is the division of labour: Norm runs ingest and triage in the UI; Claude applies
  the content cuts via the API. Handing him a *prose list of edits to retype* was tried once and
  produced a page with deleted headings but surviving body paragraphs.
- Report what is now **checkable on the live site** after each step — or say plainly that it's
  backend-only.

---

## 9. Lessons that still bind

Corpus-shape rules; they apply regardless of who writes the page.

- **One gap, one page.** A gap belongs on the page whose subject it is. After Module 02 both
  `models-of-psychopathology` and `integrative-model` declared the same missing diathesis-stress
  material, and `reference_worklist` counted one hole twice.
- **A source can fail to support a catalogue page at all — and it can also *declare* that it will
  not.** `integrative-model` is the first kind (the textbook states no formal framework); Module 16's
  etiology and treatment are the second. The difference matters: the second **names its own remedy**.
  Both are honest states, not defects.
- **Check a supporting page against later catalogue targets before accepting it.** Module 03 invented
  `classification-systems`, a strict subset of `diagnosis-and-classification`. Archived after.
- **`archive_page` does not rebind inbound links** the way `rename_page` does. Retarget every inbound
  reference **first**, then archive.
- **Gaps derive from the page body, never frontmatter.**
- **Off-catalogue red links get introduced constantly.** Nine were caught this project
  (`opioid-related-disorders`, `alcohol-related-disorders`, `placebo-effect`, `comorbidity`,
  `stimulant-related-disorders`, `wernicke-korsakoff-syndrome`, `catatonia`, `stress-and-coping`,
  `blinding`). **Run the red-link check after every content batch** — it is how the corpus reached
  0 red links and how it stays there.
- **"Reports results" is a separate check from "is relevant."** Weitz et al. *BMJ Open* 2017 was a
  **protocol with no results** despite a findings-shaped title. Confirm a source has findings before
  citing findings from it.
- **Verify legal and statutory claims against the statute.** I wrote that CYFSA raised the *reporting*
  age 16→18; it raised the *protection* age. s.125(4) says the mandatory reporting duty **does not
  apply to a child who is 16 or 17.** Norm caught it.

---

## 10. Gotchas that cost time

**Editing and anchors**

- **When a replacement spans a heading, assert on `extract_page_sections()`' section list, not on
  length.** A `replace()` spanning `## Contested` deleted the heading; the length delta looked fine
  because the insert dwarfed the loss.
- **Check the delta against the *expected* size, not just against zero.** A CRPO replace was a no-op
  (+161 chars where +6,000 was expected) because a prior edit had introduced a line break inside the
  anchor. Nonzero is not success.
- Prefer `position()`/`substr()` splicing over retyping long bodies — a missed anchor raises instead
  of silently writing something mangled.
- **The working copy is CRLF** (`core.autocrlf`). `\n`-based anchors in scripts fail silently.

**Regex over prose**

- `\yAct\y` matched **"Acceptance and Commitment Therapy"** (4 false positives). "crisis" matched "the
  opioid crisis"; "capacity" matched "capacity for temporary suppression". **Anchor legal terms to
  their neighbours.**

**SQL / Postgres**

- **`update` proposals are DELTAS.** Accepting one verbatim replaces the page with the addendum. The
  UI pre-merges, but calling `review_proposal()` yourself means **passing merged content**. This
  truncated `biofeedback` 2,428 → 1,565 chars.
- **`ingest_jobs.status`** allows only `uploaded | processing | done | failed` — there is no
  `'running'`.
- **Views default to security-definer.** Every view over a roster-gated table must set
  `security_invoker=true`. Narrow privileged reads are SECURITY DEFINER **functions** with a
  membership check — never views.
- **`CREATE OR REPLACE VIEW` cannot reorder or rename existing columns**; new ones append last.
- **A data-modifying CTE's rows are invisible to the rest of the same statement**, and the Management
  API returns only the last statement's result set. Create shells in one call, insert versions in the
  next.
- **`FROM a, b JOIN c ON … a.col` does not parse** — `JOIN` binds tighter than the comma. Use
  `CROSS JOIN`.
- **`wiki_pages_bind_links()` only binds, never unbinds** — hence `rename_page` cleaning up after
  itself. `link_disorder_page()` has the same gap.
- **DOI slugs are opaque** — harvest them, never compute them. `wp1_verify.sql` check 5 guards this.

**RLS — the expensive one**

**A policy whose predicate reads another RLS-protected table silently under-matches. It does not
error; it returns too little**, which reads as missing data rather than a permissions bug.

"permission denied for table people" was **three faults stacked**, each hidden by the one in front:

1. **Grant** — `identity.people` had SELECT for `postgres` only, so queries failed on *privileges*
   before RLS was consulted. The pre-existing `read own person row` policy had **never been reachable
   from the client**.
2. **Schema usage** — the table grant is unreachable without `usage on schema identity`.
3. **Nested RLS** — the first staff policy read `enrollments` directly, but that table carries
   `read own enrollments`, so the EXISTS subquery saw only the caller's own row. **A reviewer would
   have seen exactly one name — their own — and every submission would have rendered with a blank
   student.** Fixed with `shares_staffed_course()`, SECURITY DEFINER.

Verified with `SET LOCAL ROLE authenticated`, not by inspection: instructor → 2 rows, student → 1 row.
**Any new policy that joins `enrollments` should go through a definer helper.**

**Files**

- **Non-ASCII filenames fail to open** (an `Arnáez` PDF). Copy to an ASCII name first.

---

## 11. Infrastructure that is done — don't re-litigate

- **Model: `claude-opus-5` at `effort: medium`** — measured better than `high` here, not merely
  cheaper (run plan §5). A refusal retries once on `claude-opus-4-8`; the syllabus is full of material
  that can false-positive a safety classifier.
- **The 300s Vercel ceiling is real** — Hobby plan, cannot be raised. Direct parse sidesteps it.
- **Guards built from real incidents**, all live and all still wanted: `reconcileCollidingUpdate`, the
  placeholder-aware wiki index, the reject-drops-the-shell fix, `wiki_merge_health.sql`. **The ingest
  pipeline is no longer exercised by module runs** — it needs a deliberate test pass before students
  touch it (§7 item 7).
- **Email:** radlab-academic sends via **Resend SMTP**. Auth templates live in a dashboard text box
  with no history — `supabase/auth-templates/` is the source of truth. **Edit the file, then paste
  into the dashboard**, never the reverse. The Field Guide template is table-wrapped because U of T
  mail is Outlook/Exchange, which ignores `max-width` and `margin: 0 auto` on a div.
- **`handle_new_user()`** on `auth.users` creates the `identity.people` row, enrols from
  `public.invites` where `consumed_at is null`, and marks the invite consumed. To let someone re-sign
  up, delete the auth user **by id** and **un-consume the invite**.

---

## 12. Where things live

| | |
|---|---|
| Run plan (the reference) | `docs/markdowns/psy240_wp4_runplan.md` — §9 is the method; §26–§37 are this phase |
| This handoff | `docs/markdowns/psy240_handoff.md` |
| Architecture record | `website.md` — **must be checked on every merge to main** (CLAUDE.md) |
| Migrations | `supabase/migrations/` + `README.md` applied-status manifest |
| Auth templates | `supabase/auth-templates/` |
| Staff review UI | `src/academic/fieldguide/SubmissionsQueue.jsx` |
| Routes | `src/App.jsx` — every page `lazy()`-loaded (CLAUDE.md) |
