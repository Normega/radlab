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
| — | ~~Module 13~~ | **direct parse** ✔ | **2026-08-02 — the pilot for §9.** 13 pages, **10 of 10 Tier A**, zero empty sections, zero slug misses; L11 Tier A complete | L11 |
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

> **Added 2026-08-02 after Module 16: a second, larger class of uncovered material, and it is not
> uncovered by omission.** Module 16 states twice — in its overview and again in its recap — that it
> gives clinical presentation, prevalence, comorbidity and differential diagnosis **only**, and
> defers etiology, assessment and treatment to a companion volume. So all 18 pages built from it
> have real Presentation, Diagnosis and Epidemiology sections and **empty Etiology and Treatment
> sections — 36 gaps that no amount of re-reading the source will close**. Unlike §4's list above,
> the remedy is already identified and cheap: **Bridley & Daffin, *Behavioral Disorders of
> Childhood*** (https://opentext.wsu.edu/behavioral-disorders-childhood/) — same authors, same
> series, same CC BY-NC-SA licence, same section format, and written to cover exactly the three
> things Module 16 withholds for exactly these disorders. It is the single highest-yield source
> addition available and should be the next ingest.
>
> Distinguish the three classes when triaging, because they look alike in a gap count and have
> different remedies: **not in the source at all** (§4 — needs a different source), **in the source
> but carved differently** (Module 11's four substances — recoverable by reference mode), and **out
> of the source's declared scope** (Module 16's etiology and treatment — needs the companion volume).

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

Counting a page as written only if it has an accepted body. **Updated 2026-08-02 after Module 16
closed the module sweep** (the earlier row is kept because §8.2's stub analysis is written against it):

| Tier | Written | Total | Was, before Module 16 |
|---|---|---|---|
| A (central to the course) | **46** | 54 | 40 |
| B (supporting) | **24** | 46 | 14 |
| Foundation | 13 | 14 | 13 |
| **Overview** | **3** | **16** | 1 |

Tier A by lecture: L3 **10/10**, L4 **4/4**, L5 **4/4**, L6 3/5, L7 **0/5**, L8 4/5, L9 **2/2**,
L10 **9/9**, L11 **10/10**. Six lectures complete. **Everything still missing at Tier A is a page
the textbook does not cover** — §4's list, unchanged and now exhaustive.

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

---

## 9. Direct parse — the method from 2026-08-02 onward

> Piloted on Module 13 (personality disorders), the run this plan flagged as most likely to fail:
> ten Tier A pages in one go, against a 300s ceiling that Module 11 had already come within 13
> seconds of. It produced **13 pages, 10 of 10 Tier A, zero empty sections, zero slug misses**, and
> took Tier A from 30/54 to 40/54 — the largest single jump of the sprint.

### 9.1 What actually changes, and what does not

**The model call moves out of the 300-second Vercel function and into the session.** That is the
whole change. Everything downstream is untouched: the run still writes an `ingest_jobs` row, still
lands `kind='proposed'` versions carrying that `job_id`, and is still accepted through
`review_proposal()`. Provenance, the version trail, `needs`/`annotations` computation, link
extraction and the collision guards all work exactly as before.

**Do not use `edit_page()` to create these pages.** `wiki_page_provenance` joins
`wiki_page_versions` on `kind='proposed'` **and** `review_status='accepted'`, then to `ingest_jobs`
by `job_id`. An `edit_page()` write produces `kind='accepted'` with a null `job_id`, so it
contributes nothing — the page would show **no sources** under *Built from*, which for CC BY-NC-SA
material is a licence violation rather than a cosmetic gap. Verified working on Module 13:
`borderline-personality-disorder` correctly reports four sources, accumulating Module 13 alongside
the earlier Fonagy and Shedler journal ingests.

### 9.2 Why it beats the pipeline: catalogue-first vs source-first

Nearly every failure in §8 traces to one cause. The pipeline is **one-shot and blind** — the model
sees a source, carves it as the source is built, and only afterwards does anyone discover the
catalogue wanted a different partition. That produced the carve mismatches (§4, substance and NCD),
the slug misses (§8.7), and the semantic duplication on stubs (§8.9).

Working in-session inverts it. Both the module *and* the catalogue fit in context at once, so the
question becomes "here are the ten slugs I must fill — find their material" rather than "here is a
chapter, see what falls out". On Module 13 that meant **ten of ten slugs matched by construction**,
with no renames and no orphaned links, on a module whose ten disorders had never been written.

Reference mode was always the better-behaved half of the pipeline for exactly this reason. Direct
parse is reference mode without the 300-second ceiling, without a triage cycle per target, and with
`disorders` visible while writing.

### 9.3 Format: HTML primary, native PDF for images

Settled empirically on 2026-08-02 against the full book HTML
(`PSY240resources/Fundamentals-of-Psychological-Disorders-1721254433.html`, 1.06M chars):

| | `pdftotext -layout` | **HTML** | Native PDF |
|---|---|---|---|
| Prose, headings | inferred from numbering | ✅ real `h2`/`h3` | ✅ |
| Lists | flattened | ✅ 274 `<ul>` / 121 `<ol>` | ✅ |
| Real `<table>` (3 in the book) | flattened | ✅ | ✅ |
| **Content delivered as an image** | ✗ invisible | ✗ **URL only** | ✅ |

**HTML is primary — and it is the only format that tells you where the figures are.** But it is not
sufficient. The book has 17 `<img>`; most are cover art, CC badges, or Module 2 figures, but
`Table-13.1.jpg` is a full **prevalence matrix for all ten personality disorders across three data
sources**, and `pdftotext` does not even preserve its caption.

So the workflow is: parse HTML for structure and prose → scan the module's byte range for `<img>` →
read those PDF pages natively with the Read tool. Module 13 cost ~15k tokens of text plus two vision
pages ≈ **18k**, against ~65k for a full-native paper run. Better coverage at a quarter of the input.

**Amends the §5 correction.** "The tables are the payload" was wrong about `<table>` markup — 0 in
24 disorder pages — and right about the *category*, in a form no text format exposes. The
distinction that matters is **prose vs image**, not native vs extracted.

### 9.4 The recipe

1. **Locate the module** in the HTML by `<h1>`/`<h2>` byte offset; slice that range.
2. **Convert to markdown** — map `h2`–`h5` to `##`–`#####`, `<li>` to `-`, replace `<img …>` with a
   visible `[[IMAGE: filename]]` marker so figures cannot be silently dropped.
3. **Read any image markers** off the corresponding PDF page (`Read` with `pages`).
4. **Pull the catalogue** for that lecture — slug, tier, and existing `needs` — before writing.
5. **Create the job row**: `source_type='paper'`, `pdf_mode='extracted'`, a `pdf_path` of the form
   `direct-parse/<html file>#module-N`, and **citation row N from §6 verbatim**. Record the figures
   read natively in `result_json` so the method is auditable.
6. **Create page shells** for every slug in one `INSERT … ON CONFLICT DO NOTHING`.
7. **Insert versions** against those shells — `kind='proposed'`, the right `action`, the `job_id`.
8. **Run the §8 checks before accepting**: catalogue match, heading collisions, `needs` vs
   `annotations`.
9. **Accept** through `review_proposal(id,'accept',NULL,false)` — `false` keeps them drafts.
10. **Close the job** (`status='done'`, `completed_at`), then re-run the corpus checks.

### 9.5 Two SQL traps, both hit on the pilot

**A data-modifying CTE's rows are invisible to the rest of the same statement.** An
`ins AS (INSERT … RETURNING id)` followed by a main query that reads `wiki_pages` will not see the
new shells, so the versions silently insert zero rows. Either read from the CTE itself, or — better,
and what §9.4 does — create all shells in one statement and insert versions in the next.

**`FROM a, b JOIN c ON … a.col` does not parse.** `JOIN` binds tighter than the comma, so `a` is not
in scope. Use explicit `CROSS JOIN`.

### 9.6 What this leaves the ingest GUI for

Its actual job: **student submissions of peer-reviewed papers** (WP6). That use case wants precisely
what bulk textbook ingest kept fighting — one unfamiliar paper, unknown structure, a proposal queue,
mandatory human review, refusal fallbacks, provenance captured at upload. Every guard built during
the sweep (`reconcileCollidingUpdate`, the placeholder-aware index, `wiki_merge_health.sql`) is
*more* valuable there, because a student's paper genuinely may restate an existing section.

**One consequence to plan for:** the pipeline stops being exercised by every module run. It needs a
deliberate test pass before students touch it.

### 9.7 Module 16 closed the sweep — and it needed a script, not a one-off slice

**All 16 modules are now in.** Module 16 by direct parse produced **18 pages** — the 6 remaining
Lecture 10 Tier A entries (`adhd`, `autism-spectrum-disorder`, `conduct-disorder`,
`intellectual-developmental-disorder`, `oppositional-defiant-disorder`, `specific-learning-disorder`),
9 Tier B, and **2 overviews** — taking Tier A **40 → 46/54**, Tier B **14 → 24/46**, overviews
**1 → 3/16**, and completing **Lecture 10 at 9 of 9**. Zero slug misses, zero duplicate headings,
zero off-catalogue pages, and provenance verified after acceptance.

**The HTML slice is now `scripts/wsu-module-extract.mjs`.** Module 13 sliced the book by hand. That
does not survive being done seventeen times, and it will not survive a second textbook — so the
recipe in §9.4 steps 1–2 is a committed script: `node scripts/wsu-module-extract.mjs 16` prints the
module as markdown, `--list` prints every chapter's byte offset and size. It replaces `<img>` with a
visible `[[IMAGE: file]]` marker, which is the part that must not be reimplemented casually — a
silently dropped figure is how Table 13.1 nearly went missing. Module 16 contains **zero images**,
which the script established in one pass rather than by inspection.

**Two decisions worth keeping.**

*Empty beats annotated when the source has nothing.* A section whose only content is a
`> **Needs research:**` blockquote still parses as **empty** (`prose=false`), so it lands in `needs`
— instructor work — while telling the reader exactly what is missing. That is the right
classification for Module 16's 36 etiology/treatment holes: they need a second source, not a
student's literature search. Adding a token sentence of prose to each would have converted 36
instructor gaps into 36 student annotations and quietly falsified the worklist. The **one** page
where the annotated form was correct is `communication-disorders`, whose Presentation section has
real content on social (pragmatic) communication disorder *plus* a marker naming the three
communication disorders the source never mentions.

*Catalogue-first also means declining material.* Module 16 covers pica, rumination disorder,
enuresis, encopresis, stereotypic movement disorder and social (pragmatic) communication disorder
at length. **None has a catalogue slug**, so none got a page. Stereotypic movement disorder and
social (pragmatic) communication disorder were folded into `neurodevelopmental-disorders` and
`communication-disorders`, where they earn their place as differentials; the feeding and elimination
disorders were left out entirely. This is §8.7 applied in the other direction — the check that stops
a source inventing catalogue entries is the same check that stops it padding the corpus.

**One pre-existing defect found by the corpus check**, which is the review pass arriving early:
`historical-traditions` (a Module 1 pipeline page) linked to `[[abnormal-behavior]]`, which is not a
catalogue slug and has no page. Retargeted to `[[what-is-abnormal]]` via `edit_page()`. Every red
link in the corpus now points at a real catalogue slug.

---

## 10. What the next sources have to do

Written 2026-08-02, when the textbook sweep finished and Norm raised adding open-licensed material,
**including a Canadian text**. This section is the brief: what is actually missing, ordered by yield.
It is derived from the live corpus, not from a plan.

### 10.1 The four gap classes, largest first

**(a) 36 etiology/treatment holes across Module 16's 18 pages.** Out of the source's declared scope,
not absent from it. Fix: **Bridley & Daffin, *Behavioral Disorders of Childhood*** — same authors,
same CC BY-NC-SA licence, same format, covering etiology/assessment/treatment for precisely these
disorders. One book closes the largest single block of gaps in the corpus. Do this first.

**(b) 8 Tier A pages with no textbook source at all** (§4): all five of Lecture 7
(`erectile-disorder`, `female-sexual-interest-arousal-disorder`, `gender-dysphoria`,
`exhibitionistic-disorder`, `pedophilic-disorder`), both sleep-wake pages (`insomnia-disorder`,
`narcolepsy`), and `gambling-disorder`. **This is now the whole of the remaining Tier A deficit** —
every other Tier A page exists. L7 also holds the two pages the taxonomy flagged for rewrite-level
review.

**(c) `suicide-and-self-harm` — the only unwritten foundation, and now the most-linked red link in
the corpus at 7 inbound references.** Module 16 added five of those seven: ADHD, autism, conduct
disorder, specific learning disorder and intermittent explosive disorder each report suicide risk.
It is uncovered by the textbook. NIMH statistics are US public domain; the Canadian figures are the
ones a UofT course needs.

**(d) 13 unwritten overviews.** Not source-limited — the material exists in modules already ingested.
This is a reference-pass job, and the three that exist (`neurocognitive-disorders`,
`neurodevelopmental-disorders`, `disruptive-impulse-control-and-conduct-disorders`) came out at
9.4k–15.2k chars with no empty sections, so the pattern is established.

### 10.2 What specifically needs to be Canadian

Not a preference — these are places where a US source is *wrong for the course*, not merely
foreign:

- **`law-and-ethics`** already declares `canadian-law-and-other-jurisdictions` as a gap. Duty to
  warn is the clean case: the corpus documents `tarasoff-duty-to-warn`, a California decision, while
  Canadian practice runs on *Smith v Jones* (SCC, 1999) and provincial regulatory standards.
- **All prevalence in the disruptive/conduct chapter is US or "high-income countries".** The
  conduct-disorder range (2% to >10%) is wide enough that the choice of source changes what a student
  believes.
- **Service systems differ structurally.** The neurodevelopmental pages assume US special-education
  law; Canadian identification runs through provincial frameworks, and school-board designation is
  not the same thing as a DSM diagnosis. `intellectual-developmental-disorder` and
  `specific-learning-disorder` both carry this as a declared gap.
- **Practice guidance**: CADDRA for ADHD, CANMAT for mood and anxiety, Canadian youth-justice context
  for conduct disorder.
- **Fetal alcohol spectrum disorder** is a Canadian public-health priority and appears **nowhere**
  in the WSU book.
- **Suicide statistics** (class c above).

### 10.3 How to take a new source in

The §9 recipe is source-agnostic. A new text is a new `ingest_jobs` row with its own
`source_citation` and a `pdf_path` of the form `direct-parse/<file>#<locator>`. Three things to
settle *before* the first run, because each has bitten once already:

1. **Check the licence page**, and record the exact variant in the citation. CC BY-NC-**ND** (e.g.
   StatPearls) may be read, cited and paraphrased but **never remixed** — that is a different
   workflow, not a stricter one.
2. **Write the citation into §6-style prepared strings first.** Attribution is a licence condition
   and is derived from the job row, so a typo becomes a permanent provenance error. Pasting a
   prepared row costs the same as typing one and cannot drift.
3. **Decide the carve against the catalogue, not the source.** A second source covering a page that
   already exists produces an `update` — and **update proposals are deltas**. See §8's gotcha:
   pass merged content to `review_proposal()`, never the delta.

### 10.4 Done 2026-08-02: the companion volume, and what it closed

**Item 10.1(a) is complete.** *Behavioral Disorders of Childhood* (Bridley & Daffin, 3rd ed. 2022,
CC BY-NC-SA 4.0) filled the Etiology and Treatment sections on **17 of the 18 Module 16 pages** —
every one except `communication-disorders`, which has no chapter in that book either. Empty sections
across the corpus fell **142 → 108**; annotations rose **60 → 79**, which is the right direction:
material that was an instructor-sized hole is now present prose carrying a student-sized ask.

**Source format: the WXR export, not the live site.** Pressbooks offers this book only as `mpdf` and
`wxr` — `?type=xhtml` returns 500. The WXR (`Behavioral-Disorders-of-Childhood-1668708112.xml`) is a
single local file containing every chapter's HTML in `content:encoded` CDATA, so a run is
reproducible and does not depend on the site being reachable. `scripts/pressbooks-wxr-extract.mjs`
reads it; `--list` prints every chapter with its size. Verified against the live chapter pages on
Module 11 before committing to it: 34,277 chars against 33,764, the delta being the title line.

**Ten jobs, not one.** Attribution is a licence condition, and the parent book set the precedent of
citing the specific module. So each of the nine source chapters got its own `ingest_jobs` row with
its own citation, plus a tenth whole-book row for `neurodevelopmental-disorders`, which synthesises
Modules 7–10 and cannot honestly claim any single one. Verified after acceptance: `adhd` reports two
sources — Module 10 of the companion volume and Module 16 of the parent book — with the right module
named on each.

**Splice, do not retype.** These were `action='replace'` versions built in SQL by
`substr()`/`position()` around the `## Etiology` and `## Contested` anchors, with the frontmatter
`sources:` line spliced in at the `---\n\n# ` boundary. Only the new prose was written by hand.
Anchor uniqueness and ordering were checked on all 18 pages *before* the first insert — one
`## Etiology`, one `## Contested`, correctly ordered, one frontmatter close. This is §7's
"prefer splicing over retyping long bodies" applied at scale, and it kept 17 multi-thousand-character
pages untouched outside the two sections being filled.

**What the companion volume does not fix.** `contested` is still empty on nine pages — this book has
no more critical apparatus than the parent. Its treatment sections are **entirely US-institutional**:
IEPs under IDEA, insurance-gated ABA, US state screening rates. That makes §10.2's Canadian
requirement sharper rather than softer — `intellectual-developmental-disorder`,
`specific-learning-disorder`, `autism-spectrum-disorder` and the `neurodevelopmental-disorders`
overview now each carry an explicit declared gap naming provincial frameworks, CADDRA, and the
distinction between a school-board designation and a DSM diagnosis. And it reports response rates
and names programmes without ever giving an **effect size**, which is now the single most repeated
`Needs research` line in the corpus.

**One methodological note worth keeping.** The Module 14 etiology in this book is written for OCD and
then applied to trichotillomania and excoriation, while the same chapter states that environmental
factors matter more for the other OCD-related disorders than for OCD itself. Both new pages say so
explicitly rather than inheriting the OCD account silently. When a source generalises across a
category, the page should say which member the evidence was actually collected on.

### 10.5 Done 2026-08-02: ten of the sixteen overviews

**Overviews 3/16 → 13/16.** All ten that could be written from ingested material are written; the
three that remain are `sleep-wake-disorders`, `paraphilic-disorders` and `sexual-dysfunctions`.

**That is not a shortfall, it is §4's list showing up in a different shape.** Every member page of
those three overviews is unwritten, because the textbook has no chapter for sleep-wake or for
Lecture 7. An overview whose members are all empty would have no source at all. **Check member-page
coverage before scheduling an overview** — a chapter map assembled from nothing is the one failure
mode this job class has.

Written: `mood-disorders`, `psychosis-and-the-schizophrenia-spectrum`, `personality-disorders`,
`anxiety-disorders`, `obsessive-compulsive-and-related-disorders`,
`somatic-symptom-and-related-disorders`, `trauma-and-stressor-related-disorders`,
`dissociative-disorders`, `feeding-and-eating-disorders`,
`substance-related-and-addictive-disorders`. **7.4k–12.3k chars each, zero empty sections across all
ten**, which matches what the `neurocognitive-disorders` pilot predicted in §3.

**Method: synthesise from the member pages, cite the module.** The member pages are already faithful
renderings of the module and carry vetted figures, so building the map from them is more accurate
than re-reading the chapter and re-deriving the numbers — and the citation still traces to the
module, because that is where the content came from. Each overview got its own `reference` job with
`target_slug` set (the `ingest_jobs_target_slug_ck` constraint requires it for `source_type='reference'`).

**What the overviews are for, learned by writing ten of them.** The useful ones do something the
member pages structurally cannot: put the chapter's numbers in one table so the outliers show. That
is where the teaching value concentrated every time —

- **Personality disorders**: the DSM-5-TR Table 13.1 grid, where two disorders were found at **0.0%**
  by one national survey and 6.2% and 1.8% by another. The best epidemiology teaching material in
  the corpus, and an argument about method rather than about people.
- **Feeding and eating**: anorexia and bulimia run ~10:1 female, **binge-eating disorder is close to
  even** — which complicates the simple sociocultural account, since the disorder with the least
  body-image content has the most even ratio.
- **Substance-related**: **9% of US teens and adults against ~22% of Native Americans**, reported
  with no explanation. Teaching that rate without context teaches a stereotype; it is the single
  clearest place in the corpus where Canadian material is a requirement and not an enrichment.
- **Mood**: unipolar ~30% of relatives affected against bipolar heritability near **90%**.
- **Dissociative**: **50% of adults report a transient depersonalization episode**, 1–2% have the
  disorder — the course's cleanest continuum-with-normality case.
- **OCD-related**: the reference disorder (OCD, ~1.2%) is **rarer than three of the four conditions
  grouped around it**.

**A structural pattern the overviews made visible, which no single page could.** Four chapters
develop their etiology on one member and apply it to the rest by assumption: psychosis (schizophrenia
only), trauma (PTSD only), OCD-related (OCD only), somatic (class-level only). Each overview says so
explicitly rather than presenting a chapter-wide account that does not exist. **When a source
generalises across a category, the page should name the member the evidence was collected on** — the
same rule §10.4 recorded for trichotillomania and excoriation.

### 10.6 A wrong call worth recording

**Claim made and retracted the same day:** that 168 markdown-style links (`[text](slug.md)`) across
35 pages "never reached `wiki_links`" and understated the graph. **False.** `sync_wiki_links()`
parses both forms explicitly, and `src/academic/fieldguide/wiki/wikiText.js` normalises `[[…]]` *into*
`[label](slug.md)` so one renderer handles both. The link total was unchanged at 802 across the
edit — which was visible immediately and is the proof.

The conversion was applied before the claim was checked. It is harmless (display text is preserved
exactly, and the corpus now uses one syntax), but it created 35 version-history entries carrying a
false rationale, which were corrected in place afterwards.

**The lesson is ordering, and it is the same one §9 already teaches for slugs.** The check that would
have caught this — read `sync_wiki_links()` — takes one query, and running it *first* would have cost
nothing. A corpus-wide "defect" that no one has noticed is more likely to be a misreading of the
schema than a real bug; verify the mechanism before mass-editing on the strength of it.

---

## 11. The Canadian text — Cummings (2020), and what a third source changes

**Source.** Cummings, J. A. (2020). *Abnormal Psychology.* University of Saskatchewan Open Press.
**CC BY-NC-SA 4.0**, so remixable on the same terms as the WSU books. HTML export at
`PSY240resources/Abnormal-Psychology-1598733236.html` (686 KB), native PDF alongside it. Canonical
URL `https://openpress.usask.ca/abnormalpsychology/` — **not** the URL in the book's own metadata
sample citation, which contains a typo (`abnormalpsychcology`).

**Cite by section, with the section's own authors.** This book is compiled from OERs — a *different*
Bridley & Daffin volume (*Essentials of Abnormal Psychology*, ed. Cuttler), OpenStax, and Noba — and
**every section carries its own author list**. Section 2.4 is Susan Barron alone; 8.1 is Pelphrey and
Campoli; 2.5 is Strauss and Cummings. A single whole-book citation would misattribute most of it.
`scripts/wsu-module-extract.mjs` now matches a section title as well as `Module N`, because this book
numbers sections `1.1`, `3.1` and so on.

### 11.1 What it covers, and what it does not

**Nine chapters:** defining/classifying, perspectives (models, therapies, psychopharmacology, EBP),
mood, anxiety + body dysmorphic, schizophrenia, PTSD, ADHD and childhood behaviour disorders, autism,
personality.

**It does not cover sleep-wake, sexual dysfunctions, paraphilias, substance, eating, dissociative,
somatic or neurocognitive disorders.** So it does **not** close §4's uncovered list or unblock the
three remaining overviews. Check this before assuming a new source fills a known gap — chapter
coverage is the first thing to establish, not the last.

### 11.2 Why Canadian content is a correctness fix, demonstrated

The prevalence deltas are not decoration; several **reverse or reframe** what the US figures teach.

| | Canada | US |
|---|---|---|
| [[major-depressive-disorder]] lifetime | **11.2%** | 16.6% |
| [[generalized-anxiety-disorder]] lifetime | **8.7%** | 5.7% — **Canada higher, the opposite direction to depression** |
| [[obsessive-compulsive-disorder]] | **0.93%** | 1.6% |
| [[social-anxiety-disorder]] lifetime | 13% (Ontario) | 12.1% — close agreement, unlike the above |

Three findings have no US-source equivalent at all:

- **Cluster B personality disorders in Quebec: 13 years of life expectancy lost for men, 9 for women**
  (Cailhol et al., 2017). A whole-province administrative cohort. Nothing in the DSM-derived material
  conveys that these are conditions with a mortality profile.
- **Panic: a third of Canadian adults have a panic attack in a year; 1–2% are diagnosed with panic
  disorder.** The cleanest available demonstration that the *apprehension*, not the attack, is the
  disorder.
- **Sexual and gender minorities in Ontario: 67.7% lifetime depression for sexual minorities, 72% for
  gender liminal people, 66.4% current depression among FtM trans participants** (Williams et al.,
  2017; Rotondi et al., 2011). The largest disparities in the corpus, from community samples.

And **service context is Canadian and provincial**: Ontario's 2019 autism funding changes had families
leaving the province to obtain services. Where treatment access is decided provincially, "does it
work" and "can you get it" are not separable questions.

### 11.3 What it adds that neither WSU book has

- **[[evidence-based-practice]]** — defined by the **Canadian Psychological Association (2012)**, and
  three-legged: best research evidence, critical evaluation of it, *and* client specificity. The
  common error is collapsing EBP into "use the treatment with the best trial evidence".
- **[[empirically-supported-treatments]]** — the 1990s task forces, the two criteria, and four
  substantive objections including the **manualisation selection effect** (therapies that can be
  written as step-by-step rules were prioritised) and payers **funding only listed approaches, which
  is not how the list was intended to be used**.
- **[[treatments-that-harm]]** — Lilienfeld (2007) on potentially harmful therapies. **This closes the
  most-repeated `Needs research` line in the corpus.** Every "what does not work" note now has a page
  to point at: [[psychological-debriefing]], scared-straight and deviancy training, the discredited
  attachment therapies.
- **[[eco-anxiety]]** — with Canada's own wildfire and flood exposure, and the finding that the same
  distress produces paralysis or engagement depending on how it is held.
- **[[person-centered-therapy]]**, **[[mindfulness-based-therapy]]**, **[[acceptance-and-commitment-therapy]]**,
  **[[emerging-treatment-strategies]]** — four orientations the WSU books do not describe. The
  mindfulness page carries one of the few explicit magnitude statements in the corpus: **moderate**
  symptom improvement for anxiety and depression (Hofmann et al., 2010).
- **Diathesis-stress, stated formally** — which closed a gap `integrative-model` had declared since
  Module 02 and which the handoff had explicitly earmarked a new text to fix. It also supplies
  **protective factors**, the half usually omitted, which is the frame in which "why do most exposed
  people *not* develop the disorder" becomes a proper question rather than a curiosity.

### 11.4 Sections still unswept

Done: **1.1, 2.2, 2.3, 2.5, 3.1, 4.1, 6.1, 8.1, 9.1.**

Remaining, with what each is expected to yield:

| Section | Chars | Expected target |
|---|---|---|
| **2.4 Psychopharmacology** (Barron) | 26k | Pharmacokinetics, metabolism, **grapefruit-juice interaction**, individualised therapy, **juveniles and the elderly**. Nothing comparable exists in the corpus; the medication pages are mechanism-only |
| **1.4 Diagnosing and Classifying** | 16k | **ICD-11 and DSM–ICD harmonization**, which `diagnosis-and-classification` lacks; may bear on its `alternatives-to-categorical-diagnosis` gap |
| **1.3 Clinical Assessment** | 15k | `clinical-assessment`, `mental-status-examination` |
| **2.1 Historical Perspectives** | 13k | `historical-traditions`, `deinstitutionalization` |
| **7.1 ADHD & behaviour disorders** | 48k | Canadian ADHD context (CADDAC); a second source for `adhd`, `oppositional-defiant-disorder`, `conduct-disorder` |
| **5.1 Schizophrenia** | 48k | Second source for `schizophrenia`; Schizophrenia Society of Canada |
| **1.2 Cultural Expectations** | 8k | `multicultural-psychology`, and **Szasz's *Myth of Mental Illness*** for `medicalization-of-distress` |
| **4.2 Body Dysmorphic Disorder** | 9k | Second source for `body-dysmorphic-disorder` |

**55 image markers across the book have not been read natively.** None was needed for the sections
swept so far, but 2.3 and 2.4 (neurotransmission, brain structures, drug administration) are the ones
most likely to carry content as figures — check them against the PDF before writing those pages.

---

## 12. The fourth source — Davies (2025), and what is left after it

**Source.** Davies, C. (2025). *Adult Psychopathology.* Amherst, MA: University of Massachusetts
Amherst Libraries. **PDF only** (`Adult-Psychopathology-1770239033.pdf`, 565pp) — Pressbooks/Prince
output with a clean text layer, so `pdftotext -layout` is sufficient and no image route was needed.
Canonical URL **verified live**: `https://openbooks.library.umass.edu/adultpsychopathology/` (the PDF
itself carries no URL — do not guess one).

### 12.1 Three licences in one book

The book default is **CC BY-NC 4.0** — the first source in this corpus that is **not** ShareAlike. But
the chapters used carry their own sub-licences, and the citation must say so:

| Chapters used | Adapted from | Licence |
|---|---|---|
| 23–24 Gender Dysphoria | *Abnormal Psychology* (Coursehero) | **CC BY-SA** |
| 47–48 Sleep | *Psychology 2e* (OpenStax) | **CC BY 4.0** |

**Check the per-chapter attribution line, not just the copyright page.** A compiled OER can carry
three licences at once, and the one that governs a given page is the chapter's, not the book's.

### 12.2 What it delivered

**Tier A 46 → 49/54; overviews 13 → 14/16.** Six pages:

- **`gender-dysphoria`** — the page the taxonomy flagged for **rewrite-level review** over dated
  terminology. A 2025 source handles it properly: the GID → gender dysphoria rename, the DSM-5 move
  out of the sexual-disorders category, the post-transition specifier and **why it exists** (so that
  successful treatment does not remove access to ongoing treatment), and the **0.6% transgender
  against ~0.01% diagnosed** gap that makes the identity/diagnosis distinction quantitative. The page
  is written *against* the terminology history rather than around it, per the review flag.
- **`insomnia-disorder`**, **`narcolepsy`**, **`obstructive-sleep-apnea-hypopnea`**, **`parasomnias`**,
  and the **`sleep-wake-disorders`** overview.

**The best single teaching item is the gender-dysphoria trade-off**: the diagnosis is criticised as
stigmatising *and* is what makes insurers cover gender-confirming care, so removing it would relieve
the stigma at the cost of the access. Most [[medicalization-of-distress]] cases in this course run
one way; this one does not.

**The best sleep item is the sleepwalking finding**: benzodiazepines did not alleviate sleepwalking,
but every sleepwalking patient with a sleep-related breathing problem improved markedly once the
breathing was treated (Guilleminault et al., 2005). Treat the apnea, and the parasomnia may resolve.

### 12.3 What it does not cover — and the pattern that is now three-for-three

**No sexual dysfunctions and no paraphilic disorders.** The only mentions are rows in the DSM chapter
table. **No gambling** — zero occurrences. Verified by keyword scan over the whole extraction, not
inferred from the contents page.

That is the third consecutive new source that covered less than expected:

| Source | Expected to fill | Actually covered |
|---|---|---|
| *Behavioral Disorders of Childhood* | Module 16's etiology/treatment | ✅ 17 of 18 pages |
| Cummings, *Abnormal Psychology* | "Canadian content" broadly | 9 chapters; **no** sleep, sexual, substance, eating, dissociative, somatic, NCD |
| Davies, *Adult Psychopathology* | "sleep and sexual disorders" | **Sleep yes, sexual no** |

**Establish coverage before planning work.** A keyword scan of the extracted text costs one command
and settles it; a table of contents does not, because a chapter may name a topic it only lists.

### 12.4 What remains uncovered, after four sources

**Five Tier A pages, one foundation, two overviews — and they are now a single coherent block plus one
straggler.**

| | Needed |
|---|---|
| `erectile-disorder`, `female-sexual-interest-arousal-disorder` + the **`sexual-dysfunctions`** overview | A source covering DSM chapter 13 |
| `exhibitionistic-disorder`, `pedophilic-disorder` + the **`paraphilic-disorders`** overview | A source covering DSM chapter 19. The taxonomy flags the paraphilic overview for **rewrite-level review** — lecture-hall-provocative framing in the deck |
| `gambling-disorder` | **NIMH** (US public domain) remains the obvious source; it is a behavioural addiction and no textbook here covers it |
| `suicide-and-self-harm` | Still the only unwritten foundation, still the most-linked red link. **Davies has a chapter 22, "Suicide and Prevention" — this is now writable and was not before** |

**`suicide-and-self-harm` is the immediate next job.** It has a source now, it is a foundation page,
and it carries more inbound red links than anything else in the corpus.

Then: the two textbooks Norm supplied are also **second sources for chapters already written** — the
Cummings sections still unswept (§11.4) and Davies' parts on PTSD, anxiety, OCD, mood, psychosis,
personality, somatic, dissociative, eating and substance. That is the review-and-fill pass, and it is
where the remaining `Needs research` lines get closed rather than where new pages get created.

---

## 13. The fifth source — Goerling & Wolfe (2022): overviews complete, Tier A 53/54

**Source.** Goerling, E., & Wolfe, E. (2022). *Introduction to Human Sexuality.* Open Oregon
Educational Resources. WXR + PDF in `PSY240resources/`; URL verified live at
`https://openoregon.pressbooks.pub/introtohumansexuality/`. Book licence **CC BY-NC-SA 4.0**, with
per-chapter sub-licences: **Ch 17 adapted from Miller's *Clinical Perspectives in Abnormal
Psychology* under CC BY 4.0**; **Ch 16 adapted from Walinga & Stangor's *Introduction to Psychology –
1st Canadian Edition* (BCcampus) under CC BY-NC-SA 4.0**.

**Edition caveat recorded in the job:** the WXR export is dated 2022-10-21 while the live edition is
now ©2024. The citation names 2022, the copy actually read.

### 13.1 What it closed

**13 pages. Tier A 49 → 53/54. Tier B 26 → 33/46. Overviews 14 → 16/16 — complete.**
**Lecture 7 Tier A is now 5 of 5**, the last incomplete lecture apart from gambling.

Sexual dysfunctions (ch 17): the `sexual-dysfunctions` overview, `erectile-disorder`,
`female-sexual-interest-arousal-disorder`, `male-hypoactive-sexual-desire-disorder`,
`ejaculation-and-orgasmic-disorders`, `genito-pelvic-pain-penetration-disorder`.

Paraphilic disorders (ch 16): the `paraphilic-disorders` overview, `pedophilic-disorder`,
`exhibitionistic-disorder`, `voyeuristic-disorder`, `fetishistic-disorder`,
`sexual-sadism-and-masochism-disorders`, `transvestic-disorder`.

**Only `gambling-disorder` and `suicide-and-self-harm` remain unwritten at Tier A / foundation**, and
both have identified sources (NIMH; Davies ch 22).

### 13.2 The taxonomy's rewrite-level flag was correct, and this is how it was handled

The catalogue flagged the paraphilic overview for rewrite-level review — *"lecture-hall-provocative
framing… must not be laundered into a reference page."* **Chapter 16 justifies that flag.** Four
passages were treated as **source defects, named on the page rather than reproduced or silently
dropped**:

1. **A cultural-relativism passage** presenting adult–child sexual contact as normal in some
   societies. Named on `pedophilic-disorder` and `paraphilic-disorders` as not teachable: the issue
   is **capacity to consent**, and the passage confuses a descriptive claim about practices with a
   normative one about harm.
2. **A relayed conflation of pedophilia with homosexuality**, reproduced by the source without
   rebuttal. Stated on the page as **false**, with the distinction spelled out.
3. **"Women who wear low-cut gowns are exhibitionists in a sense"** — not a DSM criterion, no
   diagnostic content, imports victim-blaming into a chapter about non-consensual acts.
4. **Internally contradictory voyeurism prevalence** — 12%/4% stated, then "prevalence not known" in
   the same passage. The page says **do not quote these figures**.

**The general rule this establishes: when a source contains material that should not be taught,
name it as a defect on the page.** Dropping it silently leaves the next person to rediscover it from
the source; reproducing it launders it. The `source_quality_warning` field in `ingest_jobs.result_json`
carries the same warning at the job level.

### 13.3 What the chapter gets right, and what it is missing

**The paraphilia / paraphilic disorder distinction is the best-stated version in the corpus** —
Lehmiller (2019): an unusual sexual interest requiring no treatment, against one that distresses the
person or victimises others. **Consent is the organising axis**, and it sorts the eight disorders
better than the DSM's own ordering.

**The BDSM evidence is the strongest counter-pathologising finding available**: practitioners show
*higher* wellbeing than average, less neuroticism, more openness and conscientiousness, and **no
correlation with childhood sexual assault** (Joyal, 2018; Lehmiller, 2019).

**But the paraphilia chapter supplies essentially no etiology and no treatment at all.** Both
sections are empty across every paraphilic page. That is the single largest declared gap this run
created, and it is honest: the chapter is descriptive and forensic, not clinical.

**And the sexual-dysfunction chapter's threshold is worth teaching in its own right** — six months,
75% of occasions, clinically significant distress — because the headline survey figures (43% of
women, 31% of men) measure *difficulty in the past year* and do not apply it. The gap between those
two numbers is where the medicalisation argument lives.

### 13.4 Five sources in, what the pattern says

| Source | Expected | Delivered |
|---|---|---|
| *Behavioral Disorders of Childhood* | Module 16 etiology/treatment | ✅ as expected |
| Cummings, *Abnormal Psychology* | "Canadian content" | Partial — 9 chapters only |
| Davies, *Adult Psychopathology* | "sleep and sexual" | Partial — sleep only |
| Goerling & Wolfe, *Human Sexuality* | "sex and gender content" | ✅ **as expected — closed both chapters** |

**The keyword scan before planning is now standard** (§12.3) and it paid off here in the opposite
direction: it confirmed full coverage before any work started, and it correctly predicted 13 pages.

---

## 14. Tier A complete — `gambling-disorder`, and two sources with different licences

**Tier A 53 → 54/54.** Every Tier A page in the catalogue now has a body. With overviews at 16/16,
**`suicide-and-self-harm` is the only unwritten page across Tier A, foundations and overviews** — and
it now carries **11 inbound red links**, more than any other target in the corpus.

### 14.1 Two sources, and only one of them is remixable

| Source | Licence | Used for |
|---|---|---|
| **Menchón et al. (2018)**, *An overview of gambling disorder*, F1000Research 7:434 | **CC BY 4.0** — fully remixable | Current clinical picture: treatment, pharmacology, risk factors, subgroups |
| **National Research Council (1999)**, Appendix B, *Pathological Gambling: A Critical Review*, National Academies Press | **Not openly licensed.** Copyrighted, freely readable on NCBI Bookshelf | DSM-III / III-R / IV criteria history — **summarised, not reproduced** |

**The NAP source is handled the way §4 prescribes for StatPearls: read, cite, paraphrase — do not
remix.** The criteria lists were not reproduced verbatim; the page describes the *evolution* of the
classification instead, which is both the licence-safe route and the more useful teaching content.
The `licence_note` field on each job records which applies, so the distinction survives independently
of the page.

**This is the first page in the corpus built from two sources with materially different licences**,
and the pattern will recur as more journal and government material comes in.

### 14.2 What the page carries

**The reclassification is the spine.** DSM-5 moved gambling disorder into *Substance-Related and
Addictive Disorders* — **the first behavioural addiction placed alongside the substance disorders** —
on the basis of shared criteria, symptomatology, genetic vulnerability, comorbidity, biomarkers and
cognitive deficits. From DSM-III (1980) to DSM-IV (1994) the same behaviour sat under **Impulse
Control Disorders Not Elsewhere Classified**. Teaching both framings shows a category being
**re-theorised rather than discovered**.

Menchón et al. add the point that makes it more than taxonomy: the reclassification **changes
perceived dangerousness, expectations of recovery, and attributions of responsibility**.

**Three numbers do most of the work:**

- **Only ~10% of people with gambling disorder ever seek treatment.** Every other figure on the page
  describes that tenth, selected for severity.
- **32% suicidal ideation and 17% lifetime attempts** among treatment-seeking patients; another study
  found **30.2% reporting an attempt in the 12 months before treatment**. See `suicide-and-self-harm`.
- **No drug is approved anywhere.** Opioid antagonists are the best-supported class and the
  meta-analytic verdict is **"a small but significant benefit"** over placebo.

**The risk-factor meta-analysis is unusually well specified** — 13 individual, 1 relationship and 1
community risk factor, plus **three protective factors**, which is rare in this corpus. And **three
replicated subgroups** (behaviourally conditioned, emotionally vulnerable, antisocial impulsive)
support treatment matching rather than one protocol.

### 14.3 The Canadian gap here is a conflict of interest, not just missing data

Every figure is US or European. For a Canadian course the omission is specific and sharp:
**provincial governments both regulate gambling and depend on its revenue**, and provincial
self-exclusion programmes have no equivalent in this literature. Neither source mentions
industry funding of gambling research. Recorded as a declared gap on the page.

---

## 15. The skeleton is complete — `suicide-and-self-harm`

**Tier A 54/54. Foundations 14/14. Overviews 16/16.** Every page the catalogue marks as central,
foundational or structural now has a body. **Only Tier B remains incomplete, at 33/46.**

`suicide-and-self-harm` was the last, and had been the most-linked red link in the corpus at **11
inbound references** — accumulated across eleven disorder pages that each reported suicide risk with
nowhere to point. Source: **Davies (2025) ch 22**, adapted from Coursehero under CC BY-SA.

### 15.1 Safe messaging, and what it cost analytically

The source includes a **named-individual case study with circumstantial detail**. The page **omits the
circumstances and method entirely** and keeps only the general teaching point — that risk is often
invisible to those closest to the person, so **absence of visible warning signs is not evidence of
absence of risk**. A `editorial_note` on the ingest job records the decision so it is not silently
reversed later.

**It cost the page nothing.** The analytic content survives without the detail, which is worth knowing
for the next time a source mixes clinical material with case narrative. Means-restriction evidence
(higher rates in households with firearms) **is** retained, because it is protective public-health
content rather than method information — that distinction is the one to apply.

The page also carries a short reader-facing note at the top pointing to the crisis-line section.

### 15.2 What the chapter supplies that the corpus needed

**The ideation gap is the organising finding.** Roughly **10.6 million US adults with serious suicidal
thoughts**, against **1.4 million attempts** and **47,000 deaths**. Jobes and Joiner's (2019) point is
that prevention research, clinical treatment and health policy are all organised around the two
smaller numbers. A field that measures what it can count under-serves the largest affected group.

**Berman's (2009) three-part model** — vulnerability *plus* means *plus* absent protective factors —
is the frame that makes the 90%-have-a-diagnosis figure interpretable in both directions, and each
leg is separately modifiable, which is exactly how the prevention section is organised.

**The treatment evidence is the strongest in the corpus, and it comes with magnitudes**, which is rare
here:

| Intervention | Finding |
|---|---|
| **Crisis Response Plan** | Attempts reduced **76%** at 6 months vs no-harm contracts |
| **Brief CBT** (12 sessions) | **60% less likely** to attempt at 24 months |
| **Cognitive Therapy for Suicide Prevention** | **50% less likely** to attempt at 18 months |
| **Caring contacts** (Motto & Bostrom) | A letter every 4 months for 5 years **reduced suicides** |
| **CAMS** | Reduces ideation and distress, increases hope and retention; **as good as DBT** on attempts |
| **DBT** | Reduces attempts and self-harm; **ideation results inconsistent across RCTs** |

**The pattern is the teachable part: treatments that target suicidality *directly* outperform treating
an underlying disorder and expecting risk to follow.** That runs against how the rest of this course
handles comorbidity.

**And a clean displaced-practice case.** Coercive **no-harm contracts** — asking a patient to promise
*not* to act — have been replaced by **stabilization planning**, which plans what the person *will*
do. Adopted across US Veterans Affairs and the Department of Defense. See `treatments-that-harm` and
`evidence-based-practice`.

**The barrier that limits all of it: ~60% of people with suicidal thoughts do not seek help**, and the
reasons given are **low perceived need** and **wanting to deal with it alone** — not unavailability of
treatment.

### 15.3 Two gaps flagged on the page, one of them urgent

**Non-suicidal self-injury is in this page's title and absent from the source.** Its distinct
function, its relationship to suicide risk, and its adolescent prevalence all need a second source.

**The crisis line is US-only (988).** The page flags that the **Canadian 9-8-8 Suicide Crisis
Helpline** and provincial services should be stated, **with the number and hours verified before
publishing** — this is the one line on the page a student in distress might act on, and it is the
single highest-priority verification item outstanding in the corpus. Canadian rates generally, and
rates among First Nations, Inuit and Métis communities in particular, cannot be substituted from a US
source.

---

## 16. The sweep completes — every section of every source is in

**All seventeen Cummings sections and all relevant Davies chapters are now swept.** The remaining
work produced **one new page and nine gap-closing updates**, and the ordering principle was
**gap-first rather than source-first**: the declared `needs` and `annotations` lists were queried
first, and only the sections that could close them were read.

That inversion is worth keeping. Sweeping a source section by section produces bulk; sweeping it
against a gap list produces closure. **Nine of the ten items below closed a specific declared gap.**

### 16.1 What closed

| Page | Was | Closed by |
|---|---|---|
| **`psychopharmacology`** *(new)* | did not exist | Cummings 2.4 (Barron) |
| `deinstitutionalization` | `outcomes-and-criticisms` empty | Cummings 2.1 |
| `historical-traditions` | `non-western-and-global-histories` + `outcome-evidence-on-historical-reforms` empty | Cummings 2.1 |
| `mental-status-examination` | `limitations` annotated | Cummings 1.3 |
| `clinical-assessment` | `cultural-and-contextual-considerations` annotated | Cummings 1.2 |
| `medicalization-of-distress` | no Szasz at all | Cummings 1.2 |
| `body-dysmorphic-disorder` | `contested` empty | Cummings 4.2 |
| `schizophrenia` | `contested` empty | Davies ch 25–31 |
| `antipsychotic-medications` | `what-they-do-not-do` annotated | Davies ch 25–31 |
| `adhd` | MTA trial declared missing since Module 16 | Cummings 7.1 |

**All ten now have zero empty sections.** Corpus empty sections **129 → 123** despite four new
pages being added in the same period.

### 16.2 The findings worth teaching

**The MTA trial closed the longest-standing declared gap in the corpus**, and its result is better
than either side of the medication debate usually reports: **stimulant medication was most effective
on core symptoms and combined treatment was no better** — but behavioural treatment produced **less
school disruption, lower required stimulant doses, and higher parent satisfaction**. A single
headline result is not a treatment recommendation.

**The ADHD parenting myth is refuted by an unusually clean design.** Cunningham and Barkley (1979)
found mothers of children with ADHD less attentive and more controlling — then showed that **giving
the children stimulants improved the mothers' parenting to the level of mothers of typically
developing children**. The arrow runs child → parent. Pelham et al. (1997) add that **a brief
interaction with an impulsive child raised parents' alcohol consumption**. This is the corpus's best
worked example of a reciprocal effect mistaken for a unidirectional cause.

**Moral treatment and deinstitutionalisation failed the same way, a century apart.** Moral treatment
was **"a victim of its own success"** — it worked best at **≤200 patients**, post-Civil-War
immigration pushed facilities to **1,000+**, funding and staffing collapsed, and **immigrants were
denied the moral treatment given to native-born citizens even where resources existed.** Teaching the
two collapses together shows the recurring failure is **resourcing and equity, not the humane
principle**.

**The institutional model arrived in Canada as imperial policy.** The **County Asylums Act 1845** was
extended to English colonies **including Canada**, after maltreatment at a Kingston, Jamaica facility
prompted a colonial audit; Dorothea Dix's work also extended to Canada. That partially closes
`non-western-and-global-histories` — **partially**, and the page says so.

**Szasz is now on the record properly.** *The Myth of Mental Illness* (1961), the "problems in living"
reframing, and the argument's decisive vindication — **Szasz was perhaps the first psychiatrist to
openly challenge homosexuality as a diagnosis**. The page holds that against `gender-dysphoria`,
where the same argument is live and where removing the diagnosis would also remove funded care.
**The critique was right once; that does not make it automatically right again.**

**`psychopharmacology`** supplies what the medication pages lacked: ADME, **route of administration
predicting abuse liability** (fast to brain + reward circuit = high risk, and the *cues* become
addictive too — you can avoid old haunts, you cannot avoid waking up), cytochrome P450 and the
**grapefruit-juice interaction** (85 drugs), the **four metaboliser categories** where both extremes
look like treatment failure and neither is, and the two populations **excluded from the trials that
licensed their drugs** — children and older adults, the latter consuming a projected 40% of
prescriptions by 2030.

### 16.3 Two sections were read and produced nothing

**Cummings 5.1 (schizophrenia) and 7.1 (ADHD) contain no substantive Canadian prose** — an earlier
keyword count suggested otherwise because it was matching **reference-list entries** (Canadian
Journal of Psychiatry, Schizophrenia Society of Canada, CADDAC). 7.1 was swept anyway for the MTA
trial and the diversion material; 5.1 added nothing beyond what Davies supplied.

**Lesson: count keyword hits in the body, not the references.** A citation to a Canadian journal is
not Canadian content, and the earlier §11 scan overstated Canadian coverage on that basis.

### 16.4 The check caught two errors before acceptance, again

The duplicate-heading check flagged that appended content had **re-created `## Non-Western and global
histories` and `## Outcome evidence on historical reforms`** as second copies rather than filling the
existing empty ones; and a `clinical-assessment` block had landed **after `## Contested`** instead of
inside its own section. Both were repaired pre-acceptance. **That is three separate runs now in which
the pre-accept checks caught a real structural error** — they are not ceremony.

---

## 17. `student-support-resources` — the first student-facing page, and the first with a standing verification requirement

**Source:** Kulzhabayeva, D. (2026). *Mental Health and Student Support Resources.* RADlab, University
of Toronto. **Internal lab material, compiled 2026-07-20** — not an openly licensed publication, used
with the lab's own authority for the lab's own course.

This closed the **highest-priority verification item** flagged in §15.3: the `suicide-and-self-harm`
page gave the **US 988 line only**.

### 17.1 What it carries

**Immediate danger** — 911 or nearest emergency department. **Crisis, any time** — **9-8-8 Suicide
Crisis Helpline** (call or text 988, free and confidential anywhere in Canada, 24h) and **Good2Talk**
(1-866-925-5454 / text GOOD2TALKON to 686868, Ontario post-secondary students, 24h). **U of T** —
Mental-Health Resource Portal, and **TELUS Health Student Support** (1-844-451-9700, 24h, all U of T
students). **All three campuses** — St. George, UTM, UTSC, with same-day mental-health appointment
routing for St. George. **Outside Canada** — Find-A-Helpline, verified lines in 150+ countries.

**Worth noting for anyone reading the literature: Canada and the US share the 988 digits.** A paper
citing "988" may mean either service, and the pages say so.

### 17.2 Two editorial decisions

**The study-specific research contact was omitted.** The source ends with the investigator name and
email for the Dana Kulzhabayeva causal-reasoning study, because the document was written to appear at
the end of *that study's* surveys. **Directing PSY240 students to a different study's investigator
would misdirect them.** Recorded in `result_json.omitted_deliberately` so the omission is visible as a
decision rather than an oversight.

**The page states why it exists, from the corpus's own findings.** About **60% of people with
suicidal thoughts do not seek help**, citing **low perceived need** and **wanting to handle it alone**
— not unavailable treatment; **~10% of people with gambling disorder ever seek treatment**; and fear
of stigma recurs as a barrier throughout. **The barrier the literature identifies is knowledge and
reluctance, not scarcity** — which is exactly what a visible, specific list addresses. That makes the
page an application of the course content rather than boilerplate appended to it.

### 17.3 A standing obligation, not a one-off check

**This is the only page in the corpus where a stale detail could cause direct harm.** Phone numbers,
URLs and service hours change. The page carries a visible ⚠ block and the job carries a
`staleness_warning`:

> Re-verify **every entry** before the Field Guide is published to students, and **again at the start
> of each term**. If a number cannot be verified, **remove it rather than publish it unchecked**.

**A frontmatter flag `verify_before_publishing: true` marks it**, so a future publication pass can
find it by query rather than by memory.

### 17.4 Open: how prominently to signpost it

It currently has **one inbound link**, from `suicide-and-self-harm` — which is itself linked from
eleven disorder pages, so it is one hop from most sensitive material. **One hop is a real barrier for
a reader in distress**, but where to place trigger-adjacent signposting across a course is a
pedagogical decision for the instructor, not a corpus-mechanics one.

**Done 2026-08-02 at Norm's direction:** linked from every page on which the corpus itself reports
elevated suicide risk — **12 inbound links**. A one-line support blockquote sits above the first
section on each, so a reader in distress does not have to hunt for it. The pages are — currently `major-depressive-disorder`, `bipolar-i-disorder`,
`borderline-personality-disorder`, `adhd`, `autism-spectrum-disorder`, `conduct-disorder`,
`specific-learning-disorder`, `intermittent-explosive-disorder`, `gambling-disorder`,
`anorexia-nervosa` and `gender-dysphoria`. **Norm's call.**

---

## 18. The `contested` campaign — World Psychiatry, and why this is per-page not per-source

**`contested` is now the largest hole in the corpus: 47 pages, 38% of all empty sections** — 22 of
them Tier A. `treatment` follows at 27, `etiology` at 19, `epidemiology` at 11.

**Textbooks will not close it.** Five textbooks in, every one supplied presentation, prevalence,
etiology and treatment, and every one left `contested` empty on most pages. Critique is a different
genre. The vehicle the corpus already has for it is the **`debate` page type**
(`eating-disorders-as-an-ocd-variant`, `sociocultural-iatrogenic-model-of-did`,
`categorical-vs-dimensional-personality-models`) and the **journal-article ingest** (Fonagy, Shedler,
Menchón).

### 18.1 Proof of concept: PTSD

**Bryant, R. A. (2019). Post-traumatic stress disorder: a state-of-the-art review of evidence and
challenges. *World Psychiatry*, 18(3), 259-269.** Retrieved from PMC6732680, verified before use.

It closed the gap completely and produced the best `contested` section in the corpus:

- **Only 42% of trauma survivors are diagnosed with PTSD under *both* DSM-5 and ICD-11.** Two manuals,
  the same people, agreement on fewer than half the cases — which reframes every prevalence figure on
  the page, including the Canadian ones.
- **636,120 permutations** of how DSM-5 PTSD may present. Two people can share the diagnosis with
  almost no symptoms in common, which is Bryant's explanation for why biomarkers have not been found.
- **The breadth/specificity trade-off has a real cost on both sides**: DSM-5 reaches more survivors,
  but moving beyond fear symptoms **undermines the evidence base of the exposure treatments the page
  recommends**.
- **Complex PTSD survives its validity test** — latent class analyses distinguish it from PTSD *and*
  from borderline personality disorder.
- **Only two-thirds respond adequately to trauma-focused CBT**, which Bryant reads as evidence the
  definition is not capturing the essential mechanisms — a failure of the *category* presenting as a
  failure of treatment.

### 18.2 Licence handling

The PMC record shows **"© 2019 World Psychiatric Association" with no explicit Creative Commons
statement** in the retrieved metadata. Treated **conservatively as free-to-read but not remixable**:
cite and paraphrase, no extended verbatim reproduction — the same handling as StatPearls (§4) and the
NAP gambling source (§14.1), recorded in `licence_note` on the job. **Verify before any reuse beyond
paraphrase.** Much of World Psychiatry is CC-licensed; the conservative default costs nothing.

### 18.3 The shape of the campaign, and why it is slower than a textbook sweep

**This is one article per page, not one source per chapter.** Each target needs: a search, a
**verification fetch** to confirm the article exists and says what the search summary claims, a read,
and a write. Searches for OCD, bipolar, panic and GAD returned mostly *non*-World Psychiatry work,
so each disorder has to be checked individually rather than assumed covered.

**Never write a citation from a search-result summary.** Two of the first candidates illustrate why:
`PMC11733476` looked like Brewin's 2025 PTSD review and is in fact **Maercker's commentary on it**;
the Wiley copy of Brewin returns **403** to automated fetch. Both were caught by fetching before
writing. A fabricated citation in a reference corpus is worse than an empty section.

**Practical route:** Wiley blocks automated access; **PMC is the reliable path** for World Psychiatry.

### 18.4 Where to aim next

World Psychiatry's **state-of-the-art review series** is the richest seam and covers major disorders.
Highest-value remaining Tier A targets with empty `contested`: `obsessive-compulsive-disorder`,
`bipolar-i-disorder`, `generalized-anxiety-disorder`, `panic-disorder`, `substance-use-disorder`
(foundation), `dissociative-identity-disorder`, `neurocognitive-disorder-due-to-alzheimers-disease`,
`delirium`, `binge-eating-disorder`.

Where World Psychiatry has no matching review, other fully open-access venues carry the same genre —
**F1000Research** (already used for `gambling-disorder`), **BMC Psychiatry**, **Frontiers in
Psychiatry** — and the **`debate` page type** remains the right vehicle for a dispute that deserves
its own page rather than a section.

### 18.5 Progress log — `contested` campaign

| Page | Source | Verified |
|---|---|---|
| `posttraumatic-stress-disorder` | Bryant (2019), *World Psychiatry* 18(3):259-269 | ✔ PMC6732680 |
| `bipolar-i-disorder` | McIntyre et al. (2022), *World Psychiatry* 21(3):364-387 | ✔ PMC9453915 |
| `bipolar-ii-disorder` | Berk et al. (2025), *World Psychiatry* 24(2):175-189 | ✔ PMC12079553 |

**`bipolar-ii-disorder` was one of §8.2's six known stubs and more than doubled** (2,428 → 5,601
chars). The stub problem is closing from the `contested` direction rather than the coverage one.

**Findings worth carrying:**

- **Bipolar II is not milder.** Berk et al. state it directly: contrary to perception, patients carry
  high depressive burden, poor functioning and poor outcomes, and **suicide rates are equivalent to
  or higher than bipolar I**. The disorder is defined by an *absence* (of full mania) and the absence
  reads as lesser severity, which it is not.
- **Diagnostic reliability, side by side:** bipolar I **0.56**, bipolar II **0.40**, major depressive
  disorder **0.28** in DSM-5 field trials. The most-diagnosed condition in the course is the least
  reliably diagnosed.
- **The four-day hypomania threshold is a committee judgement, not a finding.** A two-day threshold
  was proposed and **supported by family-history data**, then rejected over false-positive risk.
- **Underdiagnosis has a pharmacological cost.** Half of bipolar II cases were previously
  undiagnosed, **median delay almost eight years** — and since antidepressants carry switch risk while
  mood stabilisers are first-line, eight years treated as unipolar depression is eight years of the
  wrong first-line drug. The clearest case in the corpus of a reliability problem with a direct
  treatment consequence.
- **Bipolar/borderline overlap is larger than either page suggested alone:** ~70% of bipolar patients
  have borderline traits, ~20% meet full criteria. McIntyre et al.'s remedy is procedural — **assess
  personality during euthymic periods**.

### 18.6 Where World Psychiatry has no review — an open candidate question

**There is no World Psychiatry state-of-the-art review for OCD.** Searching surfaced four
alternatives, and the choice is a real trade-off rather than an obvious pick:

| Candidate | Licence | Assessment |
|---|---|---|
| **Stein (2019)**, *Indian Journal of Psychiatry* 61(S1):S4-S8 | **CC BY-NC-SA** — the most permissive available | Author **chaired the DSM-5 OCRD workgroup**. But it is a supplement editorial, thinner than Bryant or Berk. Has the classification dispute and the **DSM-5 prioritises validity / ICD-11 prioritises clinical utility** framing, which generalises well beyond OCD |
| **Abramowitz et al. (2026)**, *BMJ* state-of-the-art review | Unverified | Abramowitz is a major OCD figure; BMJ reviews are strong. Accessibility not yet confirmed |
| *Neuroscience & Biobehavioral Reviews* (2025) state-of-the-art review | Likely paywalled | ScienceDirect; abstract only from the search |
| *Frontiers in Psychiatry* (2023), treatment-resistant OCD | CC BY | Open, but **treatment-focused rather than contested-focused** |

**Recommendation: Stein (2019) as the licence-safe base, supplemented if Abramowitz proves
accessible.** The general rule this establishes: **where the ideal journal has no matching review,
prefer a permissively licensed piece by an author who shaped the classification over a paywalled
review by a stranger to it** — provenance and reuse rights both improve, and the thinner content is
visible as declared gaps rather than hidden.

### 18.7 Use the Europe PMC REST API, do not guess PMC IDs

**A guessed PMC ID returned the wrong article on the first attempt** — `PMC10168175` is Nesse's
*Evolutionary psychiatry* (World Psychiatry 22(2):177-202), the article immediately preceding the one
wanted. Adjacent articles in the same issue have adjacent IDs, which makes a near-miss look plausible.

**The reliable lookup is the Europe PMC REST API**, which returns exact identifiers as JSON:

```
curl -sG "https://www.ebi.ac.uk/europepmc/webservices/rest/search" \
  --data-urlencode 'query=TITLE:"<article title>"' \
  --data-urlencode 'format=json'
```

It gives `pmid`, `pmcid`, journal, volume, issue, pages, `isOpenAccess` and `inEPMC` in one call.
**PMC and Europe PMC search *pages* are JS-rendered and unreadable to WebFetch** — the API is not.

Volkow & Blanco resolved to **PMID 37159360, PMCID PMC10168177**, `isOpenAccess=N` but `inEPMC=Y`:
free to read, not formally open access, which is exactly the conservative-handling case.

### 18.8 `substance-use-disorder` — when the best source is also a party to the dispute

**Volkow, N. D., & Blanco, C. (2023). Substance use disorders: a comprehensive update. *World
Psychiatry*, 22(2), 203-229.** The most comprehensive source available — and **Volkow directs NIDA**,
the institution most identified with the **brain disease model of addiction**, which the review
presents as **established neuroscience rather than a contested position**.

**The page treats that framing as one side of the dispute rather than as background**, and flags the
authorship. This is the first time in the corpus that a source's own position has had to be handled
as evidence rather than as narration, and it is a pattern to expect more of as the campaign moves
into contested territory: **the most authoritative review of a disputed area is often written by a
party to the dispute.**

**The paper's own figures are the sharpest material against its strongest claim.** It states that
substance use disorders "tend to be chronic" and reports lifetime remission of **99.2% cocaine, 97.2%
cannabis, 90.6% alcohol, 83.7% nicotine**. Most people who develop one eventually remit — which is
exactly the evidence critics cite when arguing the brain disease model **downplays natural recovery**.
Relapse also follows a **hyperbolic function**, risk falling the longer remission lasts, which argues
against reading a single relapse as an unchanging disease process.

**Two absences named on the page.** The review does not critique the DSM-5 collapse of abuse and
dependence into one severity continuum; and it **covers no behavioural addictions at all** — no
`gambling-disorder`, no `internet-gaming-disorder` — despite DSM-5 having placed gambling in this
chapter as the first behavioural addiction. The most authoritative recent review of the chapter omits
its newest and most disputed part.

**Progress: `contested` 47 → 43 empty.**

---

## 19. The `contested` campaign completes Tier A — 24 pages, 20 journal sources, one session

**Result: `contested` empty 47 → 21, and Tier A `contested` is 0.** Every page the catalogue marks as
central now has a contested section. What remains is 19 Tier B pages, `substance-intoxication`
(foundation) and `sleep-wake-disorders` (overview).

### 19.1 What was written

| Page | Source | Closed |
|---|---|---|
| `functional-neurological-symptom-disorder` | Stone et al. 2024, *World Psychiatry* | etiology, contested |
| `insomnia-disorder` | Krystal, Prather & Ashbrook 2019, *World Psychiatry* | contested |
| `prolonged-grief-disorder` | Prigerson & Maciejewski 2024 + Reed et al. 2022 | etiology, treatment, contested (enriched) |
| `internet-gaming-disorder` | Reed et al. 2022, *World Psychiatry* | contested (enriched) |
| `generalized-anxiety-disorder` | Gray et al. 2024 (WHO), *World Psychiatry* | contested |
| `panic-disorder` | Gray et al. 2024 (WHO) | contested |
| `disruptive-mood-dysregulation-disorder` | Leibenluft 2017, *World Psychiatry* | diagnosis, epidemiology (partial), etiology, treatment, contested |
| `stimulant-use-disorder` | Newcorn 2025, *World Psychiatry* | contested |
| `separation-anxiety-disorder` | Silove, Manicavasagar & Pini 2016 | contested |
| `obsessive-compulsive-disorder` | Cervin et al. 2022 + Cervin et al. 2025 | contested |
| `neurocognitive-disorder-due-to-alzheimers-disease` | Ravona-Springer et al. 2003, *Dialogues Clin Neurosci* | contested |
| `vascular-neurocognitive-disorder` | Ravona-Springer et al. 2003 | contested |
| `binge-eating-disorder` | Amianto et al. 2015, *BMC Psychiatry* | contested |
| `adjustment-disorders` | Zapata-Ospina et al. 2023, *Front Psychiatry* | treatment, contested |
| `delirium` | Sepulveda et al. 2016, *BMC Psychiatry* | contested |
| `delusional-disorder` | Gonzalez-Rodriguez & Seeman 2022, *World J Psychiatry* | etiology, treatment, contested |
| `narcolepsy` | Quaedackers, Pillen & Overeem 2021, *Nat Sci Sleep* | epidemiology, contested |
| `illness-anxiety-disorder` | Lebel et al. 2020, *PLOS ONE* | contested |
| `dissociative-amnesia` | Taib et al. 2023, *Front Psychiatry* | contested |
| `dissociative-identity-disorder` | Brand et al. 2016, *Harvard Rev Psychiatry* | contested |
| `substance-withdrawal` | Jesse et al. 2017, *Acta Neurol Scand* | epidemiology, etiology, contested |
| `agoraphobia` | Roest et al. 2019, *Depress Anxiety* | contested |
| `erectile-disorder` | Dewitte et al. 2021, *Sexual Medicine* (ESSM) | contested |
| `specific-phobia` | Thng et al. 2020, *F1000Research* | contested |

### 19.2 The search method that made this affordable

**Batch the Europe PMC API over a topic list, then fetch only the shortlist.** One shell loop over
15-20 topics with `JOURNAL:"..." AND TITLE:"..." AND OPEN_ACCESS:Y`, printing `pmcid | year | journal |
title`, turns a per-page search problem into one call per batch. Only shortlisted candidates get a
WebFetch — and **the fetch is still mandatory before writing** (§18.3), because a search result gives a
title, not a verified citation and not a licence.

```
curl -sG "https://www.ebi.ac.uk/europepmc/webservices/rest/search" \
  --data-urlencode 'query=JOURNAL:"World Psychiatry" AND TITLE:"delirium" AND OPEN_ACCESS:Y' \
  --data-urlencode 'format=json' --data-urlencode 'pageSize=10' --data-urlencode 'sort=CITED desc'
```

**World Psychiatry alone does not cover the course.** Searching 17 topics against it returned nothing
for phobia, dissociation, delirium, Alzheimer's, narcolepsy, adjustment disorder, PMDD, schizoaffective
or delusional disorder. Widening to `BMC Psychiatry`, `Frontiers in Psychiatry`, `PLOS ONE`,
`F1000Research`, `Dialogues in Clinical Neuroscience`, `Depression and Anxiety`, `Nature and Science of
Sleep` and `World Journal of Psychiatry` closed almost all of them. **Search the topic, not the
journal.**

### 19.3 One source, two pages, two job rows

Ravona-Springer et al. (2003) answers the separability question for **both**
`neurocognitive-disorder-due-to-alzheimers-disease` and `vascular-neurocognitive-disorder`; Reed et al.
(2022) covers gaming disorder and prolonged grief; Gray et al. (2024) covers GAD and panic.

**Create one `ingest_jobs` row per (source, target page).** `wiki_page_provenance` joins version → job,
so a single job row would attribute the source to only one page. `ingest_jobs_target_slug_ck` requires
`target_slug` when `source_type='reference'`, which enforces this anyway.

**Two sources on one page needs two versions, accepted in sequence.** `review_proposal` writes the
version's content wholesale, so two pending versions on the same page would have the second overwrite
the first from a stale base. `obsessive-compulsive-disorder` was done this way — benchmarks accepted
first, then the MCID section appended under its own job.

### 19.4 Licence variants encountered, and what each permits

| Licence | Seen on | Handling |
|---|---|---|
| **CC BY 4.0** | Gray (WHO), Amianto, Zapata-Ospina, Sepulveda, Lebel, Taib, Thng | remixable with attribution |
| **CC BY-NC 4.0** | Gonzalez-Rodriguez & Seeman, Roest | remixable, non-commercial |
| **CC BY-NC 3.0** | Quaedackers (Dove) | remixable, non-commercial |
| **CC BY-NC-ND 4.0** | Ravona-Springer, Brand, Jesse, Dewitte | **no derivatives** — cite and paraphrase only |
| **WPA copyright, free to read** | most *World Psychiatry* items | cite and paraphrase only |

**A WHO-authored article in a copyrighted journal can still be CC BY** — Gray et al. is © World Health
Organization, licensed by the authors, in a journal whose other content is not. **Check per article,
never per journal.**

### 19.5 Sources that are parties to the dispute — now a pattern, not an exception

§18.8 recorded this for Volkow on addiction. It recurred twice:

- **Brand et al. (2016) on `dissociative-identity-disorder`** — the authors are advocates of the trauma
  model and authors of the treatment guidelines the paper defends. The page **states that in the
  running text before presenting the evidence**, names the design limits of the outcome studies it
  cites (within-patient, uncontrolled, non-randomised), and flags what the paper does not weigh: the
  costs of *over*diagnosis, and the interpretive choice involved in classifying cultural possession
  states as DID variants.
- **Dewitte et al. (2021) on `erectile-disorder`** — an ESSM position statement arguing for the
  psychosocial approach it represents. Handled the same way; its strongest evidence (the >50%
  first-year discontinuation rate for medical aids) survives the framing.

**The rule: name the authorship position in the page text, then use the source's own numbers.** A
source that is a participant is still usable; a source presented as neutral when it is not is a
misrepresentation.

### 19.6 Say how big the evidence base is before saying what it found

Three pages this round would have been misleading without a size statement in front of the findings:

- **`adjustment-disorders`** — the seven phenomenological differences between adjustment disorder and a
  depressive episode come from a **qualitative study of four people**, all highly educated, all
  Colombian, interviewed retrospectively. The table is on the page; so is the *n*, in bold, immediately
  after it, described as a hypothesis worth testing rather than an established discriminant.
- **`dissociative-amnesia`** — the neuroimaging findings come from **22 studies, 49 patients, one
  prospective controlled study, mean quality 4.9/10**. Stated before any finding.
- **`specific-phobia`** — the large effect sizes come overwhelmingly from **community volunteers** (3
  of 33 studies used clinical samples) in a population defined by *not* seeking treatment.

**A finding without its denominator reads as settled.** Same discipline as §16's "count hits in the
body, not the references".

### 19.7 What the campaign found that is worth teaching

Recurring across pages, and useful as course material rather than page filler:

- **Prevalence is a property of the manual.** Delirium in the same 200 patients: **28% (DSM-III-R),
  27% (DSM-5), 21% (DSM-IV), 16% (ICD-10)**. Agoraphobia: prevalence essentially unchanged between
  DSM-IV and DSM-5 while **43% of cases are recognised by one manual and not the other**. PTSD (§18):
  42% concordance.
- **Reliability and accuracy trade off.** DSM-5's delirium criteria have the best inter-rater
  reliability of four systems and slightly lower accuracy; *disorganised thinking* was dropped after
  DSM-III-R **to improve reliability among non-psychiatrists** and performed well phenomenologically.
  Same structure in DSM-5's collapse of primary/secondary insomnia, made because **the mechanism is
  poorly understood**, not because the distinction had been disproved.
- **Thresholds that govern who gets treated are often arbitrary.** The Y-BOCS **16** used as
  trial-entry criterion across the OCD literature has **no empirical basis**; the empirically derived
  severe threshold of 30 has PPV 43-49%, leading its own authors to say that rationing specialist
  treatment by it **should be questioned**.
- **A treatment that separates two conditions is better evidence of distinctness than a criteria set
  that asserts it** — interpersonal psychotherapy and nortriptyline both treat bereavement-related
  depression and **not** grief.
- **Adherence data undercut efficacy data.** More than 50% of couples discontinue medical aids for
  erectile dysfunction within a year, mostly for non-pharmacological reasons.

### 19.8 What remains

**21 `contested` gaps**: 19 Tier B, plus `substance-intoxication` (foundation) and
`sleep-wake-disorders` (overview). Corpus-wide, also 23 `treatment`, 14 `etiology` and 8
`epidemiology` sections empty.

The Tier B remainder is genuinely harder. `communication-disorders`,
`disinhibited-social-engagement-disorder` and `psychological-factors-affecting-other-medical-conditions`
have thin open-access review literature, and several of the rest are better served by a targeted search
per page than by another batch sweep.

**Live: 247 pages, 1,286 wikilinks, 114 ingest jobs, 0 published, queue clear.**

---

## 20. `prevalence` — a frontmatter invariant, a concept page, and a reader surface

**All 108 disorder pages now carry a one-line `prevalence:` value in frontmatter, and the reader
renders it.** Before this, 63 had a value, 12 had a placeholder and **33 had no such field at all** —
and none of the three states was visible to a reader, because `WikiPage.jsx` never rendered the field.

### 20.1 The invariant

**Every page with `type = 'disorder'` has exactly one `prevalence:` line, inside the frontmatter block,
on one line, double-quoted.** Check it with:

```sql
SELECT count(*) FILTER (WHERE content !~ E'\nprevalence:') AS missing
FROM wiki_pages WHERE type = 'disorder';
```

**One line matters.** `splitFrontmatter()` in `src/academic/fieldguide/wiki/wikiText.js` parses a
deliberately narrow YAML subset — `key: scalar` and inline `[a, b, c]` lists, one line each. A folded
or block-scalar value would be silently dropped, so a long prevalence string must stay on a single
line rather than wrap.

**Placement is immediately after `title:`.** Inserted with a first-match `regexp_replace` on
`(\ntitle:[^\n]*\n)`, which keeps it above the `sources:` block list rather than stranded after it.

### 20.2 "No figure in this source" is a value, not a gap

**21 of the 108 pages honestly report that no rate exists.** Those are written out rather than left
blank, because the two states mean different things:

- **Blank** = nobody looked.
- **"Largely unknown — deception is intrinsic to the disorder and clinicians rarely record the
  diagnosis (APA, 2022)"** (`factitious-disorder`) = somebody looked, and the absence has a reason.

The reason is often the most teachable part of the page. `pedophilic-disorder` — stigma keeps people
out of clinical samples, so published figures are unrepresentative *by construction*.
`voyeuristic-disorder` — the source's own two figures are contradicted within the same passage, so the
field says the rate is not known **and says why the numbers already on the page must not be quoted**.

**The reader shows these too.** Hiding them would leave only the disorders that happen to have been
counted, which is exactly the distortion the `prevalence` page argues against.

### 20.3 Values are derived, not researched

Each value was written **from that page's own Epidemiology section**, which is already provenanced —
so no new claim enters the corpus and the frontmatter cannot drift from the body's sources. This is
why it was done as a plain `UPDATE` on `wiki_pages.content` rather than through an ingest job: it is a
restatement, not an ingest.

**A plain UPDATE is safe here** because the triggers do the bookkeeping: `wiki_pages_snapshot_trg`
keeps the previous body as an accepted version, `wiki_pages_set_needs_trg` re-derives `needs`,
`wiki_pages_sync_links_trg` re-derives the graph, `wiki_pages_touch_trg` bumps the timestamp. Link
count was unchanged at 1,286 across the 45-page edit, which is the check that frontmatter-only edits
touched no bodies.

**Overview pages carry a chapter-level range** rather than a single rate — `anxiety-disorders`
("specific phobia 8-12% (US) down to agoraphobia 1-1.7% worldwide"), `personality-disorders`
("narcissistic personality disorder 0.0% (NCS-R) against 6.2% (NESARC)"). The point of those is the
spread, not a midpoint.

### 20.4 The `prevalence` concept page

**New page, `type='concept'`, three provenanced sources** — deliberately *not* a duplicate of
`epidemiology`, which keeps the definitions (point/period/lifetime, incidence, comorbidity). The new
page carries the thing the §19 campaign kept turning up: **what a published rate is actually a property
of** — the manual, the instrument, the threshold, the sample.

| Section | Source |
|---|---|
| The manual decides the number (delirium, 200 patients, 16%-28%) | Sepulveda et al. 2016, CC BY 4.0 |
| A stable rate can hide an unstable category (agoraphobia, 43% non-overlap) | Roest et al. 2019, CC BY-NC 4.0 |
| The instrument, and where its threshold came from (41 measures, 4.3%-86%) | Lebel et al. 2020, CC BY 4.0 |

**Built as three sequential versions under three jobs** (§19.3), so all three appear under *Built from*
rather than one crowding out the others. Figures borrowed from elsewhere in the corpus — PTSD's 42%
concordance, the Y-BOCS 16, gaming disorder's 30+ instruments — are cited inline and wikilinked to the
page where they are fully provenanced, which is cross-referencing rather than unsourced content.

### 20.5 The label is the link

**`WikiPage.jsx` renders the frontmatter value under the summary, with the word "Prevalence" linking to
`/academic/fieldguide/wiki/prevalence`.** That gives **all 108 disorder pages a route to the concept
page without editing 108 bodies** — the alternative, a `[[prevalence]]` wikilink in every disorder
page, would have added ~108 graph edges of no analytical value and touched every page's version
history to do it.

The trade-off is explicit: the concept page gets **one** backlink (from `epidemiology`, where the link
*is* in the body and *is* a real edge) rather than 109. The reader can always reach it; the graph
stays meaningful.

---

## 21. The Lecture 10 neurocognitive sweep — treatment closes, and one section was simply out of date

**Nine sources, eight pages, two of them new.** `treatment` fell **23 → 18**, and every page in the
neurocognitive chapter except `neurocognitive-disorder-other-aetiologies` now has a treatment section.

### 21.1 What was written

| Page | Source | Closed |
|---|---|---|
| `neurocognitive-disorder-due-to-alzheimers-disease` | Espay, Kepp & Herrup 2024, *eNeuro* | **replaced a stale treatment claim** |
| " | Haass & Selkoe 2022, *PLoS Biology* | contested (enriched) |
| `delirium` | Abraha et al. 2015, *PLOS ONE* | treatment |
| **`neurocognitive-disorder-with-lewy-bodies`** *(new)* | McKeith et al. 2017, *Neurology* | whole page bar etiology |
| `frontotemporal-neurocognitive-disorder` | Gambogi et al. 2021, *Dement Neuropsychol* | treatment, contested |
| `mild-neurocognitive-disorder` | Chen et al. 2021, *Front Neurol* | treatment |
| `vascular-neurocognitive-disorder` | Jaul & Meiron 2017, *Front Aging Neurosci* | treatment |
| `neurocognitive-disorder-due-to-traumatic-brain-injury` | Barman, Chatterjee & Bhide 2016, *Indian J Psychol Med* | treatment |
| **`substance-medication-induced-neurocognitive-disorder`** *(new)* | Sachdeva et al. 2016; Wijnia 2022 | whole page |

### 21.2 A page can be complete and still be wrong

**`neurocognitive-disorder-due-to-alzheimers-disease` had a full treatment section, no declared gap,
and a sentence saying disease-modifying therapy was "research in its infancy."** That was accurate to
its source — the Alzheimer's Association, **2017** — and by 2026 it was false. **Lecanemab and
donanemab had completed phase 3 and reached clinical use, and neither appeared anywhere on the page.**

**The gap query cannot find this class of problem.** `needs` and `annotations` only surface what a page
*declares* missing; a confidently-written stale section declares nothing. It was found by reading the
treatment section while checking something else.

**Standing check to add to any review pass: for every page, what is the newest source, and has the
field moved since?** Sections most exposed are ones citing an advocacy organisation or a textbook
rather than a journal, and ones about **treatment** rather than presentation — presentation ages
slowly, treatment does not.

### 21.3 The relative-versus-absolute framing, worked

The anti-amyloid trials are the corpus's best worked example of a reporting choice doing the
persuasive work.

| | Lecanemab | Donanemab |
|---|---|---|
| Difference from placebo | **0.45** points (CDR-SB, 18-point scale) | **3.4** points (iADRS, 144-point scale) |
| Reported as | "27% slowing" | "33% slowing" |
| As a share of the whole scale | **2.5%** | **2.4%** |
| Minimal clinically important difference | 1.0 (MCI) / 1.6 (mild dementia) | 5 (MCI) / 9 (mild dementia) |
| **Below MCID?** | **yes, on both** | **yes, on both** |
| Treatment-related adverse events | 45% | 89% |
| Brain swelling and/or bleeding | ~25% | >33% |
| **Number needed to harm** | **~3** | **~3** |

Both framings describe the same result. Pair this with `obsessive-compulsive-disorder`, where the
minimal clinically important difference was derived empirically in 2025 — it demonstrates that the
threshold *can* be established, and that here it has not been.

### 21.4 Both sides, both partisan

Run plan §19.5 recorded that the best source on a disputed area is often a party to the dispute. Here
**both** sources are, and in opposite directions: **Espay, Kepp and Herrup** are prominent critics of
the anti-amyloid approach; **Selkoe originated the amyloid cascade hypothesis** and Haass is a leading
proponent. The page names both positions in the running text and then does the thing that makes the
pairing worth having — **states what both sides concede**:

1. **The field has no validated definition of clinical meaningfulness**, which the proponents say
   outright. The entire dispute turns on a threshold nobody has set.
2. **The aducanumab approval was irregular** — EMERGE positive, ENGAGE negative, accelerated approval,
   reconciliation by post-hoc reanalysis that even its defenders label post-hoc.
3. **The trials may not measure the toxic species** — the proponents' own mechanism implicates soluble
   oligomers, which are **invisible to amyloid PET**.

**Where two partisan sources are available, take both and mine the overlap.** The concessions are more
informative than either case.

### 21.5 The findings worth teaching from this chapter

- **Delirium: prevention works, treatment does not.** Multicomponent programmes cut incidence (**RR
  0.71** after hip fracture; **RR 0.42** in high-risk medical patients when family-delivered) — but for
  patients who already have delirium *"the available evidence does not support the efficacy"* of the
  same interventions. Also **no effect on falls, length of stay or mortality**, and **no benefit at all
  in low-risk patients**.
- **The same drug, three answers, because the deficit differs.** Donepezil helps in
  `neurocognitive-disorder-due-to-traumatic-brain-injury`, is **contraindicated** in
  `mild-neurocognitive-disorder` (one guideline recommends **deprescribing** it), and is **useless or
  harmful** in `frontotemporal-neurocognitive-disorder`, where the cholinergic system is **relatively
  preserved** and a case series found **increased disinhibition in 4 of 12** treated patients. This is
  the argument for subtyping neurocognitive disorders, stated in a currency that matters.
- **Two dementias where the standard response to agitation is the dangerous one.** Antipsychotics
  cause a severe, sometimes fatal sensitivity reaction in **Lewy body** disease, and **parkinsonism and
  tardive antecollis** in bvFTD.
- **A criteria change can reflect improved practice rather than new knowledge.** Severe antipsychotic
  sensitivity was **downgraded** from "suggestive" to "supportive" in the DLB criteria **because
  prescribing fell**, so the reaction is now too rarely seen to be diagnostically useful.
- **Rehabilitation after structural damage: compensate, don't restore.** External memory aids have
  **strong evidence** after TBI; memory drills aimed at rebuilding the capacity largely do not work.
- **Oral thiamine is not a weaker treatment for Wernicke encephalopathy — it is not a treatment.**
  And requiring the classic triad finds **23%** of cases against **85%** for Caine's two-of-four
  criteria.
- **One neurocognitive disorder can partially reverse.** Alcohol-related impairment improves over a
  year or more of abstinence, with increased brain volume — the only page in the chapter where the
  prognosis is not uniformly grim.

### 21.6 Saying what a source does not have

Two pages record an absence in the running text rather than quietly writing around it:

- **`vascular-neurocognitive-disorder`** — the prevention framework is presented as **a rationale, not
  a trial literature**, because Jaul and Meiron cite **no randomised trials** for any tier of it. The
  page says so.
- **`substance-medication-induced-neurocognitive-disorder`** — a **scope note at the top** states that
  the DSM category covers inhalants, sedative-hypnotics and medications while **the evidence here is
  almost entirely about alcohol**. Same handling as `substance-withdrawal` (§19).

### 21.7 What remains in Lecture 10

**`neurocognitive-disorder-other-aetiologies`** is the last unwritten page in the chapter and is
awkward by construction: one catalogue slug covering **Parkinson's disease, Huntington's disease, HIV
infection and prion disease**. There is no single source; it needs roughly one per aetiology, so it is
a small batch of its own rather than an add-on.

**`neurocognitive-disorder-with-lewy-bodies` declares `etiology`** — the consensus report covers
diagnosis and management, not pathogenesis, and says the **genetic contribution is substantial but
poorly characterised** (*GBA* overrepresented, most patients do not carry it).

**`communication-disorders`** still has four gaps. It sits in Lecture 10 but is a neurodevelopmental
page, and §19.8 already flagged its open-access literature as thin.

**Live: 250 pages, 1,343 wikilinks, 127 ingest jobs, 79 empty sections, 0 published.** Gaps now
`contested` 20, `treatment` 18, `etiology` 15, `epidemiology` 8.

---

## 22. The neurocognitive chapter closes — 13 pages, zero declared gaps

**Every page in DSM-5-TR Chapter 17 now has every section filled.** Four more sources finished it:
Outeiro et al. (2019) for Lewy body pathogenesis and Parkinson's disease dementia, Jurcau et al. (2024)
for prion disease, Anderson et al. (2018) for Huntington's, Vastag et al. (2022) for HIV.

| Page | Chars | Gaps |
|---|---|---|
| `neurocognitive-disorders` (overview) | 15,362 | none |
| `delirium` | 11,274 | none |
| `major-neurocognitive-disorder` | 7,669 | none |
| `mild-neurocognitive-disorder` | 5,536 | none |
| `neurocognitive-disorder-due-to-alzheimers-disease` | 17,937 | none |
| `vascular-neurocognitive-disorder` | 9,181 | none |
| `neurocognitive-disorder-with-lewy-bodies` | 14,097 | none |
| `frontotemporal-neurocognitive-disorder` | 8,402 | none |
| `neurocognitive-disorder-due-to-traumatic-brain-injury` | 8,253 | none |
| `substance-medication-induced-neurocognitive-disorder` | 12,235 | none |
| `neurocognitive-disorder-other-aetiologies` | 20,411 | none |
| `dementia-versus-neurocognitive-disorder-terminology` | 2,631 | none |

### 22.1 A composite page can use its own section scheme

**`neurocognitive-disorder-other-aetiologies` is one catalogue slug covering four unrelated diseases** —
Parkinson's, Huntington's, HIV and prion disease. Forcing them through the standard
Presentation/Diagnosis/Epidemiology/Etiology/Treatment/Contested scheme would have produced six sections
each containing four disconnected paragraphs.

**It uses `##` headings per disease instead, and the gap machinery works better that way, not worse.**
`extract_page_sections()` keys on **any** `##` heading, so before the diseases were written the page's
`needs` read:

```
hiv-associated-neurocognitive-disorder | huntingtons-disease |
parkinsons-disease-dementia | what-is-contested-across-these-four
```

Each unwritten aetiology surfaced as its own named gap and closed independently. **Where a page is a
container rather than a disorder, name the sections after its contents.** The standard six are a default
for single-disorder pages, not a schema.

### 22.2 Building a four-source page in four versions

Provenance joins version → job, so a page needs one accepted version per source to list them all under
*Built from* (§19.3). For a page assembled from four sources that means **four sequential versions**,
each replacing a placeholder block:

1. **v1** creates the page with the frame, the prion section written, and the other three as
   `> **Needs research:** not yet written from a source.`
2. **v2, v3, v4** each `replace()` exactly one placeholder block with its disease.

**Every intermediate state is internally honest** — the page always declares exactly what it is missing
— and the final page carries **4 sources**. The alternative, one version citing four sources, would
have attributed everything to one job.

### 22.3 The finding the chapter kept producing

**Removing the pathological protein has now failed to help in three separate diseases**, and putting
them on adjacent pages makes it visible:

| Disease | Intervention | Result |
|---|---|---|
| Prion disease | **PRN100** anti-PrP antibody | **cleared the abnormal protein**, no effect on clinical progression |
| Alzheimer's disease | lecanemab, donanemab | amyloid cleared; differences **below the threshold of perception** |
| Lewy body disease | — | **Lewy body density does not correlate** with duration, onset, fluctuations, hallucinations, delusions, falls, parkinsonism or cognitive decline |

Either the visible aggregate is not the toxic agent in any of them, or by the time it is visible the
damage is done. The Lewy body literature has the sharpest version: *in vitro*, **fibril uptake is
associated with a protective outcome** while **monomer and oligomer uptake triggers apoptosis** — which
would make the structure the disease is named after the brain's defence.

**And the four "known cause" diseases show that certainty about aetiology does not deliver treatment.**
Huntington's has a single identified autosomal dominant mutation, testable years before onset, and its
management guidance is **expert consensus** because there are *"insufficient data for evidence-based
guidelines."* Prion disease is understood in molecular detail and **every therapeutic attempt has
failed**.

### 22.4 Other things worth teaching from these four

- **Two dementias separated by a stopwatch.** DLB and Parkinson's disease dementia are distinguished by
  the **one-year rule** — which symptom set was noticed first — on a boundary its own authors call
  arbitrary, with **end-stage neuropathology that may be identical**.
- **Criteria that manufacture cases.** The **Frascati criteria** for HAND put the cutoff at 1 SD across
  multiple domains, and **15-22% of people without HIV test positive** on extensive batteries; 20% of a
  simulated normal population falls below threshold. Antiretroviral therapy left **overall prevalence
  steady at 30-60%** while shifting almost all of it to the asymptomatic end (**HAD 2%** in CHARTER).
- **Check whether a prescribed drug is causing the symptom before treating it.** The Huntington
  guidance for apathy says to **reduce SSRIs and neuroleptics first** — apathy from an SSRI looks
  exactly like apathy from the disease. Likewise anxiety versus **akathisia**.
- **In rapidly progressive dementia the expensive error is missing the reversible mimic** — autoimmune
  encephalitis (responds well to immunotherapy; antibodies **initially negative in up to 50%**),
  lithium toxicity, hepatic encephalopathy, hypoglycaemia, and **thiamine deficiency, whose MRI can show
  the same cortical ribboning as CJD**.
- **A diagnostic test can get worse as the disease progresses.** CJD's MRI signal **fades** with
  neuronal loss and the EEG changes **disappear in late stages** — both most useful when the diagnosis
  is least obvious.

### 22.5 What is left outside the chapter

**`communication-disorders`** sits in Lecture 10 but belongs to the neurodevelopmental chapter; it
still has four gaps and thin open-access literature (§19.8).

**Live: 251 pages, 1,353 wikilinks, 132 ingest jobs, 78 empty sections, 0 published.**

---

## 23. `communication-disorders` closes, and the chapter map gets its missing chapter

Two jobs from one session: the last multi-gap page in Lecture 10, and a chapter the catalogue had
deliberately omitted.

### 23.1 `communication-disorders` — 4 gaps closed, 4 sources

| Section | Source |
|---|---|
| epidemiology | Calder et al. 2022, *J Paediatr Child Health* (Raine Study) |
| etiology | Mountford et al. 2022, *Children* |
| treatment | Rinaldi et al. 2021, *Brain Sciences* |
| contested | Sansavini et al. 2021, *Brain Sciences* |

All CC BY 4.0. Page now **19,215 chars, five sources, zero declared gaps**.

**The scope note is doing real work here.** All four sources are about **developmental language
disorder**, which maps to **one** of DSM-5-TR's four communication disorders. **Speech sound disorder,
childhood-onset fluency disorder (stuttering) and social (pragmatic) communication disorder remain
uncovered**, and that is stated in the Epidemiology section and again in a closing Needs-research line.
The page was previously honest about a *source* limit ("Module 16 covers only the last of these") and
now carries a different, larger one; the fix was to keep saying so rather than to let four good sources
imply full coverage.

**The three findings that made the page worth doing:**

- **Ascertainment decides the answer, twice on one page.** Heritability is **0.97** in clinically
  ascertained twins and **near zero** in population-screened twins. And the long-standing male
  predominance disappears in an unselected cohort — **52.9% male, p = 0.799** — which the authors
  attribute to **referral bias toward males and under-detection of females**. A sex ratio from clinic
  samples measures who gets referred.
- **Only 2 of 104 children meeting criteria had been identified by a health professional**, in a
  prospective birth cohort. Set that beside the diagnostic review's conclusion that there is
  **insufficient evidence for universal screening** — both are on the record, and the tension is the
  teachable part.
- **The treatment evidence runs the wrong way relative to the epidemiology.** Expressive targets have
  RCT support (SMD 0.44-1.08); **receptive vocabulary has no studies at all** — while **46.2%** of
  affected children have combined receptive-expressive difficulties and 20.2% are receptive-only. And
  the one long follow-up (Wake et al.) found gains **gone by age 6 with controls caught up**, which
  suggests acceleration rather than change of outcome.

**A pattern worth naming: the nosology limits the genetics.** Genetic studies used language cutoffs
from **1.25 to 2.0 SD** with inconsistent IQ thresholds, because there is no international diagnostic
consensus — so samples cannot be pooled and results cannot replicate. The Etiology section says this
and points forward to Contested rather than treating the two as separate topics.

### 23.2 `elimination-disorders` — a page for a chapter the course does not teach

**It existed nowhere**: no page, no catalogue row, no `disorders` row. That was not an oversight —
`dsm_chapters` records **Chapter 11 as `taught = false`**, one of two so marked (with Ch. 20, *Other
Mental Disorders*). The decision was recorded; the consequence was that a whole DSM chapter was
invisible.

**Written anyway, as an explicitly out-of-scope overview.** A Field Guide that silently omits a chapter
reads as incomplete rather than scoped, and a reader meeting enuresis or encopresis in a case or a
comorbidity list has nowhere to land. The page opens with a scope note saying the course does not teach
it, that it is not exam material, and that it is deliberately thinner than a taught page.

**Catalogue handling:** a `disorders` row was added with **`tier = 'overview'` and `lecture = NULL`**,
plus a `tier_review_note` explaining why. Catalogue rows: **130 → 131**. `lecture = NULL` is the honest
encoding — the page exists, no lecture teaches it — and it keeps the page from counting as
off-catalogue.

**The justification for the page is in the psychiatric comorbidity, which is the part a psychology
course would actually use.** **20-30% of children with enuresis and 30-50% with encopresis** have a
clinically relevant comorbid disorder — **over a fourfold increase** on peers, [[adhd]] most often.
Where effects reach significance they are mostly **externalising** (attention 0.37, social problems
0.39, self-concept 0.42, aggression 0.33), and **depression and anxiety do not differ significantly** —
the null result being the surprising one.

**Encopresis is left as a declared gap** because no encopresis-specific source was used; it appears in
the comorbidity meta-analysis as **7 studies of 214 children** against 32 studies of 3,244 for enuresis,
and the page says so rather than padding.

### 23.3 A rule that emerged from both pages

**Where a page covers less than its title claims, say so in the section that carries the numbers — not
only in a note at the top.** `communication-disorders` repeats its scope limit in Epidemiology, where a
reader is most likely to lift a figure, and again at the end of Contested. `elimination-disorders`
carries the "not taught" note in the opening section and the encopresis gap inside the encopresis
heading. A scope note at the top of a long page is read once and then forgotten.

**Live: 252 pages, 1,361 wikilinks, 138 ingest jobs, 75 empty sections, 131 catalogue rows,
0 published.**

---

## 24. The paraphilias — the cluster with the worst existing content, and four sources that fix it

**Six pages closed across Lecture 7**, including both Tier A pages and the chapter overview. Major-tier
gaps fell **21 → 16**, `treatment` **18 → 11**, `etiology` **15 → 11**.

| Page | Closed | Source |
|---|---|---|
| `pedophilic-disorder` | etiology | Joyal 2023, *Sexual Offending* |
| " | treatment | Landgren et al. 2022, *Drugs* |
| `paraphilic-disorders` (overview) | etiology | Joyal 2023 |
| " | treatment | Culos et al. 2024, *J Clin Med* |
| `exhibitionistic-disorder` | treatment | Culos et al. 2024 |
| `voyeuristic-disorder` | treatment | Culos et al. 2024 |
| `fetishistic-disorder` | treatment | Culos et al. 2024 |
| `sexual-sadism-and-masochism-disorders` | treatment | Culos et al. 2024 |

### 24.1 The finding that reorganises the chapter

**A neuroimaging meta-analysis of 436 men with pedophilic disorder against 449 controls found no
structural brain difference** (reported in Joyal, 2023). Pedophilic disorder is the most-researched
paraphilia by a wide margin, so a null result there is the strongest available statement about the
chapter as a whole — and it is now the opening of both `pedophilic-disorder` etiology and the overview's.

**The three circulating neurobiological models all explain the wrong thing.** Frontal-dysexecutive,
temporal-limbic and dual-dysfunction accounts explain **hypersexuality and disinhibition** and none
explains **the paraphilic interest itself**. The distinction between *why someone acts* and *why
someone wants* now runs through the chapter.

**Acquired cases argue against the models they are usually cited to support.** Joyal reviewed **64
documented cases**: 63 male, mean onset **52.8**, and **81% with no premorbid interest**. They arrive
with hyperphagia, kleptomania, aggression and compulsivity — a **general failure of behavioural
filtering**, sometimes without corresponding sexual fantasies at all. His conclusion, now on the page:
such cases **should not be used to infer the neurology of the developmental disorder**. A lesion that
removes inhibition tells you about inhibition.

**One observation sits against the whole account and is recorded as unresolved**: almost all 64 acquired
cases were male, though generalised fronto-temporal disinhibition should not be sex-specific.

### 24.2 Say what the treatment does *not* show

**The pedophilic-disorder treatment section opens with the gap rather than the efficacy**, because the
review does: testosterone-lowering drugs reduce sexual *activity*, and *"it remains to be explored if
reduced sexual activity translates into a reduction in criminal sexual behavior"* — **risk of offending
was not assessed in any of the randomised trials**. Everything downstream is read against that.

The numbers are real but small: **cyproterone acetate** 4 studies / 32 people, significant reduction
across all domains; **degarelix** one RCT of 52 with the fastest onset documented; **medroxyprogesterone**
mixed across 4 studies / 61. Median sample **13.5**, median follow-up **15 weeks**, only one study after
2010.

**And the harms are not incidental.** Degarelix: injection-site reactions 88%, raised liver enzymes 44%,
**two cases of increased suicidal ideation**. Cyproterone is under European restriction over meningioma
risk. Testosterone suppression brings reduced bone density, insulin resistance and cardiovascular risk.

**Adding psychotherapy has not been shown to add anything on this evidence** — McConaghy compared drug
alone, imaginal desensitisation alone, and both, and found **no significant differences**. That is worth
holding against the overview's summary that combined treatment is "superior".

### 24.3 State the size of the literature before quoting from it

The whole pharmacological evidence base for this chapter is **28 studies and 379 people**, of which
**only three of 28 scored above 5** on the Newcastle-Ottawa scale. That sentence opens the treatment
section on every paraphilia page, before any drug is named — the §19.6 rule, applied per page rather
than once on the overview.

**The most-quoted recidivism figure in the field rests on a single 1992 study**: 18% on
medroxyprogesterone, 35% after discontinuation, 58% untreated. It is on the page with its provenance
attached.

### 24.4 Two asymmetries the sources ignore and the pages name

- **`sexual-sadism-and-masochism-disorders` is two different treatment questions.** Masochism requires
  **distress in the person themselves**; sadism centres on **acting on urges with a non-consenting
  person**. A drug literature built around drive reduction and recidivism was assembled for the second
  and is routinely read onto the first. The page says so, and asks whether a diagnosis whose criterion
  is the patient's own distress should be treated by suppressing sexual drive at all.
- **`fetishistic-disorder` is the one paraphilia where the conditioning account has been studied** — so
  a learning account predicts **behavioural treatment is where the leverage is**, and the pharmacological
  review cannot speak to it. Named as a gap rather than filled with drug evidence that answers a
  different question.

### 24.5 Scope notes that stop a source over-reaching

**The WFSBP guideline most often cited for this chapter (Thibaut et al., 2015) is
adolescent-specific.** Fetched, read, and *not* used as general treatment guidance; the overview records
what it is and one thing it explains — that **ethical constraints make placebo-controlled or
no-treatment designs very difficult in potential offenders**, which is the structural reason this
literature is shaped the way it is rather than a failing of any single study.

**Prevention services are named because they are protective information**: the German **Dunkelfeld
Project**, **Stop It Now** (UK and US), the Swedish **Preventell** helpline, **Don't Offend India**.
Landgren et al. recruited through a national helpline, which is unusual — the review notes this
literature **includes few voluntary participants**, so most of it generalises poorly outside forensic
settings.

**Handling.** All four sources are clinical or forensic reviews and are used for **etiology, treatment
and prevention only**. No offence detail appears on any page. `result_json.editorial_note` records that
decision on the two pedophilic-disorder jobs so it is not silently reversed.

### 24.6 What is left in Lecture 7

`exhibitionistic-disorder` (etiology), `fetishistic-disorder` (epidemiology), `transvestic-disorder`
(etiology, treatment), and `contested` on `genito-pelvic-pain-penetration-disorder` and
`male-hypoactive-sexual-desire-disorder`. **Transvestic disorder is absent from the pharmacological
review entirely**, so it needs its own search rather than another read-across.

**Live: 252 pages, 1,383 wikilinks, 146 ingest jobs, 67 empty sections, 0 published.** Major-tier gaps
**16 across 11 pages**; corpus-wide `contested` 19, `etiology` 11, `treatment` 11, `epidemiology` 7.

---

## 25. `law-and-ethics` — the Canadian content, and the piece that could not be sourced

**Both declared gaps on the foundation page are closed.** `canadian-law-and-other-jurisdictions` from
the National Trajectory Project; `professional-ethics-codes-and-boundaries` from the Canadian Academy
of Psychiatry and the Law guidelines. The page is now **21,025 characters with three sources and no
declared gaps** — but one thing it still needs is recorded prominently rather than quietly closed.

### 25.1 The search finding: this article does not exist where we look

The brief was "an article outlining how the Canadian mental health and justice system differs from the
US". **There isn't one in the biomedical literature.** Searching Europe PMC across NCRMD, forensic
psychiatry, civil commitment, duty to warn, insanity defence, mental health law and health-system
comparison returned **no Canada-versus-US comparative paper**. Comparative mental-health *law*
scholarship lives in law journals — CanLII, *Health Law Journal*, *McGill Journal of Law and Health* —
which are **not indexed in PubMed or Europe PMC**.

**One near-miss is worth recording as a warning.** *"Cross-Cultural Notions of Risk and Liberty: A
Comparison of Involuntary Psychiatric Hospitalization…"* (Hotzy et al., 2018) reads from its title like
exactly the paper wanted. It compares **New York and Zurich**. Canada appears nowhere in it. **Fetch
before assuming from a title** — §18.3 again, this time on the search side rather than the citation
side.

**The route taken instead was Canadian primary sources rather than a comparison**, which is arguably
better for a Canadian course: the page now states Canadian law directly and lets the US material
already on the page provide the contrast.

### 25.2 What Canadian NCRMD data actually shows

**Section 16 of the *Criminal Code*** replaced the insanity verdict in 1992; **Canada has no "guilty
but mentally ill" verdict**, which several US states do. The structural difference is what follows the
verdict: a **provincial or territorial Review Board**, operating under **federal** provisions but
**provincially administered**, reviewing each disposition **at least yearly**, with three options —
detention, conditional discharge, absolute discharge.

**The National Trajectory Project followed 1,800 people** found NCRMD 2000-2005 across Quebec (1,094),
Ontario (484) and British Columbia (222). Its findings run against the public image of the verdict:

| | |
|---|---|
| Homicide and attempted murder | **under 7%** of all NCRMD verdicts |
| Largest offence categories | threats **27.4%**, assaults **26.5%**, property **16.9%** |
| Victims: family or partner | **33.7%** |
| Victims: stranger | **22.7%** |
| Homicide/attempted murder victims who were family or partners | **60.8%** |
| Psychotic-spectrum diagnosis | **70.9%** |
| Prior psychiatric hospitalisation | **72%** |

**The NCRMD population is mostly people with psychosis, already known to services, who threatened or
assaulted someone close to them** — a different clinical and policy problem from the one the insanity
defence is usually argued about.

**Provincial variation is large and the authors decline to explain it.** Quebec has the highest verdict
rate and the *lowest* median offence severity; Ontario the highest homicide proportion (11.6%); BC the
highest substance-use comorbidity. Whether that is legal interpretation, service availability or
genuinely different populations is **unresolved** — and the files themselves differ in completeness
(education missing from **44.1%** of Quebec records against **5.4%** in BC). **A national figure
conceals three systems**, which is the transferable point.

### 25.3 Forensic ethics is a different ethics

The CAPL guidelines (Ramshaw et al., 2024, CC BY 4.0) supply the professional-standards gap, and the
substantive idea is a **role separation the page had not made**: the forensic assessor is **not** the
treating clinician, and must be **objective and independent of the retaining party** — the lawyer,
court or insurer who commissioned the assessment.

**Consent inverts.** Before beginning, the assessor must explain the reason for the assessment, their
own role, and **the limits to confidentiality**. In a forensic assessment the person is often not the
client and the usual promise does not hold; saying so in advance *is* the ethical requirement.

### 25.4 What could not be sourced at first, and was not faked

**Smith v Jones (1999 SCC) has no source in the corpus.** CanLII **403s automated fetches**, and per the
standing instruction (memory: ask when a download fails rather than substitute) the case was **not
written from memory**. The page therefore still declares the gap — now stated as **the single most
important correction it needs**: *Smith v Jones* framed disclosure as a public-safety **exception to
privilege** on a three-part test, a **permission** to disclose, against the affirmative **duty** to warn
that *Tarasoff* imposed.

**The CAPL guidelines cannot close it either, and the page says so.** They **explicitly decline to
address duty to warn or duty to protect, and cite no Canadian case law at all**. Recording that is more
useful than silently leaving the gap, because it tells the next session that the obvious Canadian
professional-standards document is not the answer.

**Also corrected: an overstatement of mine.** I had described this page as documenting a California
decision as the duty-to-warn rule in a way that would "actively mislead" a Toronto student. That was
too strong — the page **already carried a detailed Needs-research block** naming the Canadian
counterparts including the *Smith v Jones* distinction. It was a **declared gap, not a silent error**.

### 25.4a Resolved: Norm supplied the judgment

**Norm saved the CanLII PDF to `PSY240resources/` and the case is now written up from the judgment
itself**, in the duty-to-warn section rather than the Canadian one — beside *Tarasoff*, where the
contrast reads.

**The permission-versus-duty point is anchored in the procedural history, which is stronger than
asserting it.** The **trial judge held the psychiatrist was under a *duty* to disclose**; the **Court of
Appeal varied that to an order *permitting* disclosure**; the **Supreme Court dismissed the appeal and
affirmed the Court of Appeal**. The Canadian rule is what a clinician *may* do; *Tarasoff* is what a
Californian clinician *must* do.

**A second difference the page now makes explicit**: *Smith v Jones* is a **solicitor-client privilege**
case — the psychiatrist was retained by defence counsel — where *Tarasoff* arose from a **therapeutic**
relationship and a negligence claim. The doctrines have different parents.

**The three factors, with the Court's own qualifications**: **clarity** (person or group must be
ascertainable; a general threat to a whole city may be too vague, but a large group can count if clearly
identified), **seriousness** (danger of death or serious bodily harm), **imminence** (must create *a
sense of urgency*; **may apply to some time in the future**, with no particular time limit required).
They are **weighted, not counted**. If met, **disclosure is still limited to the information necessary
to protect public safety**.

