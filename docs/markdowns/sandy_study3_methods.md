# Sandy Study 3 — Methods & Analysis Log

Running record of every data-handling and analysis decision, maintained for reportability
and computational reproducibility. Updated after each step. Companion to
[`sandy_study3_prereg.md`](sandy_study3_prereg.md).

- **Study**: Perfectionism and Effort Allocation in Multi-task Performance (Sandy Study 3)
- **Platform study id**: `f8cbf629-d477-4ada-ae47-23a59c602b13`
- **Source export**: `I:\Shared drives\Sandy\Study3\Data\PilotSandy Study 3_study_export.zip`
  (generated from `/admin/export`; 12 CSVs; 385 KB)
- **Analysis environment**: R 4.6.0, Python 3.13 (pandas 2.3.3, numpy 2.3.5, scipy 1.16.3)
- **Status**: Step 1 complete (data review). Steps 2–6 pending.

> **Pilot firewall.** The pilot is used *only* to estimate nuisance parameters (variances,
> zero rates, reliabilities, ICCs, distribution shapes, feasibility). No pilot analysis
> estimates an effect size for any preregistered hypothesis: no trait→outcome association
> and no condition→outcome contrast is computed at any point. This is enforced structurally
> in the extraction code (§Step 3) and is why the pilot can precede registration without
> circularity (prereg §3.5).

---

## Decision index (D1–D19)

The preregistration was cleaned of inline decision markup on 2026-08-11 so that it reads as
a formal document; the decisions are absorbed into its prose and summarised in its
Appendix B. The numbered index below is retained here as the audit trail, and is what the
`D<n>` references throughout this log point to.

