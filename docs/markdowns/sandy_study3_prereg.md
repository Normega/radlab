# Preregistration — Perfectionism and Effort Allocation in Multi-task Performance (Sandy Study 3)

> OSF Standard Preregistration format. Draft prepared 2026-08-04 from the working Google Doc ("Pre-Reg" and "Statistical Models" tabs) reconciled against the session flow actually built on the RADlab platform (`/admin/studies` → Sandy Study 3, study id `f8cbf629`). Decisions made in this draft that depart from the working doc are marked **[DECISION]**; items requiring a build or design change before launch are marked **[BUILD]**. Both are indexed in §7.

---

## 1. Study Information

**Title.** Perfectionism and Effort Allocation in Multi-task Performance

**Description.** This study examines how maladaptive (discrepancy) perfectionism relates to effort allocation, performance variability, and affective responses during a multi-task cognitive battery, and whether a "redemption" framing of a bonus task moderates these relations. Participants complete the **Aptitude Suite** — three concurrent word tasks (Unscramble/anagrams, Word Storm/category fluency, Word Probe/deductive word guessing) under a shared 8-minute budget with free task switching and a real-time percentile-rank display — followed by **ColourMax**, a 5-minute paint-by-numbers task with five images. Participants are randomized to one of two framings of ColourMax delivered immediately after their Aptitude Suite score feedback:

- **Control**: "You've finished Aptitude Suite. The next activity will begin shortly. Note that this activity will not count toward your overall score."
- **Redemption**: "Good news: you now have a chance to raise your percentage!" — and, at the end of ColourMax, a combined "new overall score."

Brief state ratings (stress, negative/positive emotionality, predicted/experienced performance relative to others, effort, satisfaction) are collected around each task. A trait questionnaire battery (APS-R, BAT-Student, PANAS, RRQ-rumination, GSE, DASS-21, SCS-26), demographics (U of T Student Equity Census), and a debrief close the session. The session is single-shot, fully online, desktop-required, and takes ~35 minutes (pilot median 30.8; §3).

**Hypotheses.** Three hypothesis families, all directional. The specific statistical test for each is given in §5; the confirmatory test family is enumerated in §5.3.

**H1 — Redemptive framing moderates trait–behavior links (framing × trait interactions).**

- **H1A.** The positive relation between discrepancy perfectionism (and, separately, rumination) and self-reported effort on ColourMax is stronger in the redemption condition than the control condition.
- **H1B.** The relation between discrepancy perfectionism (and, separately, rumination) and post-ColourMax negative emotionality (adjusting for pre-manipulation negative emotionality) differs by condition: among high-trait participants, the redemption framing reduces post-task negative emotionality relative to control.
- **H1C.** Discrepancy perfectionism predicts more *concentrated* (less even) allocation of time across the five ColourMax images, and this relation is stronger in the redemption condition. Secondarily, discrepancy perfectionism predicts higher ColourMax precision in the redemption condition relative to control.

**H2 — Trait main effects on effort and performance variability.**

- **H2A.** Higher discrepancy perfectionism and higher rumination each predict higher post-task effort ratings.
- **H2B.** Higher burnout predicts lower post-task effort ratings.
- **H2C.** Higher discrepancy perfectionism, rumination, and burnout each predict greater within-person variability across the three Aptitude Suite task percentile scores (uneven effort allocation), controlling for mean performance.
- **H2D** *(exploratory — see §5.7)*. The same traits predict a steeper decline in ColourMax per-image performance (precision/coverage) from earlier- to later-positioned images.

**H3 — Anticipatory stress and negative emotionality.**

- **H3A.** Higher discrepancy perfectionism and lower pre-task predicted self-efficacy each predict greater pre-task stress and negative emotionality (the state immediately preceding each task segment).
- **H3B.** Higher discrepancy perfectionism predicts a steeper increase in stress and negative emotionality across the session's three affect timepoints (pre-Aptitude → post-Aptitude/pre-ColourMax → post-ColourMax).

**[DECISION D1]** The working doc's H1B specified a three-way interaction (discrepancy × rumination × condition). A three-way interaction between two correlated, imperfectly reliable continuous traits and a binary factor is realistically detectable only at N ≥ ~800 (see §3.4) — and the pilot's observed discrepancy–rumination correlation of .53 makes the product term worse, not better; at the registered N a null would be uninterpretable. H1B is therefore specified here as two 2-way moderation models (one per trait), and the three-way term is demoted to the exploratory set (§5.7).

---

## 2. Design Plan

**Study type.** Experiment — randomized controlled experiment delivered online via the RADlab platform (radlab.zone).

**Blinding.** Participants are blind to condition and to the existence of a second framing. No experimenter interaction occurs during the session (fully automated delivery), so experimenter blinding is structurally guaranteed.

**Study design.** Single-session, between-subjects, one factor (ColourMax framing) with two levels (control, redemption). All state ratings are within-subject repeated measures around the two tasks. No counterbalancing: task order is fixed (Aptitude Suite → ColourMax) because the manipulation is defined by its position after Aptitude Suite feedback.

**Session flow as built** (platform session template "Sandy Study 3", 34 steps):