**The dissent is on the page too**, because it makes the clinical argument the majority does not: the
breach must be **as narrow as possible**, the psychiatrist should disclose **his opinion and that it
rests on a consultation** but not the accused's own account of the offence (which risks becoming
**conscriptive evidence**) — and their reasoning is itself a public-safety argument, that a narrow
exception **fosters a climate in which dangerous individuals disclose, seek treatment and pose less
danger**, the accused here having been diagnosed **only because he felt secure in confiding**.

**The divergence from *Tarasoff* is deliberate**: the Court **considered *Tarasoff*** directly, along
with *Thompson v. County of Alameda*, *Brady v. Hopper* and *W. v. Egdell*.

**Handling.** This is a **primary legal source, not a licensed article** — a public SCC judgment, used
by paraphrase and short quotation. Facts are kept at **headnote level**: the page states the category of
threat and the identified victim group, because both are load-bearing for the clarity factor, and no
method detail. Recorded in `result_json.editorial_note`.

### 25.5 Still open on this page

Provincial **Mental Health Acts** for civil committal, including Ontario's **Form 1**; **fitness to
stand trial** under Canadian law; ***Smith v Jones***; and on the ethics side the **CPA Code of
Ethics**, provincial **mandated reporting**, sexual boundary violations and the disciplinary
mechanisms, record-keeping, and telehealth. None of these is in a source obtained so far.

