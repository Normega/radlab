# Breath Belt Correspondence — Preregistered Analysis Plan

**Validating the accelerometer breath belt against the lab-grade stretch belt**

> Version 0.1 (draft for discussion) · 2026-07-22 · RADlab
> Status: **DRAFT** — decision points flagged `[DECIDE]`; empirical thresholds flagged `[SET]`.
> This plan is written to be lifted into an OSF preregistration once the `[DECIDE]`/`[SET]`
> items are fixed and the dataset is frozen. Nothing here has seen the paired data yet.

---

## 0. One-paragraph summary

Over the past month a set of participants (the same people appearing in the compensation
roster and the in-person Breath Belt sessions) were recorded **simultaneously** on two
respiration sensors: (a) the **accelerometer breath belt** worn through the website — a
Polar H10 chest strap whose tri-axial accelerometer is projected to a 1-D breath signal
by the calibrated MLR model, and (b) a **lab-grade stretch belt** — a Biopac respiratory-effort
transducer recorded in AcqKnowledge (`.acq`). The 13 event-trigger codes fired by the game
are written into *both* records (as markers in the `.acq`, as logged timestamps in the accel
CSV), so the two streams can be aligned phase-by-phase and trial-by-trial. This plan sets out
(i) how the study's phases map onto distinct correspondence questions, (ii) a hierarchy of
correspondence measures from coarse (breath rate) to fine (waveform morphology) to
consequential (do the *scientific conclusions* survive substituting one belt for the other),
and (iii) preregistered, directional, equivalence-framed hypotheses with an analysis pipeline
that respects the repeated-measures structure of the data.

The framing is **interchangeability**, not mere correlation. Two signals can correlate
near-perfectly and still disagree by a fixed or rate-dependent offset that makes them
non-substitutable. Every primary claim is therefore stated as an **equivalence** test
(TOST / concordance / limits of agreement), not a null-hypothesis-significance "they're
correlated" test.

---

## 1. The two signals — and why the comparison is not naive

| | Accelerometer breath belt (website) | Lab-grade stretch belt (`.acq`) |
|---|---|---|
| Device | Polar H10, tri-axial ACC over Web Bluetooth | Biopac respiratory-effort transducer (RSP), AcqKnowledge |
| Physical quantity | Chest-wall **acceleration** (≈ d²/dt² of displacement) | Chest **circumference / displacement** |
| Derived signal | MLR projection of filtered x/y/z → 0–1 "breath value" | Raw transducer volts → filtered respiration trace |
| Units | Arbitrary (calibrated per session) | Arbitrary (transducer volts) |
| Sampling | Polar ACC packets → ~25 Hz breath signal | AcqKnowledge graph rate (typically 200–1000 Hz) |
| Clock | Browser / BLE packet timestamps (jittery) | Physio ADC clock (stable) |
| Role | Device under test | Reference standard |

**The central physical subtlety.** Acceleration is (to first order) the second time-derivative
of displacement. For a quasi-sinusoidal breath at angular frequency ω, acceleration ≈ −ω²·displacement:
the two are **180° out of phase** and the accelerometer's amplitude is scaled by **ω²** relative to
the stretch belt's. Two consequences the plan must handle head-on:

1. **Amplitude is frequency-dependent for the accelerometer but not the stretch belt.** Faster
   breathing inflates raw accel amplitude relative to displacement. Any amplitude/morphology
   comparison on *raw* signals will look like disagreement even if breathing is identical.
2. **Rate and timing are frequency-invariant.** Breath *period*, *rate*, cycle *count*, and the
   *timing* of inspiration onsets do not depend on this scaling. This is why the rate/period family
   (Level 1 below) is the natural **primary** endpoint and the fair comparison, while raw-waveform
   morphology (Level 4) is secondary and must first reconcile the derivative relationship
   (double-integrate the accel, or band-pass both and phase-align) before it means anything.

Note the MLR calibration already partly launders this: the accel model is *fit against a cosine
displacement-like pacer*, so the "breath value" is re-phased and re-scaled toward a displacement
proxy. But that is a **learned linear projection at one rate (~15 bpm calibration pace)**, not a
physics-based integration — so it is not guaranteed to hold across the manipulated rate range of
Phases 2–3. Testing exactly that is one of the interesting questions (H2).

