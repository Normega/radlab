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
- [x] L5–L12 content passes, on dev for review (2026-09-22): L5 20→31 · L7 25→35 · L8 18→30 ·
  L9 20→31 · L10 17→30 · L11 17→30 · L12 20→31. All fit at three screen shapes. Promote after
  Norm's review; per-lecture follow-ups below.
- [ ] Every lecture from L5 on has an exercise with **no quiz check-in built**, and every closer has
  a `TODO(QotW)`. The QotW rows exist as `planned`; reconcile each deck's closer with its row.
- [ ] **RCT dates disagree across decks**: L7 "practice through November 17", L10 "post window
  Nov 18–24" and "day 28", L11 "post-questionnaire window closed yesterday (Nov 24)", syllabus
  "~Nov 18". Fix one schedule and make every deck match it.
- [ ] 2025 engagement material not usable until the Guide carries it: the Swissair volunteers table,
  the Air Transat amygdala study, *The Three Faces of Eve*, the Doug BDD video.
- [ ] Deck numbering: `L7.html`–`L12.html` call themselves "L6"–"L11" in their titles and kickers
  (the deck count skips the midterm) while the database and Lecture Lounge count it. Pick one
  convention before students notice the mismatch.
- [ ] Keep the deck-fit harness as `scripts/deck-fit.mjs` (it has been rebuilt by hand for every pass).

## Platform