1. Transition display → pre-task ratings (stress VAS 1–6; negative emotionality slider 0–100; positive emotionality slider 0–100; predicted relative performance slider 0–100)
2. **Aptitude Suite** (8 min, three tasks, free switching, live percentile display)
3. Post-task ratings (effort 0–100; stress; negative; positive; experienced relative performance 0–100)
4. Score feedback display (predicted vs. observed percentile) → task satisfaction VAS → **framing display (manipulation)** → bonus-round instructions
5. Pre-ColourMax rating (predicted relative performance). No additional affect ratings are inserted here: the post-Aptitude stress/negative/positive ratings (taken before feedback and framing) serve as the pre-ColourMax affect baseline (**[DECISION D9]**)
6. **ColourMax** (5 min, 5 images)
7. Post-task ratings (satisfaction; effort; stress; negative; positive; experienced relative performance) → condition-gated score display
8. Questionnaire battery: APS-R, BAT-Student, PANAS, RRQ-rumination, GSE, DASS-21, SCS-26
9. U of T Student Equity Census (demographics) → Debrief

Note the deliberate ordering: **trait questionnaires are administered after the tasks**, to avoid priming perfectionism/rumination content before the behavioral measures. A randomization check (§5.5) tests whether condition leaked into trait reports.

**Randomization.** Simple individual-level randomization, 1:1 allocation, executed server-side by the platform's permuted-block randomizer (`draw_assignment`: seeded permuted blocks per slot, concurrency-locked, idempotent per participant; audit trail in `participant_assignments`). The operative slot is `framing` with arms `control` / `redemption`. Assignment occurs at session entry after consent, before any study content. The study also carries a vestigial `condition` slot (control/treatment) left over from the platform randomizer pilot. It is retained as-is (**[DECISION D11]**): the draw is server-side, no session content references it, and participants see no trace of it — its only artifacts are an inert row per participant in `participant_assignments` and an unused export column. Analysis uses the `framing` slot exclusively.

---

## 3. Sampling Plan

**Existing data.** Registration prior to creation of the confirmatory data. No data for the confirmatory sample have been collected. A pilot (N = 20) **was** collected on 2026-08-06, before registration, to estimate nuisance parameters only (§3.5); no hypothesis test was run on it, no effect size was estimated from it, and it is not pooled with the registered sample.

**Data collection procedures.** Participants recruited via Prolific. Inclusion: fluent English; currently enrolled post-secondary student (Prolific prescreen); normal or corrected-to-normal vision; desktop/laptop required (ColourMax requires mouse input; enforced by Prolific device filter and platform check). Exclusion at recruitment: Prolific prescreen for active suicidal ideation (given DASS-21 content). Compensation at or above Prolific's recommended hourly rate for a 35-minute session (see Session duration below). **[DECISION D2]** The working doc named UTM undergraduates in one place and Prolific in another; this draft specifies Prolific with a post-secondary-student prescreen. If SONA/UTM recruitment is used instead or additionally, the sampling section must be revised before registration.

**Session duration.** Measured in the pilot at a **median of 30.8 minutes** (IQR 28.4–35.3;
sum of step durations), not the 45–60 minutes originally estimated. Longest components:
Aptitude Suite 8.8 min, ColourMax 5.3 min, questionnaire battery ~11.5 min. Recruitment
materials and the Prolific pay rate are set against a **35-minute** estimate.

**Sample size.** See §3.4 — the target is set by the simulation-based power analysis.

### 3.4 Sample size rationale (simulation-based power analysis)

Power was estimated by Monte Carlo simulation of the **entire 17-test family jointly**, so
that Benjamini–Hochberg power is evaluated as it will actually be applied (§5.3) rather
than test-by-test. Each of 2,000 replicates per design cell generates a complete study,
fits all 17 preregistered models, applies BH across the 17 p-values, and records which
survive. Code: `R/04_power_simulation.R`; results: `output/power_grid.csv`.

**Realism comes from the N = 20 pilot, effect sizes do not.** The simulation takes from
the pilot only nuisance parameters — outcome dispersion and distribution shape, the
observed trait correlation matrix (discrepancy–burnout **r = .71**, discrepancy–rumination
.53, rumination–burnout .46), cor(discrepancy, pre-task predicted efficacy) = **−.63**,
within-person ICCs (stress .60, negative affect .46, positive affect .87), the H1B baseline
covariate correlation (.47), and the instruments' censoring (0–100 sliders clipped,
reproducing the observed effort ceiling; stress rounded to its 6-point scale, reproducing
its floor). Effect magnitudes are swept over a grid and never estimated from the pilot
(§3.5). Type-I control was verified at δ = 0: uncorrected rejection .052, BH rejection .004.

δ denotes a standardised effect: for main effects a partial correlation; for interactions
the **difference in trait slope between arms (Δr)**.

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

Three things follow, and the third is the important one.

1. **Everything except H1 is comfortably powered at modest N.** H2A/H2B detect partial
   r = .23 at N = 200; H3B detects r = .18 (three timepoints make the within-person
   time × trait contrast the most efficient test in the family); H2C and H3A detect
   r ≈ .25 at N = 250 despite the trait collinearity penalty. These sit inside the range
   typically reported for perfectionism and rumination with effort and affect outcomes.
