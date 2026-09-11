# Preregistration — Perfectionism and Effort Allocation in Multi-task Performance

**Study**: Sandy Study 3 · Regulatory and Affective Dynamics Lab, University of Toronto Mississauga
**Format**: OSF Standard Preregistration
**Version**: 2026-09-11 — amended after a data-collection failure in the confirmatory sample; filed before any confirmatory analysis.
**Registered version**: 2026-08-11 (pilot-informed), which superseded the 2026-08-04 draft; see Appendix B.

> **Read §7 before §5.** On 2026-08-26/27 a platform defect discarded most repeated slider
> ratings in the second of two confirmatory batches. §7 documents the failure, what it removed
> and what survives; Appendix C2 records the amendments to the confirmatory analysis that follow
> from it. Registered text in §§1–6 is retained where it has been superseded, with a dated
> signpost at each affected point, so that what was registered stays legible beside what is now
> planned.

---

## 1. Study Information

### 1.1 Title

Perfectionism and Effort Allocation in Multi-task Performance

### 1.2 Description

This study examines how maladaptive (discrepancy) perfectionism relates to effort
allocation, performance variability, and affective responses during a multi-task cognitive
battery, and whether a "redemption" framing of a bonus task moderates these relations.

Participants complete the **Aptitude Suite** — three concurrent word tasks (Unscramble
anagrams, Word Storm category fluency, and Word Probe deductive word guessing) under a
shared 8-minute budget, with free switching between tasks and a real-time percentile-rank
display. They are instructed to aim for the top 10%. The Aptitude Suite is followed by
**ColourMax**, a 5-minute paint-by-numbers task with five images between which participants
may move freely.

Participants are randomized to one of two framings of ColourMax, delivered immediately
after their Aptitude Suite score feedback:

- **Control**: "You've finished Aptitude Suite. The next activity will begin shortly. Note
  that this activity will not count toward your overall score."
- **Redemption**: "Good news: you now have a chance to raise your percentage!" — followed,
  at the end of ColourMax, by a revised overall score.

Brief state ratings (stress, negative and positive emotionality, predicted and experienced
performance relative to others, effort, satisfaction) are collected around each task. A
trait questionnaire battery, demographics, and a debrief close the session. The session is
single-shot, fully online, requires a desktop or laptop, and takes approximately 35 minutes.

### 1.3 Hypotheses

Three hypothesis families, all directional. The statistical test for each is specified in
§5.1; the confirmatory test family is enumerated in §5.3.

> *Revised 2026-09-10 — see §7 and Appendix C2.* H1B, and the negative-emotionality tests of
> H3A and H3B, cannot be run as registered: the ratings they require were not retained for most
> of the confirmatory sample. H1B is refitted on stress (C2.1). The hypotheses themselves are
> unchanged and are stated below as registered.

**H1 — Redemptive framing moderates trait–behaviour links.**

- **H1A.** The positive relation between discrepancy perfectionism (and, separately,
  rumination) and self-reported effort on ColourMax is stronger in the redemption condition
  than in the control condition.
- **H1B.** The relation between discrepancy perfectionism (and, separately, rumination) and
  post-ColourMax negative emotionality, adjusting for pre-manipulation negative
  emotionality, differs by condition: among high-trait participants, redemptive framing
  reduces post-task negative emotionality relative to control.
- **H1C.** Discrepancy perfectionism predicts more concentrated (less even) allocation of
  time across the five ColourMax images, and this relation is stronger in the redemption
  condition. Secondarily, discrepancy perfectionism predicts higher ColourMax precision in
  the redemption condition relative to control.

**H2 — Trait main effects on effort and performance variability.**

- **H2A.** Higher discrepancy perfectionism and higher rumination each predict higher
  post-task effort ratings.
- **H2B.** Higher burnout predicts lower post-task effort ratings.
- **H2C.** Higher discrepancy perfectionism, rumination, and burnout each predict greater
  within-person variability across the three Aptitude Suite task percentile scores,
  controlling for mean performance.
- **H2D** *(exploratory; §5.7)*. The same traits predict a steeper decline in ColourMax
  per-image performance from earlier- to later-positioned images.

**H3 — Anticipatory stress and negative emotionality.**

- **H3A.** Higher discrepancy perfectionism and lower pre-task predicted self-efficacy each
  predict greater pre-task stress and negative emotionality.
- **H3B.** Higher discrepancy perfectionism predicts a steeper increase in stress and
  negative emotionality across the session's three affect timepoints.

---

## 2. Design Plan

### 2.1 Study type

Experiment — a randomized controlled experiment delivered online via the RADlab platform
(radlab.zone).

### 2.2 Blinding

Participants are blind to condition and to the existence of a second framing. No
experimenter interaction occurs during the session, so experimenter blinding is structurally
guaranteed by the automated delivery.

### 2.3 Study design

Single-session, between-subjects, one factor (ColourMax framing) with two levels (control,
redemption). All state ratings are within-subject repeated measures around the two tasks.
There is no counterbalancing: task order is fixed (Aptitude Suite → ColourMax) because the
manipulation is defined by its position after Aptitude Suite feedback.

The delivered session comprises 34 steps:

1. Transition display, then pre-task ratings: stress (6-point), negative emotionality
   (0–100), positive emotionality (0–100), predicted relative performance (0–100)
2. **Aptitude Suite** (8 minutes; three tasks; free switching; live percentile display)
3. Post-task ratings: effort, stress, negative emotionality, positive emotionality,
   experienced relative performance
4. Score feedback display (predicted vs. observed percentile), task satisfaction rating,
   **framing display (the manipulation)**, bonus-round instructions
5. Pre-ColourMax predicted relative performance rating
6. **ColourMax** (5 minutes; five images)
7. Post-task ratings: satisfaction, effort, stress, negative emotionality, positive
   emotionality, experienced relative performance; then the condition-gated score display
8. Trait questionnaire battery: APS-R, BAT-Student, PANAS, RRQ-Rumination, GSE, DASS-21,
   SCS-26
9. Demographics (U of T Student Equity Census), then debrief

Two features of this ordering are deliberate. **Trait questionnaires are administered after
the tasks**, so that perfectionism and rumination content cannot prime the behavioural
measures; a randomization check (§5.5) tests whether condition leaked into trait reports.
And **no affect ratings are inserted between the framing display and ColourMax**: the
post-Aptitude stress, negative, and positive ratings — taken before score feedback and
before the framing display — serve as the pre-ColourMax affect baseline. This keeps the
baseline uncontaminated by condition and avoids re-administering identical items about two
minutes apart. The consequence is three affect timepoints rather than four pre/post pairs:

- **T0** — before the Aptitude Suite
- **T1** — after the Aptitude Suite, before feedback and framing; also the ColourMax baseline
- **T2** — after ColourMax

### 2.4 Randomization

Simple individual-level randomization, 1:1 allocation, executed server-side by the
platform's permuted-block randomizer: seeded permuted blocks per slot, concurrency-locked,
idempotent per participant, with an audit trail written to `participant_assignments`. The
operative assignment slot is `framing`, with arms `control` and `redemption`. Assignment
occurs at session entry after consent, before any study content is shown.

---

## 3. Sampling Plan

### 3.1 Existing data

Registration prior to creation of the confirmatory data. No data for the confirmatory
sample have been collected. A pilot of N = 20 was collected on 2026-08-06, before
registration, and was used to estimate nuisance parameters only (§3.4). No hypothesis test
was conducted on the pilot, no effect size was estimated from it, and it will not be pooled
with the registered sample.

Separation is enforced in code rather than left to care. The pilot participants were
recruited on Prolific into the same study record, so no identifier, status or flag
distinguishes them; the boundary is the enrolment date, and the analysis pipeline refuses to
run a confirmatory analysis unless that date is declared (`SANDY3_COHORT_START`). A second
reason makes the boundary substantive rather than procedural: the pilot ran an earlier
version of the Aptitude Suite. The Word Probe recalibration and partial-credit scoring, and
the floored redemption score (Appendix B), shipped on 2026-08-11, after the pilot sessions.
Pilot percentiles are therefore not on the same scale as the registered sample and could not
be pooled even if the registration permitted it.

> *Status at revision, 2026-09-10 — see §7.1.* Confirmatory data collection is closed. The
> cohort begins at the declared boundary, 2026-08-20, and arrived in two batches: 32 enrolled on
> 2026-08-20 and 298 on 2026-08-26/27, for 330 enrolled and 292 complete sessions.

### 3.2 Data collection procedures

Participants are recruited via Prolific. Enrolment status — currently enrolled as a
post-secondary student — is set through Prolific's standard prescreening fields, and the
study listing states the eligibility criteria below, the time commitment, the desktop
requirement, and the nature of the tasks.

