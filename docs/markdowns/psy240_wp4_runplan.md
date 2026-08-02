# PSY240 WP4 — the content sprint run plan

> Written 2026-07-30, **corrected the same day against the actual book** (the first draft
> guessed the module numbering and got it wrong — see §1). Keyed to the live catalogue in
> `radlab-academic` rather than to any doc. Companion to
> [`psy240_wiki_plan.md`](./psy240_wiki_plan.md) (§4 sequencing) and
> [`psy240_taxonomy.md`](./psy240_taxonomy.md) (§6, the page list).
>
> **Scope: 78 generated pages, ~17 instructor-hours.** 53 Tier A disorders + 16 topic
> overviews + 9 foundations. The 45 Tier B stubs are generated mechanically from the seed
> with no model call and are not part of this plan.

---

## 0. Read this first — four things that will bite

**Run sequentially, never in parallel, and never the same source twice *in paper mode*.**
Filenames are unstable run-to-run, so two concurrent ingests of overlapping material produce two
competing carves of the same concepts. One job at a time, each seeing the wiki the previous one
left. **Reference mode may name several targets against one module** — `reference_worklist` counts
prior runs per page for exactly that reason — **but those runs are still sequential, with triage
between each, broad target first.**

> **Corrected 2026-07-31.** An earlier draft called reference mode "the exception" to the
> never-in-parallel rule full stop. That holds only for *conceptually disjoint* targets. Module 02's
> two runs were launched 17 seconds apart against `models-of-psychopathology` and
> `integrative-model`: neither saw the other, two supporting pages were proposed twice over, and the
> two target pages came back as near-duplicates sharing three identically-titled sections. Both had
> to be cut back afterwards. Run them one at a time.

**When a module feeds two catalogue slugs, vet run 1's supporting pages against run 2's target
before accepting them.** Triage-between-runs fixes duplicate *proposals*; it does not stop run 1
inventing a supporting page that squats on a slug this plan already lists as a later target. Module
03 hit this while doing everything else correctly: the `clinical-assessment` run produced
`classification-systems`, whose DSM history, elements-of-a-diagnosis list, ICD-11 chapter listing
and harmonization argument were a strict subset of `diagnosis-and-classification` — run 2's target.
It had to be archived and its inbound links retargeted. It should have been rejected at triage.

**A run has 300 seconds, and that is a hard wall.** The Vercel project is on Hobby, where
`maxDuration` cannot exceed 300s. The ingest runs inside `waitUntil()` *after* the 202 response,
so when the platform hits that limit it kills the function outright — no catch runs, the job row
stays `processing` forever, and nothing surfaces. Module 09 was lost that way on 2026-08-01 and
sat "processing" for an hour before anyone looked.

Runtime is **output-token-bound at ~82 tokens/sec**, measured across all 22 jobs; input barely
matters (Module 01 sent 91,863 input tokens and finished in 110s). So 300 seconds buys roughly
**25,000 output tokens**, and that is the real budget for a run.

Module 07 finished in **298 of the 300 seconds available** — it did not pass comfortably, it
squeaked through. Two seconds of margin is what separated the pilot run from the failure.

Three changes now hold the line, all in `api/ingest.js`:

- **`effort: 'medium'`** (was the `high` default). This is the big one and it is not the quality
  tradeoff it looks like. Module 07 spent 27,020 output tokens to produce ~14,100 tokens of actual
  page content — **about half the run, and half the 298 seconds, was thinking**. Opus 5 is
  unusually strong at medium, so this buys back most of that time.
- **A shared wall-clock deadline.** Every model call gets an `AbortSignal` sized to what is left of
  the invocation, not to a fresh per-call timeout. The budget belongs to the *invocation*: a
  malformed-JSON retry calls the model again and each call can retry on the fallback model, so one
  job can make four calls. The job now fails itself with a legible error instead of being killed
  silently.
- **`max_tokens: 32000`** (was 64,000). At 82 tok/s the old ceiling was ~780 seconds of generation
  inside a 300-second function — the model was permitted to produce more than twice what could
  ever be waited for.

**Thinking stays on.** Disabling it is the obvious-looking saving and is a trap: with thinking
disabled Opus 5 can leak `<thinking>` tags into the visible response, and this pipeline
`JSON.parse`s that response. A leaked tag fails the parse, fires the retry, and doubles the
runtime — precisely the failure being budgeted against.

**Module 13 will still not fit, and probably Module 11 and 16 too.** Ten Tier A personality
disorders cannot be written in 25,000 output tokens. Those need splitting: the module PDF cut at a
section boundary and run as two paper jobs with triage between. Two halves of one module are
disjoint sources, so the never-the-same-source-twice rule in this section is not violated — and
triage between them means the second half sees the first half's accepted pages, which is the
coordination that keeps the carve coherent.

**Triage between runs, or you get duplicates.** `api/ingest.js` builds the model's wiki index
from pages **with accepted content only** — a page sitting unreviewed is invisible to the next
run, so the next module proposes it afresh as a full draft. That is deliberate (two competing
full drafts is reviewable; a delta against nothing is not), but it makes the loop:

> run a module → skim its proposals → **accept as draft** anything structurally sound, reject
> the junk → run the next module

Triage is ~5 minutes and is *not* the review. It exists to get pages into the index. The real
review (~17 h) happens afterwards, page by page in the reader, where `edit_page` lets you fix
in place instead of round-tripping through the queue. Nothing is published by triage, so no
student sees a drafted page.

---

## 1. The book, as it actually is