2. **The multiple-comparison correction is nearly free.** Averaged across the family, BH
   costs 1–4 percentage points of power at N ≥ 200 for δ ≥ .25 (e.g. at N = 250, δ = .25:
   .79 uncorrected vs. .76 corrected). Shrinking the confirmatory family to buy power would
   therefore gain almost nothing; the 17-test structure is not what limits this study.
3. **The H1 framing × trait interactions are the binding constraint, and they are hard.**
   Detecting a between-arm slope difference of Δr = .30 — already a *large* moderation —
   needs N ≈ 300 for H1B and N ≈ 400 for H1A and H1C. A more typical moderation of
   Δr ≈ .20 would need roughly N ≈ 800, and Δr ≈ .15 is out of reach entirely. This is
   intrinsic to between-subjects moderation of a continuous trait, not a defect of the
   design or the correction.

**Target: N = 300 valid sessions** (~150 per arm) after exclusions (§5.4) — **[DECISION D12]**.
The rationale is explicitly a compromise: it brings H1B to 80% power for Δr = .30, leaves
H1A and H1C at 68–71% power there, and gives ≥ 95% power to every H2 and H3 test at
δ = .25. N = 400 would raise the H1 family to Δr ≈ .26–.30 at a third more cost; N = 200
would leave the study's headline hypothesis powered only for moderation of Δr ≈ .40.

**Stated plainly, so that the result is interpretable either way:** a null H1 result at
N = 300 rules out *large* moderation of trait–behaviour links by redemptive framing. It
does not rule out the small-to-moderate moderation that would be the more typical finding
in this literature. H2 and H3 are the parts of this study that will yield decisive
evidence at achievable sample sizes.

Two design changes identified in the pilot (methods log §1.8, §1.9) act on the *numerator*
rather than the sample size, and are the more efficient route to H1 sensitivity: the
Word Probe recalibration removes an artefact that deflates the score feedback the
manipulation is built on, and the redemption-score fix removes an incoherent >100
"percentile" seen by 13 of 20 pilot participants. Both plausibly strengthen the
manipulation and so the moderation being tested.

**Not covered by these figures:** the H1C Dirichlet regression (secondary; `DirichletReg`
was not available in the analysis environment and the test is not in the confirmatory
family) and the exploratory analyses of §5.7. The confirmatory H1C test is the scalar
concentration index precisely so that H1C's status does not rest on the compositional model.

### 3.5 Pilot (N = 20) — completed 2026-08-06

A Prolific pilot of N = 22 enrolled / **20 with complete sessions** (11 redemption,
9 control) was run before registration. It was **not** used to estimate effect-size
priors: at N = 20 the 95% CI on a correlation spans roughly ±.45, so any observed pilot
effect is uninformative and using it to power the main study would be circular.

**The firewall is enforced in code, not by convention.** In `scripts/03_nuisance_params.py`
the condition column is removed from the data frame before any statistic is computed, and
a guard function raises an error on any attempt to associate a trait predictor — or
pre-task predicted efficacy — with an outcome, i.e. on every quantity that one of the 17
confirmatory tests estimates. No H1, H2 or H3 effect size exists anywhere in the pilot
output.

What the pilot did establish, and what each result changed:

1. **ColourMax zero structure.** 9/20 participants (45%) left ≥1 image with zero dwell
   time; 13/20 (65%) left ≥1 image uncoloured. Zeros are structural, not noise — which
   confirms **D7** (the entropy-based concentration index, defined at zero without
   imputation, as the primary H1C test) and makes the Dirichlet secondary analysis
   genuinely sensitive to its detection-limit choice.
2. **Distributions and censoring.** Effort ratings are ceilinged (25% at 100 post-Aptitude,
   20% post-ColourMax, skew −2.7) and stress is floored (45% at the scale minimum at T0).
   The stress floor trips the §5.2 >30%-at-a-boundary rule, so the Tobit sensitivity
   analysis and the ordinal (`clm`) refit are both expected to fire. Both censoring
   patterns are reproduced in the power simulation.
3. **H2C dependent variable.** Within-person SD of the three subtask percentiles:
   mean 36.4, SD 16.8, skew −0.71 — so the §5.2 log-transform rule (right skew) will
   *not* apply, contrary to the original expectation.
4. **Trait intercorrelations.** Discrepancy–burnout **r = .71**, discrepancy–rumination
   .53, rumination–burnout .46 (VIFs 1.4–2.3). Below the §5.1 VIF > 5 trigger, but high
   enough to inflate H2C standard errors by 1.2–1.5×; now built into the power simulation.
5. **Reliability.** APS-R Discrepancy α = .93, RRQ Rumination α = .93, BAT core-23 α = .95.
   Trait attenuation is therefore minor; the single-item slider DVs are the limiting
   reliability and cannot be estimated from one administration.
6. **Within-person dependence.** Stress ICC .60, negative affect .46, positive affect .87
   across the three timepoints — these drive the H3 models' efficiency. Effort ICC was
   −0.18 across its two administrations (see **D13**).
7. **Feasibility.** Median session 30.8 min (IQR 28.4–35.3), not 45–60. Rating-write loss
   0.29% (§5.6). Every variable in §4 was located in the export, though three required
   different sources than assumed and ColourMax time-per-image had to be reconstructed
   from the event log (§4 indices).
