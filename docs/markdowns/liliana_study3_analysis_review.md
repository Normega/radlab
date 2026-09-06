# Liliana Study 3 — Analysis Plan Review

> **Status, 2026-09-06.** This document is the issue log as found on 2026-08-19; it is kept as the
> record of what was raised and why, not updated in place. The resolutions live in
> `liliana_study3_plan_consolidated.html` (revision 2). Closed since:
> **§2.7 race coding** — collapsed to a binary `person_of_colour` (any non-White = 1, White only = 0,
> prefer-not-to-answer = missing), now in the default covariate set;
> **§2.1 / §2.2 Aim 2 model form** — Aims 2 and 3 merged into one three-condition model with two
> orthogonal contrasts, C1 (choice) and C2 (feedback).
> Still open: gender and household income coding, and the target sample size.

> Review of the analysis plan (Google Doc, read 2026-08-19) against the study as actually built.
> Companion to `docs/markdowns/liliana_study3_design.md` (reproducible design spec) and
> `docs/markdowns/liliana_feedback_spec.md` (midpoint mechanics).
>
> Structure: **§1** issues that will invalidate a hypothesis as written · **§2** specification gaps
> that need a decision before pre-registration · **§3** variables the study collects that the plan
> never touches · **§4** the new exploratory aim (WP-L6), drafted in the plan's own format ·
> **§5** answers to Liliana's open comments.

---

## 1. Issues that will invalidate a hypothesis as written

### 1.1 GAD-7 and PHQ-8 are baseline measures, but they are also the selection variables

**Where it bites:** H1B and E2B only. **Not** Aim 2 or Aim 3 — see the scope note below.

**Settled, and correctly so:** the screener runs immediately before the baseline battery as one
continuous Day-1 session, and screener data is retained only if consent is given. So the screener
administration **is** the baseline measurement for GAD-7 and PHQ-8, and the plan's
"Time (0 = baseline, 1 = post–Phase 1)" coding is right. Re-administering them minutes later was
deliberately rejected: both ask about the preceding two weeks, so a second administration in the
same sitting would measure test–retest noise rather than anything about the participant. The export
labels that administration `screener` rather than `baseline` for schedule-linkage reasons — it is
collected outside the scheduled-session system — which is a data-plumbing distinction, not a
substantive one. **The analysis should treat it as baseline; the export column naming should not be
read as disagreeing.**

**What remains is a selection problem, and it is independent of timing.** Eligibility requires
`max(GAD-7, PHQ-8) ≥ 10` **and** `GAD-7 ≤ 14` **and** `PHQ-8 ≤ 19`. Participants are therefore
admitted partly because at least one of these two scores was high on the day they were measured, and
those scores contain measurement error. On re-measurement at midpoint and final, they will drift
back toward the population mean **even under zero intervention effect**. That is a property of who
is in the sample, not of when the measurement happened, so it would survive any change to the
schedule.

Two consequences:

1. **H1B's baseline→midpoint change for GAD-7 and PHQ-8 is confounded with regression to the mean**,
   and will likely reach significance regardless of efficacy.
2. **E2B, for these two outcomes, is close to a direct test of RTM.** "Participants who start higher
   in depression/anxiety improve more" is exactly what RTM predicts on a selection variable.

**Scope — this does not touch Aim 2 or Aim 3.** Those are *between-group* comparisons of change.
Every group was selected by the same rule, so RTM operates equally in all three and cancels in the
Condition × Time interaction. H2B and H3B are unaffected.

**Recommended handling:**

- **Report H1B for GAD-7/PHQ-8 with the confound named**, rather than dropping it. The magnitude is
  bounded and estimable: expected RTM shrinkage is approximately `(1 − r) × (baseline deviation from
  the population mean)`, where `r` is short-interval test–retest reliability. Both instruments have
  published reliability in the .8 range, so a rough expected-shift benchmark can be pre-registered
  and the observed change reported against it. That is far more informative than either ignoring the
  problem or discarding the outcome.
- **Use the non-binding instrument as a partial internal control.** Eligibility is a *disjunction* —
  only one of the two scores needs to reach 10. So a participant with GAD-7 = 12 and PHQ-8 = 4 was
  **not** selected on PHQ-8, and no RTM is expected there. Pre-specify a split by which instrument
  was the binding constraint: RTM predicts differential shrinkage on the binding score only, whereas
  a genuine treatment effect should appear on both. This is a genuinely informative test and it costs
  nothing to add.