**Train/test hygiene.** Calibration is where the accel model is fit. Using calibration data to
*validate* correspondence would be circular. **Calibration = training window; every correspondence
statistic is computed on held-out phases** (baselines, Phase 2, Phase 3).

---

## 2. Phases of the Breath Belt session, and what each one is good for

The FSM (see `website.md` §20) produces these analyzable windows, each bracketed by trigger codes
present in both streams:

```
Calibration            (TRAIN — accel MLR fit; excluded from validation)
Pre-baseline  120 s    triggers 2→3    free breathing, natural rate
Phase 2       9 trials triggers 4→5    fixed paced rates (faster/slower/same vs 4 s), per trial 10/11/12
Phase 3       ≤60 trl  triggers 6→7    adaptive QUEST, small near-threshold rate deviations
Post-baseline 120 s    triggers 8→9    free breathing, natural rate (repeat of pre)
```

| Phase | Regime | What correspondence question it uniquely licenses |
|---|---|---|
| **Pre-baseline** (120 s) | Spontaneous, natural rate | Ecological validity: does the accel belt recover *unpaced* breathing? Resting-rate agreement, full breath-by-breath cycle detection, respiratory-rate variability (RRV), morphology at natural rate. The condition that matters for real-world website use. |
| **Phase 2** (9 fixed trials) | Known imposed rates spanning faster↔same↔slower | **Rate-range stress test.** Because the accel↔displacement scaling is ω²-dependent, Phase 2 is where we test whether agreement holds *across* imposed rates, not just at rest. Three-way ground truth available: pacer (intended) vs stretch belt (actual displacement) vs accel belt (actual accel-derived). Per-trial period columns already stored for the accel belt (`bt_baseline_period_ms`, `bt_condition_period_ms`); compute stretch-belt equivalents offline from the `.acq`. |
| **Phase 3** (dual-QUEST) | Small, near-perceptual-threshold deviations | **Fine-resolution stress test.** The hardest regime: can the accel belt resolve the *same small Δperiod* the stretch belt resolves? Also the largest trial count → tightest per-participant agreement estimates. Directional-change agreement using the already-ported Study 5 `direction_correct` method. |
| **Post-baseline** (120 s) | Spontaneous, natural rate (repeat) | **Within-session stability / test-retest of the agreement itself.** Does correspondence degrade after 20+ min of wear (strap slip, sweat, posture)? The shared-layer EVR signal-quality index is the covariate that should predict any degradation. Also an internal replication of the pre-baseline agreement result. |
| **Per-trial substructure** (codes 10/11/12) | baseline breaths 1–2 → condition breaths 3–4 | Within-trial *change* detection: do both belts register the same *directional* step at trigger 11 (Δperiod agreement), independent of absolute calibration? |

The trigger fiducials also let us treat the **whole session** as one long paired recording for
morphology/coherence analyses (Level 4), sliced by phase label.

---

## 3. Level 0 — Temporal alignment (prerequisite, and a mini-validation in itself)

Nothing downstream is trustworthy until the two clocks are reconciled. This is a deliverable in
its own right.

- **Fiducial extraction.** Recover the 13 trigger marks from the `.acq` (event channel) and their
  logged timestamps from the accel CSV (`phase`/`trial`/`packet_timestamp` columns). Codes 1–13
  span the whole session; codes 10/11/12 recur per trial → dozens of shared fiducials.
- **Clock-mapping model.** Regress `.acq` fiducial times on accel fiducial times. Report the
  **offset** (global lag), **slope** (relative clock drift between the browser/BLE clock and the
  physio ADC clock), and **residual jitter** (fiducial-alignment error after the best affine map).
  A slope ≠ 1 is real, expected Web-Bluetooth/browser-timer drift and must be corrected before any
  timing comparison.
- **Cross-check.** Independently, within each 120 s baseline, cross-correlate the reconstructed
  accel respiration against the stretch belt and confirm the lag matches the fiducial-derived offset.
