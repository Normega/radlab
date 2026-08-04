# Preregistration — Perfectionism and Effort Allocation in Multi-task Performance (Sandy Study 3)

> OSF Standard Preregistration format. Draft prepared 2026-08-04 from the working Google Doc ("Pre-Reg" and "Statistical Models" tabs) reconciled against the session flow actually built on the RADlab platform (`/admin/studies` → Sandy Study 3, study id `f8cbf629`). Decisions made in this draft that depart from the working doc are marked **[DECISION]**; items requiring a build or design change before launch are marked **[BUILD]**. Both are indexed in §7.

---

## 1. Study Information

**Title.** Perfectionism and Effort Allocation in Multi-task Performance

**Description.** This study examines how maladaptive (discrepancy) perfectionism relates to effort allocation, performance variability, and affective responses during a multi-task cognitive battery, and whether a "redemption" framing of a bonus task moderates these relations. Participants complete the **Aptitude Suite** — three concurrent word tasks (Unscramble/anagrams, Word Storm/category fluency, Word Probe/deductive word guessing) under a shared 8-minute budget with free task switching and a real-time percentile-rank display — followed by **ColourMax**, a 5-minute paint-by-numbers task with five images. Participants are randomized to one of two framings of ColourMax delivered immediately after their Aptitude Suite score feedback:

- **Control**: "You've finished Aptitude Suite. The next activity will begin shortly. Note that this activity will not count toward your overall score."
- **Redemption**: "Good news: you now have a chance to raise your percentage!" — and, at the end of ColourMax, a combined "new overall score."

Brief state ratings (stress, negative/positive emotionality, predicted/experienced performance relative to others, effort, satisfaction) are collected around each task. A trait questionnaire battery (APS-R, BAT-Student, PANAS, RRQ-rumination, GSE, DASS-21, SCS-26), demographics (U of T Student Equity Census), and a debrief close the session. The session is single-shot, fully online, desktop-required, ~45–60 minutes.

**Hypotheses.** Three hypothesis families, all directional. The specific statistical test for each is given in §5; the confirmatory test family is enumerated in §5.3.

**H1 — Redemptive framing moderates trait–behavior links (framing × trait interactions).**

- **H1A.** The positive relation between discrepancy perfectionism (and, separately, rumination) and self-reported effort on ColourMax is stronger in the redemption condition than the control condition.
- **H1B.** The relation between discrepancy perfectionism (and, separately, rumination) and post-ColourMax negative emotionality (adjusting for pre-manipulation negative emotionality) differs by condition: among high-trait participants, the redemption framing reduces post-task negative emotionality relative to control.
- **H1C.** Discrepancy perfectionism predicts more *concentrated* (less even) allocation of time across the five ColourMax images, and this relation is stronger in the redemption condition. Secondarily, discrepancy perfectionism predicts higher ColourMax precision in the redemption condition relative to control.

**H2 — Trait main effects on effort and performance variability.**

- **H2A.** Higher discrepancy perfectionism and higher rumination each predict higher post-task effort ratings.
- **H2B.** Higher burnout predicts lower post-task effort ratings.
- **H2C.** Higher discrepancy perfectionism, rumination, and burnout each predict greater within-person variability across the three Aptitude Suite task percentile scores (uneven effort allocation), controlling for mean performance.
- **H2D** *(exploratory — see §5.6)*. The same traits predict a steeper decline in ColourMax per-image performance (precision/coverage) from earlier- to later-positioned images.

**H3 — Anticipatory stress and negative emotionality.**

- **H3A.** Higher discrepancy perfectionism and lower pre-task predicted self-efficacy each predict greater pre-task (anticipatory) stress and negative emotionality.
- **H3B.** Higher discrepancy perfectionism predicts a greater pre-to-post increase in stress and negative emotionality across tasks.

**[DECISION D1]** The working doc's H1B specified a three-way interaction (discrepancy × rumination × condition). A three-way interaction between two correlated, imperfectly reliable continuous traits and a binary factor is realistically detectable only at N ≥ ~800 (see §3.4); at N = 200 a null would be uninterpretable. H1B is therefore specified here as two 2-way moderation models (one per trait), and the three-way term is demoted to the exploratory set (§5.6).

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
5. Pre-ColourMax ratings (predicted relative performance; **[BUILD B1]** stress, negative, positive — to be added, see §7)
6. **ColourMax** (5 min, 5 images)
7. Post-task ratings (satisfaction; effort; stress; negative; positive; experienced relative performance) → condition-gated score display
8. Questionnaire battery: APS-R, BAT-Student, PANAS, RRQ-rumination, GSE, DASS-21, SCS-26
9. U of T Student Equity Census (demographics) → Debrief