`Fundamentals-of-Psychological-Disorders-1721254433._oss.pdf`, 343 pages, **16 modules** in six
parts. All 16 are now split out in `F:\gits\radlab_project\PSY240resources\` as
`BridleyDaffin-ModuleNN-Title.pdf`, using the same boundaries and naming as the two you had
already extracted — verified by reproducing Module 04 (23 pages) and Module 07 (18 pages)
byte-for-page against your own files.

| Module | Title | Book pages | Pages |
|---|---|---|---|
| 01 | What is Abnormal Psychology? | 30–63 | 34 |
| 02 | Models of Abnormal Psychology | 64–98 | 35 |
| 03 | Clinical Assessment, Diagnosis, and Treatment | 99–114 | 16 |
| 04 | Mood Disorders | 116–138 | 23 |
| 05 | Trauma- and Stressor-Related Disorders | 139–155 | 17 |
| 06 | Dissociative Disorders | 156–167 | 12 |
| 07 | Anxiety Disorders | 169–186 | 18 |
| 08 | Somatic Symptom and Related Disorders | 187–201 | 15 |
| 09 | Obsessive-Compulsive and Related Disorders | 202–215 | 14 |
| 10 | Feeding and Eating Disorders | 217–231 | 15 |
| 11 | Substance-Related and Addictive Disorders | 232–250 | 19 |
| 12 | Schizophrenia Spectrum and Other Psychotic Disorders | 252–267 | 16 |
| 13 | Personality Disorders | 268–287 | 20 |
| 14 | Neurocognitive Disorders | 289–301 | 13 |
| 15 | Contemporary Issues in Psychopathology | 302–310 | 9 |
| 16 | Disorders of Childhood Overview | 311–340 | 30 |

**Do not assume module number tracks DSM chapter number.** The first draft of this plan did,
on the strength of Module 4 = Mood, and was wrong: the book groups disorders into teaching
*blocks*, not DSM order. Anxiety is Module **7**, not 5; OCD is **9**, not 6; somatic is **8**,
not 9. The mapping below is from the book's own table of contents.

---

## 2. Module → what it feeds

| Module | Feeds | DSM ch | Lecture |
|---|---|---|---|
| 01 | Foundations: what "abnormal" means, classification, stigma, history of mental illness, research methods | — | L1 |
| 02 | Foundations: the integrative model — biological, psychological, sociocultural | — | L1–2 |
| 03 | Foundations: clinical assessment, diagnosis, treatment overview | — | L2 |
| 04 | Depressive + Bipolar | 3, 4 | L5 |
| 05 | Trauma- and stressor-related | 7 | L4 |
| 06 | Dissociative | 8 | L4 |
| 07 | Anxiety | 5 | L3 |
| 08 | Somatic symptom | 9 | L3 |
| 09 | Obsessive-compulsive & related | 6 | L3 |
| 10 | Feeding & eating | 10 | L6 |
| 11 | Substance-related & addictive | 16 | L8 |
| 12 | Schizophrenia spectrum | 2 | L9 |
| 13 | Personality (all ten) | 18 | L11 |
| 14 | Neurocognitive | 17 | L10 |
| 15 | Foundations: law, patients' rights, civil/criminal commitment, therapist–client relationship | — | L1 / L10 |
| 16 | **Cross-cutting.** Neurodevelopmental (intellectual disability, learning, autism, tics) and ADHD; conduct/ODD/intermittent explosive; *plus* pieces of anxiety (selective mutism, separation anxiety), OCD (trichotillomania, excoriation), trauma (RAD, disinhibited social engagement) and eating (pica, rumination, ARFID) | 1, 15, + | L3, L8, L10 |

---

## 3. The run order

Ordered by **lecture**, so partial completion is still usable — if August compresses you want
weeks 1–4 finished, not a random half of the course.

| # | Upload | Mode | Produces | Lec |
|---|---|---|---|---|
| — | ~~Module 01~~ | reference ×3 ✔ → `what-is-abnormal`, `historical-traditions`, `research-methods` (+ a paper run, 6 supporting pages) | L1 |
| — | ~~Module 02~~ | reference ×2 ✔ → `models-of-psychopathology`, `integrative-model` — **ran concurrently; both targets needed trimming afterwards** (§0) | L1–2 |
| — | ~~Module 03~~ | reference ×2 ✔ → `clinical-assessment`, `diagnosis-and-classification` — **run 1's `classification-systems` pre-empted run 2 and was archived** (§0) | L2 |
| 4 | Module 15 | **reference** ×1 → `law-and-ethics` | L1/L10 |
| — | ~~Module 07~~ | paper ✔ | **run 2026-07-31, triaged 2026-08-01** — 14 pages, 5 Tier A | L3 |
| 6 | Module 09 | paper | 2 Tier A | L3 |
| 7 | Module 08 | paper | 3 Tier A (1 written) | L3 |
| — | ~~Module 05~~ | paper ✔ | **run + triaged 2026-08-01** — 13 pages, 2 Tier A | L4 |
| — | ~~Module 06~~ | paper ✔ | **run + triaged 2026-08-01** — 8 pages, 2 Tier A + the DID debate page | L4 |
| — | ~~Module 04~~ | paper ✔ | **already run** — 7 pages | L5 |
| — | ~~Module 10~~ | paper ✔ | **run + triaged 2026-08-01** — 11 pages; the two eating stubs restructured by hand (§8.9) | L6 |
| — | ~~Module 11~~ | paper ✔ | **run + triaged 2026-08-01** — 17 pages, but **0 of 5 Tier A**: carve mismatch, see §4 and the reference runs below | L8 |
| — | ~~Module 12~~ | paper ✔ | **run + triaged 2026-08-01** — 14 pages, 2 Tier A + 2 Tier B; L9 Tier A complete | L9 |
| — | ~~Module 14~~ | paper ✔ | **run + triaged 2026-08-02** — 13 pages, 2 Tier A + 1 Tier B; `vascular-ncd` queued as a reference run (§5) | L10 |
| 14 | Module 13 | paper, **try extracted** | **10 Tier A** (1 written) — the one run that will not fit 300s; see §5 | L11 |
| 15 | **Module 16 — run this LAST** | paper | neurodevelopmental + disruptive/conduct, and deltas onto pages from runs 5–10 | L3/8/10 |

### Why the foundations runs are reference mode, not paper

**Learned the hard way on 2026-07-31**, when Module 01 was run in paper mode as the first draft
of this plan said. It produced six genuinely good pages — `stigma-of-mental-illness`,
`medicalization-of-distress`, `epidemiology`, `multicultural-psychology` — and **none of the
catalogue foundations it was supposed to fill.** The module has sections on the history of mental
illness and on research methods; no page was made for either. It wrote `abnormal-behavior` where
the catalogue says `what-is-abnormal`.

The reason generalises, so it is worth stating: **the slug convention holds for disorders because
disorder names are canonical.** The field agrees what "major depressive disorder" is called, so the
model's independent choice and the catalogue's hand-written slug converge — which is exactly what
was measured and celebrated at 44 pages. **Foundations slugs are our invention.** There is nothing
for the model to converge on, so paper mode will keep missing them however many times it is run.

Anything with a catalogue slug the field would not independently invent — foundations, and the 16
topic overviews — wants reference mode, which names the target. Paper mode is for letting a source
tell you what it contains.

Paper-mode runs on the foundations modules are still *useful* — that is where the supporting
concept pages come from — so the shape is: reference runs for the named pages, and optionally one
paper run per module afterwards for the surrounding concepts.

### The 16 overviews are a reference-pass job — measured, not predicted

The paragraph above predicted this; **2026-08-01 confirmed it.** Two disorder chapters have now
been run in paper mode — Module 04 (18 pages) and Module 07 (14 pages) — and between them they
produced **zero of the 16 topic overviews**. Not `mood-disorders`, not `anxiety-disorders`,
despite both chapters being entirely about those blocks.

The run table above used to promise "N Tier A **+ overview**" from each chapter run. That column
was wrong and has been corrected: paper mode delivers the Tier A disorders reliably and the
overview never. The reason is the same one that sank the Module 01 paper run — an overview slug
like `obsessive-compulsive-and-related-disorders` is the catalogue's construction, and there is
nothing for the model to converge on.

So all 16 overviews belong to the **reference pass (§5)**, not to the module sweep. Two ways to
take them, and the choice is real:

- **Deferred (plan as written).** Finish the module sweep, then one reference run per overview.
  Cleanest bookkeeping; overviews get written against a wiki that already knows every disorder
  they summarise, which is the right context for an overview.
- **Interleaved.** After each chapter's paper run, one extra *extracted*-mode reference run
  against the same module naming that overview slug. Costs about $0.13 and one triage cycle per
  module, and keeps the chapter fresh — but the overview is written before its sibling chapters
  exist, so cross-block framing has to be added later anyway.

Deferred is the default for that last reason. Interleaving buys freshness the overview cannot
actually use.

**Module 16 goes last, deliberately.** It cross-cuts: it covers selective mutism and separation
anxiety (anxiety), trichotillomania and excoriation (OCD), reactive attachment (trauma), pica and
ARFID (eating), as well as its own neurodevelopmental and conduct material. Run early it would
*define* those pages from a childhood-overview angle; run last it writes **updates onto pages the
proper chapter module already established**, which is the right shape. It is also the run most
likely to produce many small deltas — expect a fuller triage pass than the others.

Run 14 (personality) is the heaviest single run: all ten PDs became Tier A on 2026-07-30, so one
module carries ten full pages. Consider splitting its review across two sittings.

---

## 4. What the textbook does not cover

Verified against the book's table of contents — **all of Lecture 7 plus sleep has no module**:

| DSM ch | Topic | Lecture | Tier A | Overview |
|---|---|---|---|---|
| 12 | Sleep-wake | L6 | 2 | 1 |
| 13 | Sexual dysfunctions | L7 | 2 | 1 |
| 14 | Gender dysphoria | L7 | 1 | — |
| 19 | Paraphilic disorders | L7 | 2 | 1 |

That's **7 Tier A pages and 3 overviews with no textbook source** — the single biggest finding in
this plan, and worth knowing in July rather than in week six. The 9th foundations page,
**suicide**, is also uncovered: it appears inside Module 04's mood epidemiology but has no section
of its own.

> **Added 2026-08-01 after Module 11: `gambling-disorder` joins this list.** It is Tier A on the
> catalogue and **gambling appears zero times in the entire module** — checked with
> `pdftotext -layout` over the whole 57,887-character extraction, not inferred from the table of
> contents. Module 11 covers only substance-related disorders; the addictive-behaviours half of DSM
> chapter 16 is absent. So the count above becomes **8 Tier A pages with no textbook source**.
> NIMH is the obvious replacement source.
>
> This is worth separating from the *other* Lecture 8 problem, which looks similar and is not the
> same thing. Alcohol, cannabis, opioid and stimulant are **also** unwritten after Module 11, but for
> the opposite reason: their material is present and abundant (alcohol 52 mentions, cannabis 21,
> opioid 21, stimulant 19) and merely distributed across the intoxication, withdrawal, epidemiology,
> etiology and treatment sections, because the module partitions by *drug class* — Depressants /
> Stimulants / Hallucinogens-Cannabis — rather than by the five substances the catalogue names.
> Those four are recoverable from this module by reference mode, which is exactly the tool for
> pulling a named target out of a source that is organised some other way. Gambling is not
> recoverable from it at any effort, because the content is not there.

Use **reference mode** for all of these — it names the target page from the catalogue, so you get
the page the course needs rather than whatever carve a source suggests. Sources:

| Source | Licence | Good for |
|---|---|---|
| NIMH health topics & statistics | US public domain — copyable with citation | prevalence, onset, course, suicide statistics, plain-language framing |
| ICD-11 CDDR | WHO open licence | criteria structure, boundaries with normality and with other disorders |
| StatPearls (NCBI) | CC BY-NC-**ND** | read, cite, paraphrase — **never remix the text** |
| Cochrane / NICE / CANMAT | free to read | treatment evidence, effect sizes, Canadian relevance |

**L7 needs the most care of any lecture**: it has no textbook source *and* contains both pages the
taxonomy flagged for **rewrite-level review at ~30 min each** — gender dysphoria (dated
terminology in the source deck) and the paraphilic overview (lecture-hall-provocative framing).
Those flags surface automatically as a red banner in the review queue.

**DSM-5-TR PDFs never enter the pipeline.** Pages link the official chapter through the myaccess
proxy; they never carry criteria text.

---

## 5. After the module sweep: the reference pass

`reference_worklist` orders incomplete catalogue pages Tier A first, by state and gap count. As of
2026-07-30 that list is trustworthy — gaps derive from the page body, so a page that says it needs
etiology really does.

For each Tier A page still declaring gaps, run reference mode against a second source naming that
page as the target. Since 2026-07-30 reference mode returns a **complete page with `action:
replace`** rather than a delta, so accepting overwrites cleanly and you get one coherent voice
instead of two stitched together.

### Queued reference runs — Lecture 8 ✔ **all four run and triaged 2026-08-01**

Module 11's paper run produced good generic pages and **none of the five Tier A substances** (§4).
Four are recoverable from the same module because the material is there, just partitioned by drug
class instead of by substance. Reference mode names the target and pulls from wherever in the
source the material sits, which is precisely this situation.

Upload `BridleyDaffin-Module11-SubstanceRelatedAddictive.pdf`, **reference** mode, once per target,
**sequentially with triage between each** (§0 — this is the pattern that bit on Module 02, where two
runs launched 17 seconds apart produced near-duplicate targets):

| # | `target_slug` | Where the material lives in the module |
|---|---|---|
| 1 | `alcohol-use-disorder` | 11.1.5.1 Depressants; heaviest coverage in the module (52 mentions) |
| 2 | `stimulant-use-disorder` | 11.1.5.2 Stimulants — cocaine and amphetamines |
| 3 | `cannabis-related-disorders` | 11.1.5.3 Hallucinogens/Cannabis/Combination |
| 4 | `opioid-use-disorder` | 11.1.5.1 Depressants, alongside alcohol and sedative-hypnotics |

**Broad target first is the §0 rule, and here it means alcohol first** — it has the most coverage,
so it is the run most likely to invent supporting pages the later three would otherwise duplicate.
Vet its supporting pages against the remaining three targets before accepting them.

Expect **`action: replace` or `new`, not `update`** on the targets themselves: each is an unwritten
catalogue slug, so there is no body to delta against.

Use citation row 11 from §6 verbatim. **`gambling-disorder` is not in this list** — the module does
not mention it at all, so it needs a different source entirely (§4).

Use **extracted** for these four — confirmed on this exact module, not assumed: they are re-reads of one document, the
prose-vs-tables finding in §5 above showed extraction losing nothing that reached a page, and four
native re-reads of a 65k-token module is the one place in this sprint where the input cost is
actually worth avoiding.

### Queued reference run — `vascular-ncd` against Module 14

Module 14's paper run wrote `delirium`, the two level constructs, and two aetiology subtypes, but not
`vascular-ncd` — **Tier A**, covered by the module in §14.3.3 with 11 mentions. Same situation as the
four Lecture 8 substances: the material is present, the module just partitions it under Etiology by
aetiology rather than giving each subtype its own chapter section.

Upload `BridleyDaffin-Module14-NeurocognitiveDisorders.pdf`, **reference** mode, **extracted**,
`target_slug` = `vascular-ncd`. Citation row 14 from §6. One run, so no sequencing concern.

Expect `new`, not `update` — the slug is unwritten. Vet any supporting page it invents against the
five Tier B NCD subtypes still unwritten (`frontotemporal-ncd`, `ncd-with-lewy-bodies`,
`substance-medication-induced-ncd`, `ncd-other-aetiologies`), which are the obvious things for it to
squat on.

The module also covers Parkinson's and Huntington's NCD (§14.3.7–8, 13 and 9 mentions), which the
catalogue folds into `ncd-other-aetiologies` (Tier B). Worth a second reference run against that slug
if Tier B becomes a priority; not before.

### What repeat runs on one source cost

Every run re-sends the whole document, so three reference runs against one module read that module
three times. Measured on the two real runs:

| Run | Mode | Input tokens | Output | Pages |
|---|---|---|---|---|
| Module 04, paper | extracted | 24,938 | 16,468 | 18 |
| Module 04, reference | extracted | 26,090 | 4,372 | 1 |
| Module 01, paper | **native** | **91,863** | 8,970 | 6 |
| Module 01, reference ×3 | **native** | **92,266–92,270** each | 5,477 / 9,897 / 10,842 | 1 + clone each |
| Module 02, reference ×2 | **native** | **92,225–92,232** each | 15,115 / 16,612 | 4 and 6 |
| Module 03, reference ×2 | extracted | **21,798 / 22,041** | 13,060 / 9,435 | 3 and 2 |

**Native costs ~3.7× the input of extracted on this book**, and the Module 03 runs confirmed it
end to end: 22k against 92k on modules of comparable length, a **4.2× saving**, with no loss of
quality in the output — `clinical-assessment` and `diagnosis-and-classification` are the two
strongest foundations pages produced so far. Modules 01 and 02 were run native before this was
settled, at a cost of roughly $0.85 per run more than necessary. **Module 15 should be extracted.** Native is the course default because
*student* submissions may be scans with no text layer — that reasoning does not apply to this
textbook, which is born-digital with a clean text layer, and Module 04 produced 18 good pages in
extracted mode.

The trade-off is real though: extraction silently drops figures and mangles tables. For the
foundations modules (prose and concepts) extracted is a safe saving. For the **disorder chapters,
stay native** — the criteria and prevalence tables are the payload, and a mangled table looks like
a successful run.

> **Corrected 2026-08-01 — "the tables are the payload" was never checked, and does not hold.**
> The rule above was written from first principles and asserted as settled. Three measurements
> against the live corpus say otherwise:
>
> 1. **No disorder page contains a markdown table, in either mode** — 0 of 24. Whatever native
>    preserves, it is not arriving as a table. The model prosifies tabular material, which is
>    arguably the right call for a wiki, but it means the stated benefit is invisible in the output.
> 2. **Percentage figures — the actual content of a prevalence table — are *denser* in extracted
>    pages**: 1.19 per 1,000 characters against 0.91 for native. (Confounded: extracted is Module 04,
>    native is 07/08/09.)
> 3. **The decisive one.** Every prevalence figure the *native* Module 08 run put on a page —
>    1.3%, 10%, 35%, 6%, 60% — is present in the text `pdftotext -layout` pulls out of the same PDF,
>    which contains only six distinct percentages in total. Extraction had access to everything
>    native actually used, and lost nothing that reached a page.
>
> **What this does not test:** figures and diagrams, and DSM criteria laid out as tables rather than
> prose. Those could still favour native and have not been measured. The 3.7× input premium is
> therefore unjustified *on prevalence data* and unexamined elsewhere.
>
> **Recommendation: do not churn mid-sweep.** The saving is ~$0.17 per run and ~$1.30 across
> everything remaining, against a real cost in consistency — pages generated two different ways
> during one sweep. Native stays the default for the remaining disorder chapters. The two places to
> revisit it:
>
> - **Module 13** (ten Tier A personality disorders, run 14) is the one run that will not fit in
>   300s. Try it **extracted at `effort: medium`** before splitting the PDF: extraction buys input
>   headroom, medium buys output headroom, and the pair may make a split unnecessary. If the run
>   still overruns, split at a section boundary — Cluster A / B / C, which is how both the DSM and
>   the book group them — rather than splitting prose from tables. A prose page and a tables page
>   have to be merged afterwards, which is deliberately inducing the collision that §8 exists to
>   prevent.
> - **Any future non-textbook source**, where the extraction quality is unknown and the check above
>   is worth re-running before trusting it.
>
> Reproduce with `pdftotext -layout <module>.pdf -` and compare against the figures on the pages
> that module produced.
>
> **Two false-positive modes in that check, both hit on Module 11 (2026-08-01).** Re-running it
> there appeared to show 2 of 16 figures lost to extraction. Neither was real:
>
> - **`86%` — wrong attribution.** The figure sat on `operant-conditioning`, which Module 11 only
>   *updated*; the number came from Module 09's ERP material and predated the run. Joining pages to
>   a job by `job_id` attributes the page's **whole body** to that job, not just what the job added.
>   Compare against the *proposal* content, not the current page, on any page that has been updated.
> - **`65%` — the source spells numbers in words.** Bridley & Daffin write "Sixty-five percent of
>   individuals report their first drug of use was marijuana"; the model normalised it to `65%`.
>   A digit-matching regex finds nothing. Grep the surrounding term (`gateway`) rather than the
>   figure before concluding anything is missing.
>
> Corrected, Module 11 is **16 of 16 figures preserved**, and the drug-class section structure
> (`11.1.5.1 Depressants`, `11.1.5.2 Stimulants`, `11.1.5.3 Hallucinogens/Cannabis`) survives intact.
> The mention counts that establish which Tier A substances are recoverable — alcohol 52, cannabis
> 21, opioid 21, stimulant 19 — were themselves counted from the extracted text, so extraction
> demonstrably carries what the queued reference runs need.

**Prompt caching was investigated (2026-07-31) and is not worth it here.** The arithmetic, on
Module 01's real 91,863 input tokens at Opus 4.8's $5/MTok: three reference runs cost **$1.38**
uncached, **$1.01** with a 1-hour cache — a 27% saving, about **$0.37 per module**. Two things
kill it. Caching only breaks even at **three or more runs against the same PDF**, and only Module
01 has three targets (02 and 03 have two, Module 15 has one — for those, caching costs *more*
than not caching). And a **5-minute TTL is actively worse than no caching** in this workflow:
triage sits between runs, so each run would write a cache the next run is too late to read —
3 × 1.25× = 3.75× versus 3× for doing nothing. Meanwhile switching those same runs to extracted
mode costs nothing to implement and brings three runs to about **$0.38**, beating every cached
variant of the native path.

One structural note worth keeping, because it is non-obvious and would otherwise be rediscovered:
`api/ingest.js` already puts the PDF **before** the volatile text (target brief + wiki index) in
the user message, and the wiki index changes between runs as pages are accepted. That ordering —
done for an unrelated reason — is exactly what caching needs, so if the economics ever change,
enabling it is a one-line `cache_control` on the document block with **no prompt reordering**. The
token accounting already sums `input + cache_creation + cache_read`, so recorded job totals would
stay comparable.

---

### Effort: `medium` beats `high` here, measured over three chapters

Set on 2026-08-01 to survive the 300s cap (§0). The question was whether it thins the pages.
It does not. Native paper-mode disorder chapters, like for like:

| Module | Effort | Secs | Output tok | Pages | Content chars | **Chars per output tok** | Secs/page |
|---|---|---|---|---|---|---|---|
| 07 anxiety | high | 298 | 27,020 | 14 | 56,347 | **2.08** | 21.3 |
| 09 OCD | medium | 189 | 16,750 | 10 | 36,985 | **2.21** | 18.9 |
| 08 somatic | medium | 202 | 18,635 | 12 | 41,253 | **2.21** | 16.8 |

Both medium runs land on **exactly 2.21** chars of page per output token against 2.08 at high — more
of each token becomes page rather than thinking — and time per page falls. (Module 04's paper run
is 1.79, but it was extracted mode with much shorter pages, so it is not comparable.)

**Raw page length does not separate the two, and the reason is worth keeping.** Mean new
Tier A page: 6,124 chars at high (M07), 6,778 at medium (M09), 4,781 at medium (M08). Medium
produced both the longest and the shortest set, so the variance is the *source module*, not the
effort setting. The `needs` frontmatter confirms it — length tracks declared gaps almost exactly:

| Declared gaps | Pages | Length |
|---|---|---|
| 3 | illness-anxiety, functional-neurological, factitious | 3,868–4,251 |
| 2 | psychological-factors-affecting-other-medical-conditions | 6,899 |
| 1 | hoarding, body-dysmorphic, obsessive-compulsive | 6,103–7,710 |

The short Module 08 pages are short because the somatic chapter genuinely carries little etiology
and treatment, and the model **declared the gap instead of padding**. That is the behaviour the
`needs` mechanism exists to produce, and it is the opposite of quality loss.

Caveat: N=1 high against N=2 medium, different source modules. The efficiency metric is consistent
and no quality signal points the other way, so **stay on medium** — but this is worth re-checking
if a later chapter reads thin for reasons the gap list doesn't explain.

---

## 6. Citations — copy these, don't compose them

Attribution is a **licence condition** for CC BY-NC-SA material, not a courtesy. Page attribution
derives from `ingest_jobs.source_citation` (`wiki_page_provenance`), so the string you paste at
upload is the one a reader eventually sees under *Built from*.

**The form.** Creative Commons attribution wants four things — title, author, source, licence
(TASL). The original Module 4 citation had the first two and named the licence but gave **no link
to the source**, which is the part that lets a reader find the original and check the paraphrase.
The form below adds it. All three URLs were checked live on 2026-07-30 and resolve.

```
Bridley, A., & Daffin, L. W. (2023). Module N: TITLE. In Fundamentals of Psychological
Disorders (3rd ed., DSM-5-TR update). Washington State University.
Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/
```

**The sixteen, ready to paste.** Module titles are taken from the book's own table of contents,
so a mistyped module name can't enter the provenance record:

| # | Citation |
|---|---|
| 1 | `Bridley, A., & Daffin, L. W. (2023). Module 1: What is Abnormal Psychology? In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 2 | `Bridley, A., & Daffin, L. W. (2023). Module 2: Models of Abnormal Psychology. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 3 | `Bridley, A., & Daffin, L. W. (2023). Module 3: Clinical Assessment, Diagnosis, and Treatment. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 4 | `Bridley, A., & Daffin, L. W. (2023). Module 4: Mood Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 5 | `Bridley, A., & Daffin, L. W. (2023). Module 5: Trauma- and Stressor-Related Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 6 | `Bridley, A., & Daffin, L. W. (2023). Module 6: Dissociative Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 7 | `Bridley, A., & Daffin, L. W. (2023). Module 7: Anxiety Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 8 | `Bridley, A., & Daffin, L. W. (2023). Module 8: Somatic Symptom and Related Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 9 | `Bridley, A., & Daffin, L. W. (2023). Module 9: Obsessive-Compulsive and Related Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 10 | `Bridley, A., & Daffin, L. W. (2023). Module 10: Feeding and Eating Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 11 | `Bridley, A., & Daffin, L. W. (2023). Module 11: Substance-Related and Addictive Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 12 | `Bridley, A., & Daffin, L. W. (2023). Module 12: Schizophrenia Spectrum and Other Psychotic Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 13 | `Bridley, A., & Daffin, L. W. (2023). Module 13: Personality Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 14 | `Bridley, A., & Daffin, L. W. (2023). Module 14: Neurocognitive Disorders. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 15 | `Bridley, A., & Daffin, L. W. (2023). Module 15: Contemporary Issues in Psychopathology. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |
| 16 | `Bridley, A., & Daffin, L. W. (2023). Module 16: Disorders of Childhood Overview. In Fundamentals of Psychological Disorders (3rd ed., DSM-5-TR update). Washington State University. Licensed CC BY-NC-SA 4.0. https://opentext.wsu.edu/abnormal-psych/` |