- **Preregistered QC gate.** Sessions whose residual fiducial jitter exceeds `[SET: e.g. 100 ms]`
  after affine correction, or which are missing ≥ `[SET]` of the 13 marks in either stream, are
  flagged and analyzed separately (sensitivity analysis), not silently pooled.

Report: bias, drift slope, jitter distribution per session; this is Table 1 of the eventual paper.

---

## 4. A hierarchy of correspondence measures (the brainstorm)

Organized coarse → fine → consequential. Each level is a distinct claim about interchangeability;
they can pass or fail independently, and that pattern is itself informative.

### Level 1 — Scalar rate/period agreement (**PRIMARY**)
The frequency-invariant, physically fair comparison. Unit of analysis = one window (each baseline;
each Phase-2/3 trial, split into baseline-breaths and condition-breaths).

- Per window, compute breath **period (ms)** / **rate (bpm)** from each belt using a *single shared
  pipeline* (§6) so any difference is device, not method.
- Agreement statistics (report all; they answer different things):
  - **Bland–Altman** bias + 95% limits of agreement — **repeated-measures variant** (Olofsen/Parker
    or Bland–Altman-with-multiple-observations-per-subject); the naive one-pair-per-subject version
    is *wrong* here and its use is a classic validation-study error.
  - **Lin's Concordance Correlation Coefficient (CCC)** — correlation × bias-correction in one number.
  - **Deming / orthogonal regression** — both instruments carry measurement error, so OLS
    (which assumes an error-free x) is inappropriate; Deming estimates proportional and fixed bias.
  - **ICC(2,1)** (two-way random, absolute agreement).
  - **Equivalence test (TOST)** against a preregistered indifference margin `[SET: e.g. ±1 bpm,
    or ±10% of period]` — this is the statement that makes "interchangeable" a *falsifiable* claim.
- Tested **within each phase** and **pooled**, and — critically — as a function of imposed rate
  (Phase 2/3) to expose any rate-dependent bias (H2).

### Level 2 — Respiratory-rate variability (RRV) agreement
Mean rate can agree while the *dynamics* smear. Over each 120 s baseline: SD of breath period, CV,
RMSSD of the period series, and sample entropy. Agreement via ICC / CCC on each RRV metric. Tests
whether the accel belt preserves breath-to-breath variability structure, not just central tendency.

### Level 3 — Cycle-by-cycle event agreement
Detect inspiration onsets (troughs) in both signals (Study 5 pipeline). Then:
- **Detection agreement:** greedy match each stretch-belt onset to an accel onset within a tolerance
  `[SET: e.g. ±300 ms]` → sensitivity, positive predictive value, **F1**, and breath-count agreement.
- **Timing agreement:** for matched breaths, the distribution of onset-time differences (median bias,
  IQR jitter). This is the evidence that underwrites "you can substitute the accel belt for any
  *breath-timing* analysis" (phase-locking, RSA windows, event-related respiration).

### Level 4 — Continuous waveform morphology (**SECONDARY / exploratory**)
Only meaningful *after* reconciling the derivative relationship. Two routes, prereg both:
- (a) double-integrate the accel signal (with detrending/high-pass to kill integration drift) to a
  displacement proxy; or (b) band-pass both signals to the respiratory band and z-normalize.
- Then: windowed Pearson / max cross-correlation; magnitude-squared **coherence** and **phase-locking
  value** in the respiratory band; ensemble-averaged single-breath waveform shape correlation;
  optionally DTW distance. Expectation: strong near natural rate, weaker at the rate extremes — and
  that gradient is the honest, physics-predicted result, not a failure.

### Level 5 — Downstream inference equivalence (**the decisive test**)
The question that actually matters is not "do the signals agree" but "do the **answers** agree."
Re-run the study's real analyses with accel-derived vs stretch-belt-derived respiration and test
whether conclusions change:
- The `direction_correct` behavioral-adherence scoring (already ported from Study 5) computed on each
  belt → agreement in per-trial adherence classification (κ, % agreement).
- Any analysis using per-trial breath period as a physiological covariate → does the coefficient
  (sign, magnitude, credible interval) replicate across belts?
- If the scientific conclusions are invariant to which belt supplied the respiration, the accel belt
  is interchangeable *for the purpose that matters*, even where lower-level morphology (Level 4)
  diverges.