---

## 26. `alternatives-to-categorical-diagnosis` — four challengers that do not agree with each other

The gap was picked over larger ones for a reason that had nothing to do with its size. It was **one
empty section on a page with 23 inbound wikilinks** — second only to `evidence-based-practice` — and
the contested sections written during the L9–L11 sweeps had been *pointing at it*: the dimensional-vs-
categorical argument on OCD severity bands, the three-column prevalence disagreement on personality
disorders, DMDD's DSM/ICD placement split, insomnia's collapsed subtypes. Every one of those says "see
`diagnosis-and-classification`" for an argument that was not on the page. **A red link is visible; a
blue link to a declared gap is not**, and this is the second kind. Rank derived gaps by inbound links,
not only by tier.

### 26.1 The sources, and why exactly four

The existing Needs-research marker named four things — HiTOP, RDoC, the DSM-5 Section III alternative
model for personality disorders, and "the general argument that latent continua fit psychopathology
data better than discrete categories." Searching each by name rather than by journal (§18's rule) gave
one source per item, and the fourth turned out to be misdescribed by its own marker: the general
argument is not one argument.

| Source | Covers | Licence |
|---|---|---|
| Krueger & Hobbs (2020), *Psychopathology* 53(3-4) | the DSM-5 AMPD | NIH Public Access author manuscript — free to read, **not CC** |
| Conway et al. (2019), *Perspectives on Psychological Science* 14(3) | HiTOP | NIHPA author manuscript — free to read, **not CC** |
| Cuthbert (2014), *World Psychiatry* 13(1) | RDoC | © World Psychiatric Association, open access |
| Borsboom (2017), *World Psychiatry* 16(1) | network theory | © World Psychiatric Association, open access |