- **For E2B, restrict or reframe** for these two outcomes — see §2.9, which applies to the whole E2
  family.

**Two smaller notes.** The eligible band is truncated at both ends, so the baseline distributions of
GAD-7 and PHQ-8 are non-normal by construction; check residuals rather than assuming. And because
these are legitimate baseline data rather than screening artefacts, **the continuous screener scores
should be available as baseline covariates throughout** (§3.6), not used only as an eligibility gate.

> The other outcomes are unaffected. BIPS, SPANE, PWB, life satisfaction, MPoD-T, ERQ, SRI and
> SSCS-L are all administered at baseline, midpoint, and final as the plan assumes.

> **Broader context:** H1 as a whole is a single-arm pre-post aim — every participant receives
> active intervention in Phase 1, and there is no waitlist or no-treatment control anywhere in the
> study. So H1A, H1B and H1C are all confounded with time, repeated assessment, and RTM to some
> degree. GAD-7 and PHQ-8 are the acute case only because they are the selection variables. This
> belongs in the limitations section regardless of what is done about §1.1 specifically.

### 1.2 The within-person z-scored composite cannot serve as a between-group outcome

**Where it bites:** the stated primary momentary outcome; H2/H3 wherever the composite is used;
dataset 3's `Composite` column.

`z(delta_stress) + z(appraisal)` is z-scored **within person**. If the standardization is computed
over all of a participant's sessions, then **every participant's mean composite is exactly 0 by
construction**, and any between-group comparison of it is mathematically guaranteed to be null.
The same applies to `z_delta_stress` and `z_appraisal` as listed in dataset 3.

This is fine for its original purpose — the metric was built to rank practices *within* a person at
the midpoint. It is not transportable to a between-groups Phase 2 contrast without a change.

**Options:**

- **(a) Estimate the z parameters on Phase 1 only, then apply those fixed parameters to Phase 2.**
  Phase 2 values are then free to move, and a between-group difference is meaningful. This is the
  natural fix and matches how the midpoint snapshot already works.
- **(b) Use raw `delta_stress` and raw `appraisal` for all between-group tests** and reserve the
  z-composite for within-person ranking only.

Either way, **dataset 3 needs two distinct composite columns** — a within-Phase-1-standardized one
(for the ranking / E1 label) and a Phase-1-parameterized one (for Phase 2 analysis) — or the
analysis will silently use the wrong one.

**Related:** the plan names the composite as a co-primary momentary outcome, but the study
**ships v2 (mean Δstress alone) as the feedback metric**, pre-specified in the methods doc §4.3.
Making the composite primary in the analysis while showing participants Δstress is a defensible
choice but should be a stated one. See §4.

### 1.3 Aim 3 tests outcomes but never tests whether feedback changed behaviour

**Where it bites:** the whole of Aim 3.

H3A–H3E ask whether feedback improves stress, well-being, mechanisms, and engagement. But the only
route by which feedback *can* affect Phase 2 outcomes is by changing **which intervention someone
chooses**. If feedback doesn't shift choice, there is no mechanism, and a null result on H3A–E is
uninterpretable — you can't distinguish "feedback doesn't help" from "the manipulation didn't take."

**The manipulation check is missing and it is the most important single addition to the plan.**

The data supports it directly: `liliana_midpoint_feedback` stores, for **all three groups**, the
computed per-practice ranking, the participant's stated preference ranking, and the practice they
ended up with. So:

```
H3-MC (manipulation check). Participants who received feedback will be more likely to choose
their data-ranked #1 practice than participants who chose without feedback.
  - Analysis: logistic regression (or Fisher's exact given expected cell sizes)
  - Outcome: chose data-ranked #1 (yes/no)
  - Predictor: Condition (Choice vs. Choice with Feedback)
  - Note: the data-ranked #1 is computed and stored for control_choice participants too,
    even though it was never shown to them — this is the counterfactual the design banks.
```

A secondary form: **did feedback change the stated *preference ranking* itself?** The feedback group
ranks *after* seeing their data; the control-choice group ranks without it. So concordance between
the stated ranking and the data ranking is directly comparable across the two groups.