Note the deliberate ordering: **trait questionnaires are administered after the tasks**, to avoid priming perfectionism/rumination content before the behavioral measures. A randomization check (§5.5) tests whether condition leaked into trait reports.

**Randomization.** Simple individual-level randomization, 1:1 allocation, executed server-side by the platform's permuted-block randomizer (`draw_assignment`: seeded permuted blocks per slot, concurrency-locked, idempotent per participant; audit trail in `participant_assignments`). The operative slot is `framing` with arms `control` / `redemption`. Assignment occurs at session entry after consent, before any study content. **[BUILD B3]** The study currently also carries a vestigial `condition` slot (control/treatment) left over from the platform randomizer pilot; it gates no content and will be ignored in analysis (or removed by duplicating the study before launch).

---

## 3. Sampling Plan

**Existing data.** Registration prior to creation of data. No data for the confirmatory sample have been collected. A pilot (N = 20; §3.5) will be collected **before** final registration to estimate nuisance parameters; pilot data will not be included in confirmatory analyses and no hypothesis tests will be run on the pilot.

**Data collection procedures.** Participants recruited via Prolific. Inclusion: fluent English; currently enrolled post-secondary student (Prolific prescreen); normal or corrected-to-normal vision; desktop/laptop required (ColourMax requires mouse input; enforced by Prolific device filter and platform check). Exclusion at recruitment: Prolific prescreen for active suicidal ideation (given DASS-21 content). Compensation at or above Prolific's recommended hourly rate for a 45–60 min session. **[DECISION D2]** The working doc named UTM undergraduates in one place and Prolific in another; this draft specifies Prolific with a post-secondary-student prescreen. If SONA/UTM recruitment is used instead or additionally, the sampling section must be revised before registration.

**Sample size.** Target **N = 200 valid sessions** (~100 per arm) after exclusions (§5.4). Recruitment continues until 200 valid sessions are reached; no interim hypothesis tests (stopping rule is a fixed valid-N count, checked on completed data only).

### 3.4 Sample size rationale (power analysis)

All confirmatory tests are single-degree-of-freedom coefficient tests in (mixed) linear models. Analytic power at N = 200, two-tailed:

| Scenario | Per-test α | Detectable effect at 80% power |
|---|---|---|
| Uncorrected | .05 | f² = .039 (ΔR² ≈ 3.8%, partial r ≈ .20) |
| BH-FDR, mid-case (≈half of family true) | ~.025 | f² ≈ .048 (partial r ≈ .21) |
| BH-FDR, worst case (one true effect in 17) | .0029 | f² ≈ .073 (partial r ≈ .26) |

Interpretation by test type:

- **Trait main effects (H2A, H2B, H3A):** simple/partial correlations of r ≈ .20–.26 are detectable. Meta-analytic trait–outcome correlations for perfectionism/rumination with effort and affect outcomes are typically r = .2–.4, so these tests are adequately powered at N = 200 even under FDR correction.
- **Framing × trait interactions (H1A–H1C):** an interaction of f² = .039 corresponds, at balanced n = 100/arm, to a between-arm difference in trait–outcome correlation of about Δr ≈ .38 (e.g., r ≈ .02 in control vs. r ≈ .40 in redemption). That is a *large* moderation. Moderation effects half that size (Δr ≈ .19) would have ~30% power. **We therefore treat N = 200 as powered for strong moderation only**; if resources allow, N = 300 (Δr ≈ .31 detectable) materially improves the H1 family. This is stated openly rather than assumed away.
- **Three-way trait × trait × condition interactions:** attenuation from trait unreliability compounds multiplicatively in product terms; realistic effective sizes are f² < .01, requiring N ≥ 800. This is why D1 demotes the three-way to exploratory.
- **H1C Dirichlet regression and H3 mixed models:** no closed-form power exists; power will be estimated by Monte Carlo simulation using pilot-informed nuisance parameters (§3.5), with the simulation code and results attached to the final registration. The scalar concentration-index test for H1C (§5.1) carries the analytic figures above and is the primary H1C test precisely so that H1C's confirmatory status does not rest on simulation assumptions.

### 3.5 Pilot (N = 20) — what it is for and what it is not for

A pilot of N = 20 (10 per arm) **is worth running**, but not to estimate effect-size priors: with N = 20 the 95% CI on a correlation spans roughly ±.45, so any observed pilot effect is uninformative about the true effect and using it to power the main study would be circular. The pilot instead estimates **nuisance parameters and feasibility**, which N = 20 estimates usefully:

1. **ColourMax zero structure** — proportion of participants with 0 s on ≥1 image; informs the H1C zero-handling choice (entropy index needs none; Dirichlet `multRepl` detection limit) and whether skipping is rare noise or a structural behavior.
2. **Distributions and ceilings** — effort/NA/PA/efficacy sliders (0–100), stress (1–6): floor/ceiling rates, variance, skew. Determines whether the prespecified transformation rules (§5.2) will trigger.
3. **DV variance for H2C** — SD and skew of the within-person percentile-variability index.
4. **Trait intercorrelations** — discrepancy × rumination × burnout collinearity (expected r = .4–.6); VIFs for the H2C model.
5. **Platform-metric reliability** — split-half consistency of per-image precision/coverage; percentile-score behavior of the Aptitude Suite scoring curve at realistic performance levels.
6. **Feasibility** — completion time vs. the 45–60 min estimate, dropout points, manipulation comprehension (see B2), data completeness of every variable named in §4 in the actual export (`/admin/export` participant master).

These parameters feed the simulation-based power analysis for the Dirichlet and mixed models, and fix the final N. If pilot-informed simulations show the H1 interactions need N = 300 for the moderation sizes the lab considers minimally interesting, that decision is made **before** registration, not after.

---

## 4. Variables

**Manipulated variable.** ColourMax framing (control vs. redemption), operationalized by the two framing displays quoted in §1 and by the condition-gated end-of-task score display (redemption arm additionally sees "your new overall score is {Aptitude percentile + ColourMax percentile}"). Server-side assignment record: `participant_assignments`, slot `framing`.

**Measured variables — trait (questionnaire battery, post-task).**

| Construct | Instrument (platform slug) | Scoring used here |
|---|---|---|
| Discrepancy perfectionism | APS-R (`aps-r`), 23 items, 1–7 | Mean of the 12 Discrepancy-subscale items (primary trait predictor). High Standards and Order subscales scored but exploratory only. |
| Rumination | RRQ rumination subscale (`rrq-rumination`), 12 items, 1–5 | Mean of 12 items |
| Burnout | BAT-Student (`bat-student`), 23 items, 1–5 (never–always) | Total mean (core dimensions); subscales exploratory |
| Trait self-efficacy | GSE (`gse`), 10 items, 1–4 | Mean; exploratory covariate only |
| Mood | DASS-21 (`dass-21`) | Subscale sums ×2; exploratory covariates |
| Self-compassion | SCS-26 (`scs-26`) | Standard subscale/total scoring; exploratory |
| Trait affect | PANAS (`panas`) | PA/NA sums; exploratory |

**[DECISION D3]** State affect around tasks is measured with the built single-item sliders, not PANAS state subscales (the working doc referenced PANAS state pre/post per task, which is not in the build and would add ~8 administrations). PANAS appears once, in the trait battery. The single reference to a "Brief Inventory of Perceived Stress" in the doc's indices is replaced by the built single-item stress VAS.

**Measured variables — state (around each task; platform slugs in parentheses).**

- Stress: 6-point emoji VAS (`vas_stress`), pre/post each task
- Negative emotionality: 0–100 slider (`slider_negative_emotionality`), pre/post each task
- Positive emotionality: 0–100 slider (`slider_positive_emotionality`), pre/post each task
- Predicted relative performance ("How well do you think you will do relative to others on the next task?"): 0–100 slider (`slider_predicted_efficacy`), before each task
- Experienced relative performance: 0–100 slider (`slider_post_efficacy`), after each task
- Effort ("How much effort did you put into the task?"): 0–100 slider (`slider_how_much_effort_did_you_put_into_the_task`), after each task
- Task satisfaction: VAS (`vas_task-satisfaction`), after each task

**Measured variables — behavioral (platform-logged).**

*Aptitude Suite* (`aptitude_sessions` / `aptitude_events`): per-task scores and platform percentile ranks (Unscramble, Word Storm, Word Probe); overall percentile (`avg_pct`, the value displayed to participants); task-switch count; time per task.

*ColourMax* (`color_max` outputs): time on each of the 5 images (s); per-image coverage (% of colourable pixels coloured) and precision (% coloured correctly within boundaries); overall `avg_pct`; images completed; in the redemption arm, the displayed `redemption_score`.

**Indices (computed).**