**Why paste rather than edit.** The portal now keeps the citation after submit and offers a
*"reuse a citation from a previous run"* picker, so editing the previous string is possible — but
the two things you'd edit are the module number and its exact title, which is precisely where a
typo becomes a permanent provenance error nobody notices. Pasting a prepared row costs the same
and can't drift.

The **Suggest citation** button is the path for journal articles: it reads a DOI off the PDF and
resolves it. The textbook has no DOI, verified — so for these sixteen runs it will correctly tell
you it found none.

A suggestion never fills the field on its own; you accept it explicitly. Attribution is a licence
condition, and a looked-up citation nobody read is worse than one typed badly.

---

## 7. Before committing 17 hours

Run **one** module, triage it, then fully review two or three of its pages in the reader and time
yourself. Multiply by 78. The ~17-hour estimate predates the reader existing, and rendered pages
with working links should have moved it — better to learn that on run 5 than in week three.

**Run 5 (Module 07, anxiety) is the natural pilot**: it is the next lecture's material, produces 4
Tier A pages plus an overview, and one page in that chapter already has a body, so it exercises the
merge path as well as the create path.

---

## 8. The gap map — what the sweep will fix, and what it won't

> Written 2026-08-01 after Modules 07, 09 and 08. The working order is **skeleton first, review
> second**: get every part assembled, then review the assembled thing. This section exists so the
> skeleton's holes are visible *while* it is being assembled, because two of them are invisible to
> the obvious check and one of them the remaining runs will never close.