---

## 5. Hypotheses (preregistered)

Directional where the physics permits; equivalence-framed for every "they agree" claim. Thresholds
in `[SET]` to be fixed before unblinding.

- **H1 — Rate/period equivalence (primary).** Accel and stretch-belt breath-period estimates are
  *equivalent* within the preregistered margin `[SET]`: TOST rejects both one-sided nulls, CCC ≥
  `[SET: e.g. 0.90]`, repeated-measures Bland–Altman bias ≈ 0 with 95% LoA inside the margin. Holds
  within each phase and pooled.
- **H2 — Rate-invariance of period, rate-dependence of amplitude.** Because accel amplitude scales
  with ω² but breath period does not: **period agreement is invariant to imposed rate** (no
  rate × belt interaction on period error, tested across Phase 2/3), whereas **amplitude agreement
  degrades systematically with faster imposed rate**. A period bias that grows at the rate extremes
  would falsify the claim that the single-rate MLR calibration generalizes.
- **H3 — Cycle detection.** Breath-onset detection F1 between belts ≥ `[SET: e.g. 0.95]` at the
  preregistered tolerance; median matched-onset timing difference within `[SET: e.g. ±150 ms]` and
  breath-count agreement ICC ≥ `[SET]`.
- **H4 — Variability.** RRV metrics (CV, RMSSD, sample entropy) over the 120 s baselines agree,
  ICC ≥ `[SET: e.g. 0.75]`.
- **H5 — Within-session stability (conditional on quality).** Correspondence does **not** degrade
  pre→post-baseline (no credible change in bias/LoA), *except* where the EVR signal-quality index
  flags degradation — i.e., disagreement is predicted by low EVR / high clamp-saturation, not by
  time per se. EVR is the preregistered moderator.
- **H6 — Morphology (exploratory).** After integration/band-pass alignment, respiratory-band
  coherence ≥ `[SET]` at natural rate; predicted to weaken monotonically toward the rate extremes.
- **H7 — Downstream equivalence (decisive).** Directional-adherence classification and any
  per-trial-period covariate effects are unchanged (agreement κ ≥ `[SET]`; overlapping credible
  intervals / equivalence of coefficients) when substituting accel for stretch belt.

**Interpretive matrix.** H1 + H3 + H7 passing while H6 is weak = "interchangeable for rate, timing,
and inference; not a morphology substitute" — a perfectly publishable and honest conclusion for an
accelerometer respiration proxy. H1 failing only at the rate extremes (H2) localizes the limit to
the calibration-generalization boundary and points at a fix (multi-rate or PCA re-calibration —
already prototyped in the shared breath layer).

---

## 6. Shared processing pipeline (identical for both belts)

To ensure any difference is the *device*, not the *method*, both signals pass through one pipeline,
mirroring Study 5's `breath_pipeline.R` (`run_pipeline`):

1. Resample both to a common grid `[SET: e.g. 25 Hz]` (the accel breath-signal rate; downsample the
   `.acq`).
2. Band-pass with `filtfilt` (zero-phase) over the **whole continuous recording once**, then slice
   per phase/trial — *not* per short window (per-window `filtfilt` distorts edges; this exact bug was
   found and fixed in the demo, see `website.md` §20).
3. Detrend; for the accel morphology route, high-pass after double integration to control drift.
4. Trough (inspiration-onset) detection → per-breath durations = diff(trough times).
5. Period per window = median inter-trough interval (matching `estimateBreathPeriodMs`; keep the
   `minPeriodMs` gates: 2000 ms for free baselines, 1500 ms for staircase-range trials).
6. Null periods (< 2 troughs) are **kept as null, never dropped** (per `belt_correspondence_migration.sql`).

Preregister the filter band, resample rate, trough-detection parameters, and integration/detrend
constants before touching the paired data.

---

## 7. Statistical model & multiplicity

- **Repeated-measures throughout.** Trials nested in phase nested in session nested in participant,
  with participants contributing multiple sessions (`session_number`). Agreement statistics and any
  regression use **mixed-effects models** with random intercepts (and slopes where identified) for
  participant and session. Bland–Altman is the repeated-measures variant (§4, Level 1).
