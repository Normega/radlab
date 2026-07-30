# PSY240 WP4 — the content sprint run plan

> Written 2026-07-30. The ordered list of ingest runs that builds the fall scaffold,
> keyed to the live catalogue in `radlab-academic` rather than to any doc.
> Companion to [`psy240_wiki_plan.md`](./psy240_wiki_plan.md) (§4 sequencing) and
> [`psy240_taxonomy.md`](./psy240_taxonomy.md) (§6, the page list).
>
> **Scope: 78 generated pages, ~17 instructor-hours.** 53 Tier A disorders + 16 topic
> overviews + 9 foundations. The 45 Tier B stubs are generated mechanically from the
> seed with no model call and are not part of this plan.

---

## 0. Read this first — two things that will bite

**Run sequentially, never in parallel, and never the same source twice.** Filenames are
unstable run-to-run, so two concurrent ingests of overlapping material produce two
competing carves of the same concepts. One job at a time, each one seeing the wiki the
previous one left behind.

**Triage between runs, or you get duplicates.** `api/ingest.js` builds the model's wiki
index from pages **with accepted content only** — a page sitting unreviewed is invisible
to the next run, so the next module proposes it afresh as a full draft. That is deliberate
(two competing full drafts is reviewable; a delta against nothing is not), but it means
the loop is:

> run a module → skim its proposals → **accept as draft** anything structurally sound,
> reject the junk → run the next module

Triage is ~5 minutes and is *not* the review. It exists to get pages into the index. The
real review (~17 h) happens afterwards, page by page in the reader, where `edit_page` lets
you fix in place instead of round-tripping through the queue.

Nothing is published by triage, so no student sees a drafted page. The invariant becomes
"nothing published is unreviewed" rather than "nothing stored is unreviewed".

---

## 1. Module → chapter mapping

**Confidence.** Module 04 = Mood Disorders is confirmed from the job you already ran. The
rest is from the 3rd edition's structure and **wants thirty seconds against your own file
list** before you rely on it — your PDFs are already named `BridleyDaffin-ModuleNN-Title`,
so a directory listing settles it.

One pattern worth knowing because it makes the mapping self-checking: **for modules 5–10,
the module number matches the DSM-5-TR chapter number** (module 5 = ch 5 anxiety, module 6
= ch 6 OCD, and so on through ch 10 eating). Module 4 is the exception at the front — it
covers DSM chapters 3 *and* 4, bipolar and depressive, which is also how L5 teaches them.
After module 10 the book reorders and the correspondence stops.

---

## 2. The run order

Ordered by **lecture**, so that partial completion is still usable — if August compresses
you want weeks 1–4 finished, not a random half of the course. Counts are pages this run
should produce; "done" is what already has an accepted body.

| # | Run | Lecture | DSM ch | Tier A | Overviews | Done | Mode |
|---|---|---|---|---|---|---|---|
| 1 | Modules 1–3 (foundations) | L1–L2 | — | — | — | 0 / 9 foundations | **reference**, one run per foundations page |
| 2 | Module 5 — Anxiety | L3 | 5 | 4 | 1 | 1 | paper |
| 3 | Module 6 — OCD & related | L3 | 6 | 2 | 1 | 0 | paper |
| 4 | Module 9 — Somatic symptom | L3 | 9 | 3 | 1 | 1 | paper |
| 5 | *Neurodevelopmental* | L3, L10 | 1 | 4 | 1 | 0 | **no textbook module — see §4** |
| 6 | Module 7 — Trauma & stressor | L4 | 7 | 2 | 1 | 0 | paper |
| 7 | Module 8 — Dissociative | L4 | 8 | 2 | 1 | 0 | paper |
| 8 | ~~Module 4 — Mood~~ | L5 | 3, 4 | 4 | 1 | **7 — already run** | paper ✔ |
| 9 | Module 10 — Feeding & eating | L6 | 10 | 3 | 1 | 2 | paper |
| 10 | *Sleep-wake* | L6 | 12 | 2 | 1 | 0 | **no textbook module — see §4** |
| 11 | Module 14 — Sexual disorders | L7 | 13, 14, 19 | 5 | 2 | 0 | paper ⚠ see §3 |
| 12 | *Disruptive, impulse-control* | L8, L10 | 15 | 2 | 1 | 0 | **no textbook module — see §4** |
| 13 | Module 11 — Substance-related | L8 | 16 | 5 | 1 | 0 | paper |
| 14 | Module 12 — Schizophrenia spectrum | L9 | 2 | 2 | 1 | 0 | paper |
| 15 | Module 15 — Neurocognitive | L10 | 17 | 3 | 1 | 0 | paper |
| 16 | Module 13 — Personality | L11 | 18 | 10 | 1 | 1 | paper — **biggest single run** |

