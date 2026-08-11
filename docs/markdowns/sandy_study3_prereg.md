# Preregistration — Perfectionism and Effort Allocation in Multi-task Performance

**Study**: Sandy Study 3 · Regulatory and Affective Dynamics Lab, University of Toronto Mississauga
**Format**: OSF Standard Preregistration
**Version**: 2026-08-11 (pilot-informed). Supersedes the 2026-08-04 draft; see Appendix B.

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

### 3.2 Data collection procedures

Participants are recruited via Prolific. Inclusion criteria: fluent English; currently
enrolled as a post-secondary student (Prolific prescreen); normal or corrected-to-normal
vision; access to a desktop or laptop, since ColourMax requires mouse input. Exclusion at
recruitment: Prolific prescreen for active suicidal ideation, given the DASS-21 content.
Compensation is at or above Prolific's recommended hourly rate for a 35-minute session.

Session duration was measured in the pilot at a median of 30.8 minutes (IQR 28.4–35.3).
The longest components are the Aptitude Suite (8.8 minutes), ColourMax (5.3 minutes), and
the questionnaire battery (approximately 11.5 minutes).

### 3.3 Sample size

**Target: N = 300 valid sessions** (approximately 150 per arm) after the exclusions in
§5.4. Recruitment continues until 300 valid sessions are reached. No interim hypothesis
tests are conducted; the stopping rule is a fixed valid-N count, evaluated on completed
sessions only.

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

### 4.4 Behavioural measures

**Aptitude Suite**: per-task raw scores and percentile ranks for the three subtasks; the
overall percentile displayed to participants; task-switch count; time per task.

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

Everything else — simple slopes, the Dirichlet omnibus and its components, secondary and
tertiary models, subscale analyses, robustness refits, and §5.7 — is explicitly
non-confirmatory and is reported without correction.

Mixed-model p-values use Satterthwaite degrees of freedom. Effect sizes are reported as
standardized β with a 95% confidence interval for every confirmatory coefficient, and as f²
for least-squares terms.

### 5.4 Data inclusion and exclusion

The unit of analysis is a valid completed session. Criteria are applied in order, and counts
are reported for each:

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

### 5.6 Missing data

Sliders, rating scales and questionnaires are required fields in the platform flow, so a
participant cannot advance past a step without answering it. Missingness therefore arises
from three sources: dropout (§5.4, criterion 1), technical failure (§5.4, criterion 6), and
silent write loss — a completed step whose response never reaches the database. The pilot
observed write loss at 1 of 340 rating writes (0.29%).

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
- Task-switch count and per-task time allocation within the Aptitude Suite as behavioural
  signatures of perfectionism, paralleling H1C within the first task.
- Belief updating: the change from predicted to experienced efficacy, its relation to
  observed percentile and to the traits, and satisfaction as a function of the
  predicted-minus-observed gap.
- Framing effects on affect itself: the condition main effect on T2 stress and negative
  emotionality, adjusting for T1.
- APS-R High Standards and Order subscales, SCS-26, DASS-21, GSE and PANAS as alternative
  predictors and covariates.

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
impossible. The pilot falsified this: one rating write in 340 was silently lost despite the
step being completed. §5.6 now specifies a rule for it.

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