- **Time-allocation proportions:** p_i = t_i / Σt_i over the five images (denominator = the participant's actual total, not the nominal 300 s).
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

**H2C** (1 model, 3 critical tests):
`aptitude_SD ~ discrepancy_z + rumination_z + burnout_z + mean_percentile_z` (lm). Critical terms: the three trait coefficients (all predicted positive). Mean percentile is a forced covariate (mean–variance confound). The working doc's full 3-way-interaction version of this model is exploratory (§5.6). VIFs reported; if any trait VIF > 5, each trait is additionally reported from its own single-trait model as a sensitivity analysis (the joint model remains confirmatory).

**H3A** (2 models, 4 critical tests): pre-task ratings from both tasks stacked (2 obs/participant),
`preDV ~ discrepancy_z + predicted_efficacy_z + task + (1 | id)`, for preDV ∈ {stress, negative emotionality}. Critical terms: discrepancy (positive) and predicted efficacy (negative) in each model. **[BUILD B1]** This model requires the pre-ColourMax stress/NA ratings that are not yet in the build; they are to be inserted between the bonus-round display and the predicted-efficacy slider. Because they fall after the framing display, condition is included as a covariate in H3 models (and condition × task as an exploratory term). If B1 is not implemented, H3A reduces to a single-task (Aptitude Suite) cross-sectional regression and H3B to the Aptitude task only — the registration must then be edited accordingly before launch.

**H3B** (2 models, 2 critical tests): pre and post ratings for both tasks stacked (4 obs/participant),
`DV ~ time * discrepancy_z + task + condition + (1 | id)`, time coded pre = 0, post = 1, for DV ∈ {stress, negative emotionality}. Critical term: time × discrepancy interaction (predicted positive: steeper pre-to-post increase at higher discrepancy).

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
- Everything else (simple slopes, Dirichlet omnibus and components, secondary/tertiary models, subscales, robustness refits, §5.6) is explicitly non-confirmatory and reported without correction as exploratory.
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
- **Manipulation check [BUILD B2]:** one item before debrief — "During the colouring task, did you believe your score would count toward your overall score?" (yes/no/unsure). Primary analyses are intention-to-treat on the full valid sample; a per-protocol sensitivity analysis restricted to manipulation-check passers (redemption-yes, control-no) is exploratory.
- **Positive control:** predicted relative performance (pre) should correlate with experienced relative performance (post) within task, r > .2 — a sanity check that the sliders measure something; failure triggers a data-quality investigation before any hypothesis test is interpreted.

### 5.6 Missing data

Sliders/VAS and questionnaires are required fields in the platform flow, so item-level missingness within completed steps is structurally impossible; missingness arises only from dropout or technical failure and is handled by §5.4 (complete-case per model, counts reported). Questionnaire scale scores require ≥ 80% of subscale items (platform enforces 100%; the rule exists for defensive scoring only).

### 5.7 Exploratory analyses (declared, uncorrected)

- Working-doc three-way interactions: discrepancy × rumination × condition (H1B form); discrepancy × rumination × burnout (± each other) on H2C/H2D variability.
- **H2D:** per-image ColourMax composite (mean of coverage and precision) regressed on image position (1–5) within participant; the person-level position slope regressed on the three traits.
- Dirichlet component-wise effects (which images absorb time under high discrepancy).
- Task-switch count and per-task time allocation in the Aptitude Suite as behavioral perfectionism signatures (parallels to H1C within the first task).
- Belief-updating: (post − pre efficacy) and its relation to observed percentile and traits; satisfaction as a function of predicted−observed gap.
- Condition effects on H3 anticipatory ratings (pre-ColourMax measures are post-framing by design).
- High Standards and Order APS-R subscales, SCS, DASS-21, GSE, PANAS as alternative predictors/covariates.

---

## 6. Other — known context

- The displayed Aptitude Suite "percentile" is generated by the platform's scoring curve (designed for diminishing returns near the top), not a live empirical percentile of prior participants; the redemption arm's "new overall score" is the sum of two percentile-type quantities. Both are part of the deception covered in the debrief; the debrief form and REB protocol must describe them accurately.
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

**Build changes needed before launch:**

- **B1** — Insert pre-ColourMax stress + negative + positive sliders between the bonus-round display (order 14) and the predicted-efficacy slider (order 15). Without them, H3A/H3B lose the repeated-task design and must be rewritten (§5.1 H3A).
- **B2** — Add the manipulation-check item (§5.5) before the debrief step.
- **B3** — Remove the vestigial `condition` assignment slot (requires duplicating the study, since the slot is locked by pilot draws) or leave it documented as inert; analysis uses the `framing` slot only either way.
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

m_h3a_s <- lmer(stress ~ disc_z + pred_eff_z + task + condition_c + (1 | id),
                data = dplyr::filter(long, time == "pre"))
m_h3a_n <- lmer(na     ~ disc_z + pred_eff_z + task + condition_c + (1 | id),
                data = dplyr::filter(long, time == "pre"))
m_h3b_s <- lmer(stress ~ time_c * disc_z + task + condition_c + (1 | id), data = long)
m_h3b_n <- lmer(na     ~ time_c * disc_z + task + condition_c + (1 | id), data = long)

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