- [ ] **Device clock skew breaks sign-in silently.** Danny Khan's Windows laptop (2026-09-23): each
  sign-in fired ~35 token refreshes in 4 s (one per ~80 ms) until the server rate-limited it (429).
  The client then made anonymous requests, `profiles.utoronto_verified_at` came back 406, and he
  was sent back to verify. His iPhone was fine all day. The signature is a laptop clock more than
  an hour off, so every fresh token looks expired. Fix: detect skew (compare `Date.now()` with the
  response `Date` header or the token's `iat`) and show "your device clock is off — turn on 'Set
  time automatically'" instead of looping; also cap the refresh retry. Find affected students:
  count `POST | 429` on `grant_type=refresh_token` in edge_logs.
- [ ] WeeklyWall: a friendly message when an insert is refused, instead of the raw RLS error.
- [ ] `get_session_bootstrap` anonymous-call log noise.
- [ ] `enroll_from_roster` permission-denied blips in the logs.
- [ ] Syllabus says contributions are 250–500 words; the submission form allows 60–400. Reconcile.
- [ ] Deep links: check the Reports tab shows page and gap links for every resolved report, not just
  Lucas's.

## Per-lecture notes

(Filled in from each deck's content pass: check-ins to seed, QotW text, exercises needing a quiz
check-in, Guide issues found.)

### L5 — Mood Disorders and Suicide (Oct 7)

Content pass 2026-09-22: 20 → 31 sections (branch `psy240/l5-content-pass`). Every tested L5 fact
now has a slide.
- [ ] **HIGH — Exercise A "Six people" (slide 14) needs its quiz check-in**: six EMQ-style vignettes.
  They must be invented. Pool EMQ MT-L5-EMQ-01 covers the same six-disorder differential, so don't
  reuse or paraphrase its stems. Only 1/20/40/99 exist today.
- [ ] Closer (slide 31): `TODO(QotW)` for week 5.
- [ ] Slide 4 "How the midterm is built" is optional; keep or cut. Before saying it aloud, confirm
  whether stepped vignettes allow going back (the item README says no back-navigation). Note the L5
  pool has no stepped vignette, although the README plans one.
- [ ] Support slide: "UTM Health & Counselling: Davis Building, room 1123" isn't on the Guide's
  support page (it gives 905-828-5255 only). Verify the room, or use the phone number.
- [ ] Guide `suicide-and-self-harm` front-matter says `lecture: 6`; it's taught in L5.
- [ ] Guide `mood-disorders` § Contested is stale (it quotes the bipolar pages at their old lengths);
  § Epidemiology says the source gives no MDD prevalence, but `major-depressive-disorder` gives ~7%.
- [ ] Guide `bipolar-i-disorder` and `bipolar-ii-disorder` front-matter is malformed YAML (`needs:
  [contested]` followed by list items; `sources:` key missing).
- [ ] Guide: suicide-attempt rates in bipolar differ (bipolar-i ~1/3 lifetime vs suicide-and-self-harm
  25–50%). Compatible, but align them.
- [ ] Gaps: green — "asking about suicide does not increase ideation" (`suicide-and-self-harm`);
  seasonal and peripartum specifiers plus light therapy (`major-depressive-disorder`). Amber — PMDD
  epidemiology/etiology/treatment/medicalization critique (all empty); cyclothymic etiology and
  treatment (empty); NSSI and Canadian data (`suicide-and-self-harm`); DMDD prevalence.
- [ ] Item rationales that go beyond the Guide: QZ-5-002 (why a fourth symptom is required for
  irritable-only mood) and QZ-5-005 ("premenstrual exacerbation of another disorder"). Tighten the
  rationale, or add the fact to the page before Quiz 5 is served.

### L7 — Sex, Gender, and Paraphilic Disorders (Oct 21; deck calls itself L6)

Content pass 2026-09-22: 25 → 35 sections (branch `psy240/l6-content-pass`).
- [ ] Check-ins exist 1/20/40/99. No exercise needs a quiz check-in (one activity only, because the
  RCT segment takes the last 45 minutes).
- [ ] Closer: `TODO(QotW)`. Draft or confirm week 7's question.
- [ ] Slide 30 says RCT practice runs "through November 17"; the syllabus says data collection ends
  ~Nov 18. Reconcile.
- [ ] Guide `exhibitionistic-disorder`: Course says onset before 18 while Etiology quotes Karpman's
  early-to-mid twenties; "much less common in women" sits beside a 2:1 survey ratio.
- [ ] Guide `ejaculation-and-orgasmic-disorders`: the antidepressant headline "30% to 73%" conflicts
  with its own table (from 3.9%). Say it's the across-study range.
- [ ] Gaps: green — behavioural treatment of premature ejaculation (stop–start, squeeze); amber —
  ICD-11 gender incongruence; flibanserin approval / responsive-desire model; a frotteuristic
  disorder page; psychological treatment of fetishistic/voyeuristic disorder.
- [ ] Guide front-matter tags these pages `lecture: 7` (the database number), not the deck's 6.
- [ ] Item pool (when written) must avoid: Masters & Johnson as the triphasic model (it's Kaplan's),
  squeeze/SSRIs for premature ejaculation (not in the Guide), and the flagged voyeurism 12%/4%,
  "67% of divorces" and Goerling & Wolfe passages.
- [ ] Corrected an existing slide: the desire → arousal → orgasm cycle is Kaplan's, not Masters
  and Johnson's.

### L8 — Eating and Sleep-Wake Disorders (Nov 4; deck calls itself L7)

Content pass 2026-09-22: 18 → 30 sections (branch `psy240/l7-content-pass`).
- [ ] The "Triage night" exercise (slide 29) needs its quiz check-in: four cases, one question each.
  Only 1/20/40/99 exist.
- [ ] Closer: `TODO(QotW)` for week 8.
- [ ] Removed unsupported deck claims: CBT-E as first line for adults and fluoxetine for bulimia (no
  Guide page supports either); CBT-I "beats medication long-term" (the Guide lists comparative trials
  as a gap). If Norm wants CBT-E taught, open it as an amber gap first.
- [ ] Guide `feeding-and-eating-disorders` § Epidemiology: "anorexia and bulimia ~10:1 female to
  male" vs anorexia's own 0.3–0.4% vs 0.1% (~3–4:1). Wrong.
- [ ] Guide `binge-eating-disorder`: Hudson's "three times more common than anorexia and bulimia"
  doesn't reconcile with its prevalence figures; "2–3× higher in women" vs the overview's "closer to
  even"; Treatment says antidepressants aren't supported while Contested says fluoxetine beat placebo.
- [ ] Guide `insomnia-disorder`: "spending more waking time in bed" reads as advice (CBT-I restricts
  time in bed); duration is 1 month (Roth) in one place and 3 months in Contested.
- [ ] Guide `parasomnias`: lists restless legs as a parasomnia (DSM-5-TR classes it separately).
- [ ] Guide front-matter: all eating and sleep pages still say `lecture: 6`.
- [ ] Gaps: green — anorexia DSM criteria and subtypes; insomnia disorder prevalence; OSA prevalence
  and the hypopnea definition; nightmare disorder. Amber — narcolepsy medication (sodium oxybate,
  modafinil); refeeding syndrome; CBT-E.
- [ ] Item pool (when written) must avoid: the 10:1 ratio, Hudson's 3×, insomnia duration, restless
  legs as a parasomnia.

### L9 — Substance Use and Impulse Control (Nov 11; deck calls itself L8)

Content pass 2026-09-22: 20 → 31 sections (branch `psy240/l8-content-pass`). Flags for this chapter
come from the `page_audits` table (verdicts 2026-08-22). That table is the authoritative flag store
for pages without an item pool.
- [ ] The "Draw the line" exercise (slide 30) needs its four-case quiz check-in. Only 1/20/40/99 exist.
- [ ] Closer: `TODO(QotW)` for week 9.
- [ ] Part one now runs 11 content slides, so re-plan the 11:00 pause (it now falls around slides 21–22).
- [ ] **Two provenance flags the deck still leans on**: `substance-use-disorder` § Contested (Volkow
  & Blanco 2023 undeclared; behind the remission-rates slide) and
  `substance-related-and-addictive-disorders` § Harm reduction (Kerr et al. 2017 undeclared; behind
  the Insite slide). Declare the sources before Nov 11, or soften those slides.
- [ ] Guide flags to fix:
  - `alcohol-use-disorder` / `substance-withdrawal`: 8% vs 15% withdrawal incidence; CIWA-Ar "ten
    items" lists nine
  - `opioid-use-disorder`: death and hospitalisation counts disagree; fentanyl 56% vs analogues 60%
  - naloxone described as a maintenance antagonist (confused with naltrexone) on
    `opioid-use-disorder`, `agonist-and-antagonist-medications` and `aversion-therapy`
  - `sedative-hypnotic-anxiolytic-related-disorders`: the lipophilicity rule its own diazepam example
    contradicts
  - `substance-intoxication`: the Istanbul "largest block" sentence
  - `cannabis-related-disorders`: "highest prevalence" superlative
  - `tobacco-use-disorder`: NNT 11–56 vs its own table's ~12–46
  - `gambling-disorder`: 30.2% suicide attempts; "social problems" as protective
  - `intermittent-explosive-disorder`: "up to three months"; the Psychology Today "highly effective"
    claim
  - `disruptive-impulse-control-and-conduct-disorders`: "medication does not treat any disorder"
  - `kleptomania` / `pyromania`: "the other impulse-control diagnosis"
  - `conduct-disorder`: "15 symptoms" but lists 14
  - `stimulant-use-disorder`: malformed front-matter
  - `substance-use-disorder` § Opponent-process: added after the audit, never audited
- [ ] Gaps: amber — FASD (`alcohol-use-disorder`); Canadian cannabis data after 2018; current and
  Canadian gambling prevalence; kleptomania treatment. Green — Canadian smoking prevalence;
  naltrexone and acamprosate for alcohol.
- [ ] Optional extra slides the Guide supports: HPPD/psychedelic harms; inhalants (sudden sniffing death).
- [ ] 2025 "RCT Debrief" material belongs in the Dec 2 deck (see L12 notes).

### L10 — Neurodevelopmental and Neurocognitive Disorders (Nov 18; deck calls itself L9)

Content pass 2026-09-22: 17 → 30 sections (branch `psy240/l9-content-pass`).
- [ ] The exercise "Six charts, one axis" (slide 29, six cases aged 4–84) needs its quiz check-in.
  Key it on fluctuating vs steady course and "who noticed, and when", **not** on the vascular
  staircase (the Guide doesn't support it). Only 1/20/40/99 exist.
- [ ] Closer: `TODO(QotW)` for week 10.
- [ ] Slide 2 says "Today is day 28". If Oct 21 is day 1, Nov 18 is day 29. The post window
  "Nov 18–24" appears only in the deck; reconcile it with the RCT schedule (see L7/L11 notes).
- [ ] Corrected existing slides where the deck outran the Guide:
  - the autism rise was explained as "broadened criteria"; the Guide leaves it open
  - ADHD "onset before 12"
  - Fragile X as "the commonest inherited cause"
  - Lewy bodies as the "third most common dementia"
  - an Alberta Sexual Sterilization Act note (it's in no Guide page)
  Consider softening slide 19's title too ("the pathology arrives before the symptoms").
- [ ] Guide `neurocognitive-disorders` § Epidemiology and the Alzheimer's front-matter: Alzheimer's is
  32% of over-85s while all-cause dementia is ~30% at 85 (a subset larger than its whole). §
  Treatment says there's "no treatment guidance at all for delirium", but `delirium` now has the HELP
  prevention evidence.
- [ ] Guide: the vascular "stepwise course" appears only in Contested, as an unsupported textbook
  contrast.
- [ ] Guide metadata: this chapter's pages say `lecture: 10`; `tic-disorders` says `lecture: 3`
  (probably intentional, since the L3 midterm pool tests it).
- [ ] Gaps: amber — eugenics and institutionalisation history (Alberta Act, Canadian source) and FASD
  (`intellectual-developmental-disorder`); the ascertainment-vs-incidence prevalence debate and the
  neurodiversity critique of ABA (`autism-spectrum-disorder`); reversion rates
  (`mild-neurocognitive-disorder`); Lewy body prevalence and rank. Green — structured phonics
  (`specific-learning-disorder`); tau/TDP-43 (`frontotemporal-neurocognitive-disorder`).
- [ ] Item pool (when written) must avoid: the vascular stepwise signature as a discriminator, a
  Lewy prevalence rank, a DSM ADHD onset age, any cause for the autism trend.

### L11 — Personality Disorders, Clinical Psychology and the Law (Nov 25; deck calls itself L10)

Content pass 2026-09-22: 17 → 30 sections (branch `psy240/l10-content-pass`).
- [ ] Check-ins: 1/20/40/99 exist. The disposition-hearing exercise (slide 22) needs its Review Board
  vignette and a response check-in. Optionally, turn "Must, may, or no duty?" (slide 28, a room
  vote) into a second, quiz-style check-in.
- [ ] Closer: `TODO(QotW)` for week 11.
- [ ] The deck says the "post-questionnaire window closed yesterday" (Nov 24); the syllabus puts the
  end of data collection ~Nov 18. Reconcile it with the RCT schedule (and L7's "through November 17").
- [ ] Corrected an existing slide: Canada has no Tarasoff-style duty. *Smith v. Jones* is a
  permission to disclose. The new slide 21 teaches this. Norm, check the Ontario law slides (Form 1,
  Box A/B, CYFSA s.125 reporting, Starson, Gladue). They're sourced to `law-and-ethics`, but law
  deserves a human read.
- [ ] Guide: `antisocial-personality-disorder` and `narcissistic-personality-disorder` both claim
  "the chapter's largest" prevalence discrepancy; `schizotypal`'s is wider than both.
- [ ] Guide `law-and-ethics`: the Canadian-law "Needs research" block still lists Form 1 as missing
  (it's covered); Form 1 is described twice, inconsistently ("mental illness" vs "mental disorder";
  detention from arrival vs from Form 42).
- [ ] Guide `histrionic-personality-disorder` § Treatment: the goal "identify their dependency and
  become more self-reliant" reads like dependent PD's. Check it against the source.
- [ ] Guide `categorical-vs-dimensional-personality-models`: schizoid 4.9% vs 3.1% "reverses rank
  order" is unclear.
- [ ] Gaps: amber — Canadian fitness to stand trial (`law-and-ethics`, US standard only); Canadian
  insanity/NCRMD content on `insanity-defense-standards`; outcome evidence for Gladue/restorative
  justice. Green/amber — Canadian deinstitutionalisation timeline. Green — psychopathy vs ASPD.
- [ ] Item pool (when written) must avoid: the "largest discrepancy" claims, the histrionic treatment
  goal, and any Canadian fitness-to-stand-trial fact.

### L12 — Psychosis and Schizophrenia (Dec 2; deck calls itself L11)

Content pass 2026-09-22: 20 → 31 sections (branch `psy240/l11-content-pass`).
- [ ] Check-ins: 1/20/40/99 exist. The deck notes still mention a check-out at position 90 on the
  "Thank you" slide, but check-outs were retired ("no check-outs, QR on every closer"). Fix the
  note, or seed one.
- [ ] Closer: `TODO(QotW)` for the final week's question. The closer is titled "in four dates" but
  doesn't list four.
- [ ] Slide 26 placeholder "[Results land here on the night]": fill in the real RCT figures the
  weekend before. Adapt the 2025 "RCT Initial Results" slides (Day, Day×PrePost, Group×Day, "which
  worked best?") once the data is in.
- [ ] 2025 had a "Case Study Assignment" (a different Rachel); the syllabus has none this year.
  Confirm it's dropped.
- [ ] Before Break 1 now runs ~16 content slides (~75 min). If it's long, move slide 15 or 17 after
  the break.
- [ ] Typo in Break 2's notes: "Septembers-you".
- [ ] Guide `brief-psychotic-disorder` § Prognosis: "60% vs 4.8%" remission vs "three of four
  remitted"; "5 / 19.4%" should be 19.2% (5 of 26).
- [ ] Guide `psychosis-and-the-schizophrenia-spectrum` § Epidemiology: says brief psychotic disorder
  "remains unwritten". The page exists, so the note is stale.
- [ ] Guide `positive-and-negative-symptoms`: "six are listed" but it lists five (repeated on the
  Module 12 page).
- [ ] Guide `antipsychotic-medications`: "Thorazine and chlorpromazine" listed as two drugs (they're
  the same drug).
- [ ] Guide `delusional-disorder` § Contested: schizophrenia lifetime prevalence 0.48–1% vs 0.3–0.7%
  everywhere else.
- [ ] Guide `rachel-integrative-case`: "three question sets" but there are four.
- [ ] Gaps: amber — `schizophrenia` § Etiology prenatal/infection risk and the cannabis–onset link;
  `antipsychotic-medications` clozapine/treatment resistance and metabolic effects;
  `schizoaffective-disorder` and `schizophreniform-disorder` Etiology and Treatment (both empty);
  `expressed-emotion` measurement and cross-cultural variation. Green — the deleted DSM subtypes
  (`schizophrenia` § Contested); jumping-to-conclusions and aberrant salience (`delusions`).
- [ ] Item pool (when written) must avoid: the brief-psychotic remission percentages, 0.48–1%, and
  "six negative symptoms".
- [ ] Attenuated psychosis syndrome has no Guide page, so it has no slide.