### 8.1 Where the skeleton stands

Counting a page as written only if it has an accepted body (after triaging Modules 09, 08, 05 and 06):

| Tier | Written | Total |
|---|---|---|
| A (central to the course) | 30 | 54 |
| B (supporting) | 13 | 46 |
| Foundation | 8 | 9 |
| **Overview** | **0** | **16** |

### 8.2 "Has a page" is not "has a skeleton" — the stub problem

**Six of the Tier A pages that exist are stubs**, at 1,716–3,029 characters against a healthy
5,000–8,000, and they are invisible to any coverage count:

| Page | Chars | Will a scheduled run fix it? |
|---|---|---|
| `bulimia-nervosa` | 1,716 | ✅ Module 10 (run 10) |
| `anorexia-nervosa` | 2,049 | ✅ Module 10 (run 10) |
| `borderline-personality-disorder` | 3,029 | ✅ Module 13 (run 14) |
| `somatic-symptom-disorder` | 2,713 | ✅ already — Module 08's pending update is 5,166 |
| **`bipolar-i-disorder`** | **2,845** | ❌ **no — Module 04 is done** |
| **`bipolar-ii-disorder`** | **1,914** | ❌ **no — Module 04 is done** |

They exist because the **early journal-article ingests** (Shedler, Fonagy, the BMJ psychotherapy
paper) mentioned these disorders in passing and created pages for them. Every page produced by the
*module* sweep is healthy; every stub predates it.

