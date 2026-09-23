# PSY240 Fall 2026 — term to-do

The running list of what the course still owes this term. **Read it at the start of any PSY240
session; tick items as they close, add new ones where they belong.** Newest context wins: if an
item here contradicts the live site, check the live site and fix the item.

Conventions: `[ ]` open · `[x]` done (add the date) · **HIGH** = blocks a lecture or a grade.
Deck files are `public/psy240/L<n>.html`, and **the file number is the database lecture number**
(midterm day is lecture 6), so `L7.html` is the lecture the deck itself calls "L6". Item pools with answer keys
live in `I:/My Drive/Teaching/Psy240/2026/Items/` and never enter the repo.

Calendar: Wednesdays 9:00–12:00, IB 120. L4 Sep 30 · L5 Oct 7 · **Midterm + RCT onboarding Oct 14** ·
L7 Oct 21 · (reading week Oct 28) · L8 Nov 4 · L9 Nov 11 · L10 Nov 18 · L11 Nov 25 · L12 Dec 2 ·
Guide freezes before the final Dec 8.

---

## Now (dated, next two weeks)

- [ ] **HIGH — the Sept 30 Guide freeze has no mechanism.** The syllabus and L4 ("The Guide
  freezes tonight", "locked until Oct 15") promise it. Nothing in either database or website.md
  implements a lock. The syllabus also promises "accepted contributions during a freeze are
  published after the test", which means acceptance and publication have to be separable. Decide:
  (a) procedural — Norm and TAs accept nothing Sept 30 → Oct 15 (submissions keep queuing), which
  delays feedback on the Oct 7 green contributions; or (b) build it — accepting a claim during a
  freeze window records the decision and holds the page edit until the window ends. The same
  freeze is needed again Dec 8 for the final.
- [ ] **HIGH — load Quiz 4** (`quiz_4.yaml`, 7 items, flatten the two-tier). Opens Sep 30 15:45Z;
  its late tier never opens, and it hard-closes with the first half on Oct 14 13:00Z.
- [ ] **HIGH — load Quiz 5** (`quiz_5.yaml`), opens Oct 7 15:45Z; full credit through Oct 13 and
  hard-close Oct 14 13:00Z; the quiz card must say the late tier never opens.
- [ ] L3 (Sep 23): run of show is ready; afterwards Stop/Done everything and close L2's stale
  `65:planned`. Preview #15 before class.
- [ ] L4 check-ins: only 1/20/40/99 exist. **Seed Exercise B's quiz check-in** (four somatic
  vignettes, midterm option list, two deliberately close: SSD vs illness anxiety). Its cases must
  not reuse midterm EMQ-01 stems. Decide whether Exercise A (DID argument) gets a prompt check-in.
- [ ] L4 closer: the `TODO(QotW)` comment. The week-4 QotW row exists as `planned`; check its text
  matches the lecture and remove the comment.
- [x] L4 slide 3's "Green contribution is due Oct 7" matches the syllabus (amber: Nov 11, Nov 27). (2026-09-22)
- [ ] Syllabus has onboarding 10:45–11:45; L4's closer says "then the RCT onboarding until 11:45".
  Consistent, but say 10:45 on the L5 closer.
- [ ] Before L4: Stop/Done L3's check-ins and open L4's #99 from the Plan tab. Leave the L3 QotW
  open (walls stay open all term).

## Midterm (Oct 14)

- [ ] Midterm assembly from `midterm_L1..L5.yaml` (sealed pools: L1 16 · L2 23 · L3 22 · L4 23 ·
  L5 21 scoreable). Re-check every EXCLUSION against the current page versions first; some flags
  may have been fixed since Aug 27, and some pages have been edited since the items were drafted
  (`page_version` in each item).
- [ ] Delivery: on students' own devices, 9:00–10:30. Confirm the platform path, accommodations
  (extra time) and a paper fallback.
- [ ] RCT onboarding 10:30–11:45: randomisation and baseline happen here, and it can't easily be
  made up. Say "bring the device you'll use for daily practice" in L4 and L5.
- [ ] A "how the midterm is built" slide in L5 (formats: MC, EMQ sets, stepped vignettes, VSA,
  spot-the-limitation). Use no real pool item as an example.
- [ ] Late tier: all first-half quizzes hard-close Oct 14 13:00Z. Announce it in L4 and L5.

## Field Guide — flagged findings awaiting correction

These are excluded from the item pools and must not be taught as stated. Fix the page, then
clear the exclusion in the YAML header.