The criteria are deliberately **not** implemented as Prolific custom prescreening
questions. A custom prescreener on that platform is itself a short paid study with its own
completion path, so gating this study that way would mean running a second study in front
of it. The criteria are published in the listing so that participants can self-select
before accepting, and are then enforced at session entry by the screener described next.

**Eligibility screener.** Every participant then passes through a five-item pre-consent
screener hosted on the study platform, before the consent form and before any study
content. All five statements must be endorsed:

1. I can fluently read and write in English.
2. I have normal or corrected-to-normal vision.
3. I consider myself to be in good enough mental health to reflect briefly on my mood and
   stress levels.
4. I am willing to complete the word puzzles and colouring activity in one 35-minute
   sitting.
5. I am not currently experiencing depression, anxiety, or effects of trauma severe enough
   that taking part would be upsetting to me or disruptive to my ability to function.

Endorsing fewer than five is terminal: the participant is shown a screen-out page and
reaches neither the consent form nor any study task. That page states that their answers do
not meet the eligibility criteria **set out in the study description**, asks them to return
their Prolific submission, and notes that returning costs them nothing and does not affect
their approval rating. Naming the description is deliberate — the criteria are published in
the listing before anyone accepts, so the screen-out is a stated rule the participant could
have checked in advance rather than a judgement made about them at this point. The page also
lists free crisis and student-support services, since items 3 and 5 can surface distress. Item 1 covers language, item 2 vision, and item 4 both the time
commitment and the device requirement (ColourMax needs a mouse or trackpad).

Items 3 and 5 replace what an earlier version of this document described as a Prolific
prescreen for active suicidal ideation. The criterion is now the participant's own
judgement about whether taking part would be upsetting or disruptive, asked immediately
before consent rather than at recruitment — a lower bar to answer honestly, and one that
reaches every participant rather than only those whose Prolific profile carries the
relevant prescreen answer.

Screener responses are stored per item in `screener_results`, so the number screened out,
and which criterion was responsible, are reportable alongside the exclusion counts in §5.4.
Screen-outs never enter the sample and do not count toward the N = 300 target.

Compensation is at or above Prolific's recommended hourly rate for a 35-minute session.

Session duration was measured in the pilot at a median of 30.8 minutes (IQR 28.4–35.3).
The longest components are the Aptitude Suite (8.8 minutes), ColourMax (5.3 minutes), and
the questionnaire battery (approximately 11.5 minutes).

### 3.3 Sample size

**Target: N = 300 valid sessions** (approximately 150 per arm) after the exclusions in
§5.4. Recruitment continues until 300 valid sessions are reached. No interim hypothesis
tests are conducted; the stopping rule is a fixed valid-N count, evaluated on completed
sessions only.

> *Achieved sample, 2026-09-11 — see §7.5.* Recruitment closed at 292 complete sessions (146
> control, 146 redemption), below the stopping rule above, before the exclusions of §5.4
> criteria 2–7 are applied. This is a deviation from §3.3.
>
> **Why collection stopped at 292.** The recruitment budget covered 300 paid sessions. Eight
> participants who began the study without completing it were compensated, as ethics requires,
> which left budget for 292 complete sessions. A shortfall of eight (2.7% of the target) is far
> smaller than the spacing of the power simulation grid (N = 250, 300, 400; §3.4), so for power
> purposes the achieved sample is effectively at the registered target. Given that, and the data-collection failure
> documented in §7, collection was stopped at this point rather than extended. The shortfall itself
> is independent of that failure: the failure removed variables, not participants.

### 3.4 Sample size rationale

Power was estimated by Monte Carlo simulation of the **entire 17-test confirmatory family
jointly**, so that Benjamini–Hochberg power is evaluated as it will actually be applied
(§5.3) rather than test by test. Each of 2,000 replicates per design cell generates a
complete study, fits all 17 preregistered models, applies the BH correction across the 17
p-values, and records which survive.

Distributional realism is taken from the N = 20 pilot; effect sizes are not. The simulation
draws on the pilot only for nuisance parameters:

- outcome dispersion and distribution shape;
- the observed trait correlation matrix (discrepancy–burnout r = .71,
  discrepancy–rumination r = .53, rumination–burnout r = .46), so that H2C inherits its
  real collinearity penalty;
- the correlation between discrepancy perfectionism and pre-task predicted efficacy
  (r = −.63), which is the predictor collinearity in H3A;
- within-person intraclass correlations (stress .60, negative affect .46, positive affect
  .87);
- the H1B baseline covariate correlation (r = .47);
- the instruments' censoring — 0–100 sliders clipped at their bounds, reproducing the
  observed effort ceiling, and stress rounded to its 6-point scale, reproducing its floor.

Effect magnitudes are swept over a grid and are never estimated from the pilot. Type-I
control was verified in a null cell: uncorrected rejection rate .052, BH rejection
rate .004.

Below, δ denotes a standardized effect — a partial correlation for main effects, and the
difference in trait slope between arms (Δr) for interactions.

**Detectable effect at 80% BH-corrected power:**

| Test family | N=150 | N=200 | N=250 | N=300 | N=400 |
|---|---|---|---|---|---|
| H1A framing × trait | >.40 | >.40 | .38 | .34 | .30 |
| H1B framing × trait | >.40 | .37 | .33 | .30 | .26 |
| H1C framing × trait | >.40 | >.40 | .37 | .34 | .29 |
| H2A/H2B trait main effects | .26 | .23 | .20 | .18 | .16 |
| H2C variance | .33 | .28 | .25 | .23 | .20 |
| H3A anticipatory | .32 | .28 | .25 | .23 | .20 |
| H3B trajectory | .20 | .18 | .16 | .15 | .15 |

Three conclusions follow.

**All hypotheses except H1 are well powered at a modest sample size.** H2A and H2B detect a
partial correlation of .23 at N = 200; H3B detects .18, the within-person time × trait
contrast being the most efficient test in the family because it uses three timepoints; H2C
and H3A detect approximately .25 at N = 250 despite the trait collinearity penalty. These
values sit inside the range typically reported for perfectionism and rumination with effort
and affect outcomes.

**The multiple-comparison correction is nearly free.** Averaged across the family, BH costs
1 to 4 percentage points of power at N ≥ 200 for δ ≥ .25 — at N = 250 and δ = .25, .79
uncorrected against .76 corrected. Reducing the size of the confirmatory family in order to
buy power would therefore gain almost nothing.

**The H1 framing × trait interactions are the binding constraint.** Detecting a between-arm
slope difference of Δr = .30 — already a large moderation — requires N ≈ 300 for H1B and
N ≈ 400 for H1A and H1C. A more typical moderation of Δr ≈ .20 would require approximately
N = 800, and Δr ≈ .15 is out of reach. This is intrinsic to between-subjects moderation of a
continuous trait rather than a feature of this design or this correction.

N = 300 is therefore an explicit compromise. It brings H1B to 80% power for Δr = .30, leaves
H1A and H1C at 68–71% power at that value, and gives at least 95% power to every H2 and H3
test at δ = .25. N = 400 would extend the H1 family to Δr ≈ .26–.30 at a third more cost;
N = 200 would leave the study's headline hypothesis powered only for moderation of Δr ≈ .40.

**Interpretation of a null H1 result is constrained accordingly, and is stated here in
advance:** a null H1 at N = 300 rules out large moderation of trait–behaviour links by
redemptive framing. It does not rule out the small-to-moderate moderation that would be the
more typical finding in this literature. H2 and H3 are the components of this study that
will yield decisive evidence at an achievable sample size.

These figures do not cover the H1C Dirichlet regression, which is a secondary supporting
analysis and not part of the confirmatory family, nor the exploratory analyses in §5.7. The
confirmatory H1C test is the scalar concentration index specifically so that H1C's status
does not depend on the compositional model.

> *Achieved N, 2026-09-10 — see §7.5.* Every surviving confirmatory test has n = 292 except
> H1C (n = 262), so the N = 300 column above describes the achieved power closely; H1C sits
> between the N = 250 and N = 300 columns.

---

## 4. Variables

### 4.1 Manipulated variable

ColourMax framing (control vs. redemption), operationalized by the two framing displays
quoted in §1.2 and by the condition-gated end-of-task score display. The redemption arm
additionally sees a revised overall score, computed as the mean of the participant's
Aptitude Suite and ColourMax percentiles, floored at the Aptitude percentile so that the
bonus round can never lower where a participant stands. The server-side assignment record
is `participant_assignments`, slot `framing`.