**The mood block is the one that bites.** Lecture 5 reads as fully covered — 4 of 4 Tier A written
— but three of those four are incomplete (`bipolar-i`, `bipolar-ii`, and `persistent-depressive-
disorder`, which declares epidemiology, etiology *and* treatment missing), and **Module 04 has
already run, so nothing in the remaining schedule will revisit them.** Left alone they ship as-is.
Fix: one reference-mode run per page against Module 04, in the reference pass (§5).

### 8.3 `needs` detects missing headings, not thin ones

`bipolar-i-disorder` and `bipolar-ii-disorder` declare only `contested` — by the gap list they are
nearly complete. They are 2,845 and 1,914 characters. Every skeleton heading is present; each
section is a sentence or two beneath it.

So **the gap list understates the work**, and a length check has to run alongside it. Working rule:
a Tier A page under ~4,000 characters is thin regardless of what it declares.

### 8.4 The two gap families, and why they split cleanly

The `needs` vocabulary across the corpus falls into two groups, and they map onto two different
kinds of work:

**Core skeleton** — `diagnosis` (5 pages), `presentation` (4), `epidemiology` (7), `etiology` (9),
`treatment` (5). A page missing these is missing the template. This is instructor work.

**`contested`** — 9 pages, and structurally absent almost everywhere else. The textbook does not do
controversy; it reports consensus. That makes it the single best student contribution target in the
corpus: the section is *supposed* to exist, the model correctly refuses to invent it, and finding
the live disagreement in a diagnosis is real intellectual work rather than summarising.