| # | Decision | Date / source |
|---|---|---|
| D1 | H1B's three-way interaction (discrepancy × rumination × condition) demoted to exploratory; H1B is two 2-way moderations, one per trait | 2026-08-04, power rationale |
| D2 | Sampling is Prolific post-secondary students (resolving a UTM-vs-Prolific contradiction in the working doc) | 2026-08-04 |
| D3 | State affect uses the built single-item sliders, not PANAS state subscales; PANAS is trait-battery only; the "Brief Inventory of Perceived Stress" reference is dropped | 2026-08-04 |
| D4 | `multRepl` is sourced from `zCompositions`, not `compositions` | 2026-08-04 |
| D5 | Random intercepts only; `(Task \| id)` random slopes are unidentified with 2 obs/cell | 2026-08-04 |
| D6 | Two-tailed p-values plus a sign requirement, rather than one-tailed tests | 2026-08-04 |
| D7 | H1C's primary test is the scalar entropy-based concentration index; Dirichlet regression is secondary. "More time on each image" is not jointly possible under a fixed budget | 2026-08-04; confirmed by pilot zero structure |
| D8 | H1B is an ANCOVA on post-ColourMax NA with the post-Aptitude (pre-feedback, pre-framing) rating as baseline covariate | 2026-08-04 |
| D9 | No pre-ColourMax affect sliders; the post-Aptitude ratings serve as the ColourMax baseline. Consequence: three affect timepoints, so H3B is a three-point trajectory model | 2026-08-04, Norm |
| D10 | No manipulation-check item; the framing is enacted by the score displays themselves. Intention-to-treat throughout | 2026-08-04, Norm |
| D11 | The vestigial `condition` assignment slot stays; participant-invisible and ignored in analysis | 2026-08-04, Norm |
| D12 | Target N = 300 valid sessions, set by the simulation-based power analysis | 2026-08-11, Norm |
| D13 | Singular random-intercept fits in H2A/H2B are anticipated and reported, not re-specified | 2026-08-11 |
| D14 | Scale scoring reads `questionnaires.definition.scoring.subscales[]`; item-level `reverse` flags are null throughout and must be ignored. Burnout = mean of the 23 BAT-C core items | 2026-08-11 |
| D15 | Five-item pre-consent screener, all items required, **no "unsure" option**. The platform supports a third state (Zerin's distress item uses one), but that exists because a phase-2 questionnaire follows and can adjudicate an ambivalent answer. With no phase 2 there is nowhere for "unsure" to resolve to, so it would be an unresolvable state rather than a kindness | 2026-08-13, Norm |
| D16 | Eligibility is **not** enforced through Prolific custom prescreening. A Prolific prescreener is itself a small paid study with its own completion path, which would mean running a second study to gate the first. The criteria are stated in the Prolific listing instead, and enforced by the in-session screener at session entry. Accepted cost: a screened-out participant has already taken a slot, so the screen-out page asks them to return the submission | 2026-08-13, Norm |
| D17 | Aptitude per-subtask time is derived from **focus**, and stays exploratory. The three subtasks are on screen simultaneously, so unlike ColourMax there is no navigation act to log; focus is the only observable signal and it bounds engagement rather than measuring attention. The interaction-derived `task_switch_count` (which the pilot and power analysis rest on) is reported separately and not merged with it | 2026-08-19 |
| D18 | Test accounts are excluded via the enrolment's `is_test` flag as criterion 0, ahead of every behavioural criterion. Enrolment status cannot identify them, because genuine participants withdraw too. Exports predating the column read as “none flagged” and remove nobody | 2026-08-19 |
| D19 | The pilot/confirmatory boundary is the **enrolment date**, declared per run via `SANDY3_COHORT_START`, and a confirmatory run refuses to start without it. Nothing in the data separates the two cohorts — same study id, same Prolific id pattern, both real participants — and the pilot ran the pre-2026-08-11 instrument, so its percentiles are not on the same scale | 2026-08-19 |

Build items B1–B3 were withdrawn or resolved (per D9, D10, D11). B4 (export field
verification) completed 2026-08-06. B5 (Word Probe recalibration and redemption-score fix)
completed and verified live 2026-08-11 — see Step 7.

---

## Step 1 — Data review against the preregistration

**Date**: 2026-08-11. **Scripts**: `inventory.py`, `inventory2.py`, `inventory3.py`,
`inventory4.py` (to be committed to the analysis repo as `scripts/01_inventory.py`).

### 1.1 Cohort identification

The export contains all participants ever enrolled in the study, including development
and simulated runs. Cohorts are separable by `participant_id` format:

| Cohort | n | `participant_id` form | Enrolled |
|---|---|---|---|
| **Prolific pilot** | **22** | 24-char hex (Prolific PID) | 2026-08-04 (6), 2026-08-06 (16) |
| Internal/dev | 34 | `SIM_*`, null, or platform anon ids | 2026-06-16 → 2026-07-28 |

Of the 22 Prolific enrolments: 21 have step timings, **20 have a complete session**
(both games, all seven questionnaires, all state ratings, reached debrief). The analysis
cohort is therefore **N = 20**, which matches the intended pilot size.

Condition balance in the complete cohort: **12 redemption / 10 control** (`framing` slot).
All 20 have exactly one `framing` draw; none missing. Neither game was replayed by any
participant (max 1 session each), so no first-attempt rule is needed.

### 1.2 Where each preregistered variable actually lives

Every variable named in prereg §4 is present in the export. Sourcing is **not** what the
prereg assumed in three places (flagged ⚠).

| Prereg §4 variable | Source table | Key / filter | Status |
|---|---|---|---|
| Framing condition | `participant_assignments` | `node_id='framing'` | ✔ 20/20 |
| APS-R, BAT-Student, PANAS, RRQ, GSE, DASS-21, SCS-26 | `questionnaire_responses` | `questionnaire_slug`, `responses` jsonb | ✔ 20/20 each |
| Stress (T0/T1/T2) | `vas_responses` | `scale_id=14f70c02…` (slug `stress`, emoji_6) | ✔ 3/participant |
| Task satisfaction (×2) | `vas_responses` | `scale_id=667755b1…` (slug `task-satisfaction`) | ✔ 2/participant |
| Negative / positive emotionality (T0/T1/T2) | `questionnaire_responses` ⚠ | slug `slider_negative_emotionality` / `_positive_` | ✔ 3/participant |
| Predicted efficacy (×2), post efficacy (×2), effort (×2) | `questionnaire_responses` ⚠ | corresponding `slider_*` slugs | ✔ 2/participant |
| Aptitude subtask scores + percentiles, `avg_pct`, task switches | `aptitude_sessions` | `game IS NULL` | ✔ 20/20, no missing |
| ColourMax coverage/precision per image, `avg_pct` | `aptitude_sessions` ⚠ | `game='color_max'`, `results` jsonb → `scores[]` | ✔ 20/20 |
| **ColourMax time per image** | `aptitude_events` ⚠⚠ | reconstructed from `page_switch` | ✔ (see §1.3) |
| Demographics | `equity_census_responses` | `responses` jsonb | ✔ 20/20 |
| Session/step durations | `participant_step_timings` | `study_id` | ✔ 21 participants |

⚠ **Sliders are questionnaires, not VAS.** Single-item sliders are stored as rows in
`questionnaire_responses` with their own slug, not in `vas_responses`. Only the two
6-point emoji scales (stress, task-satisfaction) are true VAS rows. The prereg's §4
parenthetical slugs are correct as identifiers but imply the wrong table.

⚠ **ColourMax lives in the Aptitude tables.** There is no `color_max` table. ColourMax
writes a row to `aptitude_sessions` with `game='color_max'` and per-image results in the
`results` jsonb, and its events to `aptitude_events` with `task='color_max'`. Aptitude
Suite rows are identified by `game IS NULL` (not by a positive label).

⚠ **ColourMax rows carry no `study_id`** (null on all 52 rows in the export; the game's
insert never sets it). Study linkage must go through `user_id` → `study_enrollments`.
Aptitude Suite rows do carry `study_id` on 44/76. *Platform note for Norm: worth setting
`study_id` on the ColorMax insert so future exports are study-scoped without a join.*

### 1.3 ColourMax time-per-image is derivable, but only from the event log

This is the most consequential methods finding. The H1C dependent variable (time on each
of five images) is **not stored as a field**:

- `results.toolTimeByPage` is **brush-contact time** — accumulated only between pointer-down
  and pointer-up, per tool. It is not dwell time and must not be used for H1C.
- Dwell time is reconstructible from `aptitude_events`: the game logs `page_switch` with
  `value = {from, to}` and a wall-clock `elapsed_ms`, bracketed by `session_start`
  (elapsed 0) and `game_end`. The initial page is 0 (`pageRef = useRef(0)`), and `goPage`
  early-returns on self-switches, so the segment sequence is complete and unambiguous.

**Validation on the 20-participant cohort**: reconstructed dwell totals sum to
mean 301.0 s (SD 1.9; range 300.2–308.9) against a nominal 300 s cap — i.e. the
reconstruction closes to the true budget for every participant. Page switches:
median 4, range 1–13.

*Caveat carried forward*: `elapsed_ms` is wall-clock while the in-game countdown is a
`setInterval`, which browsers throttle in background tabs. Across the full export
(including dev sessions) reconstructed totals ranged up to 21,894 s, i.e. a backgrounded
tab. No pilot participant showed this, but the confirmatory pipeline will normalise to
within-person proportions (as prereg §4 already specifies, using each participant's actual
total rather than the nominal 300 s) and will flag any session whose total falls outside
290–320 s.

### 1.4 Questionnaire scoring keys

Scoring keys live in `questionnaires.definition.scoring.subscales[]` — with `item_ids` and
`reverse_items` — **not** on the item objects (item-level `reverse` is null everywhere,
which is a red herring). Verified correct against the published instruments:

- **APS-R** (23 items, 1–7): Discrepancy = 12 items, no reverse ✔ (matches prereg)
- **RRQ-Rumination** (12 items, 1–5): reverse = `rrs_6`, `rrs_9`, `rrs_10` ✔ — the three
  negatively-worded items ("I don't waste time rethinking…", "I never ruminate…", "It is
  easy for me to put unwanted thoughts out of my mind")
- **SCS-26** (26 items, 1–5): Self-Judgment, Isolation, Over-Identification fully reversed ✔
- **BAT-Student**, **GSE**, **PANAS**, **DASS-21**: no reverse items ✔

Two deviations from the prereg text, both requiring a prereg edit:

1. ⚠ **BAT-Student is 33 items, not 23.** The platform administers the full instrument:
   BAT-C core = Exhaustion (8) + Mental Distance (5) + Cognitive Impairment (5) +
   Emotional Impairment (5) = 23; plus BAT-S secondary = Psychological Complaints (5) +
   Psychosomatic Complaints (5) = 10. The preregistered burnout predictor ("total mean,
   core dimensions") will be the **23 core items**; the 10 secondary items are exploratory.
2. The platform's stored `method` for APS-R is `sum`, the prereg says mean. Immaterial
   (predictors are z-scored; sum and mean are a linear rescaling) but the analysis code
   uses **mean** per the prereg, and states so.

### 1.5 The `_participant_master.csv` is not usable as an analysis table

It is retained for provenance only. Three independent problems:

1. **Cross-study contamination.** Profile-strategy tables have no `study_id`, so the master
   carries columns from unrelated studies for participants who were in more than one —
   `phq4_*`, `maia2_*`, `barqr_*`, `farm_joy_*`, `stillwater_*`, `word_max_*` all appear.
   (This is the known limitation documented in `website.md` §28a.)
2. **Occurrence suffixes are not aligned across participants.** The `_t<n>` suffix counts a
   slug's administrations *in that participant's own history*, not its position in this
   session. A participant who took APS-R in an earlier study has this study's APS-R landing
   in `apsr_t2`/`apsr_t3`/`apsr_t4` (all four exist in the file) while another's is `apsr_t1`.
   Column-wise pooling would silently mix administrations.
3. **No ColourMax per-image data** — the master has no path to the `results` jsonb.

**Decision**: the analysis dataset is built from the long tables with explicit study and
session scoping, ordering repeated measures by `completed_at`/`responded_at` *within the
study session window*, never by the master's `_t<n>` columns.

### 1.6 Data-quality observations (marginal only — no hypothesis-relevant associations)

- **ColourMax zeros are structural, not noise.** 9/20 participants (45%) left ≥1 image with
  zero dwell time; 13/20 (65%) left ≥1 image with zero coverage. This vindicates prereg
  decision **D7** (entropy-based concentration index as the primary H1C test, which is
  defined at zero without imputation) and makes the Dirichlet secondary analysis genuinely
  dependent on the `multRepl` detection-limit choice.
- **The H1C concentration index is well behaved**: mean 0.255, SD 0.167, range 0.015–0.577,
  skew +0.25. Approximately symmetric; the prereg §5.2 transformation rule (|skew| > 2)
  will not trigger.
- ⚠⚠ **Word Probe's percentile curve is mis-calibrated** (see §1.8) — median displayed
  percentile 0 against 56 (anagram) and 60 (fluency). This deflates `avg_pct`, the number
  the manipulation is built on, and inflates the H2C variance DV.
- ⚠⚠ **The redemption arm's "new overall score" exceeds 100** for 13/20 participants
  (see §1.9).
- **Session length is ~30 minutes, not 45–60.** Summed step durations: median 30.0 min,
  mean 31.7, IQR 28.0–35.0. Longest steps: Aptitude Suite 8.8 min, ColourMax 5.3 min,
  questionnaire battery ~11.5 min total. The prereg's stated duration and the Prolific
  pay rate should be revised.
- ColourMax session integrity: 20/20 have non-null `results`, `session_end`, and `avg_pct`.
  (Across the full export 7/52 sessions lacked `game_end`; all were dev sessions.)

### 1.8 Word Probe percentile calibration (measurement defect)

All three Aptitude subtasks map a raw score to a displayed percentile through the same
logistic, `logisticPercentile(score, midpoint, k)` in `src/games/AptitudeSuite/constants.js`,
which returns a hard 0 whenever `score <= 0`. Two of the three are well calibrated against
the pilot; the third is not.

| Task | midpoint | k | score needed for p50 | observed median score | observed median percentile |
|---|---|---|---|---|---|
| Anagram | 5 | 0.55 | 5 | 5.5 | **56** |
| Fluency | 7.5 | 0.45 | 8 | 8.5 | **60** |
| Word Probe | 15 | 0.12 | 15 | **0** | **0** |

Word Probe awards `7 − n_guesses` per solved word (guess 1 = 6 points … guess 6 = 1), so
the 15 points needed for the median require roughly **4–7 solved Wordles** inside an
8-minute budget shared with two other tasks. Observed raw-score distribution across the
20 pilot participants: **0 (×14), 1, 2, 3, 4, 13, 17**.

Consequences:

1. **`avg_pct` — the number the whole manipulation rests on — is deflated by roughly a
   third.** Participants are instructed to "aim for the top 10%" and the cohort averaged
   the 39th percentile (mean 39.2, median 36.5). The predicted-vs-observed gap that the
   score-feedback display presents is therefore systematically inflated by an artifact.
2. **H2C's DV is contaminated.** With one subtask pinned at 0 and two near 50–60, the
   within-person SD across the three percentiles (observed mean 36.4) largely encodes
   *how well the other two went*, not uneven effort allocation. The preregistered
   `mean_percentile_z` covariate does not fully absorb a structural floor.
3. **Recalibration alone is necessary but not sufficient.** 70% of participants scored
   exactly 0, and no monotone rescaling can discriminate within a tied group. Making Word
   Probe informative additionally requires partial credit (e.g. points for letters
   revealed, or for reaching ≥3 greens in a round) so that effort moves the score without
   a solve.

Illustrative recalibrations (`midpoint`, `k`) mapping scores 0/2/4/6/10/15/20/30:

- `mid=4, k=0.30` → 0, 35, 50, 64, 85, 95, 98, 99
- `mid=6, k=0.22` → 0, 29, 39, 50, 70, 87, 95, 98
- (anagram, for reference: 0, 16, 36, 63, 93, 99, 99, 99)

### 1.9 Redemption score display (manipulation-integrity defect)

The redemption arm's ColourMax display reads: *"Because this was a bonus round, your new
overall score is {{game.color_max.redemption_score}}"*, where `redemption_score` is
precomputed in `SessionEntry.jsx` as **`aptitude_suite.avg_pct + color_max.avg_pct`** —
the arithmetic *sum* of two percentiles (`website.md` §24a).

Across the 20 pilot participants that quantity has median **114.8**, max **169.7**, and
**exceeds 100 for 13/20**. Participants who have just been told they are ranked against
others and should aim for the top 10% are shown a "score" of, e.g., 169.67.

This sits at the exact centre of the experimental manipulation. Risks: it undercuts the
credibility of the percentile cover story, may cue participants that the feedback is
fabricated (compromising the deception the debrief is written around), and adds
interpretation noise to every post-ColourMax rating.

A mean rather than a sum would be coherent and still delivers a substantial apparent gain,
because ColourMax scores far higher than Aptitude in practice (ColourMax `avg_pct`
mean 70.6 vs. Aptitude 39.2): a participant at 39 would see roughly 55 as their revised
standing — an improvement that is both credible and visible.

### 1.10 Open issues raised for discussion

Carried to the message accompanying this step; recorded here so the log is self-contained.

| # | Issue | Bearing | Needs Norm |
|---|---|---|---|
| I1 | Word Probe percentile mis-calibration (§1.8) | Manipulation fidelity; H2C DV; possible build change | **yes** |
| I2 | Redemption score displayed as a sum > 100 (§1.9) | Manipulation integrity; possible build change | **yes** |
| I3 | Analysis repo location (blocked from creating `F:\gits\sandy_study3`) | Step 6 | **yes** |
| I4 | Merge structure — one wide table vs. related tidy tables | Step 2 | **yes** |
| I5 | Session ~30 min vs. 45–60 min stated | Prereg §2/§3 and Prolific pay rate | no — will edit prereg |
| I6 | BAT-Student 33 items vs. 23 stated; core 23 scored | Prereg §4 measures table | no — will edit prereg |
| I7 | Sliders live in `questionnaire_responses`, not `vas_responses` | Prereg §4 wording | no — will edit prereg |
| I8 | H1C DV requires event-log reconstruction; no stored field | Prereg §4 indices + analysis code | no — documented §1.3 |
| I9 | ColourMax rows lack `study_id`; Aptitude logs no task-switch event | Platform hygiene; blocks per-task dwell as an H2C alternative | no — noted for platform |
| I10 | Effort ICC ≈ 0 (−0.18) → the H2A/H2B random-intercept model will be singular | Prereg §5.1 H2A/H2B model form | **yes** |
| I11 | ~~1/340 rating writes silently lost~~ **RETRACTED 2026-08-19** — no write was lost; it was a client-clock/time-window artefact in my own ETL (see Step 8) | Prereg §5.6 corrected | no |
| I12 | Stress floor (45% at scale minimum at T0) trips the >30% boundary rule | Prereg §5.2 → Tobit + ordinal refits indicated | no — already prespecified |
| I13 | Word Probe target word not logged on failed rounds | Blocks retrospective partial-credit validation | no — noted for platform |

---

## Step 1b — Follow-ups on the two defects (2026-08-11)

### Would partial credit rescue Word Probe?

Norm asked what partial credit would do to the distribution. **Letter-level credit
cannot be back-computed from the pilot**: the target word is logged only for *solved*
rounds (`round_solve`'s value is the winning guess); a failed round logs the sixth wrong
guess, and an in-progress round logs nothing terminal. Green/yellow counts are therefore
unrecoverable for exactly the rounds partial credit would score. *Going forward, logging
the answer and per-guess green/yellow counts on `round_fail` would make this checkable.*

What the pilot **can** answer is whether the zero-scorers were engaged — which decides
whether any scoring change helps:

- 14/20 scored exactly 0. Of those, **11 submitted at least one valid guess** (median 4;
  one made 25). Only **3 never guessed at all**. 9/14 made ≥3 valid guesses and 5/14
  completed at least one full six-guess failed round.
- So the modal zero-scorer was **actively trying and receiving nothing** — the worst case
  for a study about effort and its feedback.

Schemes computable from the existing log, with the midpoint retuned to the resulting scale:

| Scheme | median pct | mean pct | at zero | distinct values | knock-on Aptitude `avg_pct` |
|---|---|---|---|---|---|
| current (mid 15, k .12) | 0 | 8.6 | **14/20** | 7 | mean 39.2 |
| +1 per valid guess (mid 8, k .25) | 32 | 42.1 | 3/20 | 10 | mean 50.4 |
| +2 per failed round (mid 6, k .30) | 20.5 | 24.4 | 9/20 | 7 | mean 44.5 |
| 2×solve + 1 per guess (mid 10, k .20) | 27 | 40.0 | 3/20 | 12 | mean 49.7 |

Recommended: **2×solve + 1 per valid guess**, because "+1 per valid guess" alone inverts
the speed incentive (solving on guess 1 scores 6+1=7, the same as solving on guess 6 at
1+6=7, and only one point above failing outright at 0+6=6). Doubling the solve bonus keeps
the ordering strictly monotone — solve-on-1 = 13, solve-on-6 = 8, fail = 6 — while giving
partial credit for genuine attempts. It also lands overall `avg_pct` near 50, where a
percentile-feedback task should sit.

### Revised redemption rule (Norm's decision)

`shown = max(aptitude_pct, mean(aptitude_pct, colourmax_pct))` — the mean, floored so a
"redemption" can never lower the participant's standing.

| | old (sum) | new rule |
|---|---|---|
| median | 114.8 | 57.4 |
| max | 169.7 | 84.8 |
| exceeding 100 | **13/20** | **0/20** |

The floor binds for 1/20 (the one participant whose ColourMax percentile fell below their
Aptitude percentile); they are shown no change rather than a loss. Mean apparent gain
15.9 points (median 17.2, max 28.4) — a visible, credible improvement.

---

## Step 2 — De-identified analysis dataset

**Script**: `scripts/02_build_dataset.py`. **Shape** (Norm's choice): wide primary table
plus two long tables.

| File | Rows | Grain |
|---|---|---|
| `data/participants.csv` | 21 × 95 cols | one per participant |
| `data/ratings_long.csv` | 343 | participant × rating occasion |
| `data/images_long.csv` | 100 | participant × ColourMax image |
| `data_raw/_crosswalk.csv` | 21 | pid ↔ profile_id (**gitignored, never committed**) |

**De-identification.** Prolific IDs and profile UUIDs stay in `data_raw/`, which
`.gitignore` excludes wholesale. Participants are relabelled `P01…P21`, ordered by a
salted SHA-256 of the profile id so the label sequence carries no enrolment-time
information. Free-text equity-census fields (`*_other`, `*_specify`, `feedback`) are
dropped; only closed-response categories survive. All absolute timestamps are dropped —
only within-session durations remain.

**Study scoping.** `questionnaire_responses` and `vas_responses` carry no `study_id`, so
rows are admitted only if the participant appears in this study's `participant_step_timings`
*and* the response falls inside that participant's session window (first step entry to last
step exit + 5 min tolerance). This replaces the master table's unreliable `_t<n>` suffixes.

**Repeated measures are labelled by administration order** within the session, mapped to
the delivered 34-step sequence: stress/negative/positive affect → T0, T1, T2;
predicted efficacy → pre_AS, pre_CM; experienced efficacy, effort, satisfaction →
post_AS, post_CM. Rows where `serves_as_pre_cm` is true are the T1 readings that prereg
**D9** designates as the ColourMax affect baseline.

**Result**: **20 of 21 analysis-ready** (11 redemption / 9 control). The excluded
participant did not reach the debrief. No missing values on any key analysis variable.

### ⚠ New finding: rating writes can silently fail

P06 completed all 34 steps and reached the debrief, and their step-timing row shows the
post-ColourMax `vas_stress` step was presented and answered in 2.8 s — but **no row exists
in `vas_responses`**. Every other rating for that participant landed.

Rate: **1 of 340 expected rating writes lost (0.29%)**. This falsifies prereg §5.6's claim
that "item-level missingness within completed steps is structurally impossible." The
prereg needs a real missing-data rule for state ratings; §5.6 will be revised. Same class
as the swallowed-error pattern in the repo's CLAUDE.md (a failed insert logged to
`console.warn` and never surfaced), though at 0.3% it is not analysis-threatening.

---

## Step 3 — Nuisance-parameter extraction

**Script**: `scripts/03_nuisance_params.py` → `output/nuisance_params.json`,
`output/nuisance_report.txt`.

**Firewall enforced in code.** `condition` is `pop()`ed off the frame before any statistic
is computed, so no H1 effect size can be produced even accidentally. A `guard()` function
raises on any attempt to correlate a trait predictor, or pre-task predicted efficacy, with
an outcome — i.e. every quantity that one of the 17 confirmatory tests estimates. What the
pilot is permitted to supply: dispersion, distribution shape, ICC, covariate–outcome
correlations, predictor intercorrelations, reliability, and zero structure.

### Parameters that matter, and what they imply

**Reliability is excellent** — APS-R Discrepancy α = .928, RRQ Rumination α = .925,
BAT core-23 α = .951. Attenuation from trait measurement error is therefore modest; the
limiting reliability is the single-item slider DVs, which cannot be estimated from one
administration.

**⚠ Trait predictors are strongly intercorrelated**: discrepancy–burnout **r = .711**,
discrepancy–rumination .528, rumination–burnout .460 (VIFs 1.41–2.26). The prereg's
VIF > 5 trigger will not fire, but H2C's three trait coefficients are substantially
confounded, inflating their standard errors by roughly 1.2–1.5×. This is now built into
the power simulation rather than assumed away.

**⚠ Effort ratings have a ceiling and near-zero between-person consistency.**
`effort_post_AS` mean 86.4 with 25% exactly at 100; `effort_post_CM` mean 83.9, skew
−2.69, 20% at ceiling. ICC across the two administrations is **−0.18** (satisfaction
−0.09). A negative ICC means the two effort ratings share essentially no between-person
variance, so `effort ~ trait + task + (1|id)` will estimate a zero random-intercept
variance and return singular fits. See Open issue I10.

**⚠ Stress has a floor**: 45% of participants sat at the scale minimum at T0 (20% at T1,
32% at T2). This *does* trip the prereg's ">30% at a boundary" rule, so the Tobit
sensitivity analysis and the prespecified ordinal (`clm`) refit are both indicated for
stress DVs.

**Affect ICCs support the H3 models**: positive affect .865, stress .597, negative
affect .459 across the three timepoints.

**Covariate strengths**: cor(NA_T1, NA_T2) = .474 (the H1B baseline adjustment removes
~22% of outcome variance); cor(Aptitude mean pct, Aptitude SD) = .288 (the H2C forced
covariate).

**ColourMax composition**: mean time proportions by slot **[.380, .318, .119, .094, .088]**
— a steep position gradient, with images 1–2 absorbing 70% of the budget. Method-of-moments
Dirichlet precision s = 10.4. Concentration index mean .255, SD .167, skew .25.

**Feasibility**: session median 30.8 min (IQR 28.4–35.3).

---

## Step 4 — Power simulation design

**Script**: `R/04_power_simulation.R` (R 4.6.0; `MASS`, `lme4`, `lmerTest`, `jsonlite`).

**The whole 17-test family is simulated jointly**, so Benjamini–Hochberg power is evaluated
as it will actually be applied (prereg §5.3) rather than test-by-test. Each replicate
generates one complete study, fits all 17 preregistered models, applies BH across the 17
p-values, and records which survive.

Design choices:

- Traits are drawn multivariate-normal with the **observed** trait correlation matrix, and
  pre-task predicted efficacy is drawn correlated with discrepancy at the observed
  r = −.625, so H2C and H3A inherit their real collinearity penalty.
- Outcomes are generated on a latent scale with pilot means/SDs and then **censored the way
  the instruments censor them** — sliders clipped to 0–100 (reproducing the effort
  ceiling), stress rounded and clipped to the 6-point emoji scale (reproducing its floor).
- Effect sizes come **only** from a swept grid, never from the pilot: main effects are
  parameterised as partial correlations, interactions as the difference in trait slope
  between arms (Δr), swept over δ ∈ {.15, .20, .25, .30, .35, .40} × N ∈ {150, 200, 250,
  300, 400}.
- H1A/H1B/H1C/H2C are `lm`. For H2A/H2B/H3A the trait predictors are between-person and
  the design is balanced, so the coefficient test is algebraically identical to a
  regression on person means; the script **validates this against `lmer`** before use
  (agreement confirmed: .930 vs .945 power at 200 replicates). H3B's time × discrepancy
  term is within-person and is fitted with `lmerTest::lmer` directly.
- A δ = 0 cell provides a Type-I / BH false-positive check.

## Step 5 — Power analysis results and prereg integration

**Scripts**: `R/04_power_simulation.R` (2,000 replicates × 5 sample sizes × 6 effect
sizes), `scripts/05_power_summary.py`. **Outputs**: `output/power_grid.csv`,
`output/power_null.csv`, `output/power_summary.txt`.

**Runtime optimisation, validated.** A first run was on track for ~2.5 h because H3B's
`lmer` fit dominated. Under a random-intercept model the person intercept is constant
within person, so the time × discrepancy contrast is carried entirely by within-person
variation and is reproduced by regressing each person's OLS time-slope on discrepancy.
`R/_validate_h3b_shortcut.R` confirms this against `lmerTest` across ICC .2/.5/.8 and
δ ∈ {0, .25}: power agreement within .006 (e.g. .970 vs .967), cor(log p) ≥ .96, and
**58× faster**. The same person-mean equivalence for the between-person predictors in
H2A/H2B/H3A is validated inline at every run (.930 vs .945).

**Type-I control** at δ = 0: uncorrected rejection .052, BH rejection .004.

### Detectable effect at 80% BH-corrected power

| Test family | N=150 | N=200 | N=250 | N=300 | N=400 |
|---|---|---|---|---|---|
| H1A framing × trait | >.40 | >.40 | .38 | .34 | .30 |
| H1B framing × trait | >.40 | .37 | .33 | .30 | .26 |
| H1C framing × trait | >.40 | >.40 | .37 | .34 | .29 |
| H2A/H2B trait main | .26 | .23 | .20 | .18 | .16 |
| H2C variance | .33 | .28 | .25 | .23 | .20 |
| H3A anticipatory | .32 | .28 | .25 | .23 | .20 |
| H3B trajectory | .20 | .18 | .16 | .15 | .15 |

Findings:

- **H1 is the binding constraint.** Δr = .30 — a large moderation — needs N ≈ 300 (H1B) to
  400 (H1A, H1C). A typical Δr ≈ .20 would need N ≈ 800.
- **H2 and H3 are comfortable.** H3B is the most efficient test in the family (r = .18 at
  N = 200) because three timepoints make the within-person contrast cheap; H2A/H2B reach
  r = .23 at N = 200 even with the effort ceiling.
- **BH is nearly free** — 1–4 points of power at N ≥ 200, δ ≥ .25. Trimming the
  confirmatory family to buy power would gain almost nothing.
- The earlier analytic estimate in the prereg (Δr ≈ .38 detectable at N = 200) was
  slightly optimistic; the simulation puts it beyond .40 once BH, censoring and trait
  collinearity are included.

**Prereg updated**: §3.4 rewritten around the simulation; §3.5 rewritten as a completed
pilot with the firewall described; new decisions **D12** (N = 300), **D13** (singular-fit
rule for H2A/H2B), **D14** (scoring-key source). Also corrected: BAT-Student item count
(§4), slider storage location (§4), ColourMax time reconstruction (§4 indices), session
duration (§3), missing-data rule (§5.6).

## Step 6 — Reproducible repository

**`F:\gits\sandy_study3`** — git-initialised, first commit `a8ae1d4`.

```
README.md                  orientation, reproduction steps, firewall description
docs/prereg.md             preregistration (synced from the radlab repo)
docs/methods.md            this log
scripts/01_inventory.py    pilot data review
scripts/02_build_dataset.py  raw -> de-identified tables
scripts/03_nuisance_params.py  nuisance parameters, firewall enforced
scripts/05_power_summary.py    power tables
scripts/scoring_keys.json  scoring keys exported from the platform
R/04_power_simulation.R    joint 17-test power simulation
R/_validate_h3b_shortcut.R validation of the fast path
data/                      participants.csv, ratings_long.csv, images_long.csv
data_raw/                  platform export + crosswalk — GITIGNORED
output/                    nuisance params, power grid, summaries
```

**Verified**: `git ls-files data_raw` returns 0 files. A regex sweep of all three
de-identified tables for UUID and 24-hex Prolific-ID patterns returns no matches; no
absolute timestamps and no free-text demographic fields survive.

---

## Step 7 — Both defects fixed and verified (2026-08-11)

Norm approved **N = 300** and both code fixes.

### Word Probe — partial credit + recalibration

- `src/games/AptitudeSuite/hooks/useWordProbe.js`: every valid guess now earns **+1**, so
  genuine attempts move the score without a solve. The solve bonus doubles to
  `2 × (7 − guesses)`.
- `src/games/AptitudeSuite/constants.js`: `WORDPROBE_MIDPOINT` 15 → **10**,
  `WORDPROBE_K` 0.12 → **0.20**.

Per-round totals are `n + 2(7 − n) = 14 − n` for a solve on guess *n*, against 6 for a
failed round — strictly decreasing in guesses used, and always above failing:

| outcome | solve@1 | @2 | @3 | @4 | @5 | @6 | fail |
|---|---|---|---|---|---|---|---|
| points | 13 | 12 | 11 | 10 | 9 | 8 | 6 |

*(An assertion in the verification script initially fired here — it had encoded the
per-round total as `1 + 2(7−n)`, forgetting that each of the n guesses earns its own
point. The scheme was correct; the check was wrong. Worth recording, because the wrong
formula would have shown solve-on-6 = 3 < fail = 6, i.e. rewarding giving up.)*

### Redemption score

`src/pages/SessionEntry.jsx`: `redemption_score` changes from
`aptitude_pct + colourmax_pct` to `max(aptitude_pct, mean(aptitude_pct, colourmax_pct))`.

### Verification — replay against the real pilot log

`scripts/06_verify_fixes.py`. The replay first reconstructs the **old** score from
`aptitude_events` and checks it against the stored `wordprobe_score`: **20/20 exact
matches**, so the reconstruction is trusted before evaluating the new scheme.

| | before | after |
|---|---|---|
| Word Probe stuck at percentile 0 | 14/20 | **3/20** |
| Word Probe median percentile | 0 | **31** |
| Word Probe distinct percentile values | 7 | **12** |
| Aptitude `avg_pct` (mean / median) | 39.2 / 36.5 | **50.4 / 47.3** |
| subtask median percentiles (ana/flu/wp) | 56 / 60 / 0 | **56 / 60 / 31** |
| redemption value above 100 | 14/20 | **0/20** |
| redemption value (median / max) | 130.2 / 184.3 | **65.1 / 92.2** |
| participants shown a decrease | — | **0/20** (floor guarantees it) |

`npm run build` clean.

**Trade-off worth naming**: fixing Word Probe raises the Aptitude baseline from ~39 to
~50, which *shrinks* the apparent redemption from a mean of 15.9 points to **10.9**
(median 8.2, max 27.8) because ColourMax (~70) is now a smaller jump from a higher floor.
That is the correct trade — the inflated gain was an artefact of a broken subtask — and
what matters for H1 is the contrast between arms, not the absolute size, since the control
arm still receives no revision at all. Flagged in case the manipulation should be
strengthened another way.

**Scale break**: raw `wordprobe_score` is on a new scale from 2026-08-11. Pilot and
main-study values must not be pooled. Recorded in `website.md` §22.

---

**Re-identification risk closed (2026-08-11).** `participants.csv` originally carried nine
closed-response demographic fields (age, gender identity, race/ethnicity, sexual
orientation, Indigenous identity, disability, trans identity, parent education,
racialized) which are jointly identifying in a 20-person table. Row-level demographics are
now **never written to any versioned file**. `02_build_dataset.py` §6 emits only
`output/demographics_summary.txt`: age as median and range, and category counts with
**cells below 5 suppressed** as a total rather than printed, so the sample can still be
described without disclosing intersections. `participants.csv` is now 21 × 86 (was 21 × 95)
and contains no `dem_*` column. Nothing downstream used them — `03_nuisance_params.py`
re-runs unchanged.

---

## Step 8 — Preregistered analysis code, and a retraction (2026-08-19)

**Location**: written to `I:\Shared drives\Sandy\Study3\Scripts\`; **moved into the analysis
repository at `<repo>/analysis/` on 2026-08-19 — see Step 11**. (R; `run_all.R` orchestrates
`00_config` → `05_exploratory`.) Runs from the `/admin/export` zip with no manual
preprocessing. Independently audited by a sub-agent against the pilot export.

### 8.1 Retraction: there was no write loss

**Issue I11 is withdrawn.** The pilot did *not* lose a rating write. All 340 expected
writes are present.

What happened: `vas_responses.responded_at` is stamped by the **participant's own device**,
while `participant_step_timings` is server-stamped. One pilot participant's clock ran
**265 seconds slow** (uniform across all five of their VAS rows, SD 0.9 s). My Python ETL
scoped ratings to a time window built from step timings, so that participant's first stress
rating fell before `t_start` and was dropped. Worse than the loss itself: occasion was then
assigned by rank order, so every later reading for that measure shifted up a slot — their
T1 was silently relabelled T0 and their T2 became missing.

Verified by matching each of that participant's five VAS rows to the step that presented
it: five steps presented, five rows written, offsets −264 to −266 s.

At N = 300 this would have hit roughly 5% of participants (1 of 21 in the pilot), silently
corrupting the H3 trajectory for each. It is the most consequential defect found in this
whole build, and it was in *my* code, not the platform's.

**Fix**: ratings are no longer scoped by time at all. Each rating row is matched to its
`participant_step_timings` row — server-clocked, study-tagged — by within-participant rank,
and the timepoint comes from the step's position. The pipeline now reports 0 of 340 lost,
and a genuine missing row is distinguishable from a clock offset because the integrity check
compares steps *presented* against rows *written*.

Prereg §5.6 and Appendix B corrected. The missing-data rule stands, because genuine write
loss remains possible; the reported rate does not.

### 8.2 The firewall had to be built twice

The first version inferred `PILOT_SAFE_MODE` from whether the export path contained
"pilot". The audit showed that failed for the documented default invocation (`Rscript
run_all.R`), where the path is the *Data directory* and the pilot zip is only discovered
later inside `read_export()` — so the registration's central commitment was one careless
command from being void. It now **fails closed**: safe mode is on unless
`SANDY3_CONFIRMATORY=true` is set explicitly.

A second gap: redaction initially applied only at the CSV writer, so `confirmatory` and
`MODELS` still held every estimate in memory and one `View()` would have breached it.
`redact_in_memory()` now runs after 04/05 (which legitimately need the fitted objects) and
clears the estimates from the tables and releases the models.

A third: the effect-size columns added for §5.3 (`std_beta`, `ci_lo`, `ci_hi`, `f2`) were
not in `INFERENTIAL_COLS`, and reached disk. That list is now deliberately over-inclusive,
with a comment saying why.

**Note for the confirmatory run**: I did run the confirmatory family on the pilot once,
before the firewall existed, and saw the results. They are not recorded anywhere and the
analysis plan was already registered and locked, so no analytic choice was made in light of
them — but it is on the record here rather than not.

### 8.3 Other defects found by the audit and fixed

| # | Defect | Fix |
|---|---|---|
| 1 | §5.4 criterion 3 excluded on zero *score*, not zero *responses* — a participant who tries everything and scores nothing was dropped from all 17 tests (one pilot participant scored 1 across 25 logged responses) | Engagement now counted from `aptitude_events` response events |
| 2 | Criterion 6 (dwell reconstruction) gated H1A and H1B, which do not use dwell | Now gates H1C only; `h1c_analysis_ready` is separate |
| 3 | Exclusion table counted each criterion independently, so one participant failing five criteria read as five exclusions | Counts are now sequential, as §5.4 requires |
| 4 | §5.2 transformation rule fitted the transformed model but never made it confirmatory (the rule *fires* on the pilot) | Transformed fit replaces the row and BH is recomputed across all 17 |
| 5 | Winsorized BH ran over the 8 least-squares tests alone, not the 17-test family | Winsorized p-values substituted into the 17-vector, adjusted once |
| 6 | §5.3 standardized β, 95% CI and f² were not produced at all | Added for every confirmatory coefficient |
| 7 | DASS-21 and PANAS scored as means, not the published sums | Sums (DASS ×2), prorated for partial completion |
| 8 | Unordered `slice(1)` when picking a game session | Ordered by `session_start` |

### 8.4 The one platform-logging gap — closed in Step 9

*(Written 2026-08-19; closed the same day by Step 9, which added the missing events. The finding is kept as written because it is what motivated the instrumentation.)*

**Aptitude Suite per-task time cannot be derived.** Prereg §4.4 names "time per task" and
§5.7 names per-task time allocation as exploratory. The Aptitude Suite emits no
task-switch event — only `solve`/`skip`/`wrong_guess`, `submit_*`, `guess_*`, `round_*` —
so there is nothing to bracket. `task_switch_count` is stored on the session row, but the
transitions are not. ColourMax has exactly the counterpart needed (`page_switch`).

Everything else in §4 is logged and derived: verified column by column, non-missing for all
20 analysis-ready participants, including all 100 per-image ColourMax rows.

### 8.5 Data-quality signal to watch at launch

The §5.5 positive control **fails for the Aptitude Suite** (ColourMax passes) in the pilot.
§5.5 makes that a stop-and-investigate before interpreting any hypothesis test. The Word
Probe scoring defect (14 of 20 scoring exactly zero, fixed 2026-08-11) is a plausible cause
and it may clear, but this should be checked on the first ~30 confirmatory participants
rather than at the end.

---

## Step 9 — Closing the Aptitude timing gap (2026-08-19)

Step 8.4 found the one measure the preregistration named but the platform did not log:
per-subtask time within the Aptitude Suite. This step adds it.

### 9.1 Why it is not a ColourMax analogue

The obvious move was to copy ColourMax's `page_switch`. That turns out not to transfer.
ColourMax shows **one image at a time**, so moving between images is a navigation act with an
unambiguous before and after, and logging it is exact. The Aptitude Suite renders all three
subtasks **simultaneously** in a three-column grid — there is no navigation, and therefore no
event to log.

What remains observable is **focus**: which subtask holds the keyboard. That is a weaker
signal, and the weakness is not fixable by better instrumentation — a participant can read
one box while another holds focus. So per-subtask time is recorded as a bound on engagement,
not a measurement of attention, and it stays exploratory (prereg §5.7) however cleanly it
patterns (D17).

### 9.2 What was added

Four event types on `aptitude_events`, and a migration widening the `task` CHECK constraint
to accept `'aptitude_suite'` for the session-scoped ones:

| Event | Task | Purpose |
|---|---|---|
| `session_start` | `aptitude_suite` | Opens the timeline (ColourMax already had this) |
| `game_end` | `aptitude_suite` | Closes the final focus segment |
| `task_focus` | the subtask | Focus acquisition, valued `{from, to}` |
| `window_blur` / `window_focus` | `aptitude_suite` | Time outside the window, subtracted |

The blur pair matters more than it looks. Without it a participant who tabs away for four
minutes has that time charged in full to whichever subtask last held focus, which would be
the single largest source of error in the measure.

`task_switch_count` was deliberately **left untouched**. It is interaction-derived, it is what
the pilot and the power analysis were built on, and changing its definition mid-study would
break continuity with both. The focus-derived transition count is a separate column.

### 9.3 Two implementation traps

**The wrappers that did nothing.** The first attempt wrapped each subtask box in a
`display: contents` div carrying `onFocusCapture`. It produced zero rows. A DOM probe
confirmed the wrappers rendered correctly, which was misleading — the fault was in the
*test*, which dispatched a non-bubbling `focus` event. React's synthetic `onFocus` is built
on `focusin`. Re-testing with `focusin` produced a clean chain on the first run:

```
anagram    {"from":null,       "to":"anagram"}      88686
wordprobe  {"from":"anagram",  "to":"wordprobe"}    90860
fluency    {"from":"wordprobe","to":"fluency"}      94845
anagram    {"from":"fluency",  "to":"anagram"}      97861
```

Dwell is the gap between consecutive events: 2174, 3985, 3016 ms against held intervals of
2000, 3000, 2500. The lesson is that a negative result from a synthetic-event test is not
evidence of a broken handler until the event type is the one React actually listens for.

**Window listeners catch bubbling element focus.** The same flawed test produced four
spurious `window_focus` rows, because a bubbling `focus` event reaches `window` and the
listener could not tell it from the window genuinely regaining focus. Real element focus does
not bubble, so this was an artefact — but the failure mode is real, and an away-interval that
never happened would be subtracted from a dwell segment. Both listeners now check
`e.target === window`.

### 9.4 Analysis side

`01_load_and_build.R` gains `reconstruct_apt_focus()`, mirroring the ColourMax reconstruction:
segments run focus-to-focus, closed by `game_end`, with blur intervals subtracted. A blur never
followed by a focus runs to the end of the session rather than being dropped. It yields
per-subtask dwell, a transition count, a lead-in before first focus, total away time, and the
same zero-safe entropy concentration index used for H1C — here 1 − H/log(3).

Verified by `_validate_apt_focus.R`, which checks the function against a hand-computed
timeline (13 assertions, all passing), including the open-blur case and the pilot case of no
`task_focus` events at all, which must return NULL rather than error. The pilot export runs
unchanged through the full pipeline: 21 enrolled, 20 analysis-ready, 17/17 critical terms,
write loss 0 of 340.

### 9.5 A second gap found while cleaning up

The test account created to verify all this exposed something worse than itself: **the R
pipeline had no `is_test` filter**. The platform export has carried the flag for some time and
even ships a codebook note telling analysts to exclude it — the analysis code simply never
read it. A staff test account would have entered the confirmatory sample carrying fabricated
ratings, caught only by the `RESTRICT_TO_PROLIFIC_IDS` heuristic, which is not a guarantee and
would not hold for non-Prolific recruitment.

Now exclusion criterion 0, ahead of every behavioural criterion, because these were never
participants (D18). The test enrolment was flagged `is_test` and annotated rather than
deleted, and its participant link revoked.

### 9.6 Verified, and not

Confirmed live, through a real participant session against the dev server: `session_start`,
`task_focus` (all four transitions, correct `{from, to}` payloads and plausible gaps),
`window_blur`, `window_focus`, and the CHECK constraint accepting `'aptitude_suite'`.

**Not separately exercised: `game_end`.** It fires only on timer expiry (8 minutes), demo mode
is disabled in study mode, and navigating away to reach a shortened standalone run ended the
token session. It is the same `logEvent('aptitude_suite', ...)` call on the same constraint
path as `session_start`, which did write — so it is verified by identical path, not by
observation. Worth confirming on the first confirmatory participant, where its absence would
show as `apt_has_game_end = FALSE`.

---

## Step 10 — Launch readiness check (2026-08-19)

Asked to confirm the study was ready to run on the full sample. Most of it was; one thing
was not, and it would not have announced itself.

### 10.1 The blocking defect: nothing separated the pilot from the confirmatory sample

The preregistration has said since §3.1 that the pilot "will not be pooled with the
registered sample." The commitment existed. The **enforcement did not**.

The pilot participants were recruited on Prolific into the *same study id*. Their ids match
`PROLIFIC_ID_RE` exactly like every future participant, their enrolment status is identical,
and `is_test` is false because they were real participants. `RESTRICT_TO_PROLIFIC_IDS` — the
only cohort filter in the pipeline — keeps every one of them. So
`SANDY3_CONFIRMATORY=true Rscript run_all.R` over a full export would have silently analysed
20 pilot participants as confirmatory data, and nothing in the output would have said so.

**A second reason makes this substantive rather than procedural**, and it holds regardless of
what the registration says: the pilot ran a *different instrument*. The Word Probe
recalibration (midpoint 15 → 10, k 0.12 → 0.20) and partial credit, and the floored
redemption score, all shipped in `1b00da7` on 2026-08-11 — after the pilot sessions of 08-04
and 08-06. Under the old curve 14 of 20 pilot participants scored exactly zero on the Word
Probe. Those percentiles are not on the same scale as the registered sample, and the
redemption manipulation is computed from them. Pooling would have distorted the Aptitude
distribution and the manipulation built on top of it.

### 10.2 The fix, fail-closed

`SANDY3_COHORT_START` (a date) now bounds the cohort, and a confirmatory run **refuses to
start without it** — the same posture as `PILOT_SAFE_MODE`, and for the same reason: a
safety property that depends on remembering a flag is not a safety property. In pilot/safe
mode it is optional and, unset, keeps everything, which is what reproducing the pilot needs.

All three paths were exercised:

| Invocation | Result |
|---|---|
| Pilot default, no boundary | unchanged — 21 enrolled, 20 analysis-ready |
| `SANDY3_CONFIRMATORY=true`, no cohort start | **refused**, with the reason |
| Boundary 2026-08-20, safe mode | dropped all 31 pre-cutoff, then stopped — correct today, since no confirmatory participant exists yet |

### 10.3 What was verified live in production

Not inferred from the repo — fetched from `radlab.zone` and checked in the deployed bundles:

- `AptitudeSuite-CT-Efx6z.js` contains all six instrumentation markers (`task_focus`,
  `aptitude_suite`, `window_blur`, `window_focus`, `session_start`, `game_end`).
- The recalibrated curve is live and the old one is gone: `k = .2` and midpoint `10` present,
  `.12` and `15` absent.
- Partial credit is live: `2*(7-c.length)`.
- The floored redemption score is live in `SessionEntry-COD2g5OC.js`:
  `redemption_score:+Math.max(n…`.

Note for future checks: `git branch -r --contains 1b00da7` does **not** list `origin/main`,
which looks alarming and is not. That commit reached main by another route, so its patch-id
differs — the caveat CLAUDE.md already records about `git cherry` overstating things. The
file contents on `origin/main`, and the deployed bundle, are the authority.

Study record: `active`, external enrolment on, screener attached.

### 10.4 Carried into launch as watch items, not blockers

- **The §5.5 positive control fails for the Aptitude Suite** in the pilot (§8.5). The Word
  Probe defect is a plausible cause and may now clear, but §5.5 makes this a
  stop-and-investigate before interpreting any hypothesis test. Check it on the first ~30
  participants, not at the end.
- **`game_end` has not been observed** (§9.6). It would show as `apt_has_game_end = FALSE`,
  and per-subtask dwell would lose its final segment.
- **The first confirmatory export should be spot-checked for `task_focus` rows** before
  relying on the per-subtask columns at all.

---

## Step 11 — The analysis code joins the repository (2026-08-19)

The registered analysis pipeline lived on the shared drive at
`I:\Shared drives\Sandy\Study3\Scripts\`, outside version control, while the analysis
repository held the pilot prep, the de-identified tables and the power analysis. The one
piece of code that produces the study's *results* was the piece with no history, no way to
tell which copy was current, and nothing to stop two edited copies drifting apart.

It now lives at `<repo>/analysis/` (commit `a5d21c2`). The shared-drive folder keeps `output/`
and gains a README pointing at the repo.

Two things had to change for it to run there:

**Data path resolution.** `DATA_DIR` was `dirname(SCRIPT_DIR)/Data`, which is the shared-drive
layout. It now tries `data_raw/` (the repo) and then `Data/` (the shared drive) and takes the
first that exists, so a copy in either place works without configuration.

**The crosswalk could have been committed.** `run_all.R` writes
`output/PRIVATE_crosswalk.csv`, which maps study-local `pid` labels back to Prolific ids and
profile UUIDs. The repo's top-level `output/` **is** tracked (power-analysis results), so a
blanket ignore was wrong and a scoped one was needed: `analysis/output/` plus a `PRIVATE_*`
rule for wherever else it might be written. Verified with `git check-ignore` and by confirming
`git status` reports nothing from that directory.

Verified running from the new location: 21 enrolled, 20 analysis-ready, 17/17 critical terms,
write loss 0 of 340 — identical to the shared-drive run — and the focus validator's 13
assertions pass.

**Open, and it matters for Sandy:** the analysis repository is **local only** — it has no
remote. Moving the code into it therefore put it somewhere Sandy cannot reach. The pointer
README says so explicitly rather than implying a clone will work. Pushing the repo to a
private host is the obvious next step; it also means the analysis code stops existing on
exactly one machine.