Run 16 is the heaviest: all ten personality disorders became Tier A on 2026-07-30, so this
one module carries ten full pages. Budget review time accordingly, or split it across two
sittings.

---

## 3. Two runs that need extra care

**Run 11 (sexual disorders, L7)** covers three DSM chapters at once and contains both pages
the taxonomy flagged for **rewrite-level review — ~30 minutes each, not 15**:

- *Gender dysphoria* — the source deck's terminology is dated.
- *Paraphilic disorders overview* — the framing is lecture-hall-provocative.

Both flags travel into the review queue automatically as a red banner (`tier_review_note`),
so they will be in front of you at the moment of decision. Don't triage this run on autopilot.

**Run 16 (personality)** — ten Tier A pages from one module. The module may not give each
of the ten equal depth, which is exactly what the gap markers are for: let the pages declare
what they lack and close it with reference runs in §5 rather than forcing the module to
carry all ten.

---

## 4. Three chapters the textbook probably doesn't cover

The course teaches 18 DSM chapters; the textbook has ~15 modules and does not map onto all
of them. These three have Tier A pages with no obvious module:

| DSM ch | Lecture | Tier A | Suggested source |
|---|---|---|---|
| 1 — Neurodevelopmental | L3, L10 | 4 | NIMH topic pages (US public domain, copy-able with citation); CDDR for criteria structure |
| 12 — Sleep-wake | L6 | 2 | NIMH; CDDR. Sleep is thinly covered in most abnormal texts |
| 15 — Disruptive, impulse-control, conduct | L8, L10 | 2 | NIMH; the conduct-disorder pathway may also appear inside the personality module |

Use **reference mode** for these — it names the target page from the catalogue, so you get
the page you need rather than whatever carve a source suggests. Check the textbook's table
of contents first; if a module does cover one of these, prefer it, since it's the licence
you already have and the voice already in the wiki.

---

## 5. After the module sweep: the reference pass

`reference_worklist` orders incomplete catalogue pages Tier A first, by state and gap count.
As of 2026-07-30 that list is trustworthy — gaps derive from the page body, so a page that
says it needs etiology really does.

For each Tier A page still declaring gaps, run **reference mode** against a second source
naming that page as the target. Since 2026-07-30 reference mode returns a **complete page
with `action: replace`** rather than a delta, so accepting overwrites cleanly and you get one
coherent voice instead of two stitched together.

Good second sources, by what they're good for:

| Source | Licence | Use for |
|---|---|---|
| NIMH health topics & statistics | US public domain | prevalence, onset, course, plain-language framing |
| ICD-11 CDDR | WHO open licence | criteria structure, boundaries with normality and with other disorders |
| StatPearls (NCBI) | CC BY-NC-**ND** | read and cite and paraphrase — **never remix the text** |
| Cochrane / NICE / CANMAT | free to read | treatment evidence, effect sizes, Canadian relevance |

**DSM-5-TR PDFs never enter the pipeline.** The page links the official chapter through the
myaccess proxy; it never carries criteria text.

---

## 6. Citation string — required at upload

Attribution is a **licence condition** for CC BY-NC-SA material, not a courtesy, and the
portal now requires a citation per job. Page attribution is derived from it
(`wiki_page_provenance`), so getting it right once per upload is the whole job. Copy this,
changing only the module number and title:

```
Bridley, A., & Daffin, L. W. (2023). Fundamentals of Psychological Disorders
(3rd ed., DSM-5-TR update), Module NN: TITLE. Washington State University.
Licensed CC BY-NC-SA 4.0.
```

That is byte-for-byte the format already used for Module 4, so provenance stays consistent
across the sprint.

---

## 7. Before committing 17 hours

Run **one** module, triage it, then fully review two or three of its pages in the reader and
time yourself. Multiply by 78. The ~17-hour estimate predates the reader existing, and
rendered pages with working links should have moved it — better to find that out on module 5
than in week three.

Run 2 (anxiety, L3) is the natural pilot: it's the next lecture after the material you have,
it produces 4 Tier A pages plus an overview, and one page in that chapter already has a body
to merge against.