A third group is bespoke one-off enrichments on the foundation pages
(`non-western-and-global-histories`, `canadian-law-and-other-jurisdictions`,
`cultural-and-contextual-considerations`, `alternatives-to-categorical-diagnosis`). Genuinely
additive, not core.

### 8.5 Thin *and* central — the hub check

Length alone mis-ranks: a short page nothing links to costs little, a short page everything links
to degrades all of them. Pages under 2,500 chars with 6+ inbound links:

| Page | Chars | Inbound |
|---|---|---|
| `epidemiology` | 2,339 | 8 |
| `allegiance-effect` | 1,371 | 7 |
| `multicultural-psychology` | 2,104 | 7 |
| **`cognitive-behavioral-therapy`** | **1,362** | **6** |
| `effect-size` | 1,527 | 6 |

`cognitive-behavioral-therapy` is the one to look at first — the most-referenced treatment in an
abnormal psychology course, and one of the thinnest pages in the wiki.

### 8.6 The two lists

**Core text — must exist before the class starts.**

1. **The 16 topic overviews.** Zero written; every lecture needs its own. Reference pass (§5).
2. **The mood block: `bipolar-i`, `bipolar-ii`, `persistent-depressive-disorder`.** No scheduled run
   will touch them (§8.2).
3. **Lecture 7 in full** — 7 Tier A pages and 3 overviews with no textbook source at all (§4).
4. **`suicide-and-self-harm`** — the only unwritten foundation, and uncovered by the textbook (§4).
5. **`cognitive-behavioral-therapy`**, and the thin hubs behind it (§8.5).
6. The 37 remaining Tier A pages from unrun modules — *on track* via the sweep, not at risk.

