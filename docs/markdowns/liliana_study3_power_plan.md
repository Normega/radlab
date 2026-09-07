# Liliana Study 3 — Power Analysis Plan

> Drafted 2026-09-07. Companion to `liliana_study3_plan_consolidated.html` (the analysis plan,
> rev 2 + contrast correction) and `liliana_study3_design.md` (design spec).
>
> **Status: plan, not results.** Inputs now fixed: recruitment ceiling ~150–250 (Norm, 2026-09-06);
> **SESOI closed 2026-09-07** — the BIPS standard error of measurement, primary threshold
> 3.43 points (d = 0.569) from the measure's 1-month test–retest stability, with the
> internal-consistency-based 2.18 points (d = 0.362) pre-registered as a secondary, more sensitive
> bound (§2a). Tooling confirmed: R 4.6.0 with lme4/lmerTest/simr.
>
> **One input still gates the analysis: Day-1 onboarding conversion**, which needs to clear roughly
> **32%** (§1, §2a). That is an empirical number and the August pretest is where it comes from.
> Remaining inputs, all sweepable, are in §5.

---

## 1. The headline finding, before any simulation

Scoping arithmetic and one piece of platform evidence already determine most of the answer, and
they point somewhere other than where a power analysis usually points.

**The binding constraint on this study's power is not effect size, sample size, or the analysis
model. It is Day-1 onboarding conversion.**

The platform has exactly one completed longitudinal run with real participants — the Zerin study,
17 non-test enrollments, July 2026, now fully run out. Its outcome:

| | People | Sessions completed | Emails received |
|---|---|---|---|
| Consented + gave contact email | 5 | 6, 19, 20, 20, 25 | 66.6 each |
| Did not | 12 | 0 each | 0.7 each |

The 12 never crossed the consent / contact-email gate, so they never entered the email stream and
never had a session to complete. **Attrition was ~entirely at onboarding, not during the study.**
Conditional on onboarding, adherence was excellent — four of five completed 19–25 sessions, which
would clear Liliana's ≥10-of-12 rule in both phases with room to spare.

Consequences for Liliana Study 3:

- **Randomized N ≈ recruited × onboarding conversion.** Mid-study attrition is a second-order
  correction, not the main term.
- At the observed ~29% conversion, recruiting 250 randomizes ~73. Against the SESOI settled in
  §2a that is *just* short of the ~79 the feedback contrast needs — workable, with no margin.
- At ~50% conversion, recruiting 250 randomizes ~125, which clears both the feedback contrast and
  the manipulation check with room to spare.

**The threshold to clear is therefore ~32% onboarding conversion**, not the ~55% quoted before the
SESOI was set (§2a).

**So the highest-value action available before launch is improving the consent → contact-email
funnel, not anything in the analysis plan.** That should be measured explicitly in the August
pretest and treated as a go/no-go number.

**Caveats, stated plainly.** N = 17, one study, a different design and a different consent flow.
Zerin's non-consenters are mostly marked `withdrawn`, so some may have actively declined rather
than silently dropped. This is a *prior worth taking seriously and worth checking*, not an
established rate. §5 lists it as the top input to pin down in the pretest.

---

## 2. What is being powered, ranked by how binding it is

| Test | Contrast | Level | Verdict from scoping |
|---|---|---|---|
| H3-MC | Choice vs Choice+Feedback, congruence | Participant, binary | **Best powered.** ~59/group for a 40%→65% lift |
| H2D / H3D | C1 / C2 on `delta_stress` | Session (12/person) | Comparable precision to BIPS, not better (see below); its case is proximity to the manipulation |
| H2A / H2B / H2C | C1 × Time | Assessment | Feasible for d ≈ 0.30, not for d ≈ 0.20 |
| H3A / H3B / H3C | C2 × Time | Assessment | **Weakest.** ~515 randomized for d = 0.20 |
| H1A–D | Time only | Both | Not binding — single-arm pre-post is well powered at any feasible N |

### Assessment-level minimum detectable effect (SD units, 80% power, ANCOVA on the prior timepoint)

| Randomized | n/group | C1, r=.70 | C2, r=.70 | C1, r=.80 | C2, r=.80 |
|---|---|---|---|---|---|
| 90 | 30 | 0.45 | 0.52 | 0.38 | 0.43 |
| 150 | 50 | 0.35 | 0.40 | 0.29 | 0.34 |
| 210 | 70 | 0.29 | 0.34 | 0.25 | 0.28 |
| 300 | 100 | 0.25 | 0.28 | 0.21 | 0.24 |