8. **Two measurement defects** were found and are documented in the methods log §1.8–1.9:
   the Word Probe percentile curve (median displayed percentile 0, against 56 and 60 for
   the other two subtasks) and the redemption score displayed as a sum of two percentiles
   (>100 for 13/20). Both bear on the manipulation itself rather than on the analysis.

Pilot data are excluded from all confirmatory analyses and are not pooled with the
registered sample.

---

## 4. Variables

**Manipulated variable.** ColourMax framing (control vs. redemption), operationalized by the two framing displays quoted in §1 and by the condition-gated end-of-task score display (the redemption arm additionally sees "your new overall score is {redemption_score}"). Since 2026-08-11 `redemption_score` is `max(aptitude_pct, mean(aptitude_pct, colourmax_pct))` — the mean of the two percentiles, floored at the Aptitude percentile so the bonus round can never lower a participant's standing. It was previously the arithmetic *sum*, which exceeded 100 for 13 of 20 pilot participants; see methods log §1.9. Server-side assignment record: `participant_assignments`, slot `framing`.

**Measured variables — trait (questionnaire battery, post-task).**

| Construct | Instrument (platform slug) | Scoring used here |
|---|---|---|
| Discrepancy perfectionism | APS-R (`aps-r`), 23 items, 1–7 | Mean of the 12 Discrepancy-subscale items (primary trait predictor). High Standards and Order subscales scored but exploratory only. |
| Rumination | RRQ rumination subscale (`rrq-rumination`), 12 items, 1–5 | Mean of 12 items |
| Burnout | BAT-Student (`bat-student`), **33 items**, 1–5 (never–always) | Mean of the **23 BAT-C core items** (Exhaustion 8, Mental Distance 5, Cognitive Impairment 5, Emotional Impairment 5) — the preregistered burnout predictor. The 10 BAT-S secondary items (Psychological, Psychosomatic Complaints) are exploratory. |
| Trait self-efficacy | GSE (`gse`), 10 items, 1–4 | Mean; exploratory covariate only |
| Mood | DASS-21 (`dass-21`) | Subscale sums ×2; exploratory covariates |
| Self-compassion | SCS-26 (`scs-26`) | Standard subscale/total scoring; exploratory |
| Trait affect | PANAS (`panas`) | PA/NA sums; exploratory |

**[DECISION D3]** State affect around tasks is measured with the built single-item sliders, not PANAS state subscales (the working doc referenced PANAS state pre/post per task, which is not in the build and would add ~8 administrations). PANAS appears once, in the trait battery. The single reference to a "Brief Inventory of Perceived Stress" in the doc's indices is replaced by the built single-item stress VAS.

**Measured variables — state (around each task; platform slugs in parentheses).**
*Storage note (confirmed against the pilot export): only the two 6-point emoji scales
(stress, task satisfaction) are stored in `vas_responses`. Every single-item 0–100 slider
is stored as a row in `questionnaire_responses` under its own slug, with the value in a
`{"value": n}` payload. Scale scoring keys, including reverse-keyed items, live in
`questionnaires.definition.scoring.subscales[]` and not on the item objects.*

- Stress: 6-point emoji VAS (`vas_stress`), three timepoints — T0 pre-Aptitude, T1 post-Aptitude (before feedback/framing; doubles as the pre-ColourMax baseline), T2 post-ColourMax
- Negative emotionality: 0–100 slider (`slider_negative_emotionality`), same three timepoints
- Positive emotionality: 0–100 slider (`slider_positive_emotionality`), same three timepoints
- Predicted relative performance ("How well do you think you will do relative to others on the next task?"): 0–100 slider (`slider_predicted_efficacy`), before each task
- Experienced relative performance: 0–100 slider (`slider_post_efficacy`), after each task
- Effort ("How much effort did you put into the task?"): 0–100 slider (`slider_how_much_effort_did_you_put_into_the_task`), after each task
- Task satisfaction: VAS (`vas_task-satisfaction`), after each task

**Measured variables — behavioral (platform-logged).**

*Aptitude Suite* (`aptitude_sessions` / `aptitude_events`): per-task scores and platform percentile ranks (Unscramble, Word Storm, Word Probe); overall percentile (`avg_pct`, the value displayed to participants); task-switch count; time per task.

*ColourMax* (`color_max` outputs): time on each of the 5 images (s); per-image coverage (% of colourable pixels coloured) and precision (% coloured correctly within boundaries); overall `avg_pct`; images completed; in the redemption arm, the displayed `redemption_score`.

**Indices (computed).**