**Student starting points — publish the list, don't fill them.**

1. **`contested` sections**, corpus-wide. The best of the set (§8.4).
2. **The 39 remaining Tier B stubs** — what the taxonomy designed them for.
3. **Thin peripheral concepts**: `defense-mechanisms` (717), `attributional-style` (784),
   `cognitive-triad` (801), `learned-helplessness` (871), `monoamine-hypothesis` (901),
   `transference` (971). Small, well-scoped, low-risk.
4. **Foundation enrichments** — the bespoke one-offs in §8.4.

Norm's sequencing note, kept because it governs how this list is used: the student list gets
extended *after* the core textbook is assembled, not now.

### 8.7 Check the slug against the catalogue at every triage

The slug convention is what makes paper mode viable — disorder names are canonical, so the model's
independent choice and the catalogue's hand-written slug converge. It has now missed twice, and both
misses were invisible to a coverage count:

| Run | Model wrote | Catalogue has | Consequence |
|---|---|---|---|
| Module 15 | `internet-gaming-disorder` | *(no row at all)* | Good page, outside the catalogue |
| Module 05 | `adjustment-disorder` | `adjustment-disorders` | **Tier A** row read "no page yet" |

Both failures look identical from the wiki side — the page exists, reads well, resolves its links —
and identical from the catalogue side — the row is unlinked, so `reference_worklist` keeps offering
it as unwritten work and the browse-by-DSM-chapter view never shows it.

**The pattern to expect is number.** DSM category names covering subtypes are plural
(`adjustment-disorders`, `tic-disorders`, `communication-disorders`, `parasomnias`) while single
diagnoses are singular. The model reaches for the singular because it is writing about *a* disorder.

Check at every triage:

```sql
SELECT p.slug AS page_only, d.slug AS catalogue_only
FROM wiki_pages p
FULL JOIN disorders d ON d.page_id = p.id
WHERE p.type = 'disorder' AND (d.id IS NULL OR p.id IS NULL);
```

**Fix with `rename_page()`, and fix it *after* accepting, not before.** Wikilinks are extracted on
accept, so a rename run before triage reports a clean rename and is wrong — Module 05's rename
orphaned two inbound links (`posttraumatic-stress-disorder`, `acute-stress-disorder`, both of which
had linked the singular) that did not exist an hour earlier. `rename_page()` reports what it
orphaned; retarget those with `edit_page()` and re-check red links.

### 8.8 Open question: does a debate page discharge a `contested` gap?

