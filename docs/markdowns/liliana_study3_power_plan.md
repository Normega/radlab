# Liliana Study 3 — Power Analysis Plan

> Drafted 2026-09-07. Companion to `liliana_study3_plan_consolidated.html` (the analysis plan,
> rev 2 + contrast correction) and `liliana_study3_design.md` (design spec).
>
> **Status: plan, not results.** Fixed inputs so far: recruitment ceiling ~150–250 (Norm,
> 2026-09-06); effect sizes to be set as **smallest effect of interest** rather than from
> literature or pilot estimates. Open inputs are listed in §5.

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
- At the observed ~29% conversion, recruiting 250 randomizes ~73 — at which point nothing in
  Aims 2 or 3 is adequately powered, and even the manipulation check is marginal.
- At ~70% conversion, recruiting 250 randomizes ~175 — which powers the manipulation check
  comfortably and brings the choice contrast into a defensible range.

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
| H2D / H3D | C1 / C2 on `delta_stress` | Session (12/person) | Repeated measures cut MDE to 0.52–0.80× the single-measure value |
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

**The feedback hypothesis is best tested behaviourally and at the session level, not via BIPS at
final.** H3-MC asks whether feedback changed what people chose; that is both the mechanism and the
best-powered test in the design. If Aim 3's distal outcomes stay primary at a feasible N, the study
is pre-registering a test it is unlikely to pass regardless of whether the effect is real.

Three options, to decide before registration:

1. Keep BIPS primary for Aim 3, and pre-register the honest MDE as a stated limitation.
2. Promote H3-MC and the session-level `delta_stress` contrast to primary for Aim 3, with the
   assessment-level outcomes secondary.
3. Keep the structure but pre-register Aim 3 as explicitly exploratory.

Option 2 is the one I would argue for; option 1 is defensible if the assessment outcomes matter
more to the thesis framing than the power does.

---

## 2a. The SESOI, and why it is better news than §2 suggests

**Set 2026-09-07 (Norm): the smallest score change worth acting on is 3–4 BIPS points, on the
reasoning that a change below the standard error of measurement cannot be distinguished from
measurement noise.**

Two consequences, one of them convenient.

### The raw SD cancels

If the SESOI is set *at* the SEM, and SEM = SD·√(1 − α), then

**SESOI in SD units = SEM / SD = √(1 − α)**

The raw standard deviation drops out. **We therefore do not need BIPS norms, or an estimate of its
SD in this population, to set the power target** — only its reliability.

| BIPS α | SESOI (d) |
|---|---|
| 0.75 | 0.500 |
| 0.80 | 0.447 |
| 0.85 | 0.387 |
| 0.90 | 0.316 |

It also means **the 3-vs-4 ambiguity is immaterial.** Under the SEM reading, 3 points implies a
sample SD of ~7.7 and 4 points implies ~10.3 (at α = .85); either way the standardized target is
the same 0.387. What actually moves the target is BIPS's reliability in this sample, which will be
estimated from the data rather than assumed. The registration should therefore state the SESOI in
**raw points** and report the implied *d* once α is known.

*(If instead the intent is "3–4 raw points regardless of what the SEM turns out to be," then the SD
does matter and we need it — flagged in §5.)*

### Randomized N required, at the SESOI

| BIPS α | d | r=.70 C1 / C2 | r=.75 C1 / C2 | r=.80 C1 / C2 |
|---|---|---|---|---|
| 0.80 | 0.447 | 90 / 120 | 77 / 103 | 64 / 85 |
| 0.85 | 0.387 | 120 / 160 | 103 / 137 | 85 / 113 |
| 0.90 | 0.316 | 180 / 240 | 155 / 206 | 127 / 170 |

At a plausible α = .85 and r = .75, the binding requirement is **~137 randomized** (the C2 feedback
contrast). That is a materially better outlook than §2's scoping, which was benchmarked against
d = 0.20–0.30 — effect sizes the study now explicitly declines to chase.

**This is the correct move, and worth stating in the registration as deliberate.** Powering to a
SESOI means the design is built to detect effects large enough to matter for a person, and to be
uninformative about smaller ones. A null then reads as "no effect worth acting on," not "no effect."

One caveat to make explicit: **the SEM is a within-person precision quantity, and this is being used
as a between-group threshold.** A group mean difference smaller than the SEM is still statistically
detectable with enough participants — it is simply being declared not worth detecting. That is a
clinical-significance stance rather than a statistical one, and it is defensible, but it should be
named in the registration rather than left implicit.

### What this makes the go/no-go number

Combining with §1: at 250 recruited, hitting 137 randomized needs **~55% onboarding conversion**.
At 200 recruited it needs ~69%. Against the ~29% observed in Zerin, that is the gap the pretest has
to close.

**So the single number to measure in the August pretest is onboarding conversion, and the threshold
is roughly 55%.** Below it, the feedback contrast cannot reach its own stated SESOI at any feasible
recruitment.

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
| 2 | ~~SESOI~~ — **SET 2026-09-07**: 3–4 BIPS points, at the SEM (§2a) | Sets the power target | Norm. Implied d = √(1−α); raw SD not needed |
| 2b | **BIPS reliability (α) in this sample** — replaces the SD as the quantity that matters | Converts the SESOI to SD units; moves required N from ~85 to ~206 across α = .80–.90 | Estimate from the data; sweep meanwhile |
| 2c | Confirm the SESOI is meant *at the SEM* rather than as a fixed 3–4 points | If fixed, the raw SD is needed after all (§2a) | Norm — one line |
| 3 | Test–retest r for BIPS and the secondary outcomes over ~2 weeks | Sets ANCOVA efficiency; 0.70 vs 0.80 moves MDE ~15% | Published values, or Liliana's prior data |
| 4 | Expected congruence rate in the Choice arm | H3-MC's baseline; chance is 33%, but people may pick well unaided | Assumption; sweep 0.33–0.50 |
| 5 | Session-level ICC for `delta_stress` | Sets the repeated-measures gain | Sweep 0.2–0.6; refine from pretest |
| 6 | Pre-stress distribution | Determines floor severity on `delta_stress` | Pretest; the screener selects for distress, so floor risk may be modest |
| 7 | ~~R + `lme4` availability~~ — **CONFIRMED 2026-09-07**, R 4.6.0 with lme4/lmerTest/simr | Tooling (§3.3) | Closed |

Items 3–6 and 2b can be swept rather than fixed. With the SESOI now set, **the one genuinely
gating input is item 1, onboarding conversion** — and §2a gives it a concrete threshold of roughly
55%. It is empirical, and the August pretest is where it comes from.

Item 2c is a one-line confirmation, not a blocker: under the SEM reading the 3-vs-4 ambiguity does
not affect the target at all.

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