Two of the four are **author manuscripts, not CC-licensed** — free to read under the NIH Public Access
Policy, which permits reading and citing but is not an open licence. The citation strings record this
distinction explicitly. Paraphrase-and-cite was the handling regardless, so the practical constraint
was unchanged, but the provenance row should not claim a licence the source does not carry.

### 26.2 The finding the section is built around

**"Dimensional alternatives" is not one position, and the four disagree with each other about what a
mental disorder is.** DSM categories, the AMPD's traits and HiTOP's spectra all keep the **common-cause
/ latent-variable** model — something hidden generates the symptoms — and argue only about its shape:
category, continuum, or (for RDoC) neural circuit. **Borsboom's network theory removes it entirely**:
symptoms cause each other, and the pathology *is* the set of interactions.

That matters pedagogically because **HiTOP and network models are routinely taught as allies against
the DSM while resting on incompatible premises.** Conway et al. concede only that the two are "not
necessarily mutually exclusive," which is a long way from having shown they fit. The section ends on a
five-row comparison table whose second column ("why symptoms co-occur") is where the fault line shows.

The second organising finding: **every one of the four is candid that it cannot yet do the DSM's job.**
RDoC is not a diagnostic system *by design* and Cuthbert says DSM codes will be needed for records and
insurance indefinitely; HiTOP awaits normative data and agreed cutoffs — the same practical thresholds
it faults the DSM for setting arbitrarily; network theory has no trial showing network-guided treatment
beats standard care. So the categorical model is **not so much defended by the evidence as left
standing by the absence of a deployable replacement.** Both halves are true at once, and the page now
says so in `## Contested` rather than implying a consensus that does not exist.