Both belong in the plan as confirmatory-adjacent, listed before H3A.

### 1.4 Phase 2 intervention type is confounded with condition and never modelled

**Where it bites:** all of Aim 2 and Aim 3.

In Phase 2, participants practise **different interventions**. Choosers self-select — plausibly
toward whichever practice they liked or that worked. No-Choice participants are assigned a
**non-preferred** one by construction. So the distribution of Phase 2 intervention will differ
systematically across conditions.

If the three interventions differ in efficacy at all, then **part of any "choice effect" is an
intervention-efficacy effect.** The plan never includes Phase 2 intervention as a covariate, never
reports its distribution by condition, and never tests intervention × condition.

**Minimum fix:** report the 3 × 3 crosstab of condition × Phase 2 intervention, and include Phase 2
intervention as a covariate in every Aim 2 / Aim 3 model. **Better:** pre-specify a sensitivity
analysis stratified by intervention, acknowledging it will be underpowered.

### 1.5 "Choice" is not the same as "preferred" — and the plan assumes it is

The design summary in the plan says Choice = "(preferred, no feedback)" and Choice + Feedback =
"(preferred, chosen after feedback)". **This is not what the study does.** Choice is genuinely free:
participants may select any of the three practices, including their own rank-3. This was an explicit
design decision and is verified in dry-run testing (a participant ranked reappraisal #1 and chose
self-compassion).

So:

- `phase2_practice == stated_preference` is an **empirical quantity**, not a design guarantee. It
  must be measured and reported.
- Any hypothesis phrased as "participants who choose their preferred intervention" is describing a
  subgroup, not a randomized condition. Conditioning on it breaks randomization.

**This also opens the cleanest available fix for §2.1's confound** — see below.

---

## 2. Specification gaps needing a decision before pre-registration

### 2.1 Aim 2 conflates agency with preference-match

The Choice vs. No-Choice contrast differs on two things at once: whether the participant had a
choice, and whether they ended up with a practice they wanted. No-Choice participants receive a
non-rank-1 practice **by design**. Aim 2 is titled "Impact of Choice" but as specified it estimates
choice + preference-match jointly.

**The design already contains the clean contrast.** Because choice is free (§1.5), some choosers
will select a non-rank-1 practice. Comparing *those* choosers against No-Choice participants holds
preference-match roughly constant and isolates agency.

```
H2A-sensitivity. Restricted to participants practising a non-rank-1 intervention in Phase 2,
Choice participants will still show greater stress reduction than No-Choice participants.
  - Same model as H2A, restricted sample
  - Pre-register as a sensitivity analysis; expect it to be underpowered
```

Whether or not this is powered, **the framing in Aim 2 should be corrected** to name both
components, or the paper will overclaim.

### 2.2 Does Aim 2 pool the two choice groups? State it, and state the order of operations

H2A's predictor is written as a two-level factor "Choice vs. No-Choice", while RQ2 says "with or
without feedback" — implying `feedback_choice` and `control_choice` are pooled. That should be
explicit. It should also be stated that **pooling assumes no feedback effect**, which Aim 3 then
tests. If Aim 3 finds one, the Aim 2 estimate is a weighted average across a real difference.

Pre-specify the order: either (a) Aim 2 pools regardless, with Aim 3 reported alongside, or
(b) Aim 3 is tested first and Aim 2 pools only if the feedback effect is null. **(a) is cleaner** —
(b) is a data-dependent decision rule and invites bias.

An alternative worth considering: **model all three groups in one model** with two pre-specified
orthogonal contrasts (choice vs. no-choice; feedback vs. no-feedback among choosers). Same two
questions, one model, no pooling decision, better power.

### 2.3 Random effects are participant-intercept-only everywhere — and that contradicts the study's premise

Every model specifies "Random effect: participant intercept." For the session-level models this is
too sparse:

- **H1D** models intervention type (3 levels) as a fixed effect with random intercepts only. That
  assumes **the effect of each practice is identical across people** — which is precisely what the
  entire study, and Exploratory Aim E1, denies. H1D should carry a **random slope for intervention
  type**, and its variance component is itself an interesting result (it *is* the "different
  practices suit different people" claim, testable directly).
- **H1D, H2D/E, H3D/E** all include session day as a predictor with 12 observations per person.
  A **random slope for day** is standard; intercept-only will understate uncertainty on the day
  effect and on any condition × day interaction.

Pre-specify a fallback: maximal model, simplify on non-convergence in a stated order.

### 2.4 Pre-session stress is missing as a covariate in every Δstress model

`delta_stress = pre − post` is bounded by pre-stress: a participant who starts at 1 cannot show
relief, and one who starts at 6 has the most room. **Pre-stress therefore predicts Δstress
mechanically**, through both the ceiling and within-session regression to the mean.

In Phase 1 this mostly averages out (counterbalancing). **In Phase 2 it does not** — conditions
differ between people, and if pre-stress differs by condition, Δstress differs for reasons unrelated
to the intervention.

**Add session-level pre-stress as a covariate to H1D, H2D, and H3D.** This is separate from the
existing sleep-quality covariate, which is retained.

Related, worth pre-specifying: `stress` is a **6-point ordinal item**, so Δstress takes integer
values in [−5, +5]. Check the pre-stress distribution for floor effects before treating Δstress as
continuous, and pre-register an ordinal or censored alternative if a large share of sessions start
at 1–2.

### 2.5 Session-day coding is inconsistent, and study day varies between participants

H2D/H2E/H3D/H3E specify "session day (13–24)". Dataset 3 specifies "Session_day (1-12)" with a
separate Phase variable. These disagree.

Recommend: **session index within phase (1–12), with Phase as a separate factor.** This makes the
Phase 1 and Phase 2 day effects directly comparable, which "13–24" does not.

Separately — and this is a design fact the plan doesn't reflect — **calendar day is not fixed across
participants.** Assessment windows are catch windows: Phase 2 begins the day after the midpoint is
actually completed, so the study runs 29–31 days depending on the person. Use
`participant_schedule.study_day` for anything calendar-indexed, never the nominal day number. Elapsed
baseline-to-final time is a per-participant variable and a candidate covariate.

### 2.6 No missing-data or ITT/per-protocol statement

The plan says nothing about attrition, and the design has strong opinions about it:

- **Phase 1 adherence (<10 of 12) withdraws the participant** before the midpoint group is drawn.
  So Aim 2 and Aim 3 samples are conditioned on Phase 1 adherence, and that attrition sits **above**
  the randomization box in a CONSORT diagram.
- **Phase 2 adherence stopped gating on 2026-08-11**, deliberately, so that ITT is possible. The
  classification lives in the `liliana_phase_adherence` view. **The plan collects adherence
  (dataset 1) but never uses it.**
- Missed sessions are marked `missed`; participants stay on the original calendar.

Pre-specify: primary analysis is ITT over everyone reaching Phase 2; per-protocol (≥10 of 12 in
Phase 2) as a pre-registered sensitivity analysis; mixed models retain partial cases under MAR, and
that assumption should be stated and probed (e.g. is missingness predicted by condition or by
prior-session stress?).

### 2.7 Covariate coding is unspecified and probably too rich for the sample

Every model carries "age; gender; racial/ethnic identity; household income; SSS total."

- **Race/ethnicity is unimplementable as written.** The instrument is a **multi-select with 10
  top-level categories and nested sub-options**. It cannot enter a model as a single factor without
  a stated collapse rule (racialized yes/no? a small set of collapsed groups? which?).
- **Gender** is likewise multi-select with 9 options plus free text.
- **Household income** has 9 levels including prefer-not-to-answer. Continuous, ordinal, or
  collapsed? How is PNA handled — dropped, or its own level?
- With five covariates (two of them multi-category) plus condition, time, and their interaction, in
  a sample plausibly around 100–200, this is a lot of parameters. Consider a **reduced default set**
  (age, gender collapsed to a small number of levels, SSS total) with the fuller set as sensitivity.

**Also inconsistent:** BFI-2 appears in dataset 1 as a baseline covariate and in E1's feature list,
but never in any H1/H2/H3 covariate specification. Decide whether it's a covariate or an
exploratory-only variable.

### 2.8 Multiplicity is specified unevenly

Holm within family is specified for the secondary and mechanism families, but:

- **The primary outcome (BIPS) is tested in H1A, H2A, and H3A with no correction.** Defensible if
  BIPS is genuinely the single pre-registered primary — but say so explicitly.
- **E2 has no correction specified** despite running 4 + 6 + 4 models.
- **Families are not defined consistently across aims.** "Holm within family" for mechanisms (H1C,
  H2C, H3C) — is the family the 4 mechanism outcomes within one aim, or across aims?

State family membership explicitly, once, and apply it uniformly.

### 2.9 The E2 baseline-dependence analyses need an RTM-aware specification

E2A/B/C predict the follow-up value from its own baseline. Two problems:

1. Under pure measurement error, baseline is negatively correlated with change — so "higher baseline
   → greater reduction" is what noise alone predicts.
2. The ANCOVA coefficient on baseline (predicting post from pre) does not directly answer "do
   high-baseline people improve more"; a coefficient below 1 *is* regression to the mean.

If baseline-dependence is a genuine question, pre-specify a method built for it (e.g. Oldham's
method, or explicitly modelling the reliability-corrected slope) and state that a naive result is
expected under the null. For PHQ-8/GAD-7 this compounds with §1.1 and the analysis should probably
be dropped.

### 2.10 Naming

- The plan calls the third intervention **"Self-Appreciation"**; the study calls it
  **self-compassion** everywhere (module ids, condition labels, participant-facing copy).
- Condition labels: plan says No-Choice / Choice / Choice + Feedback; the database uses
  `control_assigned` / `control_choice` / `feedback_choice`. Worth a mapping table in the plan.
- "Life satisfaction" is a **single-item 6-point emoji VAS**, not a multi-item scale. Treating it as
  a continuous outcome in an LMM is common but should be acknowledged.

---

## 3. Variables the study collects that the plan never touches

### 3.1 Objective engagement telemetry — the largest omission

Engagement is currently measured only by **self-reported effort** (H2E, H3E). The study also
records, per session:

| Source | What it gives you |
|---|---|
| `participant_video_sessions` / `_events` | Watch percentage, completion, **focus-loss count and duration** (tab switches during video) |
| `participant_step_timings` | Time on task, per step, every session |
| `intervention_responses` | Presence, length, and content of written reflections |
| `liliana_day_data.started_at` / `completed_at` | Session duration; time of day of completion |

**Focus losses and step timings are objective, unobtrusive, and immune to the demand
characteristics that plague a self-reported effort item** — particularly for H2E/H3E, where the
condition (having chosen) is exactly the sort of thing that biases self-report.

Recommend: add an objective engagement composite as a co-outcome for H2E/H3E, or at minimum as a
pre-registered convergent check.

### 3.2 Mechanism specificity is never tested

Each intervention targets a specific mechanism, and each mechanism has a matched instrument:

| Intervention | Targeted mechanism | Instrument |
|---|---|---|
| Non-reactivity | Decentering / non-reactivity | **MPoD-T**, incl. its `(Non)Reactivity` subscale |
| Reappraisal | Cognitive reappraisal | **ERQ-CR**, **SRI-IP** |
| Self-compassion | Self-compassion | **SSCS-L**, incl. its six facets |

H1C/H2C/H3C test whether mechanisms improve **in general**. The obvious and much stronger test —
**does practising intervention X specifically improve mechanism X?** — is absent. Phase 2 is the
ideal setting: 12 days of a single intervention, three groups.

```
E4 (suggested). Intervention-specific mechanism change.
  - Analysis: linear mixed model
  - Outcome: mechanism score (one model per mechanism)
  - Predictors: Phase 2 intervention (3 levels); Time (midpoint, final); Intervention × Time
  - Prediction: the interaction is carried by the matched intervention
```

This also gives a **manipulation check on the interventions themselves**, which the plan otherwise
lacks entirely.

### 3.3 Subscales are collected but unused

The plan uses total scores throughout. Available and unused:

- **BIPS** — Pushed, Conflict & Imposition, Lack of Control (the primary outcome's own structure)
- **MPoD-T** — Meta-awareness, (Dis)Identification, (Non)Reactivity
- **SSCS-L** — Kindness, Self-judgment, Common Humanity, Isolation, Mindfulness, Over-identification
- **SPANE-B** (= P − N) is computed by the system; the plan uses P and N separately, which is
  defensible, but B should be mentioned as available
- **BFI-2-S** — 5 domains and 15 facets

Totals are the right primary choice. Subscales belong in the exploratory section, especially for
§3.2's specificity test.

### 3.4 Phase 1 block order is never modelled

Phase 1 order is counterbalanced across all six permutations, and the order is stored. It is never
used. Two reasons it matters:

1. **Order effects on the outcomes** — practice 1 has 12 fewer days of accumulated exposure than
   practice 3 when the midpoint arrives.
2. **Recency bias in the ranking and the metric.** The practice done immediately before the midpoint
   may be favoured in both the participant's stated preference and their computed Δstress ranking.
   That is a threat to the feedback manipulation's validity and it is directly testable, because
   order is randomized.

```
E5 (suggested). Recency in preference and ranking.
  - Test whether the practice completed most recently before the midpoint is over-represented
    at rank #1, in both the stated preference ranking and the computed Δstress ranking.
  - Analysis: multinomial / chi-square against the uniform expectation given counterbalancing
```

### 3.5 The preference ranking is collected from all three groups and never analysed

Dataset 1 lists "Preference ranking" but no hypothesis uses it. It is the key to §1.3, §1.5, and
§2.1. At minimum: concordance between stated ranking and data ranking, by group; concordance between
stated preference and received intervention, by group.

### 3.6 Other collected variables absent from the plan

| Variable | Where | Why it matters |
|---|---|---|
| `stated_preference` vs `phase2_practice` concordance | `liliana_midpoint_feedback` | Whether "Choice" delivered a preferred practice (§1.5) |
| Ranking **gap magnitude** (top vs second practice Δstress) | snapshot `computed` | Moderator: feedback should matter more when the winner is clear |
| `low_n` flag | snapshot | Flags participants whose ranking rests on <2 sessions per practice |
| `shown_at` and dwell on the feedback screen | snapshot + step timings | Manipulation exposure — did they actually read it? |
| Screener GAD-7/PHQ-8 as **continuous** | `screener_results` | These are baseline data (§1.1), not just an eligibility gate — usable as covariates throughout, and needed for the binding-constraint split |
| Which instrument was the **binding** eligibility constraint | derived from `screener_results` | The internal RTM control described in §1.1 |
| Time of day of session completion | `liliana_day_data` | Diurnal variation in stress is substantial and unmodelled |
| Elapsed study duration (29–31 days) | derived | Varies by midpoint promptness; confounded with engagement |
| `is_test` | `study_enrollments` | **Exclusion criterion — should be stated in the plan** |
| Written reflection text | `intervention_responses` | An entire unexploited qualitative/NLP dataset |
| Adherence counts | `liliana_phase_adherence` | Collected, listed in dataset 1, never used (§2.6) |
| Consent-to-baseline interval | `study_enrollments` | Gap between screener and Day 1 (§1.1) |

---

## 4. New exploratory aim — metric robustness (WP-L6)

Drafted in the plan's format, ready to paste after E2. This is the WP-L6 "metric bake-off"
converted from a pre-launch decision procedure into a post-hoc exploratory analysis.

**Rationale for the conversion.** The original plan was to pilot both metrics and freeze the better
one before recruitment. That is no longer the right shape, for three reasons: (i) metric v2 is
**pre-specified** in the methods document §4.3 and is what participants are shown, so changing it
after seeing data would alter the manipulation itself, not merely the analysis; (ii) an August
pretest will not be powered to distinguish the metrics; and (iii) **the design already banks the
counterfactual** — `liliana_midpoint_feedback.computed` stores `composite_v1` and `composite_v2` for
every participant in every group, so the comparison is recoverable at full N afterwards. E3 below
therefore reports the sensitivity rather than deciding on it.

### **E3. Robustness of the intervention-ranking metric**

To quantify how much the choice of quality metric, and the small number of sessions per practice,
affect which intervention is identified as a participant's "best" — and what that implies for the
feedback manipulation and for E1.

**E3A.** The two candidate quality metrics disagree about the top-ranked intervention for a
non-trivial share of participants.

- Analysis: descriptive, computed from the stored snapshot; no new data collection
- Quantity: proportion of participants for whom `argmax(composite_v1) ≠ argmax(composite_v2)`,
  plus Kendall's τ between the two full rankings, per participant
- Note: v2 (mean Δstress) is what was **shown**; v1 (`(z(Δstress) + z(appraisal))/2`) is computed
  and stored for every participant but never displayed
- Report: disagreement proportion with 95% CI; distribution of τ; disagreement rate stratified by
  `low_n`

> **Analytic benchmark.** Because within-person z-scoring is a monotone transform, ranking by mean
> `z(Δstress)` is *identical* to ranking by mean Δstress. So v1 is not a different metric — it is v2
> plus an appraisal term at equal weight, and the two disagree on a pair exactly when the
> standardized appraisal gap outweighs and opposes the standardized Δstress gap. For gaps that are
> approximately bivariate normal with correlation ρ and relative scale λ = sd(appraisal gap) /
> sd(Δstress gap):
>
> **P(disagree) = ½ − arcsin(r)/π,  where r = (1 + ρλ) / √(1 + 2ρλ + λ²)**
>
> | ρ | λ = 0.5 | λ = 1.0 |
> |---|---|---|
> | 0.0 | 15% | 25% |
> | 0.5 | 11% | 17% |
> | 0.8 | 7% | 10% |
> | 0.9 | 5% | 7% |
>
> (Closed form verified against 400,000-draw simulation to three decimals.) Even under a strong
> correlation between how much a practice relieves stress and how much it is liked, roughly one
> participant in ten would be told a different practice is "your strongest" under the alternative
> metric. E3A estimates ρ and λ from the observed data and reports the realised rate against this
> benchmark.

**E3B.** The Phase 1 ranking is unstable under resampling, because it rests on four sessions per
intervention.

- Analysis: leave-one-session-out resampling within participant
- Quantity: proportion of participants whose top-ranked intervention changes when any single session
  is dropped; report per-participant instability and the sample-wide rate
- Also report: the observed session-level SD of Δstress within person, and the observed
  between-intervention separation — the two quantities that determine stability
- Report: instability rate, and its association with the top-vs-second gap magnitude and `low_n`

> **Prior expectation.** With four sessions per intervention the standard error of an intervention
> mean is σ/2. Simulating three interventions with equal true spacing:
>
> | σ (session-level) | true separation | P(identifies true best) | P(dropping one session flips the top) |
> |---|---|---|---|
> | 1.0 | 0.25 | 55% | 22% |
> | 1.0 | 0.50 | 73% | 17% |
> | 1.5 | 0.25 | 48% | 23% |
> | 1.5 | 0.50 | 61% | 20% |
> | 2.0 | 0.50 | 55% | 22% |
>
> Chance is 33%. For plausible values on a six-point scale, the ranking identifies the genuinely
> best intervention roughly half to three-quarters of the time.

**E3C.** Label noise in the Phase 1 ranking places an upper bound on achievable accuracy in E1.

- Analysis: derive the maximum attainable classification accuracy given the E3B instability estimate,
  and report E1's cross-validated accuracy against that ceiling rather than against chance alone
- Rationale: E1 predicts a **label that is itself estimated with error**. If the ranking recovers the
  true best intervention only ~60% of the time, then no classifier — however good its features — can
  exceed ~60% accuracy against ground truth. Reporting E1 against a 33% chance baseline without this
  ceiling risks reading a null as "baseline traits don't predict intervention fit" when the correct
  reading may be "the label is too noisy to learn from at this N."
- Report: estimated ceiling; E1A and E1B accuracy and κ relative to both chance and ceiling

**Implication for the feedback manipulation (to be stated as a limitation, not tested).** E3A and
E3B together characterise how much of "your strongest practice" is signal. This does not threaten
Aim 3's primary contrast — the manipulation is *receiving personalised feedback*, and the feedback
is honestly the participant's own data whatever its precision. It does attenuate any mediational
claim of the form "feedback helped **because** participants chose a better-matched intervention,"
since that mediator is measured with substantial error. Pre-register the top-vs-second gap magnitude
as a moderator: if feedback works through match quality, its effect should be larger for
participants whose ranking was clear-cut.

### A note on E1 as currently specified

Independent of E3, **E1's feature-to-sample ratio is a problem.** The feature list —
baseline demographics + sleep + BIPS + PHQ-8 + GAD-7 + MPoD-T + ERQ + SRI + SSCS-L + SPANE + life
satisfaction + PWB + BFI-2 — is on the order of 40–60 predictors before any demographic dummy
coding, against a sample plausibly around 100–200 Phase 1 completers, predicting a **three-class
label that is roughly half noise**. Recommend: a pre-specified reduced feature set, nested
cross-validation (so the reported accuracy isn't optimistically biased by tuning), and an explicit
statement that a null result is the expected outcome under these constraints and should not be
interpreted as evidence against personalised matching.

---

## 5. Answers to the open comments in the document

**"ERQ-reappraisal and SRI-increase-positive — combine into one reappraisal score, or keep the two
facets separate?"** *(Liliana, leaning toward combining)*

Recommend **keeping them separate as the pre-registered primary, and reporting a combined score as
secondary** — the opposite of the lean, for three reasons:

1. They are on **different response scales** (ERQ-CR is 1–7, SRI-IP is 1–5) and different frames.
   ERQ-CR is a **trait** measure ("how you generally regulate"); SRI-IP asks about **the moment**
   ("what you think and/or feel at the moment"). Averaging a trait and a state measure produces a
   quantity that is hard to interpret and that will change over 31 days for two different reasons.
2. A 31-day intervention should move a state measure more readily than a trait one. Combining them
   **dilutes the more sensitive measure with the less sensitive one**, which costs power on exactly
   the effect being tested.
3. The multiplicity saving is small — Holm on 4 tests versus 3 barely changes the thresholds — and
   is not worth the interpretive cost.

If they are combined, standardize each to z first, and check that they actually correlate in this
sample before treating them as one construct. **Also worth pre-specifying either way:** ERQ-CR is the
mechanism matched to the reappraisal arm (§3.2), so keeping it identifiable is valuable.

**"Holm — less harsh than Bonferroni?"** *(marked resolved)*

Yes, and the procedure written in the thread is correct. Holm is uniformly more powerful than
Bonferroni while controlling the same family-wise error rate, so there is no reason to prefer
Bonferroni. One clarification worth adding to the plan: **Holm is a step-down procedure and stops at
the first failure** — every test below the failure point is non-significant regardless of its own
p-value. That has a practical consequence: a family containing one very strong effect and several
weak ones behaves quite differently from one with uniformly moderate effects, so **family membership
is a substantive decision, not bookkeeping** (§2.8).

**"Yeah this you will have to get from dataset 3"** *(on the participant-level Phase 1 composite)*

Correct, with the §1.2 caveat: the participant-level Phase 1 composite must be built from
**Phase-1-only** standardization, and if the same composite is wanted for Phase 2 analysis it must
reuse the Phase 1 parameters rather than re-standardizing. Recommend naming the columns distinctly
in dataset 1 and dataset 3 so the two cannot be confused at analysis time.

---

## 6. Suggested priority order

**Before recruitment (design decisions, cheap now and impossible later):**

1. Decide the race/ethnicity and gender covariate coding (§2.7) — this determines whether the
   demographics battery can be used as specified at all.

**Before pre-registration (plan changes, in rough order of consequence):**

2. Add the choice manipulation check to Aim 3 (§1.3) — without it a null on H3A–E is uninterpretable.
3. Fix the composite standardization and split the columns (§1.2) — as written the between-group
   test is a guaranteed null.
4. Add Phase 2 intervention as a covariate; report the condition × intervention crosstab (§1.4).
5. Correct the Choice = preferred framing and add the non-rank-1 sensitivity analysis (§1.5, §2.1).
6. Add pre-stress as a session-level covariate (§2.4).
7. Specify random slopes and the convergence fallback (§2.3).
8. Specify ITT vs per-protocol and missing-data handling (§2.6).
9. Fix session-day coding; specify `study_day` for calendar-indexed variables (§2.5).
10. Define families and correction uniformly, including E2 (§2.8).
11. Name the RTM confound in H1B and add the binding-constraint split (§1.1); reframe E2 (§2.9).
12. Add E3 (§4); revise E1's feature set and reporting (§4).

**Worth adding if there is appetite:**

13. Objective engagement telemetry as a co-outcome (§3.1).
14. Intervention-specific mechanism test, E4 (§3.2).
15. Recency/order test, E5 (§3.4).