Inverted, at r = .75: detecting d = 0.20 needs **386 randomized for C1 and 515 for C2**; d = 0.30
needs 172 and 229.

`sum(c²)` is 1.5 for C1 and 2.0 for C2 under the corrected difference-scaled weights
(C1 = −1, +½, +½; C2 = 0, −1, +1), which is why C2 is the harder test even though it involves
only two groups.

### The implication worth putting to Liliana

**The feedback hypothesis is best tested behaviourally, not via BIPS at final.** H3-MC asks
whether feedback changed what people chose; that is both the mechanism and the best-powered test in
the design. If Aim 3's distal outcomes stay primary at a feasible N, the study is pre-registering a
test it is unlikely to pass regardless of whether the effect is real.

**Correction to an earlier claim (2026-09-07).** A previous draft asserted that the session-level
outcomes are meaningfully better powered because of repeated measures. That was overstated. A
12-session person mean has reliability ICC/(ICC + (1-ICC)/12) — 0.84 at ICC = 0.3, 0.89 at 0.4,
0.92 at 0.5 — which is *comparable to* BIPS's alpha of .869, not dramatically better. The real
argument for the session-level outcomes is that acute within-session relief is **closer to what the
feedback manipulation could plausibly move** than month-scale perceived stress, not that it is more
precisely measured.

Three options, to decide before registration:

1. Keep BIPS primary for Aim 3, and pre-register the honest MDE as a stated limitation.
2. Promote H3-MC and the session-level `delta_stress` contrast to primary for Aim 3, with the
   assessment-level outcomes secondary.
3. Keep the structure but pre-register Aim 3 as explicitly exploratory.

Option 2 is the one I would argue for; option 1 is defensible if the assessment outcomes matter
more to the thesis framing than the power does.

---

## 2a. The SESOI — settled 2026-09-07

**Decision: the SESOI is the standard error of measurement of the BIPS. Primary threshold is the
test–retest-based SEM (3.43 points, d = 0.569); the internal-consistency-based SEM (2.18 points,
d = 0.362) is pre-registered alongside it as a secondary, more sensitive bound.**

### The psychometrics it rests on

From Lehman et al. Table 5 (BIPS total, baseline, N = 138 MS patients): M = 17.99, **SD = 6.02**,
**Cronbach's alpha = .869**, **1-month stability r = .676**, 12-month stability r = .626.

| Basis | SEM | d | MDC95 |
|---|---|---|---|
| Cronbach's alpha | 2.18 pts | 0.362 | 6.0 pts |
| 1-month test–retest | **3.43 pts** | **0.569** | 9.5 pts |

Norm's independent estimate of "3 or 4 points" matches the test–retest-based SEM almost exactly,
and confirms the intent was the SEM rather than the MDC.

### Why not the MDC

MDC95 = 1.96 x sqrt(2) x SEM. **The sqrt(2) is there because it is the error of a difference between
two measurements on one person.** For a between-arm group contrast that is the wrong error term
entirely — the MDC answers "is *this person's* change real?", not "is the difference between arms
meaningful?" So it is rejected as conceptually mismatched, not merely as too demanding. This is
sharpened by the design being an **active control**: all three arms receive a real 12-day
intervention and differ only in how it was selected, so an MDC-sized between-arm difference
(d ~ 1.0–1.6) is not a plausible target.

### What the SEM choice actually is

Stated plainly, because it will be asked in review: **the SEM carries the same category mismatch as
the MDC, just milder.** It too is a within-person precision quantity being used as a between-group
threshold; the true standard error of a group difference is SEM x sqrt(2/n), which is far smaller.

What justifies it is not measurement theory but a value judgement: *a between-arm difference smaller
than one person's measurement error is not worth acting on, however precisely it can be measured.*
That is defensible and it is the position taken here. It should be written up as a convention, not
presented as a derivation.

### The tension this leaves, stated openly

The active-control reasoning cuts both ways. If between-arm effects are small — published
choice/autonomy effects sit around d ~ 0.15–0.30 — then a *more* sensitive threshold is wanted,
which is the alpha-based SEM, and that is the expensive direction:

| Threshold | d | C1 randomized | C2 randomized | Onboarding needed from 250 recruited |
|---|---|---|---|---|
| Retest-based SEM (primary) | 0.569 | 59 | **79** | **~32%** |
| alpha-based SEM (secondary) | 0.362 | 146 | **195** | ~78% |

*(at r = .676; C2 binds)*

**Both thresholds sit above the plausible true effect**, so the assessment-level outcomes are
likely to null under either. Buying the sensitive threshold costs 2.5x the sample and still does
not reach d ~ 0.20–0.30, which is why the retest-based SEM is primary. Registering the alpha-based
bound alongside it costs nothing and makes the "large effects or nothing" limitation legible
rather than buried.

**The consequence to state in the registration:** on the assessment-level outcomes this study is
powered for large effects only. A null there means *no effect worth acting on* — it does not rule
out a real effect of the size the literature would predict.

### Where Aim 3 is actually decided

Given the above, **H3-MC should not be read as a subsidiary check.** It needs ~59 per choice group,
is comfortably feasible at any realistic N, and is logically prior: if feedback does not change
which intervention people choose, there is no mechanism by which it could change their outcomes.
A study that answers H3-MC cleanly has learned something real even if every assessment outcome nulls.

### Three caveats

1. **The SD does not need to transfer.** Since d = sqrt(1 - reliability), the MS-sample SD of 6.02
   cancels out; only the reliability needs to travel, and alpha = .869 for a 9-item scale plausibly
   does. In raw points, 3.43 assumes SD ~ 6 — if Liliana's screened sample runs tighter, the raw
   threshold shrinks proportionally while d stays put.
2. **Interval mismatch, in both directions.** Lehman's stability is over 4 weeks in participants
   *not* receiving an intervention; Liliana's intervals are ~13–14 days. A shorter interval implies
   higher r and hence a smaller SEM, so 3.43 is mildly conservative on interval — while being
   mildly liberal in treating genuine one-month fluctuation in stress as measurement error.
3. **Do not double-count r.** It enters both the SESOI (d = sqrt(1 - r)) and the ANCOVA efficiency
   (1 - r^2). If both are driven by the same r, required n scales as (1 + r) and the two effects
   largely offset. Fix r once, explicitly, rather than tuning it in two places.

Note also that **r = .676 is lower than the .70–.80 swept in §2**, so those MDEs are slightly
optimistic. Over a two-week interval r should land nearer .70–.75.

---

## 3. Method

**Simulation, with closed-form as a bracket.** Analytic formulas cover the two-timepoint contrasts,
and were used for §2. They cannot cover what the pre-registered models actually do: maximal random
effects (§4.4 of the plan), the ordinal 1–6 floor on `delta_stress`, attrition that conditions on
Phase 1 adherence *before* randomization, ITT with partial data under MAR, and Holm correction
within families. Those need simulation.

### 3.1 Data-generating model

Simulate at the session level and aggregate; that is where the real structure lives.

1. **Recruitment** — N recruited (swept 100–300).
2. **Onboarding** — Bernoulli(p_onboard), swept 0.3–0.8. This is the dominant parameter (§1).
3. **Phase 1** — 12 sessions, three interventions × 4 days, block order drawn from the 6
   permutations.
4. **Session stress** — pre and post as **ordinal 1–6**, not Gaussian. Person random intercept,
   person × intervention random slope (the variance component that H1D estimates and E1 depends on),
   session noise. `delta_stress` = pre − post, so it inherits the floor: a participant at pre = 1
   cannot show relief. Simulating this Gaussian would overstate power.
5. **Adherence** — per-session missingness; conditional on onboarding, calibrate to the Zerin
   pattern (high) and sweep pessimistic alternatives.
6. **Phase 1 gate** — drop participants below 10 of 12, and those missing the midpoint window.
7. **Randomize** survivors 1:1:1 to the three conditions.
8. **Choice behaviour** — congruence with `data_best` as Bernoulli, with rates differing by
   condition; this is what H3-MC tests.
9. **Phase 2** — 12 sessions of the assigned intervention, with condition effects entered on the
   SESOI scale.
10. **Assessment outcomes** — baseline / midpoint / final with specified test–retest r.

### 3.2 Analysis, per replicate

Fit the models exactly as pre-registered — same fixed effects, same maximal random structure with
the same simplification ladder on non-convergence, same covariates, same Holm families. Record
convergence failures rather than discarding them silently; a specification that fails to converge
in 20% of replicates is itself a finding about the plan.

