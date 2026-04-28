# Best Practices: Estimating High Salience Thresholds
## For Online Breath Change Detection Tasks

*Based on Study 1 data (N = 103, two runs, 3,192 trials)*

---

## Theoretical Rationale

### The interoceptive inference problem

A central question in interoception research is how people come to be aware — or unaware — of changes in their own physiology. The breath change detection task addresses this by creating a controlled, measurable physiological change (a shift in breathing rate) and asking whether participants consciously detect it. By manipulating both **how much** the breathing changes (magnitude) and **how obviously** it changes (salience), the task can independently vary the *strength* of the physiological signal and the *ease with which it can be consciously detected*.

This orthogonal manipulation is the key design innovation. It means that physiological change and conscious awareness can be partially decoupled — participants may experience the same magnitude of breathing change while differing in whether they noticed it, depending on salience. This creates the conditions needed to ask whether the *consequences* of a physiological change (e.g., on arousal, confidence, or social perception) depend on conscious awareness.

### Why manipulate magnitude and salience independently?

**Magnitude** (delta = TotalChange − 1) controls the actual physiological signal — how different the changed breath is from the baseline. Larger magnitudes produce stronger proprioceptive and mechanoreceptive signals from stretch receptors in the lungs and chest wall, as well as altered respiratory drive. Magnitude is the "ground truth" of the interoceptive event.

**Salience** controls how that change is delivered over time — gradually (amortised, low salience) or abruptly (step change, high salience). Crucially, salience affects the ease of conscious detection *independently of the underlying physiological signal*. A gradual change of magnitude 0.35 produces the same final breathing rate as an abrupt change of the same magnitude, but is far less likely to be consciously noticed.

This independence is confirmed empirically: in Study 1, the magnitude × salience interaction on detection accuracy was the dominant effect (β = 4.46 logit units, Evid.Ratio > 10,000), meaning salience dramatically amplified the detectability of any given magnitude change, while the salience main effect alone (at zero magnitude) was near zero. Salience operates as a *gain control* on the interoceptive signal-to-noise ratio.

### What this enables scientifically

The independent manipulation of magnitude and salience allows three distinct scientific questions to be addressed within a single design:

**1. Interoceptive sensitivity** — By varying magnitude, the task generates a psychometric function relating signal strength to detection probability. Signal detection theory (SDT) can then decompose performance into sensitivity (d') and response bias (criterion), providing a purer measure of interoceptive ability than simple accuracy.

**2. The role of conscious awareness** — By using salience to create matched conditions where the same physiological change is detected by some participants but not others, the task can examine whether the *effects* of a physiological change depend on conscious awareness. Comparing aware and unaware trials at the same magnitude tests whether awareness is necessary for a given downstream consequence.

**3. Misattribution and affect** — When participants are unaware that their breathing has changed, any resulting shift in arousal or affect cannot be consciously attributed to the breathing manipulation. If such shifts occur and influence judgements (e.g., face attractiveness ratings), this constitutes evidence for unconscious interoceptive influence on cognition — the misattribution of arousal mechanism. If shifts only occur when participants are aware, this instead points to cognitive appraisal as the mechanism.

### The confidence and arousal question

**Confidence** in the detection response provides a second-order measure of metacognitive accuracy — the degree to which participants' subjective certainty matches their actual performance. In interoception research, confidence is theoretically linked to the precision weighting of interoceptive signals in predictive processing accounts. Low salience trials, where performance is near chance, provide a direct test of whether participants know when they don't know — a key component of interoceptive awareness distinct from detection accuracy itself.

**Subjective arousal** is the critical mediator in the misattribution framework. Faster breathing is theoretically arousing (activating the sympathetic nervous system), but in Study 1 we found that arousal ratings were not elevated by faster breathing on unaware trials — the arousal effect was entirely confined to trials where participants detected the change. This suggests arousal in this context is a post-detection cognitive appraisal rather than a pure bottom-up physiological response, with implications for theories of emotion that assume visceral signals directly generate affective states.

Together, this design provides a window into the relationship between:
- Physiological change (magnitude)
- Conscious detection (accuracy, moderated by salience)
- Metacognitive awareness (confidence)
- Subjective affective state (arousal)
- Downstream cognitive effects (e.g., attractiveness ratings)

---

## Overview

This document provides empirical priors and practical recommendations for setting breathing manipulation parameters in online versions of the interoceptive breath change detection task, with a focus on the **high salience** condition. High salience trials load the full change in breath duration between a single transition (e.g., breaths 2–3 in a 4-breath design), producing an abrupt step change rather than a gradual drift.

The goal is to specify manipulation parameters that produce **meaningful variation in awareness** — i.e., conditions where some participants detect the change and others do not — rather than ceiling or floor performance. This variation is essential: a task that produces 100% detection provides no lever for examining the consequences of unawareness, while a task that produces 0% detection cannot validate that the manipulation affected physiology at all.

---

## Task Design Reference

### Design logic

The task presents participants with a paced breathing exercise in which a circle on screen expands and contracts to guide their breath. On each trial the breathing pace either stays constant (catch trial) or changes (signal trial). The key design choice is that the change can be delivered in two qualitatively different ways:

- **High salience:** The full change is loaded in a single step between consecutive breaths (e.g., breath 2 to breath 3). The participant experiences an abrupt shift — one breath is noticeably different from the previous one. This maximises the moment-to-moment contrast and makes the change easy to consciously notice.

- **Low salience:** The same total change in breathing rate is distributed gradually across all breaths. No single breath is dramatically different from the previous one; the change accumulates incrementally. This minimises moment-to-moment contrast, making the change hard to consciously detect even when its total magnitude is the same as a high salience trial.

The result is that **salience and magnitude are orthogonal**: a small magnitude change can be delivered abruptly (highly salient but physiologically weak) or gradually (low salience and physiologically weak), and the same is true for large magnitude changes. This orthogonality is what enables the scientific questions described in the rationale section.

### Breath structure
- **Default breath duration:** 4–5 seconds per cycle (baseline)
- **Trial length:** 4 consecutive breaths (current design); Study 1 used 8 breaths
- **First breath:** Always baseline duration — no change signal present, provides reference
- **Change structure:**
  - *High salience:* Full change loaded between breaths 2 and 3 (abrupt step)
  - *Low salience:* Change amortised gradually across breaths 2, 3, and 4
- **Response:** 3AFC — faster / slower / same (no change)
- **Post-trial ratings:** Confidence (1–7), arousal (1–7), and optionally mood

### Manipulation variable
`TotalChange` is the multiplier on breath duration:
- `TotalChange < 1` → faster breathing (shorter breath cycles, e.g., 0.65 = 65% of baseline)
- `TotalChange > 1` → slower breathing (longer breath cycles, e.g., 1.35 = 135% of baseline)
- `delta = TotalChange - 1` is the signed deviation (negative = faster, positive = slower)
- `magnitude = |delta|` is the unsigned change size (direction-agnostic)

### Trial types and their purpose

| Trial type | TotalChange | Purpose |
|---|---|---|
| Catch (no change) | 1.0 | Estimates response criterion / false alarm rate |
| Signal — faster, low salience | < 1 (gradual) | Low-awareness faster condition |
| Signal — faster, high salience | < 1 (abrupt) | High-awareness faster condition |
| Signal — slower, low salience | > 1 (gradual) | Low-awareness slower condition |
| Signal — slower, high salience | > 1 (abrupt) | High-awareness slower condition |

---

## Empirical Data: Study 1 Parameters

Study 1 used three fixed magnitude levels crossed with two salience conditions:

| TotalChange | delta | magnitude | Direction |
|---|---|---|---|
| 0.50 | -0.50 | 0.50 | Faster |
| 0.65 | -0.35 | 0.35 | Faster |
| 0.80 | -0.20 | 0.20 | Faster |
| 1.20 | +0.20 | 0.20 | Slower |
| 1.35 | +0.35 | 0.35 | Slower |
| 1.50 | +0.50 | 0.50 | Slower |

> **Note:** Study 1 used 8-breath trials with the step change occurring at breath 5 for high salience. The 4-breath design places the step at breath 2→3, which may produce somewhat different psychometric functions.

---

## Empirical Priors: Detection Performance

### High salience detection accuracy by magnitude

From Study 1 (pooled across direction and runs):

| Magnitude | Mean accuracy | Predicted probability (Bayesian model) |
|---|---|---|
| 0.20 (small) | ~62% | ~51% |
| 0.35 (medium) | ~72% | ~67% |
| 0.65 (large) | ~87% | ~88% |

Chance performance = 1/3 (33%) with no catch trials, or 25% with catch trials included.

### Key parameters from the Bayesian accuracy model

These are on the **logit scale** from:
`accuracy ~ magnitude × salience + direction + (1 + salience | participant)`

| Parameter | Estimate | 95% CrI |
|---|---|---|
| Intercept (low salience, faster, magnitude = 0) | -1.84 | [-2.18, -1.50] |
| Magnitude (slope, low salience) | 1.24 | [0.61, 1.88] |
| Salience (high vs low, at magnitude = 0) | 0.14 | [-0.33, 0.59] |
| **Magnitude × salience interaction** | **4.46** | **[3.58, 5.39]** |
| Direction (slower vs faster) | 0.55 | [0.39, 0.72] |

The magnitude × salience interaction is the dominant effect. Under high salience, the effective magnitude slope is 1.24 + 4.46 = **5.70 logit units per unit of magnitude**, compared to just 1.24 under low salience.

### Predicted accuracy under high salience

Using the model: `p = plogis(-1.84 + (1.24 + 4.46) × magnitude + 0.14)`

| Magnitude | Predicted p(correct) |
|---|---|
| 0.10 | 0.38 |
| 0.15 | 0.53 |
| 0.20 | 0.68 |
| 0.25 | 0.80 |
| 0.30 | 0.88 |
| 0.35 | 0.93 |
| 0.40 | 0.96 |
| 0.50 | 0.99 |

**The psychometric transition zone for high salience is approximately magnitude 0.10–0.30.** This is where detection probability moves from near-chance to near-ceiling and is therefore where individual differences in interoceptive sensitivity are most informative.

---

## Direction Asymmetry

A robust direction asymmetry was observed under high salience, though it was substantially smaller than under low salience:

| Condition | d' (mean) | p_same |
|---|---|---|
| High salience, faster | 0.469 | 0.260 |
| High salience, slower | 0.581 | 0.267 |

The asymmetry under high salience was not credible (interaction β = −0.42 favoured low salience as the locus of the asymmetry). For online designs, treat faster and slower as approximately equally detectable under high salience, but note that slower may be marginally easier to detect.

---

## Individual Differences

Participant-level variability in high salience detection was substantial:

| Parameter | Value |
|---|---|
| Random slope SD (salience benefit) | 1.13 logit units |
| Random intercept SD | 0.51 logit units |
| Correlation (intercept, salience slope) | -0.33 |

The negative correlation indicates that participants with lower baseline detection accuracy tend to benefit *more* from high salience — suggesting the abruptness cue particularly helps low-sensitivity individuals.

**Practical implication:** Even under high salience at magnitude 0.35, some participants will be near floor (~70th percentile detects; ~30th percentile near chance). Do not assume high salience produces uniform awareness.

### Test-retest reliability of d'
- High salience ICC = **0.537** (moderate; 95% CI [0.382, 0.663])
- Low salience ICC = 0.339 (poor-moderate)

A single session of 12 high salience trials (as in Study 1) provides only moderate reliability. For individual differences analyses, **two sessions or more trials per condition** are recommended.

---

## Recommendations for Online Implementation

### 1. Magnitude selection

**For a fixed design** targeting ~75% awareness under high salience:
- Use magnitude **0.20–0.25** (TotalChange of 0.75–0.80 for faster, 1.20–1.25 for slower)
- This places most participants in the sensitive region of the psychometric function

**For maximum individual difference sensitivity:**
- Use a range of magnitudes: 0.15, 0.20, 0.30 (approximately equal spacing in the transition zone)
- Avoid 0.35+ under high salience — these produce ceiling awareness, removing individual variation

**For a staircase/adaptive design:**
- Start value: magnitude = 0.25
- Target threshold: 70–75% correct (above the 1/3 floor, below ceiling)
- Step sizes: [0.10, 0.05, 0.025] for a 3-down-1-up staircase
- QUEST prior: μ = 0.20, σ = 0.10 (based on Study 1 distribution)

### 2. Bayesian adaptive approach (QUEST / QUEST+)

Based on Study 1, a reasonable QUEST prior for the **high salience threshold** (magnitude at 75% correct) is:

```
Prior mean (μ):     0.20  # centre of the transition zone
Prior SD (σ):       0.10  # wide enough to accommodate individual variation
Psychometric slope: 5.70  # logit units per magnitude unit (from model)
Lapse rate:         0.02  # small lapse assumed for online participants
Guess rate:         0.33  # 3AFC without catch trials
```

For the 4-breath design (vs Study 1's 8-breath), the slope may be shallower — consider inflating σ to 0.15 until empirical data is available.

### 3. Trial structure for online use

| Parameter | Recommendation | Rationale |
|---|---|---|
| Trials per salience level | ≥ 16 | Reliability; 12 gave ICC = 0.54 |
| Include catch trials | Yes | Enables full SDT, prevents bias |
| Catch trial proportion | 20–25% | Sufficient for criterion estimation |
| Breath pace | 4 sec/cycle | Matches Study 1 baseline |
| Response options | Faster / Slower / Same | Maintains 3AFC structure |
| Post-trial ratings | Confidence (1–7) + Arousal (1–7) | Required for misattribution analysis |

### 4. Online-specific adjustments

**Audio pacing:** If using audio cues instead of a visual circle, note that auditory and visual breath pacing may produce different interoceptive coupling. Visual pacing (expanding/contracting circle) is recommended for consistency with Study 1.

**Timing precision:** Online timing jitter (browser-based) may reduce the sharpness of the abrupt step change in high salience trials. Mitigate by:
- Using WebAudio API for timing if possible
- Building in a 50ms buffer around the step change
- Excluding participants with unusually long reaction times (>5s) as a data quality check

**Screen size variability:** The circle animation should scale to viewport height (Study 1 used `units='height'` in PsychoPy). Use CSS `vh` units for online implementation.

**Attention and compliance:** Online participants show higher lapse rates. Consider:
- Including ≥3 obvious catch trials (TotalChange = 1.0 exactly) as attention checks
- Excluding participants who fail >80% of catch trials
- Providing practice trials until ≥70% accuracy on practice

### 5. Sample size guidance

From the Study 1 power analysis, for **95% power** to detect:

| Effect | Required N |
|---|---|
| Salience effect on d' | ~50 |
| Magnitude × salience interaction | ~50 |
| Path b (arousal → attraction) | ~280 |

For individual differences analyses using high salience d' as a predictor, the moderate ICC (0.537) effectively reduces statistical power — apply the Spearman-Brown correction if using single-session estimates.

---

## Summary of Recommended Parameter Set

For a high salience online task targeting the interoceptive sensitivity transition zone:

```
Baseline breath duration:  4.0 seconds
High salience step:        Between breaths 2 and 3
Recommended magnitudes:    0.15, 0.20, 0.25, 0.30 (fixed)
  or adaptive start:       0.25, targeting 75% threshold
Direction balance:         Equal faster/slower (randomised)
Catch trial proportion:    25%
Trials per session:        ≥ 32 (8 per magnitude level)
QUEST prior mean:          0.20
QUEST prior SD:            0.10–0.15
```

---

## Caveats and Open Questions

1. **4-breath vs 8-breath design:** Study 1 used 8 breaths per trial. The 4-breath design provides a weaker signal — the psychometric slope under high salience may be shallower and thresholds may be higher than the values reported here. Empirical calibration in a pilot is recommended.

2. **Breath entrainment:** Study 1 included a 60-second entrainment period before the task. Online versions should include at least 8–10 practice trials at baseline pace before the main task.

3. **Population differences:** Study 1 recruited from a university sample. Online populations (e.g., Prolific) may differ in baseline interoceptive sensitivity and response strategies.

4. **No catch trials in Study 1:** The absence of catch trials means criterion (c) cannot be estimated from Study 1 data. The psychometric function parameters reported here reflect a mixture of sensitivity and bias. Online designs should include catch trials to disentangle these.

5. **Awareness ≠ detection accuracy:** The high p_same rate under low salience (56%) suggests participants often withhold a response rather than guessing. Any online design should consider whether "same" responses reflect genuine non-detection or conservative responding, and whether confidence ratings can disambiguate these.

---

*Document compiled from Study 1 analysis (Norm, 2025). Update after online pilot data is available.*
