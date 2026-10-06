# BCAT-DDM design-power simulation

Answers the question in `docs/markdowns/bcat_ddm_plan.md` §6a–§6c: with ~40 minutes of task time,
which pacing design best identifies **how breath-change evidence accumulates into detection**, and
how well it measures individual differences in **breath-to-breath vs total-change coding**? Read
the plan doc for the context. This file covers how to run the simulation and what it assumes.

## Pieces

| File | Role |
|---|---|
| `src/games/BcatDdm/schedule.js` | **The pacer schedules**: the same generator the task will use. Designs: `brief`, `roving`, `trials`, `ramp`, `roving_ramp`, `roving_mixed`, `double_blip`, `blip_train`, `blip_combo`, `double_bump`, `bump_train`, `roving_bump`, `roving_ramp_bump`. Tests: `node --test src/games/BcatDdm/schedule.test.mjs` |
| `make_schedules.mjs` | Batch CLI: spec JSON in, schedules JSON out (called by `run_power.py`) |
| `model.py` | Evidence channels, simulator, exact grid likelihood, Monte Carlo psychometrics (numba) |
| `run_power.py` | Calibrates the population, samples participants, simulates sessions, fits all models, writes the results folder |
| `results/` | Round 1 (2026-10-01): 3 observers × 5 designs. Produced by the round-1 version of `run_power.py` (commit 78cd642) |
| `results_round2/` | Round 2 (2026-10-05): 5 observers × 4 designs, two-channel models |
| `results_round2_nomeas/` | Round 2 rerun of the two ramp-block designs with perfect belt measurement |
| `results_round3/` | Round 3 (2026-10-06): memory span. 4 memory populations × 4 designs incl. the blip designs |
| `results_round4/` | Round 4 (2026-10-06): smooth 3–4-breath bumps (double, train, roving + bump block, roving + bump + ramp), same people as round 3; `roving_ramp` reference rows copied from round 3 |

### Round 3: memory span and blips

Study 1's targets (50% detection of a 20% step, 0.3 false alarms/min) are met equally well by a low
boundary with a strong criterion and by a high boundary with a weak one. The first observer forgets
in about 3 s; the second holds evidence for minutes. **How long evidence is held is therefore a free
property the task has to measure.**

**Observer populations** (all mixed coding, share s ~ Beta(2, 2)):
- `mem_short`: a = 3, criterion drain, evidence half-life about 1.5 s.
- `mem_medium`: a = 6, about 8 s.
- `mem_long`: a = 10, about 60 s.
- `mem_long_leaky`: a = 10, with forgetting through a leak drawn per person, log-uniform over
  5–60 s time constants. Each person's criterion is set so they keep their own false-alarm rate
  (0.3/min, log-SD .4). A single shared criterion would leave weak-leak people in constant false
  alarms.

**Memory metric.** Evidence half-life: ln 2/λ with a leak, a/2c without (c = criterion beyond
normal breathing noise).

**Designs:** `roving_ramp` (reference), `double_blip`, `blip_train`, `blip_combo` (20 + 20 min).
Blips are one-breath departures from the base rate. Sizes are set in `BLIP_OPTIONS` (double:
0.5 and 0.8 × m50; train: 0.4–0.9 × m50), so a single blip is usually missed. The summary adds:
- pair detection by gap × size (the double-blip signature);
- recovery of each person's memory half-life;
- the press-triggered blip kernel from blip trains.

## Run

```bash
python scripts/bcat_ddm_sim/run_power.py --n 2 --quick --designs roving_mixed --out <scratch>   # ~6 min smoke test
python scripts/bcat_ddm_sim/run_power.py --n 30 --resume --out scripts/bcat_ddm_sim/results_round2   # ~2.5 h on 22 cores
python scripts/bcat_ddm_sim/run_power.py --n 30 --sigma-meas 0 --designs <best two> --out scripts/bcat_ddm_sim/results_round2_nomeas
```

Design names accept the variants in `DESIGN_VARIANTS` (e.g. `roving_ramp50` = roving_ramp with half
the session in ramps). `--gens` and `--fits` choose the generating observers and fitted models.
`--resume` skips sessions already complete in `<out>/fits.csv`, so a run stopped by a time limit
restarts where it left off. Needs Python ≥ 3.11 with numpy, scipy, pandas, numba, plus Node 22.
`<out>/calibration.json` is reused if present; delete it to recalibrate. Outputs: `datasets.csv`
(one row per simulated session: true parameters, yields), `fits.csv` (one row per session × fitted
model) and `summary.md`.

## The observer model

A one-boundary accumulator runs through the whole stream (a CUSUM change detector), driven by two
evidence channels with separate gains:

```
dx = (vL·uL + vT·uT − δ − λ·x) dt + dW,   reflect at 0,   press when x ≥ a (+ Ter = 0.35 s),   restart 1 s after the press

uL = |L_k − R_k|         total change: distance of breath k's log period from a running reference
                         (10-breath exponential average)
uT = |L_k − L_(k−1)|     breath-to-breath change
```

Both channels are constant within a breath. After any pause (a probe or an inter-trial break), the
reference re-anchors to the first breath back and the first breath carries no transient.

| Observer / fitted model | vL | vT | λ |
|---|---|---|---|
| `level` | free | 0 | 0 |
| `leaky` | free | 0 | free |
| `transient` | 0 | free | 0 |
| `mixed` | free | free | 0 |
| `mixed_leaky` | free | free | free |

**Breath-to-breath share s.** A mixed observer has gains `vL = k(1−s)·refL` and `vT = k·s·refT`,
where `refL` and `refT` are the gains at which each channel *alone* gives the calibration target.
So s = 0 is a pure total-change observer and s = 1 a pure breath-to-breath observer, on a scale
where both are equally sensitive. The recovered share uses the same formula on the fitted gains.

**Calibration.** Each observer's population mean is set so that a 20% step is detected 50% of the
time within 5 breaths (Study 1-like), at 0.3 false alarms per minute of steady pacing. The gain is
the *lowest* one that reaches the target (an upward scan, then bisection), because the hit rate at
matched false alarms plateaus at high gain. Mixed observers are calibrated at s = 0.5.

**Between-person spread.** log k SD .30, criterion margin c SD 25% (δ = noise floor + c), log a
SD .15, log λ SD .40 around λ = 0.35/s for leaky observers, s ~ Beta(2, 2) for mixed observers.
The Quest pre-run's estimate of each person's 50% magnitude is off by log-SD .25.

**Breathing.** Paced breaths vary by log-SD .04 from breath to breath (true; round 1 used .06, see
below). The belt measures each period with log-SD .02 error (`--sigma-meas`). The analyst only sees
the belt values.

## Fitting and scoring

- **Fitting.** Every model is fitted to every session by maximum likelihood over the entire press
  stream, using exact density propagation on a 50-cell grid with the same discrete dynamics as the
  simulator. This needs no trial classification and handles ramps (time-varying drift) natively.
  Richer models are seeded from the optima of the models they contain (leaky from level, mixed
  from level and transient, mixed_leaky from mixed and leaky), so a richer model never fits worse
  than a model nested in it. Ter is fixed and assumed known.
- **Model comparison.** Lowest AIC per participant, and summed AIC across the group ("best overall
  model").
- **Scoring (for the yield table only).** A *hit* is a first press within a change window (+ Ter),
  counted separately for steps and ramps. A *late* press falls within 40 s after a window closes.
  A *false alarm* is any other press outside windows, per minute of settled time.

## Known limits (read before quoting numbers)

- Participants are fitted one at a time. A hierarchical fit (what the real analysis would do)
  recovers parameters better, so recovery here is conservative.
- Follow only. Watch (visual-only evidence) is not simulated yet. The observer feels only its own
  noisy breathing; in Follow the pacer is also visible and noise-free, which would help a
  breath-to-breath observer.
- Ter, σ and the reference time constant are fixed and known to the fitter. In real data they are
  free or need their own justification.
- Evidence about a breath arrives from that breath's onset. In reality a slower breath is only
  evident once its expected end has passed. This mostly shifts the absolute time scale, not the
  comparisons between designs.

## Checks done

- **2026-10-01.** Likelihood validated against the simulator. With exact measurement
  (`σ_meas = 0`), a transient observer with v = 70, δ = 10, a = 3.5 is recovered as v ≈ 65,
  δ ≈ 9.3, a ≈ 3.3, and the fitted negative log-likelihood is within 1–2 units of the truth. With
  σ_meas = .02 the same observer is recovered at about half its gain (errors-in-variables: the
  evidence is a difference of two noisy belt periods).
- **2026-10-05.** Round 1's breath noise (log-SD .06) made the transient observer uncalibratable.
  Even an ideal breath-to-breath detector then barely reaches 50% detection of a 20% step at
  0.3 FA/min, so its calibrated gain ran off to an arbitrary point on a plateau (k = 102 against
  20 in round 1, depending only on the bisection path). Round 2 uses .04 and a first-crossing
  calibration, which gives level k = 3.9 and transient k = 8.7, with a 50/50 mixed observer at
  k = 1.12 (each channel at 56% of its pure gain). Round-1 transient numbers should be read with
  this in mind.