### 26.3 A gap closed in a section that had not declared one

Conway et al. report that **roughly 40% of the diagnoses examined in the DSM-5 field trials did not
reach the cutoff for acceptable inter-rater agreement.** The page's `## How reliable is a diagnosis?`
section had ended with an explicit promissory note — the textbook gives no kappa values, so the figure
"has to be sourced elsewhere." **It was prose, so no derived gap tracked it**; only the sentence itself
recorded the debt. It has been paid, with the citation qualified: this is a secondary characterisation
offered while arguing *for* an alternative classification, not the primary trial report, so the
proportion is flagged as indicative rather than exact.

This is §21's lesson in a second form. There, a stale treatment section had no declared gap. Here, a
*declared* debt sat in prose that `extract_page_needs()` cannot see. **Read the prose of the sections
you are already sourcing** — a page that says "sourced elsewhere" is asking, and nothing in the tooling
will ask on its behalf.

### 26.4 One source, two pages

`personality-disorders` carried an annotation asking for exactly "the DSM-5 Alternative Model for
Personality Disorders (Section III) **and why it was not adopted as primary**" — which Krueger & Hobbs
answers directly. Rather than leave it for a later pass, a **second job row** was written for the same
source against that target slug (one job per source-and-page pair, per §9) and the annotation narrowed
to its two remaining asks: the stability-over-time assumption, and label stigma in clinical services.