### 3.3 Tooling

**R with `lme4` / `lmerTest` — confirmed available 2026-09-07.** The pre-registered structure
includes random slopes for session day and intervention type; `lme4` handles that natively and is
what the lab will use for the real analysis, so the simulation and the analysis share a
specification. Python's `statsmodels` MixedLM is awkward for crossed random slopes.

Installed: **R 4.6.0** at `C:\Program Files\R\R-4.6.0in\Rscript.exe`, with `lme4`,
`lmerTest`, `MASS` and **`simr`** already present (4.5.0 and 4.5.2 are also installed, plus
RStudio). Nothing to install. Note R is **not on the Git Bash PATH** — scripts must invoke the full
path, or run through PowerShell.

`simr` is worth using where it fits: it does power-by-simulation directly on a fitted `merMod`,
which covers H2D/H3D and H1D cheaply. The custom simulator (§3.1) is still needed for everything
`simr` cannot express — the recruitment funnel, the Phase-1 adherence gate applied *before*
randomization, the ordinal floor, and the Holm families.

---

## 4. Outputs

1. **Power curves** — power vs N recruited, one panel per key test, with onboarding conversion as
   the swept parameter. This is the plot that makes §1's argument visible.
2. **MDE table** at the realistic N, per hypothesis, in raw and SD units.
3. **An explicit underpowered list** — which pre-registered tests cannot reach 80% at feasible N,
   stated in the registration rather than discovered afterwards.
4. **Sensitivity grid** — power under pessimistic vs optimistic values of onboarding conversion,
   adherence, test–retest r, and ICC, so the answer's fragility is visible.
5. **A recommendation** on §2's three options.

---

## 5. Inputs still needed

| # | Input | Why it matters | Best source |
|---|---|---|---|
| 1 | **Onboarding conversion** | Dominates everything (§1) | Measure in the August pretest; treat as go/no-go |
| 2 | ~~SESOI~~ — **CLOSED 2026-09-07**. Primary = retest-based SEM (3.43 pts, d = 0.569); secondary = alpha-based SEM (2.18 pts, d = 0.362). Anchored on Lehman Table 5 | Sets the power target | Closed |
| 2b | BIPS reliability **in Liliana's sample** — alpha and the ~2-week stability | Confirms the imported values travel; both are estimable from the study's own data | Report alongside the result; sweep meanwhile |
| 3 | Test–retest r for BIPS and the secondary outcomes over ~2 weeks | Sets ANCOVA efficiency; 0.70 vs 0.80 moves MDE ~15% | Published values, or Liliana's prior data |
| 4 | Expected congruence rate in the Choice arm | H3-MC's baseline; chance is 33%, but people may pick well unaided | Assumption; sweep 0.33–0.50 |
| 5 | Session-level ICC for `delta_stress` | Sets the repeated-measures gain | Sweep 0.2–0.6; refine from pretest |
| 6 | Pre-stress distribution | Determines floor severity on `delta_stress` | Pretest; the screener selects for distress, so floor risk may be modest |
| 7 | ~~R + `lme4` availability~~ — **CONFIRMED 2026-09-07**, R 4.6.0 with lme4/lmerTest/simr | Tooling (§3.3) | Closed |

Items 3–6 and 2b can be swept rather than fixed. With the SESOI closed, **the one genuinely gating
input is item 1, onboarding conversion** — and §2a gives it a concrete threshold of roughly **32%**.
It is empirical, and the August pretest is where it comes from.

Item 3 is now partly answered too: Lehman's 1-month stability of .676 is a better anchor for the
ANCOVA efficiency than the .70–.80 previously swept.

---

## 6. Sequence

1. ~~Set SESOI~~ — done (§2a). Confirm item 2c in passing.
2. Build the simulator (§3.1) with parameters swept, not fixed.
3. Run the closed-form bracket against it as a correctness check — the simulation should reproduce
   §2's table when the ordinal floor and attrition are switched off.
4. Produce outputs (§4).
5. Fold the result into the plan as a new §11, and publish as Doc rev 3 **together with the
   contrast-weight correction**, so Liliana's link changes once rather than twice.
6. Re-run after the pretest with the measured onboarding conversion substituted for the assumption.

Step 6 is the one that matters most, and it is why this plan is parameterized rather than
producing a single number now.