- **Primary endpoint** is H1 pooled with the preregistered TOST margin; everything else is secondary
  or exploratory and labeled as such.
- **Multiplicity.** Control across the secondary family (H2–H5) via `[DECIDE: hierarchical Bayesian
  partial pooling vs. Holm across the frequentist secondary tests]`. Level-4/5 exploratory results
  reported with intervals, not gated by α.
- **Estimation philosophy.** `[DECIDE: Bayesian (matches the lab's existing BRMS workflow and the
  Study 1 accuracy models) vs. frequentist equivalence-testing.]` Recommendation: Bayesian for the
  hierarchical agreement models (natural handling of the nesting and of "equivalence" as a posterior
  in the ROPE), reported alongside classical Bland–Altman/CCC for reviewer familiarity.

---

## 8. Sample, inclusion, exclusion

- **Sample.** All participants from the past ~month with a **paired** record: a website accel-belt
  session and a simultaneous stretch-belt `.acq`. Cross-reference the compensation roster against
  `belt_sessions` to enumerate the paired set. `[SET: final N participants / N sessions once the
  dataset is frozen — cannot be queried from this repo; pull from Supabase `belt_sessions` + the
  `.acq` inventory.]`
- **Power.** For equivalence (TOST), power is driven by the LoA width relative to the margin and the
  number of paired windows per participant (Phases 2–3 give tens of trials each). Do a small
  simulation-based power/precision check once the margin `[SET]` and a variance guess (from the first
  few sessions or Study 5) are in hand.
- **Inclusion:** successful calibration (fitR ≥ 0.4, per the existing gate); both streams present for
  a phase; fiducial alignment within the Level-0 QC gate.
- **Exclusion (preregistered):** phases failing the Level-0 jitter/missing-mark gate (→ sensitivity
  analysis, not primary); windows flagged by EVR `signalDegraded` (→ moderator analysis under H5,
  not deletion); trials with motion-artifact clamp-saturation above `[SET]`.
- **Null-period windows are retained**, not treated as missing at random.

---

## 9. Deliverables & pipeline artifacts

1. `.acq` → tidy extractor (event channel + respiration channel → long CSV with fiducial times).
2. Alignment module (Level 0): affine clock map + residual-jitter report per session.
3. Shared breath pipeline (§6) applied to both belts (port `breath_pipeline.R`; the accel side already
   exists in `breathUtils.js` / `analyzeRecording.mjs`).
4. Agreement module: repeated-measures Bland–Altman, CCC, Deming, ICC, TOST, mixed models.
5. Downstream-equivalence module (Level 5): re-run `direction_correct` and the period-covariate
   analysis on each belt.
6. Reproducible report (per-phase agreement tables + BA plots + coherence-vs-rate figure).

---

## 10. Open decisions to resolve before this becomes a registration

- `[DECIDE]` Primary endpoint level — confirm Level 1 (rate/period) as primary vs. elevating cycle
  timing (Level 3) or downstream equivalence (Level 5).
- `[SET]` Equivalence/indifference margins for H1 (rate) and the tolerances for H3 (timing).
- `[SET]` All `[SET]` thresholds (CCC/ICC/F1/κ/coherence floors, QC gates).
- `[DECIDE]` Bayesian vs frequentist estimation; multiplicity strategy.
- `[DECIDE]` Confirm the lab-belt hardware model and the `.acq` graph sample rate / channel map, and
  whether any additional physio channel (e.g. a second belt, CO₂, or nasal thermistor) is present to
  serve as an *independent* third reference.
- `[CONFIRM]` The exact stretch-belt transducer and its transfer characteristics (some RSP transducers
  are themselves closer to displacement, others to effort/force) — this sets expectations for Level 4.

---

*Compiled 2026-07-22. Companions: `website.md` §20 (Breath Belt architecture, phase FSM, trigger
vocabulary, stored columns), `docs/markdowns/fourbreathtask.md` (task theory & Study 1 priors),
`src/games/BreathBelt/breathUtils.js` (accel pipeline). External: Study 5 `breath_pipeline.R`,
`Intero2025_BehaviourLedBreathAnalysis.R`.*