Worth noting what the answer is: **the reasons were political, and the model's authors say so** — the
work "proved to be fraught with political and practical complexities," the compromise was to print both
models, and the resistance came from psychiatry's need to "preserve the tradition of the medical model
as a basis for ensuring putative legitimacy." The corroborating detail is where the literature lives:
most AMPD research is in psychology journals, not psychiatry journals. **ICD-11 made the opposite call**
— types abolished outright, severity rating mandatory — so on personality the two manuals this corpus
elsewhere describes as *converging* have in fact diverged.

### 26.5 A mistake worth recording: a replacement that ate a heading

Building the section in four provenance-separated increments, step 3 replaced the anchor
`…arbitrarily.\n\n## Contested` with new text that **did not restore `## Contested`**. The heading was
deleted, and the whole Contested section was silently absorbed into
`alternatives-to-categorical-diagnosis`. Nothing errored. Step 4 then failed to match its own anchor
and inserted only a fragment, which is what surfaced it.

**Length deltas are a weak check and were not enough here.** Step 3's delta looked right because the
inserted block dwarfed the 12 characters removed. What caught it was querying
`extract_page_sections()` for the section *list* — `contested` was simply gone. **When a replacement
spans a heading, assert on the section list, not the character count**, and prefer anchors that sit
inside one section. The bad version was rejected rather than accepted-and-patched, so the page history
shows one clean accept per source.

