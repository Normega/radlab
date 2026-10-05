# Preregistration — Langerian Mindfulness and Its Therapeutic Promise in Alleviating Mild Depression

> **Status: DRAFT v3.2 for review by Zerin Mahfuz and Norman Farb — not yet filed.**
> v3.2 (2026-10-05), after review by the Harvard team: H3 and H4 now use the H2a contrast throughout; §3.4 is rebuilt in post-SD units, drops an overstated efficiency gain, and reports power honestly for each pattern of benefit.
> v3.1 (2026-10-05) updates §3.1 for the situation now that the 2026-10-03 deadline has passed:
> post-intervention data exist, and the data have been exported from the server.
> v3 (2026-10-01) makes three changes:
> - H2 becomes two nested orthogonal contrasts.
> - The pre/post models move to a multilevel constrained-baseline model.
> - A planned second recruitment wave (winter term) is added.
>
> It also records the baseline scoring check in §3.1.
> v2 (2026-10-01) rebuilds the hypotheses and analysis plan around the study team's a priori
> specification: 3 arms × 2 timepoints, PHQ-8 / LMS-14 / reaction time, mixed ANOVAs, paired
> t-tests and PROCESS mediation. It adds a sample-size section computed for those exact tests.
> v1 (2026-09-27) was drafted from the REB protocol before the team's specification arrived.
>
> Sources: the REB-approved protocol (U of T REB #65268, RIS 50533, approved 2026-07-02), the
> study team's hypothesis summary (2026-10-01), and the study as built on the RADlab platform
> (website.md §26b, study `6d3c38ce-d1da-42ea-9bb4-c9450054065f`). The power calculations are
> reproducible with `scripts/analysis/zerin_power.py`, which will be posted with the registration on OSF.
>
> **This registration is being filed after data collection began** (first randomization
> 2026-09-11) **and after the first post-intervention outcomes were collected** (from
> 2026-10-03). Platform data have also been exported. §3.1 states exactly what had been
> collected, exported and seen when the registration was filed.
> **[DECISION]** markers are choices the investigators must confirm; they are listed in §7.

---

## 1. Study Information

### 1.1 Title

Effects of Brief Email-Based Prompts on Mood, Cognition, and Visual Awareness: a three-arm
randomized trial of Langerian mindfulness prompts for mild depressive symptoms.

### 1.2 Investigators

- Zerin Mahfuz (PI, University of Toronto)
- Norman A. S. Farb (Faculty Sponsor, University of Toronto Mississauga)
- Ellen Langer (Co-Investigator, Harvard University)
- Deborah Phillips and Peter Aungle (Collaborators, Harvard University)

Funding: SSHRC (award 216954).

### 1.3 Description

Langerian mindfulness means actively noticing novelty and variability, rather than practising
meditative acceptance of the present moment. It is associated with fewer depressive symptoms
(Pagnini, Bercovitz & Phillips, 2018; Pirson, Langer & Zilcha, 2018). Mild depression often
shows up as cognitive rigidity: an overgeneralized sense of being perpetually sad. Noticing
that one's mood actually changes across the day may loosen that rigidity.

This study tests whether three brief daily prompts reduce mild depressive symptoms, increase
Langerian mindfulness and speed reaction time over 21 days. One arm compares current mood with
the previous check-in. A second does the same and also writes a short reason for the change.
Both are compared with neutral prompts delivered on the same schedule.

### 1.4 Hypotheses

The four hypotheses follow the study team's specification. H2–H4 are framed around the noticing-change contrast, as set out below:

- **H1 — Depression decreases from pre to post.** PHQ-8 scores will be lower post-intervention
  than at baseline.
- **H2 — Rating prompts, and reflection on top of them, reduce depression.** Tested as two
  nested, orthogonal contrasts:
  - **H2a (noticing change):** the two mood-rating arms together (mood comparison and
    reflection) will show a larger PHQ-8 reduction than the neutral arm. Both rating arms
    prompt the participant to notice how their mood has changed since the last check-in, which
    is the Langerian ingredient.
  - **H2b (causal reflection):** the reflection arm will show a larger PHQ-8 reduction than the
    mood-comparison arm. This tests what writing a reason adds beyond noticing.

  **H2a is the study's central question and its single primary test.** It asks whether noticing
  change in one's own mood reduces depressive symptoms. Both rating arms share that Langerian
  ingredient, so this contrast pools two-thirds of the sample. **The investigators recognize
  that H2b is underpowered.** If the benefit is graded, the added benefit of writing a reason is a
  difference of *d* = 0.25 between reflection and mood comparison, and detecting it would take
  about 230 participants per arm with post data (§3.4), far beyond any feasible sample. H2b is
  registered because it is the natural follow-up question. Its estimate and confidence interval
  are reported, but a non-significant H2b will be read as inconclusive, not as evidence that
  reflection adds nothing.

  The team's original H2 compared reflection with neutral directly. That contrast equals H2a
  plus half of H2b, and it is reported as a planned descriptive contrast (§5.1).
- **H3 — Mindfulness explains the effect.** The rating prompts will increase Langerian
  mindfulness (LMS-14), and that increase will account for their effect on PHQ-8. This is tested
  as the indirect effect of the H2a contrast (rating arms vs neutral) through LMS-14.
- **H4 — Faster reaction time.** Reaction time will improve (get faster) more in the rating arms
  than in the neutral arm. This is tested as the H2a contrast on reaction time.

**H3 and H4 use the same contrast as the primary test, H2a (rating vs neutral).** The study
team originally framed H3 and H4 as reflection vs neutral. Those comparisons are reported as
planned descriptive estimates, alongside the H2b version (reflection vs mood), but they are not
confirmatory. §1.4, §3.4, §5.1 and §5.3 all use this one definition.

---

## 2. Design Plan

### 2.1 Study type

Experiment: a randomized, parallel-group 3 (arm, between) × 2 (time: pre, post, within)
design, with 21 days of contact three times a day between the two timepoints.

### 2.2 Blinding

Participants see only their own check-ins and are not told which arm they are in. All arms
receive identical reminder emails. Arm-specific content appears only on the page the email
links to. The consent form says the study examines "whether deeper reflection" matters, so
participants are not blind to the general question.

Assignment is automatic (§2.4). No researcher enrolls, assigns or contacts participants
individually. Outcomes are self-report questionnaires and a computer task, all scored by code.
Analysis is not blinded to arm. **[DECISION D9]** Optionally, run the confirmatory models with
arm labels scrambled until the analysis code is frozen.

### 2.3 Study design

1. **Screening** on the RADlab platform, reached from SONA.
   - Phase 1 is yes/no eligibility: U of T student, enrolled in PSY100, English, adequate
     vision, able to handle daily emails, willing to complete both surveys, and a three-way
     distress item (`yes` stops; `unsure` passes).
   - Phase 2 is the PHQ-8. **Pass: total 5–9.** Anyone outside that range is screened out and
     shown resources and the SONA alternative.
2. **Consent**, then a contact-email step.
3. **Pre (baseline)**: PHQ-8 → LMS-14 → Pond Watch. The screener's PHQ-8 answers **are** the
   baseline PHQ-8: they are carried forward so the questionnaire is not given twice in a row
   (website.md §26b).
4. **Randomization** on completing baseline (§2.4).
5. **21 days × 3 check-ins** at 09:00, 14:00 and 20:00 America/Toronto. Each is an identical
   reminder email linking to a 4-hour check-in window.
   - **Neutral**: a day- and slot-specific wellness tip from the approved 63-message script,
     then an acknowledge button. No mood question.
   - **Mood comparison**: rate current mood 1–7 (1 = very bad, 7 = very good), then say whether
     it is Better / Worse / Same compared with the previous check-in.
   - **Mood comparison + causal reflection**: as above, plus a short free-text reason for the
     change.
6. **Post** on study day 23 (the morning after day 21), with a 72-hour window: PHQ-8 → LMS-14 →
   Pond Watch → debrief → compensation.

### 2.4 Randomization

Equal allocation (1:1:1) by permuted blocks of three. The platform's `draw_assignment` function
(`supabase/migrations/20260708_phase2_draw_assignment.sql`) handles the *k*-th draw like this:

- it shuffles the three arms for block ⌊*k*/3⌋ (Fisher–Yates, seeded with
  `design_seed = 'zerin-langerian-1'`);
- it returns position *k* mod 3 of that shuffle.

The draw happens server-side at the moment baseline is completed, so allocation stays concealed
until then. There is no stratification. Test and pilot accounts drew from the same sequence and
are excluded from analysis (§5.4).

---

## 3. Sampling Plan

### 3.1 Existing data — what exists and what has been seen

**Registration is prior to analysis, but after the start of data collection and after the
first post-intervention outcomes were collected.** The study team intended to file before the
first post sessions opened on 2026-10-03, and missed that date.

State on 2026-10-05:

- **79 randomized** (26 neutral, 27 mood comparison, 26 reflection; first randomized
  2026-09-11). Recruitment for wave 1 continues.
- Baseline PHQ-8, LMS-14 and Pond Watch exist for everyone randomized.
- **Post-intervention data exist for 3 participants** (post sessions completed 2026-10-03).
  About 33 more post sessions open between 2026-10-06 and 2026-10-08, and further ones will
  follow before filing.
- **[CONFIRM before filing]** Platform data were downloaded from the server. Record here:
  - who downloaded them;
  - when;
  - which tables;
  - whether any post-intervention value (PHQ-8, LMS-14 or Pond Watch) was opened, summarized or
    analysed, by arm or pooled.

  The claim that registration precedes analysis holds only if no outcome was opened, summarized
  or analysed. If anything was, it must be described here exactly.

**What has been looked at, as far as the drafting record shows.** Data-integrity and recruitment
reviews (Claude Code, at Norman Farb's request, on 2026-09-24, 09-29, 10-01 and 10-05) produced:
- counts of sign-ups, screener outcomes by category, and arm sizes;
- completed check-ins per arm, and the per-arm distribution of check-in completion (adherence);
- counts of post sessions completed, with no values;
- for **one** participant, three baseline PHQ-8 totals (the carry-forward anomaly, §5.4);
- on 2026-10-01, a **scoring verification** on baseline questionnaires pooled across arms
  (arm was never joined). It returned only pass/fail verdicts and sign/magnitude categories,
  never coefficients:
  - value ranges;
  - whether each reverse-keyed LMS-14 item ran opposite to the forward items;
  - corrected item–total correlations;
  - whether each subscale's α was at least .70;
  - the sign of the baseline LMS-14–PHQ-8 correlation.

  Findings: §4.2.

None of these reviews computed a mean, distribution or comparison of any PHQ-8, LMS-14, Pond
Watch or daily-mood value by arm, and none opened a post-intervention value. The power analysis
(§3.4) uses no study data. Adherence by arm has been seen, so any analysis involving adherence is
**exploratory** (§5.7).

**Safeguard from filing onward:** no post-intervention outcome is examined by arm until the
final sample is complete (end of wave 2; §3.3).

### 3.2 Data collection procedures

Participants are recruited through the UTM PSY100 SONA pool and receive SONA credit pro-rated
at 0.5 credit per 30 minutes (2.5 for full completion). All data are collected on the RADlab
platform. Every response row records the schedule slot it answers (`schedule_id`), so each
response's timepoint comes from recorded facts, not from the order responses arrived.

### 3.3 Sample size and recruitment waves

**Two waves.** Recruitment is slowing (≈ 6 randomized per day at launch, ≈ 2 per day by late
September), so the study recruits in two waves from the same PSY100 SONA pool:
- **Wave 1 (fall 2026):** randomization from 2026-09-11 until the last date on which a
  participant can finish the 23-day protocol and receive fall-term credit
  (**[DECISION D6]** provisionally 2026-10-31).
- **Wave 2 (winter 2027):** opens when the winter-term SONA pool opens, and continues until the
  total target is reached or the winter credit deadline passes, whichever comes first.

**Target: 186 randomized (62 per arm)** **[DECISION D5]**. That allows for 10% attrition and
leaves 56 per arm with a post assessment. At a medium effect (*d* = 0.5), that gives H2a about
.89 power if both rating arms help equally. If the benefit is graded across arms (mood comparison
half as effective as reflection), power falls to about .67. Reaching .80 in the graded case would
need about 77 per arm with post data, roughly 86 randomized per arm (258 in total) (§3.4). At the current rate wave 1 will end with about 105–115
randomized, so wave 2 needs about 70–80 more. The approved protocol states N = 111, so the new
target needs an **REB amendment**. The approval itself runs to 2027-06-29, which covers a
winter wave.

**Conditions that keep the two waves a single registered study:**
- Procedures, materials, platform code paths and email timing are frozen between waves. Any
  change is logged and reported as a deviation.
- Randomization continues the same permuted-block sequence (§2.4). Blocks are not reset at the
  start of wave 2.
- **No outcome is analysed by arm until wave 2 is complete.** Wave-1 post data will exist
  months before wave 2 ends. Until then the only checks allowed are integrity checks of the kind
  described in §3.1: counts, linkage, ranges, and scoring verdicts pooled across arms.
- Wave is a covariate in every confirmatory model (§5.1). Wave × arm interactions are
  exploratory.

### 3.4 Sample size rationale

**Why the existing power analysis does not apply.** The protocol says 35–37 per arm gives 80%
power, but the supporting simulation (`PowerAnalysis_Zerin.R`) models a different study:
- two groups;
- baseline PHQ mean 15 (SD 6);
- a 3-point difference;
- α = .05 against a 90% target.

The calculations below are made for the tests in §5, at α = .05 two-sided with 80% power.
**Effect sizes are *d* in units of the post-intervention SD**, the same definition §5.2 uses for
reporting. Power for the confirmatory model (§5.1) therefore depends on only one unknown, the
pre–post correlation *r*. With complete data that model is equivalent to ANCOVA, whose residual
variance is (1 − *r*²) times the post variance.

**Model efficiency, stated conservatively.** Baseline PHQ-8 is truncated to 5–9, so *r* is likely
to be low. At *r* ≈ .3, adjusting for baseline removes only about 9% of the post variance. An
earlier draft claimed a 35% saving over a change-score analysis. That figure assumed equal pre
and post variances, which the truncation rules out. With post variance about three times
baseline, the saving over change scores is about 8%. The table below assumes *r* = .3 and makes
no claim beyond that 9% reduction. (*r* = 0 adds about 10% to each n; *r* = .5 subtracts
about 17%.) *r* cannot be checked until post data exist, and it will not be estimated from
wave-1 data by arm.

**H1 — paired change within one arm.** Minimum detectable *d*<sub>z</sub> is 0.38 at the target (56 per arm
with post data; 0.47 at 37). Well powered.

**H2 — nested contrasts: n per arm with post data for 80% power at *d* = 0.5, and power at the
target (56 per arm with post data).** How the benefit is spread across the arms decides which
contrast has power:

| Pattern of benefit (neutral, mood, reflection) | H2a: rating vs neutral | H2b: reflection vs mood | Reflection vs neutral (descriptive) |
|---|---|---|---|
| Both rating arms equal (0, *d*, *d*) | 44 (power .89 at 56) | no effect | 58 (.79) |
| Graded (0, *d*/2, *d*) | 77 (power .67 at 56) | 230 (.28) | 58 (.79) |
| Reflection only (0, 0, *d*) | 173 (power .36 at 56) | 58 (.79) | 58 (.79) |

How to read the table:
- **The 186 target protects H2a if noticing change is the active ingredient.** In that case both
  rating arms carry the benefit, and the contrast pools two-thirds of the sample.
- **It does not protect H2a if the benefit is graded.** Power is then about .67. If the benefit
  comes from writing a reason alone, it is about .36. That is the cost of choosing the
  noticing-change contrast as primary, and it is accepted knowingly.
- **H2b is underpowered at any feasible N** unless the reason component carries most of the
  effect. It is read for its estimate, not its *p*-value.

**H4 — reaction time.** It is the same H2a contrast on median RT, so the same table applies, in
RT post-SD units.

**H3 — relative indirect effect of the H2a contrast (rating vs neutral) through LMS-14.**
Simulated with PROCESS model 4, X coded with the C1/C2 contrasts, Monte Carlo confidence
interval, 1,000 replications per cell, n per arm with post data. Baseline covariates are left out of the
simulation; the registered model includes them, which would add power, so these figures are
conservative:

| Effect of arm on LMS-14 (a, SD units) | b (LMS → PHQ) | 37/arm | 56/arm | 78/arm |
|---|---|---|---|---|
| Both rating arms 0.5 | 0.26 | .51 | .80 | .93 |
| Both rating arms 0.5 | 0.39 | .69 | .87 | .95 |
| Graded (0.25, 0.5) | 0.26 | .32 | .59 | .74 |
| Graded (0.25, 0.5) | 0.39 | .46 | .65 | .76 |

At the target, H3 has adequate power when both rating arms raise LMS-14, and too little when
the effect on LMS-14 is graded. Like H4, it sits in the Holm family, not as the primary test
(§5.3).

**What effect is plausible.** Brief digital self-monitoring interventions typically report
small-to-medium effects on depressive symptoms. That is why the target is set for *d* = 0.5,
not the larger effects that 111 participants could detect. **If the final sample falls short of
the target, a null H2a must be reported as inconclusive for effects below the minimum
detectable effect at the achieved N, not as evidence of no effect.**

---

## 4. Variables

### 4.1 Manipulated variable

Arm (between, 3 levels): neutral, mood comparison, mood comparison + causal reflection (§2.3).
Contact frequency, timing, email wording and click-through are matched across arms.

**Deviation from the approved script [DECISION D8].** The approved script marks the reflection
arm's reason as "(optional)". The platform requires a non-empty reason before the check-in can
be submitted (`MoodCheckinStep.jsx`). This will be reported as a protocol deviation.

### 4.2 Outcome measures (pre and post)

- **Depression: PHQ-8.** 8 items scored 0–3; total = sum (0–24). Baseline is the screener
  administration (§5.4).
- **Mindfulness: LMS-14** (Pirson, Langer & Zilcha, 2018). 14 items rated 1–7. Items 2, 4, 5,
  9, 12 and 14 are reverse-scored. Total = mean of all 14 items. Subscales, each the mean of its
  items:
  - Novelty Seeking: items 1, 7, 8, 10, 13
  - Novelty Producing: items 2, 3, 6, 11, 14
  - Engagement: items 4, 5, 9, 12

  **Scoring check on baseline data (2026-10-01; pooled across arms, verdicts only):**
  - All responses are in range.
  - All six reverse-keyed items are negatively worded as displayed.
  - No reverse-keyed item ran *with* the forward items. Items 5 and 14 ran clearly opposite to
    them, as expected. Items 2, 4, 9 and 12 were near zero.
  - Total-scale α ≥ .70; Novelty Seeking α ≥ .70; Novelty Producing and Engagement α < .70.
  - Engagement items 9 and 12 cohere with each other. Item 4 is weak against everything.
  - Baseline LMS-14 correlates negatively with PHQ-8, as expected.

  The data are consistent with the key and show no sign of a miskeyed item. The weak
  Engagement items fit the published finding that Engagement is the least related of the three
  factors. **The confirmatory mediator is the 14-item total.** Subscales are exploratory
  (§5.7), and Engagement in particular should be read with its low reliability in mind.
  **[DECISION D7]** Langer or Phillips still to confirm the published key.
- **PHQ-8 scoring check.** All item responses are 0–3, and every baseline total lies in 5–9,
  matching the screener's pass rule. Item–rest correlations are negative, as they must be when
  the sample is selected on a narrow band of the total itself. That is a selection artifact, not
  a scoring fault. PHQ-8 is analysed as the standard sum score.
- **Reaction time: Pond Watch.** A go/no-go task:
  - 60 trials, half targets (duck → respond; heron, frog, fish and ripple → withhold);
  - 800 ms stimulus, 1000 ms response window;
  - inter-trial interval 1000–3000 ms;
  - trial order shuffled on every run.

  The H4 outcome is **median correct-response (hit) RT in ms**. Hit rate, false-alarm rate and
  *d′* are recorded as well.

### 4.3 Process measures (daily)

One row per completed check-in: arm, study day (1–21) and slot. The two mood arms also record
the 1–7 rating and the Better/Worse/Same response. The reflection arm adds the reason text, and
the neutral arm records which tip was shown. **Adherence** = completed check-ins ÷ 63.

---

## 5. Analysis Plan

### 5.1 Statistical models

**Framework: one multilevel model per outcome, with a constrained baseline.** Each outcome is
modelled in long format, one row per participant × timepoint (pre, post):

```
y ~ time + time:C1 + time:C2 + wave        # no arm main effect at baseline
residual covariance: unstructured over {pre, post} (separate variances and a correlation)
```

- **C1** = rating arms vs neutral, coded neutral −2/3, mood +1/3, reflection +1/3. This is H2a.
- **C2** = reflection vs mood, coded neutral 0, mood −1/2, reflection +1/2. This is H2b.

The two contrasts are orthogonal and together span the arm effect. Arm enters only through its
interaction with time, which constrains the arm means to be equal at baseline. That constraint
is guaranteed by randomization, since baseline is measured before allocation. This is the
constrained longitudinal data analysis model (cLDA; Liang & Zeger, 2000). It has two
properties that suit this study:
- with complete data it gives the same estimates and efficiency as ANCOVA on post scores
  (§3.4);
- it keeps participants who are missing a post score, using their baseline under a
  missing-at-random assumption, where the mixed ANOVA would drop them.

**Software.** The model is fitted with `nlme::gls` (`correlation = corSymm(form = ~ tnum |
id)`, `weights = varIdent(form = ~ 1 | time)`, REML). An equivalent alternative is
`glmmTMB` with `us(0 + time | id)`. **lme4 is not used for this model**, because lme4 cannot
give the two timepoints different residual variances. Here the baseline variance is truncated
by design (PHQ-8 restricted to 5–9), so the post variance is expected to be several times larger, and
forcing the two to be equal would misstate the standard errors. lme4 is used for the daily
check-in models (§5.7), where that problem does not arise. **[DECISION D1]**

The team's 3 × 2 mixed ANOVA is reported as the descriptive frame (cell means and omnibus
effects), so that readers can see the familiar analysis.

**H1 — Depression decreases.** The `time` effect on PHQ-8 is estimated at the mean of the
contrasts (an equally weighted average over arms). Within-arm pre–post changes are reported
from the same model, with 95% CIs.

*Interpretation caveat, to be stated with the result.* Participants were selected for PHQ-8 5–9
on the very administration that serves as their baseline. A decline is therefore expected in
every arm from regression to the mean. A significant H1 shows that symptoms fell, not that the
emails caused the fall. The neutral arm's change is the estimate of that non-specific decline.

**H2a / H2b.** These are the `time:C1` and `time:C2` coefficients on PHQ-8. The predictions are
a negative coefficient for both: a larger decline for rating than neutral, and for reflection
than mood. Each is reported as an adjusted difference in PHQ-8 points with a 95% CI and *d*.
The team's original pairwise contrast, reflection vs neutral (= C1 + ½·C2 in this coding), is
reported as a planned descriptive estimate.

**H3 — Mindfulness mediates.** PROCESS model 4 (Hayes; R or SPSS):

| Element | Specification |
|---|---|
| X | Arm, multicategorical, with **Helmert-style contrast coding matching C1 and C2** (`mcx` with custom codes), so the relative indirect effects line up with H2a and H2b |
| M | Post LMS-14 total |
| Y | Post PHQ-8 |
| Covariates (both equations) | Baseline LMS-14, baseline PHQ-8, wave |
| Inference | 5,000 percentile bootstrap resamples, seed fixed in the script |

The confirmatory quantity is the **relative indirect effect for C1**: do the rating prompts
lower PHQ-8 through raised LMS-14? H3 is supported if its CI excludes zero in the predicted
direction (a > 0 on LMS-14, b < 0 on PHQ-8). The C2 indirect effect, the reflection-vs-neutral
indirect effect (the team's original framing), the a and b paths, and the direct effects are
reported as estimates.

PROCESS works on complete cases. The multiple-imputation sensitivity analysis is in §5.6.
*Caveat:* the mediator and the outcome are measured at the same timepoints, so their temporal
order is not established. A significant indirect effect is consistent with mediation but does
not demonstrate it.

**H4 — Faster reaction time.** The same cLDA model on median hit RT (valid runs, §5.4). The
confirmatory prediction is faster post RT for the rating arms than neutral (C1). The C2 and
reflection-vs-neutral RT contrasts are reported as estimates.
A time effect is expected in all arms from practice. The same model on *d′* checks for a
speed–accuracy trade-off.

### 5.2 Transformations

Median RT is analysed as recorded. If the residuals are markedly skewed (|skew| > 1), log RT is
also reported, and the untransformed model stays confirmatory. Effect sizes are reported as:
- adjusted differences in raw units (PHQ-8 points, LMS-14 scale points, ms);
- *d* = the adjusted difference ÷ the pooled post-intervention SD.

### 5.3 Inference criteria and multiplicity

**Primary (α = .05, two-sided):** **H2a** (`time:C1` on PHQ-8). This is the study's single
primary test.

**Confirmatory, Holm-corrected as one family (α = .05):**
- H1 (time effect on PHQ-8);
- H2b (`time:C2` on PHQ-8);
- H3 (C1 relative indirect effect; bootstrap CI read at the Holm-adjusted level);
- H4 (`time:C1` on RT).

H2b is in this family rather than primary because §3.4 shows it is underpowered unless writing
the reason carries most of the benefit. Its estimate and CI are reported whatever its *p*-value. A non-significant H2b is
inconclusive, not evidence that reflection adds nothing beyond noticing.

**[DECISION D3]** All tests are two-sided. **[DECISION D4]** H2 is tested as the two nested
contrasts; the omnibus arm × time F is reported descriptively only.

Everything not listed above is exploratory: reported with uncorrected 95% CIs and never
described as confirming a hypothesis.

### 5.4 Data inclusion and exclusion

**Analysis population.** Everyone randomized is analysed in the arm they were assigned to,
whatever their adherence. Excluded only:
- test and pilot accounts (`is_test = true`, including the July dry-run `pilot-*` ids and
  SONA's link-test id 3055);
- anyone who asks for their data to be removed within the protocol's window.

**Baseline PHQ-8.** The screener administration is every participant's baseline. In one known
case (screened 2026-09-22) the carry-forward failed, and the participant answered PHQ-8 twice
more in the baseline session. Their screener response is their baseline. The later rows are
kept in the dataset, reported, and not modelled. Any further cases are handled the same way and
listed.

**Post assessments.** Only a post session completed inside its 72-hour window counts.

**Pond Watch validity.** A run is excluded from H4 if any of the following holds:
- hit rate < .50;
- false-alarm rate > .50;
- median hit RT < 150 ms.

Each of these indicates the participant was not doing the task. A participant needs a valid run
at both timepoints to enter H4. **[DECISION D7b]** Confirm the thresholds.

**Repeated submissions.** Rows flagged `resubmission_of` (a byte-identical copy within 5 s)
are excluded. Any other repeat is data and is listed in `_export_integrity.csv`. Where one value
per timepoint is needed, the **first** complete response in the window is used.

### 5.5 Quality and manipulation checks (reported, not used to exclude)

- Adherence by arm, and completion by slot and study day.
- Reflection arm: reason length, and the share of reasons that are non-substantive (e.g. "idk",
  ".").
- Mood arms: share of Better/Worse vs Same responses.
- Baseline PHQ-8, LMS-14 and RT by arm, shown descriptively without significance tests.
- A CONSORT flow diagram: screened → each screen-out reason → consented → baseline →
  randomized per arm → post completed.

### 5.6 Missing data

The cLDA models (H1, H2, H4) use every observed score, including the baseline of anyone without
a post assessment. They are valid if missingness depends only on observed data (arm, baseline,
wave). The complete-case mixed ANOVA is reported alongside them.

H3 (PROCESS, complete cases) is repeated with multiple imputation (m = 50, predictive mean
matching). The imputation model includes arm, wave, both baselines, adherence and, for the mood
arms, the mean daily rating. Last observation carried forward is **not** used: it imputes "no
change" and biases every arm toward the null.

**Per-protocol sensitivity.** H2a and H2b are repeated on participants who completed at least
32 of 63 check-ins (≥ 50%).

### 5.7 Exploratory analyses

- LMS-14 subscales as outcomes.
- Adherence as a predictor of PHQ-8 change within each active arm. Adherence is not randomized,
  and it was seen by arm before registration.
- Daily mood trajectory in the two mood arms (lme4): `rating ~ day * arm + slot + wave +
  (1 + day | participant)`.
- Wave × contrast interactions: did the effects differ between fall and winter?
- Proportion moving below the mild threshold (post PHQ-8 < 5), by arm.
- Thematic coding of the reflection arm's reasons for Langerian indicators (noticing, new
  distinctions, contextual explanations), using a scheme developed blind to outcome.

---

## 6. Other

**Protocol deviations to report.** Relative to REB #65268 as approved:
- Data are collected on the RADlab platform, not Qualtrics.
- The reflection arm's reason is required rather than optional.
- The screener's PHQ-8 doubles as the baseline measure.

**[DECISION D10]** Confirm that an amendment covers the platform change. The protocol's consent
section also says screening retains no identifiable data and only aggregate pass/fail counts.
The platform keeps every screener's answers, including those of people who screened out, keyed
to their SONA-linked id.

**Data sharing.** De-identified data and analysis code will be posted to OSF, as the consent
form states.

---

## 7. Decisions needed before filing

| # | Decision | Draft's proposal |
|---|---|---|
| D1 | Model | Constrained-baseline multilevel model (nlme/glmmTMB, unstructured time covariance); mixed ANOVA as the descriptive frame |
| D3 | One- vs two-sided | Two-sided |
| D4 | H2 tests | Nested contrasts: H2a rating vs neutral (primary), H2b reflection vs mood; H3 and H4 use the H2a contrast |
| **D5** | **Sample size** | **186 randomized (62/arm) over two waves: H2a power .89 if both rating arms help equally, .67 if graded. 258 (86/arm) would cover the graded case. REB amendment for N either way.** |
| D6 | Wave-1 stopping date | Last date a participant can finish and receive fall-term credit |
| D7 | LMS-14 reverse key | Data consistent with items 2, 4, 5, 9, 12, 14; Langer or Phillips to confirm |
| D7b | Pond Watch validity | Hit rate < .50, false alarms > .50, or median RT < 150 ms excludes a run |
| D8 | Required reflection reason | Report as a deviation |
| D9 | Blinded analysis | Optional: scramble arm labels until code is frozen |
| D10 | REB coverage | Confirm amendment for the platform, screener-data retention, and the larger N |
| D11 | Between-wave freeze | No by-arm outcome analysis until wave 2 completes; integrity checks only |
| D12 | Data export disclosure | Complete the §3.1 [CONFIRM] item: who exported what, when, and whether any outcome was viewed |

---

## Appendix A — Analysis skeleton (R)

```r
library(nlme); library(emmeans); library(afex); library(lme4); library(lmerTest)
# PROCESS for R (Hayes) for H3

# long: one row per participant x time
#   id, arm (neutral, mood, reflection), wave (fall, winter), time (pre, post), phq, lms, rt
long$tnum <- as.integer(long$time == "post") + 1
long$C1 <- c(neutral = -2/3, mood = 1/3, reflection = 1/3)[long$arm]   # H2a
long$C2 <- c(neutral = 0, mood = -1/2, reflection = 1/2)[long$arm]     # H2b
long$post <- as.integer(long$time == "post")

## cLDA: arm enters only through time (equal baseline means by randomization)
clda <- function(y, data) gls(
  as.formula(paste(y, "~ post + post:C1 + post:C2 + wave")),
  data = data, na.action = na.omit, method = "REML",
  correlation = corSymm(form = ~ tnum | id),
  weights = varIdent(form = ~ 1 | time))

m_phq <- clda("phq", long)
summary(m_phq)   # post (H1); post:C1 (H2a, primary); post:C2 (H2b)
# team's original pairwise: reflection - neutral = C1 + C2/2
# (fixef difference via linear combination of post:C1 and post:C2)

## Descriptive frame: the team's 3 x 2 mixed ANOVA (complete cases)
aov_ez("id", "phq", long, between = "arm", within = "time", covariate = NULL)

## H3: PROCESS model 4, X = arm with C1/C2 contrast codes, baseline + wave covariates
# process(data = wide, y = "phq_post", x = "arm", m = "lms_post",
#         cov = c("lms_pre", "phq_pre", "wave"), mcx = <custom C1/C2 codes>, model = 4,
#         boot = 5000, seed = 20261002)

## H4: same cLDA on median hit RT, valid runs only
m_rt <- clda("rt", subset(long, pw_valid))

## Daily mood (mood arms only), lme4
# lmer(rating ~ day_c * arm + slot + wave + (1 + day_c | id), data = daily)
```