- [ ] `what-is-abnormal` § the-cost-of-mental-illness: "$16 trillion by 2030" (likely $6T)
- [ ] `what-is-abnormal` § why-the-question-is-hard: Seligman "1996 APA presidency" (elected '96, served '98)
- [ ] `integrative-model` § comparative-evidence: two flagged findings on the Xiang analysis
- [ ] `models-of-psychopathology` § sociocultural: OCD earlier-onset-in-girls (direction likely reversed)
- [ ] `psychopharmacology` § two-populations: the deprescribing paragraph (Pottie provenance)
- [ ] `therapeutic-alliance`: the 55.6%-of-n=75 rupture figure (unverified)
- [ ] `diagnosis-and-classification`: "~40% of field-trial diagnoses below acceptable agreement" (secondary citation)
- [ ] `anxiety-disorders` § Epidemiology: "most common class in the course" contradicts `sleep-wake-disorders`' 30–50%
- [ ] `obsessive-compulsive-disorder` § Epidemiology: the 76%/41% comorbidity pairing
- [ ] `panic-disorder` § Canadian rates: "one third of Canadian adults… a panic attack in a given year" + the 1–2%
- [ ] `panic-disorder` § Treatment: the breathing-retraining rationale argues for what it rejects
- [ ] `selective-mutism` § Presentation: "speaking at home demonstrates no communication disorder"
- [ ] `social-anxiety-disorder` § Epidemiology: European median 2.3% sits above the 0.5–2.0% ceiling
- [ ] `specific-phobia` § Contested: the VRET non-inferiority sentence
- [ ] `tic-disorders` § Epidemiology: "0.3% vs 3 per 1,000" are the same rate
- [ ] `posttraumatic-stress-disorder` + `hpa-axis`: "the HPA axis releases epinephrine" (HPA → cortisol; epinephrine is the sympathetic/adrenal medulla route)
- [ ] `posttraumatic-stress-disorder` § Canadian rates: 76% × 8% ≈ 6.1%, not the 9.2% lifetime
- [ ] `posttraumatic-stress-disorder` frontmatter: Bryant 2019 + the Canadian sources undeclared (the DSM/ICD 42% and 636,120 figures ride on this)
- [ ] `trauma-and-stressor-related-disorders`: "the ONLY chapter where an external event is part of the diagnosis" (substance-related also requires exposure); "adjustment is the only one not requiring a trauma"
- [ ] `adjustment-disorders` § Etiology: the Kazlauskas quotation (undeclared) and the proximity/prior-experience dichotomy
- [ ] `illness-anxiety-disorder` § Etiology: the biased-thinking example, the perception-vs-interpretation claim, the Fergus/Asmundson + Leonidou quotations; § Contested: 411 studies vs a table totalling 105
- [ ] `functional-neurological-symptom-disorder` § Treatment: the Gilmour quotation (undeclared source, and the whole section leans on it) and the instruction-voice prognosis line
- [ ] `prolonged-grief-disorder` § Etiology: Prigerson & Maciejewski (2024) addiction model (undeclared; postdates the declared source)
- [ ] `somatic-symptom-and-related-disorders` frontmatter: 4–6% SSD prevalence (its own Epidemiology says there's no figure)
- [ ] `bipolar-i-disorder` § Epidemiology: 1.5% 12-month sits above the ~1% lifetime
- [ ] `bipolar-ii-disorder` § Epidemiology: Canadian-lifetime vs US-12-month comparison
- [ ] `major-depressive-disorder` § Treatment: "N=341 / 22.7%" (no whole number of 341 gives 22.7%)
- [ ] `electroconvulsive-therapy` § Guidelines: "every memory-sparing configuration costs efficacy" (contradicted by its own bifrontal row)
- [ ] `suicide-and-self-harm` § three-part model: Berman (2009) attribution carrying a Crosby et al. citation

## Field Guide — gaps worth opening (student contribution targets)

- [x] Amber: `anxiety-disorders` § Etiology, triple-vulnerability model (gap `dfb4b9c9`, opened 2026-09-22)
- [ ] Lucas's historical-traditions gap `6e85f149` is still unclaimed. Mention it in L3 (slide 3).
- [ ] Green: `panic-disorder`, nocturnal panic (in the L3 deck, absent from the Guide)
- [ ] Green: `specific-phobia`, the blood–injection–injury vasovagal response and applied tension (L3 deck)
- [ ] Green: `obsessive-compulsive-disorder` or `illness-anxiety-disorder`, the name "thought–action fusion" on the OCD page (Shafran et al., 1996)
- [ ] Green: `dissociative-amnesia`, the dissociative fugue specifier (the page says the source doesn't name it)
- [ ] Amber: `reactive-attachment-disorder` / `disinhibited-social-engagement-disorder`, the discredited "attachment therapies" (holding, rebirthing), and the Bucharest Early Intervention Project
- [ ] Amber: `emdr-versus-trauma-focused-cbt`, dismantling studies of the eye movements (L4 slide says it's a claimable gap)

## Item pools

- [ ] Quizzes 6–11 and final-exam pools for L7–L12 don't exist yet (only `quiz_1..5`,
  `midterm_L1..L5`). Draft them against published pages after each lecture's content pass,
  with the same disjointness and exclusion discipline.
- [ ] L1's position-2 quiz check-in key was fixed 2026-09-21; the L1 check-ins 2/20/40 still sit as
  `planned`. Harmless; clear them if they clutter the console.

## Decks (content passes against the 2025 decks)

- [x] L3: content pass, 32 sections (2026-09-22)
- [x] L4: content pass, 24 → 35 sections, promoted (2026-09-22)
- [ ] L4: Part one now carries 11 content slides before Break 1. If it runs long, move adjustment
  and prolonged grief (slides 11–12) after the break.
- [ ] L5–L12 content passes: in progress 2026-09-22 (see per-lecture notes below as they land)
- [ ] 2025 engagement material not usable until the Guide carries it: the Swissair volunteers table,
  the Air Transat amygdala study, *The Three Faces of Eve*, the Doug BDD video.
- [ ] Deck numbering: `L7.html`–`L12.html` call themselves "L6"–"L11" in their titles and kickers
  (the deck count skips the midterm) while the database and Lecture Lounge count it. Pick one
  convention before students notice the mismatch.
- [ ] Keep the deck-fit harness as `scripts/deck-fit.mjs` (it has been rebuilt by hand for every pass).

## Platform

- [ ] WeeklyWall: a friendly message when an insert is refused, instead of the raw RLS error.
- [ ] `get_session_bootstrap` anonymous-call log noise.
- [ ] `enroll_from_roster` permission-denied blips in the logs.
- [ ] Syllabus says contributions are 250–500 words; the submission form allows 60–400. Reconcile.
- [ ] Deep links: check the Reports tab shows page and gap links for every resolved report, not just
  Lucas's.

## Per-lecture notes

(Filled in from each deck's content pass: check-ins to seed, QotW text, exercises needing a quiz
check-in, Guide issues found.)