### 26.6 State after

Major-tier gaps **14 across 10 pages → 13 across 9**; empty sections 65 → 64;
`diagnosis-and-classification` 16.4k → 37.1k chars, 8 sections, zero gaps, five sources in provenance.

---

## 27. The Lecture 8 block — `substance-intoxication` closes and seven catalogue pages get written

One sweep, **13 sources, 8 pages**: the foundation page `substance-intoxication` went from four declared gaps to zero, and the seven unwritten Lecture 8 catalogue slugs were written. Unwritten catalogue pages **10 → 3**; major-tier gaps **13 across 9 pages → 9 across 8**.

| Page | Sources |
|---|---|
| `substance-intoxication` | Sacak et al. 2021 (ED case series, CC BY-NC); Baldacara et al. 2024 (ABP consensus, CC BY) |
| `inhalant-use-disorder` | Radparvar 2023 (CC BY-NC-ND); Wu & Howard 2006 (NESARC, author ms) |
| `caffeine-related-disorders` | Bodur et al. 2024 (CC BY); Abdoli et al. 2024 (CC BY) |
| `hallucinogen-related-disorders` | Yildirim et al. 2024 (CC BY); Martinotti et al. 2018 (CC BY) |
| `sedative-hypnotic-anxiolytic-related-disorders` | Schmitz 2016 (CC BY-NC); Votaw et al. 2019 (author ms) |
| `tobacco-use-disorder` | Hartmann-Boyce et al. 2018 (Cochrane); Kirst et al. 2013 (CJPH, Canadian) |
| `pyromania` | Vaughn et al. 2010 (NESARC, author ms) |
| `kleptomania` | Grant & Chamberlain 2018 (author ms); Mangot 2014 (CC BY-NC-SA) |