### 4.2 Trait measures (questionnaire battery, administered after the tasks)

| Construct | Instrument | Scoring |
|---|---|---|
| Discrepancy perfectionism | APS-R, 23 items, 1–7 | Mean of the 12 Discrepancy-subscale items — the primary trait predictor. High Standards and Order are scored but exploratory. |
| Rumination | RRQ Rumination subscale, 12 items, 1–5 | Mean of 12 items (items 6, 9 and 10 reverse-keyed) |
| Burnout | BAT-Student, 33 items, 1–5 | Mean of the 23 BAT-C core items (Exhaustion 8, Mental Distance 5, Cognitive Impairment 5, Emotional Impairment 5). The 10 BAT-S secondary items are exploratory. |
| Trait self-efficacy | GSE, 10 items, 1–4 | Mean; exploratory covariate |
| Mood | DASS-21 | Subscale sums ×2; exploratory covariates |
| Self-compassion | SCS-26 | Standard subscale and total scoring, with Self-Judgment, Isolation and Over-Identification reverse-keyed; exploratory |
| Trait affect | PANAS | Positive and negative affect sums; exploratory |

### 4.3 State measures (around each task)

- **Stress** — 6-point emoji scale, at T0, T1 and T2
- **Negative emotionality** — 0–100 slider, at T0, T1 and T2
- **Positive emotionality** — 0–100 slider, at T0, T1 and T2
- **Predicted relative performance** ("How well do you think you will do relative to others
  on the next task?") — 0–100 slider, before each task
- **Experienced relative performance** — 0–100 slider, after each task
- **Effort** ("How much effort did you put into the task?") — 0–100 slider, after each task
- **Task satisfaction** — 6-point emoji scale, after each task

> *Revised 2026-09-10 — see §7.3.* In the second confirmatory batch (2026-08-26/27) only the
> last administration of each 0–100 slider was retained: T2 negative and positive emotionality,
> pre-ColourMax predicted performance, and post-ColourMax experienced performance and effort.
> Stress and task satisfaction are complete in both batches.

### 4.4 Behavioural measures

**Aptitude Suite**: per-task raw scores and percentile ranks for the three subtasks; the
overall percentile displayed to participants; task-switch count; time per subtask.

Time per subtask requires comment, because the Aptitude Suite differs from ColourMax in a
way that limits what it can measure. ColourMax presents one image at a time, so moving
between images is a navigation act and is logged as such. The Aptitude Suite presents all
three subtasks on screen at once, so there is no navigation event to record: which subtask
holds keyboard focus is the only observable signal of where the participant is working.
Focus is therefore a proxy for engagement, not a measurement of attention — a participant
can read one box while another holds focus — and per-subtask times are treated as
exploratory throughout (§5.7). Two events bound the estimate: focus acquisitions
(`task_focus`, carrying the subtask moved from and to) and window blur/focus, so that time
spent outside the browser window is subtracted rather than attributed to whichever subtask
last held focus.

**ColourMax**: time spent on each of the five images; per-image coverage (percentage of
colourable pixels coloured) and precision (percentage coloured correctly within
boundaries); overall percentile; number of images attempted.

### 4.5 Derived indices

**Time-allocation proportions.** p_i = t_i / Σt_i across the five ColourMax images, using
each participant's actual total rather than the nominal 300 seconds. Per-image time is
derived from the page-transition event log rather than a stored field: transitions carry a
source image, a destination image and an elapsed timestamp, bracketed by session-start and
game-end events, with the initial image being the first. In the pilot this reconstruction
summed to 301.0 seconds (SD 1.9) against the 300-second budget for all 20 participants.
Because elapsed timestamps are wall-clock while the in-game countdown can be throttled by a
backgrounded browser tab, any session whose reconstructed total falls outside 290–320
seconds is excluded (§5.4).

**Allocation concentration** (H1C primary dependent variable). 1 − H/log(5), where
H = −Σ p_i·log(p_i) is the Shannon entropy of the time proportions and 0·log 0 is defined as
0. The index runs from 0 (time divided perfectly evenly across the five images) to 1 (all
time on a single image). It is defined in the presence of zeros without imputation.

**Aptitude variability** (H2C dependent variable). The within-participant standard
deviation of the three Aptitude Suite subtask percentile scores; the mean of the same three
scores serves as its covariate.

**ColourMax precision** (H1C secondary dependent variable). Mean precision across images
that received any colouring.

**Subtask allocation concentration** (exploratory; §5.7). The same entropy index applied to
the Aptitude Suite, 1 − H/log(3) over the three per-subtask focus times, running from 0
(effort divided evenly across the three subtasks) to 1 (all effort on one). It is reported
alongside the count of focus transitions. This is deliberately *not* the confirmatory
`task_switch_count`, which is derived from interaction events and is the quantity the pilot
and the power analysis were built on; the two are reported separately rather than merged.

**Change scores.** Post minus pre for stress, negative affect, positive affect and
efficacy, used for description and plotting only; the confirmatory models use the stacked
ratings rather than difference scores.

---

## 5. Analysis Plan

All analyses are conducted in R (≥ 4.3). Mixed models use `lme4` and `lmerTest` with
Satterthwaite degrees of freedom. The secondary compositional analysis uses `DirichletReg`,
with zero replacement via `zCompositions::multRepl`. A script skeleton appears in
Appendix A.

### 5.1 Statistical models

Condition is coded control = −0.5, redemption = +0.5. All continuous trait predictors and
pre-task covariates are z-scored on the analysis sample. Where a hypothesis names two
traits, each is fitted in its own model. Each model has a single prespecified critical term,
and it is those terms that constitute the confirmatory family in §5.3.

> *Revised 2026-09-10 — see Appendix C2.* The models below are retained as registered. Where the
> ratings a model needs were lost (§7), it has been changed: H1B is refitted on stress (C2.1);
> H2A, H2B and the stress model of H3A are fitted in single-task reduced form (C2.2); and the
> negative-emotionality models of H3A and H3B cannot be fitted and leave the confirmatory family
> (C2.3). The specifications actually fitted are in C2 and in Appendix A.2.

**H1A** (two models; trait ∈ {discrepancy, rumination}):
`effort_postCM ~ trait_z * condition`, fitted by ordinary least squares. Critical term: the
interaction, predicted positive. If significant, simple slopes are reported per arm.

**H1B** (two models):
`NA_postCM ~ NA_T1_z + trait_z * condition`. The T1 negative-emotionality rating is taken
before score feedback and before the framing display, making it a clean pre-manipulation
baseline; this is a baseline-adjusted analysis of covariance, preferred to raw change
scores. Critical term: the interaction, predicted negative — redemptive framing lowers
adjusted post-task negative emotionality more strongly at high trait levels.

**H1C, primary**:
`concentration ~ discrepancy_z * condition`. Critical term: the interaction, predicted
positive. The main effect of discrepancy is a directional secondary term, reported as
exploratory.

**H1C, secondary** (supporting; not in the confirmatory family): Dirichlet regression on the
five-part time composition, `DR_data(proportions) ~ condition * discrepancy_z`, with an
omnibus likelihood-ratio test of the interaction block against a main-effects model. Zeros
are replaced with a detection limit of one second expressed as a per-row fraction, with
sensitivity checks at 0.1 and 5 seconds. Component-wise interaction coefficients are
exploratory.

**H1C, tertiary** (exploratory): `precision_mean ~ discrepancy_z * condition`.

**H2A and H2B** (one stacked model each): effort ratings from both tasks, two observations
per participant, `effort ~ trait_z + task + (1 | id)`. H2A fits discrepancy and rumination
in separate models (two critical tests); H2B fits burnout (one critical test). Critical
terms are the trait coefficients, predicted positive for H2A and negative for H2B. Random
intercepts only: with two observations per participant, random slopes are unidentified.

A singular random-intercept fit is anticipated and is handled by rule rather than by
judgement after the fact. If the random-intercept variance is estimated at or near zero and
the model reports a singular fit, the model is **not** re-specified. A zero intercept
variance means the two occasions are effectively independent; the fixed-effect test for a
between-person trait predictor remains valid, and the estimator reduces to the correct
ordinary-least-squares solution of its own accord. The singular-fit warning and the
estimated intercept variance are reported alongside the coefficient.

**H2C** (one model, three critical tests):
`aptitude_SD ~ discrepancy_z + rumination_z + burnout_z + mean_percentile_z`. Critical
terms: the three trait coefficients, all predicted positive. Mean percentile is a forced
covariate, included to separate the variance effect from the mean–variance confound.
Variance inflation factors are reported; if any trait exceeds a VIF of 5, each trait is
additionally reported from its own single-trait model as a sensitivity analysis, with the
joint model remaining confirmatory.

**H3A** (two models, four critical tests): pre-task ratings from both tasks stacked, two
observations per participant,
`preDV ~ discrepancy_z + predicted_efficacy_z + task + condition + (1 | id)`, for
preDV ∈ {stress, negative emotionality}. The pre-task observation for the Aptitude Suite is
T0; for ColourMax it is T1, paired with the pre-ColourMax predicted-efficacy rating.
Critical terms: discrepancy (predicted positive) and predicted efficacy (predicted
negative). Condition is retained as a covariate because the pre-ColourMax efficacy rating,
though not the T1 affect ratings, falls after the framing display. T1 reflects the state
carried into the ColourMax segment rather than informed anticipation, since participants
have not yet been told about the bonus round; the task fixed effect absorbs the mean
difference between a cold start and a post-performance state.

**H3B** (two models, two critical tests): all three affect timepoints stacked, three
observations per participant, `DV ~ time_c * discrepancy_z + condition + (1 | id)`, with
time coded 0, 1 and 2, for DV ∈ {stress, negative emotionality}. Critical term: the
time × discrepancy interaction, predicted positive. Because T1 serves as both the
post-Aptitude and the pre-ColourMax reading, a stacked pre/post-pairs specification would
enter that observation twice and understate the standard errors; the three-point trajectory
model uses each rating exactly once. Segment-specific contrasts (T0→T1 against T1→T2, the
latter spanning feedback, framing and the second task) are reported as exploratory.

### 5.2 Transformations

- Condition: −0.5 / +0.5. Task: Aptitude = 0, ColourMax = 1. Time: 0, 1, 2.
- Traits and continuous covariates: z-scored on the analysis-sample mean and standard
  deviation. Slider and rating dependent variables are analysed on their raw scale.
- The 6-point stress scale is treated as continuous. As a prespecified robustness check,
  every confirmatory stress model is refitted as a cumulative-link (ordinal) model, and
  agreement in coefficient sign and significance is reported.
- If a confirmatory model's residual skewness exceeds an absolute value of 2, the dependent
  variable is transformed — log(x + 1) for right skew of a non-negative variable, otherwise
  a rank-based inverse normal transformation — and both raw and transformed results are
  reported, with the transformed model treated as confirmatory.
- If more than 30% of a slider dependent variable sits at a single boundary value, a Tobit
  specification is added as a sensitivity analysis, with the linear model remaining
  confirmatory.

### 5.3 Inference criteria

Two-tailed tests are used throughout. The hypotheses are directional, but two-tailed
p-values are used for robustness: a hypothesis is supported only if the BH-adjusted p is
below .05 **and** the coefficient sign matches the stated direction.

The **confirmatory family comprises exactly 17 tests**, with the Benjamini–Hochberg
false-discovery-rate correction applied at q = .05 across the full family:

| Hypothesis | Critical tests | Terms |
|---|---|---|
| H1A | 2 | discrepancy × condition; rumination × condition |
| H1B | 2 | the same two interactions, on adjusted post-task negative emotionality |
| H1C | 1 | discrepancy × condition on allocation concentration |
| H2A | 2 | discrepancy; rumination |
| H2B | 1 | burnout |
| H2C | 3 | discrepancy; rumination; burnout |
| H3A | 4 | 2 predictors × 2 dependent variables |
| H3B | 2 | time × discrepancy, for 2 dependent variables |

> *Revised 2026-09-11 — see Appendix C2.3.* The confirmatory family is **14 tests**, with the
> Benjamini–Hochberg correction applied at q = .05 across all 14:
>
> | Hypothesis | Critical tests | Status |
> |---|---|---|
> | H1A | 2 | as registered |
> | H1B | 2 | refitted on stress (C2.1) |
> | H1C | 1 | as registered; sample per criterion 7 (C2.4) |
> | H2A | 2 | reduced form (C2.2) |
> | H2B | 1 | reduced form (C2.2) |
> | H2C | 3 | as registered |
> | H3A | 2 | stress only; reduced form (C2.2) |
> | H3B | 1 | stress only; as registered |
>
> Removing tests from a BH family makes each remaining test easier to pass, not harder. The
> smaller family is declared here, with its reason, rather than applied without comment.

Everything else — simple slopes, the Dirichlet omnibus and its components, secondary and
tertiary models, subscale analyses, robustness refits, and §5.7 — is explicitly
non-confirmatory and is reported without correction.

Mixed-model p-values use Satterthwaite degrees of freedom. Effect sizes are reported as
standardized β with a 95% confidence interval for every confirmatory coefficient, and as f²
for least-squares terms.

### 5.4 Data inclusion and exclusion

The unit of analysis is a valid completed session. Criteria are applied in order, and counts
are reported for each. A prior criterion removes accounts that were never participants:
enrolments flagged as test accounts on the platform (staff exercising the study end to end)
are dropped before any criterion below is applied, and are reported as their own line in the
exclusion table. The flag is authoritative — filtering on enrolment status does not identify
them, because genuine participants withdraw too.

1. **Incomplete session** — did not reach the debrief step: excluded.
2. **Duplicate participation** — the same Prolific ID or platform participant across
   sessions: the first complete session is retained.
3. **Aptitude non-engagement** — zero valid responses across all three Aptitude Suite
   tasks: excluded entirely.
4. **ColourMax non-engagement** — zero coloured pixels across all five images: excluded
   from H1 and H2D, retained for the Aptitude-side analyses.
5. **Questionnaire non-engagement** — zero variance across all APS-R items, or a battery
   completion time under three minutes: excluded from all trait-based analyses, which is to
   say from every confirmatory test.
6. **Technical failure** — a platform-logged step error, missing telemetry for a required
   dependent variable, or a ColourMax time reconstruction falling outside 290–320 seconds:
   excluded listwise from models requiring that variable.

> *Added 2026-09-10; scope extended 2026-09-11 — see Appendix C2.4.*
>
> 7. **ColourMax non-navigation** — no page-transition events, meaning the participant never
>    moved off the first image: excluded from every analysis that uses per-image ColourMax data —
>    H1C (primary, secondary and tertiary models) and H2D — and retained in every other analysis.
>    C2.4 gives the evidence that this reflects a misunderstanding of the task rather than an
>    allocation strategy; C2.5 adds exploratory analyses with these participants included.

No outliers are removed on the basis of extreme but legitimate values. As a prespecified
robustness check, every confirmatory least-squares model is refitted with 3-MAD
winsorization of the dependent variable, and agreement in sign and BH-significance is
reported.

### 5.5 Quality and manipulation checks

**Randomization check.** Arm balance is reported. Trait means are compared across arms;
a standardized difference above 0.2 on discrepancy perfectionism, rumination or burnout is
flagged as a caveat on all H1 interpretations, since traits are measured after the
manipulation.

**Manipulation check.** None is administered. The framing is enacted rather than merely
asserted — the redemption arm sees its ColourMax points incorporated into a revised overall
score, and the control arm is told before the task that the round will not count — so a
belief probe would be redundant. All analyses are intention-to-treat on the full valid
sample.

**Positive control.** Predicted relative performance before a task should correlate with
experienced relative performance after it, within task, at r > .2. Failure indicates a
data-quality problem and triggers investigation before any hypothesis test is interpreted.

> *Amended 2026-08-20, before any confirmatory data existed — see Appendix C1.* The check
> above is unchanged and is reported as registered. Its stated inference does not hold for
> the Aptitude Suite, which is designed to break the association it tests: a low correlation
> there is what a working manipulation produces. Appendix C1 fixes, in advance, three
> diagnostics and the reading of each outcome. The registered inference stands unchanged for
> ColourMax.

> *Revised 2026-09-10 — see §7.3.* The Aptitude arm of this check, and C1's diagnostic D1, need
> both Aptitude-side ratings, which exist only for the 29 participants of the first confirmatory
> batch; on the second batch neither can be computed. The ColourMax arm — the one whose
> registered inference stands — is complete for all 292 complete sessions.

### 5.6 Missing data

Sliders, rating scales and questionnaires are required fields in the platform flow, so a
participant cannot advance past a step without answering it. Missingness therefore arises
from three sources: dropout (§5.4, criterion 1), technical failure (§5.4, criterion 6), and
silent write loss — a completed step whose response never reaches the database. **The pilot
observed no write loss: all 340 expected rating writes were present.** An earlier version of
this document reported a rate of 1 in 340; that was an analysis artefact, not a platform
fault, and is corrected here. `vas_responses.responded_at` is stamped by the participant's
own device, and one pilot participant's clock ran 265 seconds slow, which placed their first
stress rating outside a time window built from server-stamped step timings. Ratings are
therefore matched to the step that presented them rather than scoped by a time window, which
removes the dependence on the client clock and makes a genuine missing row distinguishable
from a clock offset.

> *Revised 2026-09-10 — see §7.* The certification above held for the pilot. It did not hold for
> the confirmatory sample: silent write loss occurred at scale on 2026-08-26/27. The mechanism
> differed from the one anticipated here — each rating did reach the database and was then
> overwritten by the participant's next rating of the same instrument, rather than failing to
> arrive — but the consequence is the one this section describes. The step-matching described
> above is now recorded in the database itself, as a step index on every rating row, which is
> what allowed the loss to be counted exactly.

Models are fitted on complete cases, with the number of contributing observations reported
per model. A participant missing a single occasion of a repeated state rating is retained
for the occasions they do have in the mixed models, which tolerate unbalanced data, and is
dropped only from single-outcome models that require the missing value. The realized
write-loss rate is reported alongside the exclusion counts. No imputation is performed.
Questionnaire scale scores require at least 80% of subscale items.

### 5.7 Exploratory analyses

Declared in advance, reported without correction, and not treated as confirmatory:

- Three-way interactions: discrepancy × rumination × condition, on the H1B outcome; and
  discrepancy × rumination × burnout on the H2C and H2D variability outcomes.
- **H2D**: a per-image ColourMax composite (the mean of coverage and precision) regressed
  on image position within participant, with the person-level position slope then regressed
  on the three traits.
- Dirichlet component-wise effects, identifying which images absorb time under high
  discrepancy perfectionism.
- Task-switch count and per-subtask time allocation within the Aptitude Suite as
  behavioural signatures of perfectionism, paralleling H1C within the first task. Two
  distinct quantities are reported and not merged: the interaction-derived
  `task_switch_count`, which the pilot and power analysis were built on, and the
  focus-derived per-subtask times added on 2026-08-19 (§4.4), from which a three-way
  allocation concentration index and a count of focus transitions are computed. Because the
  three subtasks are visible simultaneously, focus bounds engagement rather than measuring
  attention, so these remain exploratory regardless of how strongly they pattern.
- Belief updating: the change from predicted to experienced efficacy, its relation to
  observed percentile and to the traits, and satisfaction as a function of the
  predicted-minus-observed gap.
- Framing effects on affect itself: the condition main effect on T2 stress and negative
  emotionality, adjusting for T1.
- APS-R High Standards and Order subscales, SCS-26, DASS-21, GSE and PANAS as alternative
  predictors and covariates.

> *Added 2026-09-11 — see Appendix C2.5.* Four further exploratory analyses, declared before any
> confirmatory model was fitted: the per-image ColourMax analyses refitted with the participants
> excluded by criterion 7 included; a comparison of those participants' traits with everyone
> else's; the rate of non-navigation by framing arm; and, only after the confirmatory analysis is
> complete, the five registered tests removed in C2.3 fitted as registered on the 29 participants
> whose data can support them.

---

## 6. Other

The percentile displayed by the Aptitude Suite is generated by a scoring curve designed to
produce diminishing returns near the top, not a live empirical percentile of prior
participants. The revised overall score shown to the redemption arm is a floored mean of two
percentile-type quantities (§4.1). Both are elements of the deception, and both are covered
in the debrief; the debrief form and the ethics protocol describe them accurately.

Pilot data (N = 20) precede registration, are excluded from all confirmatory analyses, and
are not pooled with the registered sample.

---

## 7. Data collection failure in the confirmatory sample

*Added 2026-09-10.* This section documents a defect in the study platform that discarded most
repeated slider ratings in part of the confirmatory sample: what failed, what it removed, what
survives, and how it was found and repaired. The amendments to the analysis that follow from it
are in Appendix C2. The full data-handling record is Step 14 of the study's methods and analysis
log.

### 7.1 Cohorts

The confirmatory cohort is bounded by enrolment date, from 2026-08-20 (§3.1). It arrived in two
batches, on either side of a platform release on 2026-08-25, and only the second batch is
affected. The first batch was deliberately small: it was recruited to confirm that the study ran
correctly end to end before full recruitment opened (§7.7).

| Cohort | Enrolled | Began session | Completed | Slider ratings |
|---|---|---|---|---|
| Pilot, 2026-08-04/06 (excluded, §3.1) | 22 | 21 | 20 | complete |
| Confirmatory batch 1, 2026-08-20 | 32 | 29 | 29 | complete |
| Confirmatory batch 2, 2026-08-26/27 | 298 | 283 | 263 | last administration only |
| **Confirmatory total** | **330** | **312** | **292** | |

### 7.2 What failed

The study administers five 0–100 slider measures repeatedly within its single session: negative
and positive emotionality at T0, T1 and T2, and predicted performance, experienced performance
and effort before or after each task — twelve slider administrations per session (§2.3).

The platform stored these ratings behind a duplicate-submission guard: a database rule intended
to absorb accidental double submissions. The guard identified an administration by participant,
instrument and session. It assumed that a session collects a given instrument only once, which is
false for this design. Every later administration of a slider was therefore taken to be a
duplicate of the earlier one: the stored rating was overwritten with the later value, and no new
row was kept. The participant saw an ordinary submission and continued. Nothing was logged.

The guard was in place from 2026-08-18. Until 2026-08-25, slider ratings did not record which
session they belonged to, and for such ratings the guard collapsed only submissions arriving
within ten seconds of each other — so it had no effect on them, which is why confirmatory batch 1
(2026-08-20) is complete. A platform release on 2026-08-25 began recording the session on every
slider rating, a correct change in itself; from that point the guard collapsed every repeated
administration. Batch 2 was collected entirely after that release.

Stress and task satisfaction are stored separately, were not subject to the guard, and are
complete in both batches.

### 7.3 What was lost

Batch 2. "Answered" counts the participants whom the platform's step log records as completing
that rating; every one of these ratings was given.

| Measure | Timepoint | Answered | Retained | Lost |
|---|---|---|---|---|
| Negative emotionality | T0, before the Aptitude Suite | 283 | 10 | **273** |
| | T1, after the Aptitude Suite | 273 | 4 | **269** |
| | T2, after ColourMax | 269 | 269 | 0 |
| Positive emotionality | T0 | 283 | 10 | **273** |
| | T1 | 273 | 4 | **269** |
| | T2 | 269 | 269 | 0 |
| Predicted performance | before the Aptitude Suite | 283 | 10 | **273** |
| | before ColourMax | 273 | 273 | 0 |
| Experienced performance | after the Aptitude Suite | 273 | 4 | **269** |
| | after ColourMax | 269 | 269 | 0 |
| Effort | after the Aptitude Suite | 273 | 4 | **269** |
| | after ColourMax | 269 | 269 | 0 |

**1,895 of the 3,290 slider ratings given in batch 2 (58%) were lost.** The loss is systematic, not
random: each participant retains exactly the last administration of each slider that they
reached. For 269 of the 283 batch-2 participants that is the post-ColourMax (T2) rating; the
remainder left the session before a later administration. The lost ratings are not recoverable.

**Not affected**: the pilot, and confirmatory batch 1, on every measure; stress (T0, T1, T2) and
task satisfaction (both tasks) in both batches; the trait battery; the framing assignment; and
all Aptitude Suite and ColourMax behavioural data.

### 7.4 Consequences for the registered analysis

| Hypothesis | Registered tests | Status |
|---|---|---|
| H1A | 2 | Unaffected |
| H1B | 2 | Cannot be run as registered: its covariate, T1 negative emotionality, was lost. Refitted on stress, and the refitted tests stay in the confirmatory family (C2.1) |
| H1C | 1 | Unaffected; sample per new criterion 7 (C2.4) |
| H2A | 2 | Reduced form, ColourMax effort only (C2.2) |
| H2B | 1 | Reduced form, ColourMax effort only (C2.2) |
| H2C | 3 | Unaffected |
| H3A | 4 | Stress: reduced form, ColourMax row only (C2.2). Negative emotionality: cannot be run |
| H3B | 2 | Stress: unaffected. Negative emotionality: cannot be run |

Seven of the seventeen tests are unaffected, five survive in reduced form, and five cannot be run
on the confirmatory sample. Every test stated over stress survives, because stress was not stored
behind the guard; each negative-emotionality counterpart does not. Complete data for the five
removed tests exist only for the 29 participants of batch 1 — a date-selected tenth of the sample
that cannot stand in for the registered tests. They are examined as an exploratory check, after the
confirmatory analysis is complete (C2.5, E4).

Two further consequences. In §5.5, the Aptitude arm of the positive control and Appendix C1's
diagnostic D1 are computable only on batch 1. In §5.7, the exploratory analyses that need a lost
rating — the three-way interaction on the H1B outcome, belief updating across the Aptitude Suite,
and the framing effect on T2 negative emotionality adjusted for T1 — are likewise computable only
on batch 1. Belief updating across ColourMax, and the framing effect on T2 stress, are unaffected.

### 7.5 Analysable sample

Complete confirmatory sessions holding every variable the test requires, before the exclusions of
§5.4 criteria 2–6:

| Test | n |
|---|---|
| H1A (discrepancy; rumination) | 292; 292 |
| H1C, after criterion 7 | 262 |
| H2A (discrepancy; rumination), reduced form | 292; 292 |
| H2B, reduced form | 292 |
| H2C | 292 |
| H3A, stress, reduced form | 292 |
| H3B, stress | 292 |
| H1B refitted on stress (C2.1) | 292; 292 |
| Positive control, ColourMax arm | 292 |

H1C loses 29 participants to criterion 7 and 1 to criterion 4; the same 30 are excluded from H2D.
Arms among the 292 complete sessions: 146 control, 146 redemption.

The data loss removed variables, not participants. The shortfall against the N = 300 target of
§3.3 comes from recruitment, and is recorded there. N = 292 lies close to the N = 300 column of
§3.4, whose power conclusions therefore describe the achieved sample closely; H1C, at 262, lies
between the N = 250 and N = 300 columns.

### 7.6 How it was found, and how it was repaired

The failure was found on 2026-09-10, when the exported data showed one value per slider where the
protocol collects two or three. It went undetected for a fortnight for three reasons, recorded
here because the same three would hide a recurrence. It was silent by construction: the platform
reported every overwritten rating as a successful save. The completeness check behind §5.6 was
run once, on the pilot, and was not repeated after the 2026-08-25 release changed how these
ratings were stored. And no automated test exercised a repeated administration within one
session.

The platform was repaired on 2026-09-10, after data collection had closed. Each rating now records
the step of the session that collected it. The guard identifies an administration by participant,
instrument, session and step, so repeated administrations are kept while genuine double
submissions are still absorbed. The step was reconstructed for existing ratings from the
platform's step log. The data export names each repeated administration by its step, so that the
retained batch-2 rating is labelled as the post-ColourMax value it is. A regression test covers
repeated administration. The repair prevents recurrence in future studies; it cannot restore what
was lost here.

### 7.7 Timing of this revision relative to the data

This revision was drafted on 2026-09-10 and finalised on 2026-09-11, after confirmatory data
collection had closed and the data had been exported. The amendments in Appendix C2 were decided
from counts of which variables exist in the collected data, together with the descriptive counts of
navigation and colouring reported in C2.4. No hypothesis-test estimate was computed in reaching
them.

**The study team confirms that no confirmatory model had been fitted, and no effect estimated for
any registered hypothesis, at any point before these amendments were made.** The first 29
confirmatory participants (batch 1, 2026-08-20) were recruited to confirm that the study was running
correctly, not to test hypotheses. This amended registration is filed before any confirmatory
analysis begins.

---

## Appendix A — Analysis script skeleton (R)

```r
packages <- c("tidyverse", "lme4", "lmerTest", "DirichletReg", "zCompositions",
              "ordinal", "psych", "car")
new_packages <- packages[!sapply(packages, requireNamespace, quietly = TRUE)]
if (length(new_packages)) install.packages(new_packages)
for (p in packages) library(p, character.only = TRUE)

# df     : one row per participant
# long3  : participant x affect timepoint (T0, T1, T2)
# img    : participant x ColourMax image

df <- df %>% dplyr::mutate(
  condition_c = dplyr::if_else(framing == "redemption", 0.5, -0.5),
  disc_z      = as.numeric(scale(disc_perfectionism)),
  rum_z       = as.numeric(scale(rumination)),
  burn_z      = as.numeric(scale(burnout_core)),
  mean_pct_z  = as.numeric(scale(apt_pct_mean)))

## H1C index: entropy-based allocation concentration (defined at zero)
prop_cols <- paste0("cm_time_img", 1:5)
P <- df[, prop_cols] / rowSums(df[, prop_cols])
H <- apply(P, 1, function(p) { p <- p[p > 0]; -sum(p * log(p)) })
df$concentration <- 1 - H / log(5)

## The 17 confirmatory models
m_h1a_d <- lm(effort_post_CM ~ disc_z * condition_c, data = df)
m_h1a_r <- lm(effort_post_CM ~ rum_z  * condition_c, data = df)
m_h1b_d <- lm(negative_affect_T2 ~ scale(negative_affect_T1) + disc_z * condition_c, data = df)
m_h1b_r <- lm(negative_affect_T2 ~ scale(negative_affect_T1) + rum_z  * condition_c, data = df)
m_h1c   <- lm(concentration ~ disc_z * condition_c, data = df)

m_h2a_d <- lmer(value ~ disc_z + task + (1 | pid), data = effort_long)
m_h2a_r <- lmer(value ~ rum_z  + task + (1 | pid), data = effort_long)
m_h2b   <- lmer(value ~ burn_z + task + (1 | pid), data = effort_long)
m_h2c   <- lm(apt_pct_sd ~ disc_z + rum_z + burn_z + mean_pct_z, data = df)

m_h3a_s <- lmer(value ~ disc_z + pred_eff_z + task + condition_c + (1 | pid), data = pre_long_stress)
m_h3a_n <- lmer(value ~ disc_z + pred_eff_z + task + condition_c + (1 | pid), data = pre_long_na)
m_h3b_s <- lmer(value ~ time_c * disc_z + condition_c + (1 | pid), data = long3_stress)
m_h3b_n <- lmer(value ~ time_c * disc_z + condition_c + (1 | pid), data = long3_na)

## Benjamini-Hochberg across the 17 prespecified p-values
crit <- tibble::tribble(~test, ~p,
  "H1A disc x cond", coef(summary(m_h1a_d))["disc_z:condition_c", "Pr(>|t|)"]
  # ... one row per critical term; 17 in total
)
crit <- crit %>% dplyr::mutate(p_bh = p.adjust(p, method = "BH"))
```

### A.2 Amended confirmatory models (2026-09-10, revised 2026-09-11; Appendix C2)

The registered skeleton above is retained unchanged. The models to be fitted are:

```r
## Variables the amended models add (z-scored on the analysis sample, §5.2)
df <- df %>% dplyr::mutate(pred_eff_CM_z = as.numeric(scale(pred_eff_CM)))

## Per-image ColourMax sample: criterion 7 (C2.4) drops participants who never left the first
## image. It applies to H1C (primary, secondary, tertiary) and H2D.
df_h1c <- df %>% dplyr::filter(cm_page_switches > 0)

## The 14 confirmatory tests (C2.3)
m_h1a_d    <- lm(effort_post_CM ~ disc_z * condition_c, data = df)                          # 1
m_h1a_r    <- lm(effort_post_CM ~ rum_z  * condition_c, data = df)                          # 2

# H1B refitted on stress (C2.1)
m_h1b_d_st <- lm(stress_T2 ~ scale(stress_T1) + disc_z * condition_c, data = df)            # 3
m_h1b_r_st <- lm(stress_T2 ~ scale(stress_T1) + rum_z  * condition_c, data = df)            # 4

m_h1c      <- lm(concentration ~ disc_z * condition_c, data = df_h1c)                       # 5

# H2A / H2B, reduced form (C2.2): ColourMax effort, one row per participant
m_h2a_d    <- lm(effort_post_CM ~ disc_z, data = df)                                        # 6
m_h2a_r    <- lm(effort_post_CM ~ rum_z,  data = df)                                        # 7
m_h2b      <- lm(effort_post_CM ~ burn_z, data = df)                                        # 8
m_h2c      <- lm(apt_pct_sd ~ disc_z + rum_z + burn_z + mean_pct_z, data = df)              # 9-11

# H3A, stress, reduced form (C2.2): the pre-ColourMax row
m_h3a_s    <- lm(stress_T1 ~ disc_z + pred_eff_CM_z + condition_c, data = df)               # 12-13
m_h3b_s    <- lmer(value ~ time_c * disc_z + condition_c + (1 | pid), data = long3_stress)  # 14

## Benjamini-Hochberg across the 14 critical p-values
```

### A.3 Exploratory analyses added on 2026-09-11 (Appendix C2.5)

Not in the confirmatory family; reported without correction, with 95% confidence intervals.

```r
df$non_navigator <- df$cm_page_switches == 0

## E1. Per-image ColourMax analyses with the criterion-7 participants included
m_h1c_all      <- lm(concentration ~ disc_z * condition_c, data = df)
m_h1c_prec_all <- lm(precision_mean ~ disc_z * condition_c, data = df)
# the Dirichlet model (H1C secondary) and H2D are refitted on `df` in the same way

## E2. Did non-navigators differ in trait? Welch t-tests, Hedges' g with 95% CI
for (trait in c("disc_perfectionism", "rumination", "burnout_core")) {
  f <- as.formula(paste(trait, "~ non_navigator"))
  print(t.test(f, data = df))
  print(effectsize::hedges_g(f, data = df))
}

## E3. Non-navigation by framing arm: the exclusion follows randomization
fisher.test(table(df$non_navigator, df$framing))

## E4. Only after the confirmatory analysis: the five removed tests, as registered, on batch 1
b1 <- df %>% dplyr::filter(batch == 1)          # the 29 participants of 2026-08-20
m_h1b_d_reg_b1 <- lm(negative_affect_T2 ~ scale(negative_affect_T1) + disc_z * condition_c, data = b1)
m_h1b_d_st_b1  <- lm(stress_T2 ~ scale(stress_T1) + disc_z * condition_c, data = b1)   # amended, same 29
# likewise for rumination, and for H3A and H3B on negative emotionality as registered
```

---

## Appendix B — Revisions following the N = 20 pilot

This version supersedes the 2026-08-04 draft, which was written before any data existed.
The pilot was run on 2026-08-06 for the sole purpose of estimating nuisance parameters and
confirming feasibility. The separation was enforced in the analysis code rather than by
convention: the condition variable is removed from the data frame before any statistic is
computed, and a guard raises an error on any attempt to associate a trait predictor, or
pre-task predicted efficacy, with an outcome — that is, on every quantity that one of the 17
confirmatory tests estimates. No effect size for any hypothesis exists anywhere in the pilot
output.

**Sample size and power.** The original draft set N = 200 on an analytic approximation. That
approximation proved slightly optimistic once the BH correction, the instruments' censoring,
and the observed trait collinearity were all represented. The target is now **N = 300**, set
by simulation of the full 17-test family (§3.4), and the limits of what H1 can establish are
stated explicitly rather than left implicit.

**Hypothesis structure.** H1B was originally specified as a three-way interaction
(discrepancy × rumination × condition). The pilot's observed discrepancy–rumination
correlation of .53 makes that product term less identifiable rather than more, and it is not
realistically detectable below N ≈ 800. H1B is now two two-way moderation models, one per
trait, and the three-way term has moved to the exploratory set.

**H1C dependent variable.** The original phrasing predicted that high-discrepancy
participants would spend "more time on each image", which is not jointly possible under a
fixed time budget. The coherent reading is concentration of time, and the primary test is
now a scalar entropy-based concentration index. The pilot justified making it primary: 45%
of participants left at least one image with zero dwell time and 65% left at least one image
uncoloured, so zeros are structural rather than incidental, and the entropy index is defined
at zero without imputation while the compositional model is sensitive to the imputation
choice.

**H3 timing.** Rather than add a second set of affect ratings between the framing display
and ColourMax, the post-Aptitude ratings — taken before feedback and framing — now serve as
the ColourMax baseline. This keeps the H3 baseline uncontaminated by condition and avoids
re-asking identical items two minutes apart. The consequence is three affect timepoints, so
H3B became a three-point trajectory model; the previous pre/post-pairs specification would
have entered the shared observation twice and understated its standard errors.

**Model specification.** Random slopes were removed as unidentified with two observations
per participant. The pilot estimated the effort intraclass correlation near zero, so a
singular random-intercept fit is anticipated; §5.1 now prespecifies that it is reported
rather than used as grounds for re-specifying the model after seeing the data.

**Measurement corrections.** The pilot revealed that the BAT-Student instrument administers
33 items rather than 23, so the burnout predictor is now defined explicitly as the mean of
the 23 core items. The reverse-keyed items for the RRQ and SCS-26 were verified against the
published instruments. Per-image ColourMax time was found not to exist as a stored field and
is now defined by an event-log reconstruction, validated in the pilot against the
300-second budget.

**Missing data.** The original draft asserted that item-level missingness was structurally
impossible. §5.6 now specifies a rule for the three ways it can nonetheless arise. The pilot
initially appeared to show one lost rating write in 340; on re-examination during analysis-code
development that proved to be an artefact of scoping ratings by a time window against a
client-stamped timestamp, and no write was in fact lost. The rule stands, because genuine
write loss remains possible; the reported rate does not.

**Feasibility.** Session duration was measured at a median of 30.8 minutes rather than the
45–60 minutes originally estimated, and the compensation rate is set accordingly.

**Two changes to the task software** were made on 2026-08-11, before the confirmatory sample
opens, both concerning the manipulation rather than the analysis. The Word Probe subtask's
percentile curve required a raw score achievable only by solving four to seven puzzles
inside a budget shared with two other tasks; 14 of 20 pilot participants scored exactly
zero, and 11 of those 14 had submitted valid guesses. The subtask now awards partial credit
for each valid guess with a doubled bonus for solving, on a recalibrated curve, which raises
the overall Aptitude percentile from a mean of 39 to a mean of 50 and leaves the three
subtasks comparably scaled. Separately, the revised score shown to the redemption arm was
the arithmetic sum of two percentiles and exceeded 100 for 13 of 20 pilot participants; it
is now the floored mean described in §4.1. Both changes were verified by replaying the pilot
event log before release.

---

## Appendix C — Amendments after registration

Changes made after the preregistration was submitted. Each records what changed, when, and
what data existed at the time. **C1 alters no registered analysis**: it adds interpretation and
diagnostics around a check that remains exactly as registered. **C2 does alter the confirmatory
analysis**, because data the registered analysis requires were lost during collection (§7);
every change it makes is listed there with its reason.

### C1. Interpretation of the §5.5 positive control for the Aptitude Suite

**Date: 2026-08-20. Confirmatory participants enrolled at the time of writing: none.**

**What is unchanged.** The registered check stands and is reported exactly as specified:
within each task, the correlation between predicted relative performance before the task and
experienced relative performance after it, expected at r > .2, reported for the Aptitude
Suite and for ColourMax.

**What is amended.** §5.5 states that failure of this check "indicates a data-quality
problem." That inference does not hold for the Aptitude Suite, and the registration should
not have attached it there.

The Aptitude Suite is built to break the association the check tests. Participants are
instructed to aim for the top 10% (§1.2) and watch a live percentile display for eight
minutes, so by design most of them end the task having visibly fallen short of the stated
target. The prediction is made before they have touched the task and can only reflect prior
self-belief; the experienced rating is made after sustained, specific performance feedback.
The better that feedback works, the more the experienced rating reflects the score on screen
rather than the earlier prediction — so a **low correlation is what a functioning
manipulation produces**, and the registered inference reads success as failure.

ColourMax is not a comparable reference point. Its prediction is collected after Aptitude
Suite feedback (§2.3, step 5), so prediction and experience there share a common cause — the
participant's newly calibrated estimate of their own standing — which inflates the
correlation. The contrast between the two tasks is uninformed versus informed prediction, not
clean versus faulty data.

**Why this is not a licence to ignore the check.** A low correlation is now consistent with
two very different situations: the measure is broken, or the manipulation worked. The
registered statistic cannot separate them, so failure no longer *establishes* a data-quality
problem but equally no longer *excludes* one. Three diagnostics, with thresholds fixed here
in advance, do separate them:

| | Diagnostic | Passes if |
|---|---|---|
| **D1** | Experienced rating tracks the percentile actually displayed (`apt_avg_pct`) | r > .2 |
| **D2** | Experienced rating is not degenerate | SD > 5 and no single value held by >50% of responses |
| **D3** | Prediction coheres with trait self-efficacy (GSE) | r > .1 |

D1 is the discriminating test: a working slider must respond to the feedback in front of it
even once it has decoupled from prior belief. The reading is fixed in advance:

- **Positive control fails, D1 passes** → measurement is sound; the prediction was overwritten
  by feedback. This is the design working. Proceed, and report both results.
- **Positive control fails, D1 fails** → the rating tracks nothing observable. This is the
  genuine data-quality alarm, and §5.5's stop-and-investigate applies: check step and
  occasion matching before interpreting any hypothesis test.
- **ColourMax positive control fails** → treated as §5.5 originally specifies. There is no
  design-based explanation for that task.

**Status in the pilot.** Run on the N = 20 pilot with the firewall up, so pass/fail only and
no estimate inspected or recorded: the Aptitude positive control fails, and **D1, D2 and D3
all pass**. The experienced rating tracked the displayed percentile even in the pilot, where
the Word Probe scoring defect (Appendix B) was still present and had compressed that
displayed percentile. The measurement chain is therefore sound end to end, and the Aptitude
decoupling sits between prediction and experience rather than in the instrumentation. This
is reported as a boolean gate under the same discipline already applied to the registered
positive control; no correlation was estimated or examined.

**Consequence for the interim check.** The interim data-quality gate at approximately 30
confirmatory participants is to be run in the pipeline's default firewall mode, which reports
these gates as pass/fail while suppressing every hypothesis test. Running it in confirmatory
mode would print the full 17-test family at n ≈ 30 and is not a permitted way to perform this
check.

**Why this was amended before data collection rather than after.** Two accounts predicted the
pilot failure — the Word Probe defect, corrected before launch, and the design argument above.
They make opposite predictions about whether the registered correlation recovers in the
confirmatory sample. Fixing the interpretation now, with no confirmatory data in existence,
keeps that a prediction rather than an explanation offered after the fact.

### C2. Amendments following the confirmatory-sample data loss

**Dates: drafted 2026-09-10, finalised 2026-09-11. Confirmatory data at the time of writing:
collection closed (330 enrolled, 292 complete sessions) and exported; no confirmatory model fitted
(§7.7).**

C2.1–C2.4 respond to the loss documented in §7. Each is the smallest change that lets a registered
hypothesis be tested on the data that exist. None adds a hypothesis, and each was decided from which
variables exist, not from any result. C2.5 adds exploratory analyses that examine two of those
decisions. All were settled before any confirmatory model was fitted (§7.7).

#### C2.1 H1B is refitted on stress

**Registered**: `NA_postCM ~ NA_T1_z + trait_z * condition` (§5.1), two models.
**Amended**: `stress_T2 ~ stress_T1_z + trait_z * condition`, two models (trait ∈ {discrepancy,
rumination}), with the same critical term — the interaction — predicted negative.

**Why this substitution.** The registered covariate, T1 negative emotionality, was lost for batch
2. §5.1 justifies that covariate by its position: it is taken before score feedback and before
the framing display, so it is a clean pre-manipulation baseline. T1 stress meets the same
requirement. It is collected in the same post-Aptitude block, immediately before the
negative-emotionality rating, and so also precedes feedback and framing. The outcome moves to
stress as well, rather than keeping T2 negative emotionality with a stress covariate, so that the
baseline adjustment is made on the same measure as the outcome, as the registered ANCOVA does.
Stress is the affect measure the registration already treats as co-equal with negative
emotionality throughout H3.

**What it is not.** It is not the registered H1B model: its outcome is stress rather than negative
emotionality, so a result bears on H1B's claim by way of that substitution, which is stated wherever
an H1B result is reported.

**Inference.** Confirmatory. The two refitted tests are members of the 14-test family (C2.3) and
share its Benjamini–Hochberg correction. H1B is a registered, a priori hypothesis; the refit keeps
its registered structure and was specified before any confirmatory model was fitted (§7.7), so it is
treated as a test of that hypothesis rather than as an exploratory analysis. As a stress model it
receives the ordinal robustness refit of §5.2.

#### C2.2 H2A, H2B and H3A in single-task reduced form, still confirmatory

**H2A and H2B.** Registered: `effort ~ trait_z + task + (1 | id)`, stacking the effort ratings
from both tasks. The Aptitude Suite effort rating was lost for batch 2, so each model is fitted on
the ColourMax rating alone: `effort_postCM ~ trait_z`, by ordinary least squares. The task term
and the random intercept drop out with the second row. The critical terms, the trait
coefficients, are unchanged.

**H3A, stress.** Registered: `preDV ~ discrepancy_z + predicted_efficacy_z + task + condition +
(1 | id)`, stacking an Aptitude row (T0 stress with the pre-Aptitude prediction) and a ColourMax
row (T1 stress with the pre-ColourMax prediction). The pre-Aptitude prediction was lost for batch
2, so the model is fitted on the ColourMax row:
`stress_T1 ~ discrepancy_z + predicted_efficacy_CM_z + condition`. Both critical terms remain.
The interpretive consequence: the surviving prediction is made after Aptitude Suite feedback, so
H3A now tests the relation between that informed prediction and the state carried out of the
Aptitude Suite. The cold-start pairing, of T0 stress with an uninformed prediction, is no longer
tested.

**Why they stay confirmatory.** The lost observation costs precision, not identification. The
critical terms are between-person coefficients, which one row per participant estimates directly.
For H2A and H2B, §5.1 already anticipated a random-intercept variance near zero, under which the
two stacked rows are close to independent observations of the same between-person effect; losing
one inflates the standard error by at most a factor of about √2 and changes nothing about what is
estimated. The same holds for the between-person critical terms of H3A.

#### C2.3 The confirmatory family is reduced from 17 tests to 14

Removed, because the ratings they require were lost:

- H1B, both tests as registered, replaced in the family by the two refitted tests of C2.1;
- H3A on negative emotionality, both critical terms;
- H3B on negative emotionality.

The family: H1A (2), H1B refitted on stress (2), H1C (1), H2A (2), H2B (1), H2C (3), H3A on
stress (2), H3B on stress (1) — 14 tests. The Benjamini–Hochberg correction is applied at q = .05
across all 14, with the inference criteria of §5.3 otherwise unchanged. Removing tests from a BH
family makes each remaining test easier to pass, not harder, so the smaller family is declared here,
with its reason, rather than applied without comment. Complete data for the five removed tests exist
for the 29 batch-1 participants only. They are used for no confirmatory test, and are examined after
the confirmatory analysis as an exploratory check (C2.5, E4).

#### C2.4 ColourMax participants who never left the first image are excluded from the per-image analyses

**Rule** (new §5.4 criterion 7). A participant with no page-transition events in ColourMax — who
never moved off the first of the five images — is excluded from the analyses that use per-image
ColourMax data (Scope, below).

**Why.** H1C's outcome is the concentration of time across five images, which presupposes that the
participant knew there were five. One participant wrote to the study team to say they had not
understood that there would be more than one image, despite the instructions. The data fit that
reading rather than a deliberate strategy. Twenty-nine confirmatory participants never navigated;
27 of them coloured exactly one image and 2 coloured none, at a mean coverage of 14.7%. The 273 who
navigated coloured 3.56 images on average, at 48.8% coverage. A participant who never navigated has
a time allocation of (1, 0, 0, 0, 0), which puts the concentration index at its maximum for a
reason unrelated to perfectionism; retained, these participants would enter H1C as its most extreme
concentrators.

**Keyed on navigation, not on images coloured.** Six participants navigated, saw the other images,
and chose to colour only one. Those are genuine concentrators and are retained.

**Scope.** Every analysis that uses per-image ColourMax data: H1C (primary, secondary and tertiary
models) and H2D. Participants excluded under this rule remain in every other analysis.

**A post-randomization exclusion.** Non-navigation happens during ColourMax, after the framing
display, so in principle its rate could differ between arms. That rate is reported by arm, and the
excluded participants' data are analysed rather than set aside (C2.5, E1–E3).

#### C2.5 Exploratory analyses added

Declared on 2026-09-11, before any confirmatory model was fitted. Not in the confirmatory family;
reported without multiplicity correction, as estimates with 95% confidence intervals.

- **E1. The criterion-7 participants included.** H1C (primary, secondary and tertiary models) and
  H2D refitted with the participants who never left the first image, as a sensitivity analysis to
  the exclusion in C2.4.
- **E2. Whether non-navigators differ in trait.** The criterion-7 participants compared with all
  other complete sessions on discrepancy perfectionism — the question being whether staying on one
  image reflected exceptionally high perfectionism rather than a misunderstanding of the task — and,
  secondarily, on rumination and burnout: Welch t-tests with Hedges' g. The confirmatory H1C stands
  as specified whatever E2 shows; E2 informs how the exclusion, and E1, are interpreted.
- **E3. Non-navigation by framing arm.** A Fisher exact test of non-navigation against arm, because
  the exclusion rests on behaviour that follows randomization (C2.4).
- **E4. The registered tests, on the batch that can run them.** Only after the confirmatory analysis
  is complete: the five tests removed in C2.3, fitted exactly as registered on the 29 batch-1
  participants, beside the amended specifications fitted to the same 29, to judge whether there is
  reason to suspect the conclusions would differ under the analyses as originally registered. With
  n = 29 and a date-selected subsample, E4 is descriptive — estimates and intervals, with no claim of
  significance and no bearing on the confirmatory results.