Module 06 wrote the DID controversy as its own page — `sociocultural-iatrogenic-model-of-did`,
3,430 chars — while all three dissociative disorder pages still declare `needs: [contested]`.

That is defensible: `debate` is a first-class page type, and the iatrogenic argument spans the whole
diagnostic category rather than sitting under one diagnosis. But it means the gap list overstates
what is missing, and `contested` is the largest single entry on the student-contribution list
(§8.6), so the answer changes what students are pointed at.

Not settled here because it is an editorial call, not a mechanical one. The two options:

- **A linked debate page discharges the gap** — then the `needs` parser should drop `contested`
  when the section links out to a `debate` page, and the student list shrinks accordingly.
- **It does not** — then the `Contested` section should carry a summary of the debate and a link to
  it, and the current state is genuinely incomplete.

### 8.9 Semantic duplication: the stub failure that collides with nothing

Module 10 produced the failure mode §8.2's stubs were always going to cause, and it slipped past
every check because it never produced a duplicate heading.

`anorexia-nervosa` and `bulimia-nervosa` both got `update` deltas that obeyed the rule "do not
restate a heading the page already has" — and so filed a clinical description under **"Clinical
picture and warning signs"** while `## Presentation` sat above it holding nothing but a
`> **Needs research:**` line. Same for prevalence under "Prevalence and cultural distribution"
against an empty `## Epidemiology`, and causation under "Multidimensional etiology" against an
empty `## Etiology`.

Appended, each page would have carried the content **and** a placeholder asking for that same
content, under two names, while still declaring `needs: [presentation, diagnosis, epidemiology,
etiology]` — so `reference_worklist` would have kept offering a finished page as unwritten work.

**Why nothing caught it.** `reconcileCollidingUpdate` looks for shared headings and there were none;
the duplicate-heading check in `wiki_merge_health.sql` returns clean. Both are correct. Syntactic
duplication is mechanically visible and semantic duplication is not.

**The cause was a missing signal, not a bad rule.** The index showed:

```
- anorexia-nervosa.md (disorder): …
    existing sections: Presentation, Diagnosis, Epidemiology, Etiology, Treatment, Contested
```

which reads as a *complete* page. **A stub and a finished page are indistinguishable in a heading
list.** The model reasoned correctly from what it was given.

**Fix (2026-08-01):** entries now carry `empty placeholder sections: …` from `wiki_pages.needs`, and
the prompt states that those headings hold nothing, that the do-not-restate rule does not apply to
them, and that filling one makes the output a `replace` under the **existing canonical heading**,
with H3 subheadings for internal structure and `needs` cut to what is genuinely still missing.

**Repairing a page that already has this shape.** Do not re-run the module (§0). Demote each delta
heading to an H3 under the canonical H2 it belongs to, verbatim, and drop the placeholder it fills.
Three things to watch, all of which came up on these two pages:

1. **Do not zero out `needs` reflexively.** Both modules supplied the *differential* but not criteria
   structure or specifiers, so `diagnosis` stayed a declared gap and the arrays went 4 → 1, not 4 → 0.
2. **The same-sounding section can belong in different places.** Anorexia's "Prognosis and mortality"
   went under Epidemiology (course); bulimia's "Outcome predictors" went under Treatment (treatment
   response). Read the content, don't match on the heading.
3. **Check placeholders for content before deleting them.** Anorexia's Epidemiology placeholder had a
   real treatment finding buried inside its `Needs research` line — *age moderates response, older
   patients to individual therapy, younger to family-based* — which deleting the placeholder would
   have destroyed. It now sits in Treatment.

Result: `anorexia-nervosa` 2,049 → 6,795 chars, `bulimia-nervosa` 1,716 → 6,108, both with the
six-section skeleton intact. Two of §8.2's six stubs are now real pages.

### 8.10 Empty vs annotated — the distinction that actually splits the two lists

§8.4 split the gap vocabulary by the gap's **name**: core-skeleton names (`diagnosis`,
`presentation`, `epidemiology`, `etiology`, `treatment`) were instructor work, `contested` was the
student target. That was a reasonable first cut and it is not the real seam. The real seam is
**whether the section has content at all**, and it was invisible until 2026-08-01 because
`extract_page_needs` scored a gap on `marker OR not prose` — collapsing both cases into one array.

| | What it is | Whose job |
|---|---|---|
| **Empty** (`needs`) | Heading present, no prose — only a `> **Needs research:**` line | Instructor. The template is missing. |
| **Annotated** (`annotations`) | Real content *plus* a line naming a specific sub-gap | Student. A scoped, concrete ask. |

The Lecture 8 reference runs made it unmissable: eleven flagged sections, **one truly empty**, ten
with 1,764–3,980 chars and 4–15 prose lines apiece. `alcohol-use-disorder` — 16,921 characters, the
most complete disorder page in the wiki — declared four gaps and sorted to the top of
`reference_worklist`. The tool was offering the most finished page as the most-needing-work.

Corpus-wide the split was **89 empty sections across 52 pages against 27 annotated across 17**.

`20260801_split_needs_from_annotations.sql` separates them: `needs` now means empty-only, and
`extract_page_annotations` is its complement, both wrappers over one shared parser so they cannot
drift. `wiki_gap_report` and `reference_worklist` expose `annotations` alongside `needs`.

**What this changes for the two lists in §8.6.**

- **Core text** takes `needs` — 77 flags across 44 pages. This is the number that means "unwritten".
- **Student starting points** take `annotations` — 27 asks across 17 pages, each already phrased as
  a specific question by the model that wrote the page. That is a far better assignment than "write
  the Contested section from scratch": the work is bounded, the page states what is missing, and a
  student can tell when they are done.

`contested` remains the single largest entry on the student list, but for a better reason than
before — not because of what it is called, but because on most pages it is *annotated* rather than
empty, i.e. the page already says which debate is missing.

**Two things to keep in mind when re-running the counts.** A page can appear on both lists (some
sections empty, others annotated). And `annotations` is computed on the fly from `content` rather
than stored, so it is always current but is not indexed — fine for the worklist, not for a hot path.