### 27.1 The finding that generalises: what a source counts is not what the page is about

Three pages in this block turned on the same distinction, and it is the most transferable thing in the sweep.

- **`substance-intoxication`.** The only countable population is the one that reaches a hospital, and in a 1,344-case consecutive ED series **55.7% were intentional self-poisoning**, with psychiatric medications, NSAIDs and paracetamol together outweighing recreational substances and alcohol (21.0% and 8.3%). An emergency department measuring "acute intoxication" is largely measuring **[[suicide-and-self-harm]]**. The sex ratio inverts accordingly — men were 92.2% of recreational-drug cases and women 67.6% of intentional poisonings — so "the sex ratio for intoxication" has no answer until you say which intoxication.
- **`pyromania`.** A search for the diagnosis returns essentially **nothing**; what exists is research on **fire-setting**, the behaviour. NESARC gives 1.0% lifetime fire-setting with **OR 12.38 for antisocial personality disorder** and 71.7% alcohol use disorder, but measured the behaviour with a *single item* and reports **no count of people meeting pyromania criteria at all**. The page is built on the behaviour and says so.
- **`sedative-hypnotic-anxiolytic`.** Votaw et al. call inconsistent definitions of "misuse" the biggest limitation in the field, and demonstrate it: when NSDUH rewrote its definition in 2015, reported misuse of one's own prescription moved **14.1% → 21.8%** with no change in behaviour.

**Rule for the review pass:** before quoting a prevalence figure, ask what the denominator's recruitment channel was. Three of the eight pages here needed that caution stated in the text, not buried in a limitations line.

### 27.2 Evidence-base size, stated first — three worked cases

§19.6's rule earned its keep three times:

- **The Brazilian Psychiatric Association acute-intoxication consensus could not grade its own evidence** — not by Oxford, not GRADE, not AMSTAR — because "the literature is still scarce." It fell back on a three-round Delphi at a 65% threshold, and **only 52 of 102 proposed items cleared it.** Half of what a national specialist panel proposed could not command two-thirds agreement among the panel. The Treatment section on `substance-intoxication` is the best available guidance *and* expert opinion, and the page says both.
- **Inhalants:** one randomised trial exists, and it addresses comorbid psychiatric symptoms rather than the inhalant use. Everything else — baclofen, lamotrigine, buspirone, risperidone, aripiprazole — is case reports and case series, presented on the page as a table with an *evidence behind it* column rather than as a drug list.
- **Tobacco is the opposite pole and belongs in the corpus as the contrast case**: 136 trials, 64,640 participants, **RR 1.55 (1.49–1.61), GRADE high**, with the authors telling funders to stop running these trials. Reading `tobacco-use-disorder` beside `inhalant-use-disorder` is the cheapest way to show a student what "evidence base" means as a variable rather than a formality.

### 27.3 Two clinical inversions worth teaching

**Blood concentration does not define intoxication.** The consensus gives alcohol bands (>400 mg/dL = respiratory depression, coma, death) *and* a lethal dose of ~300 mg/dL in a non-tolerant person — a figure that sits **below** the severe band. That is not an inconsistency to reconcile; it is tolerance, and it is why a tolerant drinker's overdose risk rises rather than falls.

**The pharmacologically obvious drug is sometimes the one to avoid.** For HPPD, risperidone is what theory recommends — LSD is a partial 5-HT2 agonist, risperidone antagonises 5-HT2 — and in practice it **worsens** the visual disturbance and anxiety, probably via α2 presynaptic antagonism. Olanzapine exacerbated a case; haloperidol can worsen flashbacks early; sertraline has been reported both ways. A worked example for [[evidence-based-practice]] that mechanism does not substitute for outcome data.

### 27.4 Two mistakes, both caught by assertions rather than by reading

1. **A `replace()` spanning a heading deleted it.** Building `alternatives-to-categorical-diagnosis` (§26) the same session, an anchor ending `…\n\n## Contested` was replaced with text that did not restore the heading. Length deltas looked right. Only asserting on `extract_page_sections()`'s **section list** caught it. Recorded here too because the same pattern recurred as a temptation throughout this block.
2. **One version drew on two sources.** The first `kleptomania` version combined Grant & Chamberlain with Mangot under a single `job_id` — a provenance error, since `wiki_page_provenance` joins version→job and the page would have credited one source for both. Rejected and rewritten as two versions. **Note the side effect that cost a step: rejecting the only version of a new page returns `page_dropped: true` and deletes the shell**, so the page had to be recreated before re-proposing.

### 27.5 A measurement flaw in the tracking, found while counting

**`reference_worklist.annotation_count` only counts annotations on pages that still have derived gaps.** A page that closes its last `## Section` gap drops out of the view, and its `> **Needs research:**` markers stop being counted.

```
annotations via the worklist view:   33   (19 pages)
annotations actually in the corpus: 298  (139 pages)
```

Every annotation figure in this run plan and in the handoff — including §29a's "watch annotations, not just empty sections" and the handoff's "the rise 60 → 79 is the real signal" — has been reporting a **filtered subset**, not the corpus. The derived-gap tracking is unaffected and remains sound; what was wrong is the sense that the backlog is small. **More than half the corpus (139 of 259 pages) carries at least one in-prose research ask**, and closing the last major-tier derived gaps will not change that. Count annotations directly:

```sql
SELECT sum((length(content)-length(replace(content,'Needs research:','')))
           / length('Needs research:'))
FROM wiki_pages WHERE content IS NOT NULL;
```

### 27.6 Canadian content

`tobacco-use-disorder` carries the one Canadian source in the block (Kirst et al. 2013, two national surveys, n = 123,846 and 13,581): problematic alcohol and illicit drug use and mental health problems are all significantly more prevalent among current smokers, with effects **significantly larger among youth**. Its more useful contribution is a Canadian statement of a Canadian gap — the authors conclude that "not enough is known about the prevalence of various types of tobacco use co-morbidities among the Canadian population." Standing annotations were left on `inhalant-use-disorder` (volatile substance use among Indigenous youth in remote and northern communities — a recognised Canadian public-health problem absent from both sources) and `tobacco-use-disorder` (actual Canadian smoking prevalence, provincial and Indigenous breakdowns).

### 27.7 State after

Pages **252 → 259**; wikilinks 1,384 → 1,426; ingest jobs 154 → 169; unwritten catalogue pages **10 → 3** (`hypersomnolence-disorder`, `circadian-rhythm-sleep-wake-disorders`, `brief-psychotic-disorder`); major-tier gaps **13/9 pages → 9/8**; empty sections 64 → 68 (new pages carrying honestly declared gaps); off-catalogue red links **0** — three introduced during the sweep (`opioid-related-disorders`, `alcohol-related-disorders`, `placebo-effect`, `comorbidity`) were caught by the standing check and repointed at the real slugs.

---

## 28. The sleep bundle — and the catalogue closes

Six sources, four pages. `sleep-wake-disorders` lost its last gap, the two unwritten sleep slugs were written, and `brief-psychotic-disorder` was taken in the same pass because it was the only thing left.

**The catalogue is complete.**

```
catalogue rows          131
catalogue pages written 131   (0 missing)
distinct link targets   244
targets that resolve    244   (0 red links)
```

Every slug in `disorders` has a body, and **every wikilink in the corpus resolves** — 1,443 links, 244 distinct targets, nothing dangling. The red-link count has been a working signal since WP2; this is the first time it has been zero.

| Page | Sources |
|---|---|
| `circadian-rhythm-sleep-wake-disorders` (new) | Steele et al. 2021 |
| `hypersomnolence-disorder` (new) | Maski et al. 2021 (AASM guideline) |
| `sleep-wake-disorders` — `contested` closed | Steele et al. 2021; Maski et al. 2021 |
| `brief-psychotic-disorder` (new) | Correll et al. 2008; Fusar-Poli et al. 2017 |

Note the job pattern: **Steele and Maski each served two target pages**, so each needed **two job rows** — one per (source, target) pair, per §9. Four jobs from two sources.

### 28.1 The finding: a remission rate is a function of follow-up length

Two sources on `brief-psychotic-disorder` looked, on first reading, to contradict each other. Correll et al. (2008) report that **three of four** adolescents with brief psychotic disorder achieved full remission. Fusar-Poli et al. (2017) report that **54%** of 80 people with Brief Limited Intermittent Psychotic Symptoms developed a persistent psychotic disorder.

The reconciliation is in the failure function:

| Time from BLIPS | Transitioned |
|---|---|
| 3 months | 10% |
| 12 months | 19% |
| 24 months | 30% |
| **60 months** | **54%** |

**Correll's mean follow-up was 22.8 months** — the point on that curve where transition is around 30% and still climbing. The two studies are not in conflict; they stopped watching at different times. **A remission rate is not a property of a disorder, it is a property of the study's horizon**, and any claim that brief psychotic episodes are benign has to state the horizon it was measured over. This belongs in the review pass as a standing question alongside §21's "what is the newest source": **over what period was this outcome measured?**

Supporting detail worth keeping: 68% of the BLIPS cohort also met ICD-10 acute and transient psychotic disorder criteria, so the two literatures are substantially the same territory under different names; and prior studies of this population report **diagnostic instability of 23% to 87%**, a range wide enough to be a statement about the category rather than about the studies.

### 28.2 Sleep medicine does not use the DSM, and that closed the overview's `contested` gap

The gap asked, among other things, "whether sleep disorders belong in a psychiatric manual at all." The answer available from the sources is better than an argument — it is an observation about practice. **Steele et al. (2021), a contemporary review of the circadian disorders, defines every subtype by ICSD-3 and does not mention DSM-5 anywhere.** ICSD-3 recognises six circadian subtypes with their own duration criteria; the DSM handles the territory more coarsely. Add the fact already recorded on `diagnosis-and-classification` that **ICD-11 places sleep-wake disorders in Chapter 07, outside the mental and behavioural disorders**, and a student consulting three manuals gets three different answers about whether these are psychiatric conditions — while the specialty that treats them uses a fourth book.

The complementary finding from the AASM guideline: it makes recommendations for narcolepsy, idiopathic hypersomnia and Kleine-Levin syndrome and **none at all for psychiatric hypersomnia**, the evidence being "insufficient and inconclusive." The sleepiness most likely to present in a psychology clinic falls between two specialties' guidelines.

**Naming note recorded on the page**: DSM-5-TR's *hypersomnolence disorder* is sleep medicine's *idiopathic hypersomnia*, grouped with narcolepsy and Kleine-Levin as the *central disorders of hypersomnolence*. A student searching the DSM term will not find the literature.

### 28.3 Evidence-base size, again — and a clean comparison inside one guideline

§19.6 keeps paying. The AASM hypersomnolence guideline gives idiopathic hypersomnia **one strong recommendation (modafinil, moderate certainty) and four conditional ones, three of them at very low certainty**. The instructive part is the internal comparison: modafinil for idiopathic hypersomnia rests on **1 RCT plus 4 observational studies**; modafinil for **narcolepsy**, in the same guideline, rests on **9 RCTs plus 4 observational studies**. Same drug, neighbouring disorder, nine times the trial evidence.

The panel's own caveats are unusually candid and are quoted on the page: small samples throughout, older treatments "rarely evaluated using a randomized controlled trial design," and **"comparative effectiveness studies were virtually nonexistent."** So a recommendation table ranks what has been *tested*, which systematically disadvantages older and cheaper drugs. Whole populations are absent — no paediatric recommendations, pregnant and lactating women outside the review's scope, no postmarketing safety data for solriamfetol or pitolisant.

Steele et al. supply the matching verdict for the circadian disorders: treatment there "remains more as an **art-of-medicine approach** based on known aspects of circadian sleep–wake physiology rather than rigorous evidence." Light dose, melatonin timing, evening screen restriction, blue-light glasses and chronotherapy are all mechanism-led rather than trial-led.

### 28.4 A teaching table worth reusing

The single most transferable thing in `circadian-rhythm-sleep-wake-disorders` is that **light and melatonin phase-response curves are roughly 180° out of phase**, so both treatments reverse direction depending on when they are given:

| | Phase **advance** (earlier) | Phase **delay** (later) |
|---|---|---|
| **Light** | after core-temperature minimum (morning) | before it (evening) |
| **Melatonin** | 2–7 h before DLMO (evening) | biological morning |

A patient self-medicating melatonin at the wrong hour moves their clock the wrong way. Effective doses are also far below what is sold — **0.5 mg** for phase advance, with 0.1–0.3 mg producing physiological plasma levels.

### 28.5 State after

Pages **259 → 262**; wikilinks 1,426 → 1,443; jobs 169 → 175; **unwritten catalogue pages 3 → 0**; **red links 1 → 0**; major-tier gaps **9 across 8 pages → 8 across 7**; empty sections 68 → 72 and annotations 300 → 303, both rising because three new pages carry honestly declared gaps.

**What this means for sequencing.** Content is no longer the binding constraint. Eight major-tier gaps remain across seven pages (`illness-anxiety-disorder` ×2, `functional-neurological-symptom-disorder`, `adjustment-disorders`, `exhibitionistic-disorder`, `integrative-model`, `research-methods`, `elimination-disorders`), and after those the work is **WP4b's review pass** and **publishing** — which carries the `student-support-resources` verification obligation. The 303 in-prose annotations across ~140 pages (§27.5) are the long tail and are not going to be closed by this kind of sweep.