- **Time-allocation proportions:** p_i = t_i / Σt_i over the five images (denominator = the participant's actual total, not the nominal 300 s). *Per-image time is not a stored field: it is reconstructed from the `page_switch` events in `aptitude_events` (each carrying `{from, to}` and a wall-clock `elapsed_ms`), bracketed by `session_start` and `game_end`, with the initial page being image 1. The `results.toolTimeByPage` field is brush-contact time, not dwell time, and is **not** used. Validated on the pilot: reconstructed totals summed to 301.0 s (SD 1.9) against the 300 s budget for all 20 participants. Because `elapsed_ms` is wall-clock while the in-game countdown is a throttleable `setInterval`, any session whose reconstructed total falls outside 290–320 s is flagged and excluded (§5.4 criterion 6).*
- **Allocation concentration (H1C primary DV):** 1 − H/log(5), where H = −Σ p_i·log(p_i) (Shannon entropy; 0·log 0 ≡ 0). Ranges 0 (perfectly even fifths) to 1 (all time on one image). Defined for zeros without imputation.
- **Aptitude variability (H2C DV):** SD of the three Aptitude Suite task percentile scores within participant; mean of the three as its covariate.
- **Pre–post change scores (descriptive/plots only):** post − pre for stress, NA, PA, efficacy. Confirmatory H3B models use the stacked pre/post ratings, not difference scores.
- **ColourMax precision (H1C secondary DV):** mean precision across images with any colouring.

---

## 5. Analysis Plan

All analyses in R (≥4.3). Mixed models: `lme4`/`lmerTest` (Satterthwaite df). Dirichlet regression: `DirichletReg`. Zero replacement (Dirichlet only): `zCompositions::multRepl` **[DECISION D4** — `multRepl` lives in `zCompositions`, not `compositions` as in the working doc**]**. Analysis script skeleton in Appendix A; the final registration will attach a complete, runnable script exercised end-to-end on pilot (or simulated) data.

### 5.1 Statistical models per hypothesis

Condition coded control = −0.5, redemption = +0.5. All continuous trait predictors and pre-task covariates z-scored on the analysis sample. One model per trait where "separately" is indicated; each model's single prespecified critical term is what enters the confirmatory family (§5.3).

**H1A** (2 models: trait ∈ {discrepancy, rumination}):
`effort_postCM ~ trait_z * condition` (lm). Critical term: interaction. Directional prediction: positive. If significant, simple slopes per arm reported.

**H1B** (2 models):
`NA_postCM ~ NA_postAS_z + trait_z * condition` (lm). The post-Aptitude negative-emotionality rating is taken *before* score feedback and framing (step order 8 vs. 11/13/14), so it is a clean pre-manipulation baseline; this is a baseline-adjusted ANCOVA, preferred over raw change scores. Critical term: interaction (predicted negative: redemption lowers adjusted post-task NA more strongly at high trait levels).

**H1C primary**:
`concentration ~ discrepancy_z * condition` (lm), concentration as defined in §4. Critical term: interaction (predicted positive). Main effect of discrepancy is the directional secondary term (reported, exploratory).

**H1C secondary (supporting, not in the confirmatory family):** Dirichlet regression on the five-part composition: `DR_data(proportions) ~ condition * discrepancy_z`, common parameterization; omnibus LRT of the interaction block (full vs. main-effects model). Zeros replaced via `multRepl` with detection limit = (1 s)/Σt (per-row), sensitivity-checked at 0.1 s and 5 s. Component-wise interaction coefficients are exploratory (which images drive concentration).

**H1C tertiary (exploratory):** `precision_mean ~ discrepancy_z * condition`.

**H2A/H2B** (one stacked model each): effort ratings from both tasks (2 obs/participant),
`effort ~ trait_z + task + (1 | id)` — H2A fits discrepancy and rumination in separate models (2 critical tests); H2B fits burnout (1 critical test). Critical terms: trait coefficients (H2A positive, H2B negative). **[DECISION D5]** Random intercepts only: with two observations per participant, random slopes (`(Task | id)` in the working doc) are unidentified.

**[DECISION D13 — singular-fit rule]** The pilot estimated the effort ICC at −0.18 across
the two administrations, i.e. no detectable between-person consistency (though at n = 20
with two observations this estimate is very imprecise and is not distinguishable from
zero, or from .3). If the random-intercept variance is estimated at or near zero and
`lmer` reports a singular fit, the model is **not** re-specified: a zero intercept variance
means the two occasions are effectively independent, the fixed-effect test for a
between-person trait predictor remains valid, and `lmer` reduces to the correct OLS
solution of its own accord. The singular-fit warning and the estimated intercept variance
are reported. This is prespecified so that an anticipated warning cannot become a
post-hoc excuse for changing the model.

**H2C** (1 model, 3 critical tests):
`aptitude_SD ~ discrepancy_z + rumination_z + burnout_z + mean_percentile_z` (lm). Critical terms: the three trait coefficients (all predicted positive). Mean percentile is a forced covariate (mean–variance confound). The working doc's full 3-way-interaction version of this model is exploratory (§5.7). VIFs reported; if any trait VIF > 5, each trait is additionally reported from its own single-trait model as a sensitivity analysis (the joint model remains confirmatory).

**H3A** (2 models, 4 critical tests): pre-task ratings from both tasks stacked (2 obs/participant),
`preDV ~ discrepancy_z + predicted_efficacy_z + task + condition + (1 | id)`, for preDV ∈ {stress, negative emotionality}. The pre-task observation for the Aptitude Suite is T0; for ColourMax it is T1 — the post-Aptitude rating taken **before** score feedback and framing (**D9**), paired with the pre-ColourMax predicted-efficacy slider. Critical terms: discrepancy (positive) and predicted efficacy (negative) in each model. Condition is retained as a covariate because the ColourMax predicted-efficacy slider (though not the T1 affect ratings) falls after the framing display. *Construct note:* T1 reflects the state carried into the ColourMax segment rather than informed anticipation (participants have not yet been told about the bonus round); the task fixed effect absorbs the mean difference between a cold start (T0) and a post-performance state (T1).

**H3B** (2 models, 2 critical tests): all three affect timepoints stacked (3 obs/participant),
`DV ~ time_c * discrepancy_z + condition + (1 | id)`, time coded 0 (T0), 1 (T1), 2 (T2), for DV ∈ {stress, negative emotionality}. Critical term: time × discrepancy interaction (predicted positive: steeper escalation across the session at higher discrepancy). Because T1 doubles as post-Aptitude and pre-ColourMax, the pre/post pairs of the working doc's specification would duplicate the T1 observation in two rows and understate standard errors; the three-point trajectory model uses each rating exactly once. Segment-specific effects (T0→T1 vs. T1→T2, the latter including feedback + framing + task) are reported as exploratory contrasts. **[DECISION D9]**

### 5.2 Transformations

- Condition: −0.5/+0.5. Task: Aptitude = 0, ColourMax = 1. Time: pre = 0, post = 1.
- Traits and continuous covariates: z-scored (analysis-sample mean/SD). Sliders/VAS DVs analysed on their raw scale.
- The 6-point stress VAS is treated as continuous; as a prespecified robustness check, every confirmatory stress model is refit as a cumulative-link (ordinal) model (`ordinal::clm/clmm`) and coefficient sign/significance agreement is reported.
- Prespecified transformation rule (replaces the working doc's "as appropriate"): if a confirmatory model's residual skewness exceeds |2|, the DV is transformed (log(x + 1) for right skew of nonnegative DVs; otherwise rank-based inverse normal), and both raw and transformed results are reported with the transformed model confirmatory. The H2C SD index is expected to trigger this rule.
- Floor/ceiling rule: if > 30% of a slider DV sits at a single boundary value, a Tobit specification (`AER::tobit` or `censReg`) is added as a sensitivity analysis; the linear model remains confirmatory.

### 5.3 Inference criteria

- Two-tailed tests throughout **[DECISION D6** — the hypotheses are directional, but two-tailed p-values are used for robustness; a hypothesis is supported only if the BH-adjusted p < .05 **and** the coefficient sign matches the stated direction**]**.
- **Confirmatory family: exactly 17 tests**, Benjamini–Hochberg FDR at q = .05 applied across the full family:
  - H1A: 2 (discrepancy × condition; rumination × condition)
  - H1B: 2 (same two interactions on adjusted post-task NA)
  - H1C: 1 (discrepancy × condition on concentration)
  - H2A: 2 (discrepancy; rumination)
  - H2B: 1 (burnout)
  - H2C: 3 (discrepancy; rumination; burnout)
  - H3A: 4 (2 predictors × 2 DVs)
  - H3B: 2 (time × discrepancy for 2 DVs)
- Everything else (simple slopes, Dirichlet omnibus and components, secondary/tertiary models, subscales, robustness refits, §5.7) is explicitly non-confirmatory and reported without correction as exploratory.
- Mixed-model p-values: Satterthwaite. Effect sizes: standardized β with 95% CI for every confirmatory coefficient; f² for lm terms.

### 5.4 Data inclusion and exclusion

Unit of analysis: valid completed session. Applied in order, counts reported per criterion:

1. **Incomplete session** — did not reach the debrief step: excluded.
2. **Duplicate participation** — same Prolific ID or platform participant across sessions: keep first complete session.
3. **Aptitude non-engagement** — zero valid responses across all three Aptitude Suite tasks: excluded entirely.
4. **ColourMax non-engagement** — zero coloured pixels across all five images: excluded from H1 and H2D analyses (retained for H2A-Aptitude/H2C/H3-Aptitude rows).
5. **Questionnaire non-engagement** — zero variance across all APS-R items, or battery completion time < 3 minutes total (from `participant_step_timings`): excluded from all trait-based analyses (i.e., all confirmatory tests).
6. **Technical failure** — platform-logged step error or missing game telemetry for a required DV: excluded listwise for models needing that variable.

No outlier removal on legitimate values. Prespecified robustness: every confirmatory lm is refit with 3-MAD winsorization of the DV; agreement in sign and BH-significance is reported.

### 5.5 Quality/manipulation checks

- **Randomization check:** arm balance from `assignment_balance`; trait means compared across arms (|d| > 0.2 on discrepancy, rumination, or burnout is flagged as a caveat on all H1 interpretations, since traits are measured post-manipulation).
- **Manipulation check:** none (**[DECISION D10]**). The framing is enacted rather than merely asserted — the redemption arm is shown its ColourMax points being added to an updated overall score at the end of the task, and the control arm is told before the task that it will not count — so a belief probe would be redundant. All analyses are intention-to-treat on the full valid sample.
- **Positive control:** predicted relative performance (pre) should correlate with experienced relative performance (post) within task, r > .2 — a sanity check that the sliders measure something; failure triggers a data-quality investigation before any hypothesis test is interpreted.

### 5.6 Missing data

Sliders, VAS items and questionnaires are required fields in the platform flow, so a
participant cannot advance past a step without answering it. Missingness therefore arises
from three sources: dropout (§5.4 criterion 1), technical failure (§5.4 criterion 6), and
**silent write loss** — a completed step whose response row never reaches the database.
The pilot observed write loss at **1 of 340 rating writes (0.29%)**: one participant
completed the post-ColourMax stress step (2.8 s recorded in `participant_step_timings`)
with no corresponding `vas_responses` row.

Rule: models are fitted on complete cases, with the number of contributing observations
reported per model. A participant missing a single occasion of a repeated state rating is
retained for the occasions they do have in the mixed models (H2A/H2B, H3A, H3B), which
tolerate unbalanced data, and is dropped only from those single-DV models that require the
missing value. The realised write-loss rate is reported alongside the exclusion counts. No
imputation is performed. Questionnaire scale scores require ≥ 80% of subscale items
(platform enforces 100%; the rule exists for defensive scoring only).

### 5.7 Exploratory analyses (declared, uncorrected)

- Working-doc three-way interactions: discrepancy × rumination × condition (H1B form); discrepancy × rumination × burnout (± each other) on H2C/H2D variability.
- **H2D:** per-image ColourMax composite (mean of coverage and precision) regressed on image position (1–5) within participant; the person-level position slope regressed on the three traits.
- Dirichlet component-wise effects (which images absorb time under high discrepancy).
- Task-switch count and per-task time allocation in the Aptitude Suite as behavioral perfectionism signatures (parallels to H1C within the first task).
- Belief-updating: (post − pre efficacy) and its relation to observed percentile and traits; satisfaction as a function of predicted−observed gap.
- Framing effects on affect itself: condition main effect on T2 stress/NA adjusting for T1 (available directly from the H1B ANCOVA structure; no dedicated measurement needed).
- High Standards and Order APS-R subscales, SCS, DASS-21, GSE, PANAS as alternative predictors/covariates.

---

## 6. Other — known context

- The displayed Aptitude Suite "percentile" is generated by the platform's scoring curve (designed for diminishing returns near the top), not a live empirical percentile of prior participants; the redemption arm's "new overall score" is a floored mean of two percentile-type quantities (§4). Both are part of the deception covered in the debrief; the debrief form and REB protocol must describe them accurately. The Word Probe subtask's curve was recalibrated on 2026-08-11 after the pilot showed it assigned the 0th percentile to 14 of 20 participants (methods log §1.8); raw `wordprobe_score` is on a new scale from that date and must not be pooled across it.
- Pilot data (N = 20) precede registration and are excluded from all confirmatory analyses; the final registration will report which nuisance-parameter estimates were taken from the pilot and attach the simulation-based power analysis for the Dirichlet and mixed models.

---

## 7. Decision and build index

**Decisions embedded in this draft (approve or revise before registration):**

- **D1** — H1B three-way interaction demoted to exploratory; H1B is two 2-way moderations (power rationale in §3.4).
- **D2** — Sampling = Prolific post-secondary students (resolves UTM-vs-Prolific contradiction in the working doc).
- **D3** — State affect = built single-item sliders; PANAS is trait-battery only; "Brief Inventory of Perceived Stress" reference dropped.
- **D4** — `multRepl` sourced from `zCompositions` (the working doc's `compositions` package does not export it).
- **D5** — Random intercepts only in all mixed models; `(Task | id)` random slopes are unidentified with 2 obs/cell.
- **D6** — Two-tailed p-values + sign requirement, rather than one-tailed tests.
- **D7** — H1C primary test is the scalar concentration index (entropy-based; zero-safe), Dirichlet regression secondary. The working doc's "more time on each image" is not jointly possible under a fixed time budget; concentration is the coherent reading.
- **D8** — H1B uses ANCOVA on post-ColourMax NA with the post-Aptitude NA rating (taken pre-feedback, pre-framing) as baseline covariate.
- **D9** — (2026-08-04, Norm) No pre-ColourMax affect sliders are added; the post-Aptitude ratings (pre-feedback, pre-framing) serve as the ColourMax affect baseline. Rationale: no hypothesis requires isolating the framing display's own effect on mood; re-asking the same three items ~2 minutes apart invites demand effects; and a pre-manipulation baseline keeps the H3 "pre" measures uncontaminated by condition. Consequence: three affect timepoints (T0/T1/T2), so H3B is a three-point trajectory model rather than stacked pre/post pairs (which would duplicate T1 across two rows and understate SEs).

- **D10** — (2026-08-04, Norm) No manipulation-check item. The framing is enacted by the score displays themselves (redemption sees points counted; control is told they won't count), so a belief probe is redundant. Intention-to-treat throughout.
- **D11** — (2026-08-04, Norm) The vestigial `condition` slot stays; it is participant-invisible and analysis ignores it. No study duplication.
- **D12** — (2026-08-11) Target **N = 300** valid sessions, set by the simulation-based power analysis (§3.4). Chosen as the point where H1B reaches 80% power for a large moderation (Δr = .30) while every H2/H3 test exceeds 95% power at δ = .25. The H1 family remains powered for large moderation only; this is stated in §3.4 rather than assumed away.
- **D13** — (2026-08-11) Singular random-intercept fits in H2A/H2B are anticipated (pilot effort ICC ≈ 0) and are reported rather than re-specified. See §5.1.
- **D14** — (2026-08-11) Scale scoring reads `questionnaires.definition.scoring.subscales[]` (item-level `reverse` flags are null throughout and must be ignored). Burnout = mean of the 23 BAT-C core items. Verified: RRQ reverses `rrs_6/9/10`; SCS reverses Self-Judgment, Isolation, Over-Identification; APS-R has no reverse items.

**Build changes needed before launch:**

- ~~**B1**~~ — *Withdrawn per D9* (was: insert pre-ColourMax affect sliders). No build change needed for H3.
- ~~**B2**~~ — *Withdrawn per D10* (was: manipulation-check item).
- ~~**B3**~~ — *Resolved per D11* (slot stays, documented as inert).
- **B4** — Verify in the pilot export that every §4 variable lands in `/admin/export`'s participant master with the expected `_t<n>` occurrence suffixes (pre/post repeated slugs).

---

## Appendix A — Analysis script skeleton (R)

```r
# Set Up ---------
## Load libraries ---------
packages <- c(
  "tidyverse", "lme4", "lmerTest", "DirichletReg", "zCompositions",
  "ordinal", "psych", "car"
)
new_packages <- packages[!sapply(packages, requireNamespace, quietly = TRUE)]
if (length(new_packages)) install.packages(new_packages)
options(readr.show_col_types = FALSE)
for (thispack in packages) {
  library(thispack, character.only = TRUE, quietly = TRUE, verbose = FALSE)
}

# df: one row per participant (platform participant master export)
# long: stacked ratings (id, task, time, stress, na, pa, effort, pred_eff, condition, traits)

## Coding and transforms ---------
df <- df %>%
  dplyr::mutate(
    condition_c  = dplyr::if_else(framing == "redemption", 0.5, -0.5),
    disc_z       = as.numeric(scale(apsr_discrepancy)),
    rum_z        = as.numeric(scale(rrq_rumination)),
    burn_z       = as.numeric(scale(bat_total)),
    mean_pct_z   = as.numeric(scale(aptitude_mean_pct))
  )

## H1C index: entropy-based concentration (zero-safe) ---------
prop_cols <- paste0("img", 1:5, "_time")
P <- df[, prop_cols] / rowSums(df[, prop_cols])
H <- apply(P, 1, function(p) { p <- p[p > 0]; -sum(p * log(p)) })
df$concentration <- 1 - H / log(5)

## Confirmatory models (17 critical tests) ---------
m_h1a_d <- lm(effort_postCM ~ disc_z * condition_c, data = df)
m_h1a_r <- lm(effort_postCM ~ rum_z  * condition_c, data = df)
m_h1b_d <- lm(na_postCM ~ scale(na_postAS) + disc_z * condition_c, data = df)
m_h1b_r <- lm(na_postCM ~ scale(na_postAS) + rum_z  * condition_c, data = df)
m_h1c   <- lm(concentration ~ disc_z * condition_c, data = df)

m_h2a_d <- lmer(effort ~ disc_z + task + (1 | id), data = long_post)
m_h2a_r <- lmer(effort ~ rum_z  + task + (1 | id), data = long_post)
m_h2b   <- lmer(effort ~ burn_z + task + (1 | id), data = long_post)
m_h2c   <- lm(aptitude_sd ~ disc_z + rum_z + burn_z + mean_pct_z, data = df)

# long_pre: 2 rows/id — task AS uses T0 ratings, task CM uses T1 (post-AS,
# pre-feedback/framing) ratings, each paired with that task's predicted-efficacy slider
m_h3a_s <- lmer(stress ~ disc_z + pred_eff_z + task + condition_c + (1 | id),
                data = long_pre)
m_h3a_n <- lmer(na     ~ disc_z + pred_eff_z + task + condition_c + (1 | id),
                data = long_pre)
# long3: 3 rows/id — time_c = 0 (T0), 1 (T1), 2 (T2); each rating used exactly once
m_h3b_s <- lmer(stress ~ time_c * disc_z + condition_c + (1 | id), data = long3)
m_h3b_n <- lmer(na     ~ time_c * disc_z + condition_c + (1 | id), data = long3)

## FDR over the 17 prespecified p-values ---------
crit <- tibble::tribble(
  ~test, ~p,
  "H1A disc x cond",  coef(summary(m_h1a_d))["disc_z:condition_c", "Pr(>|t|)"],
  # ... (one row per critical term; 17 total)
)
crit <- crit %>% dplyr::mutate(p_bh = p.adjust(p, method = "BH"))

## Secondary: Dirichlet (zeros via zCompositions::multRepl) ---------
times   <- df[, prop_cols]
dl      <- matrix(1 / rowSums(times), nrow(times), 5)  # 1 s as fraction, per row
times_r <- zCompositions::multRepl(as.matrix(times / rowSums(times)),
                                   label = 0, dl = dl)
df$Y    <- DirichletReg::DR_data(times_r)
fit_int  <- DirichletReg::DirichReg(Y ~ condition_c * disc_z, data = df)
fit_main <- DirichletReg::DirichReg(Y ~ condition_c + disc_z, data = df)
anova(fit_main, fit_int)
```
