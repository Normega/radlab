# BCAT-DDM design-power simulation

Answers the question in `docs/markdowns/bcat_ddm_plan.md` §6a: with ~40 minutes of task time,
which pacing design best supports modelling how breath-change evidence accumulates into detection?
Read the plan doc for the context. This file covers how to run the simulation and what it assumes.

## Pieces

| File | Role |
|---|---|
| `src/games/BcatDdm/schedule.js` | **The pacer schedules**: the same generator the task will use. Five designs: `brief`, `roving`, `trials`, `ramp`, `roving_ramp`. Tests: `node --test src/games/BcatDdm/schedule.test.mjs` |
| `make_schedules.mjs` | Batch CLI: spec JSON in, schedules JSON out (called by `run_power.py`) |
| `model.py` | Observer models, simulator, exact grid likelihood, Monte Carlo psychometrics (numba) |
| `run_power.py` | Calibrates the population, samples participants, simulates sessions, fits all models, writes `results/` |

## Run

```bash
python scripts/bcat_ddm_sim/run_power.py --n 4 --quick --designs brief,roving   # ~4 min smoke test
python scripts/bcat_ddm_sim/run_power.py --n 30                                  # full run, ~1 h on 22 cores
python scripts/bcat_ddm_sim/run_power.py --n 30 --sigma-meas 0 --out scripts/bcat_ddm_sim/results_nomeas
```

Needs Python ≥ 3.11 with numpy, scipy, pandas, numba, plus Node 22. `results/calibration.json` is
reused if present; delete it to recalibrate. Outputs: `datasets.csv` (one row per simulated
session: true parameters, yields), `fits.csv` (one row per session × fitted model) and `summary.md`.

## The observer model

A one-boundary accumulator runs through the whole stream (a CUSUM change detector):

```
dx = (v·u(t) − δ − λ·x) dt + dW,   reflect at 0,   press when x ≥ a (+ Ter = 0.35 s),   restart 1 s after the press
```

`u` is the evidence that the breathing has changed. It is constant within a breath and computed
from the log breath periods `L`:

| Model | u | λ | Meaning |
|---|---|---|---|
| `level` | \|L − R\|, R a running reference (10-breath exponential average) | 0 | perfect accumulation of deviation from what breathing has recently been |
| `leaky` | same | > 0 | deviation counts only while recent (integration time ≈ 1/λ) |
| `transient` | \|L_k − L_(k−1)\| | 0 | only breath-to-breath change counts |

After any pause (a probe or an inter-trial break), the reference re-anchors to the first breath
back.

**Calibration.** Each model's population mean is set so that a 20% step is detected 50% of the time
within 5 breaths (Study 1-like). False alarms are set to 0.3/min of steady pacing, with v
(sensitivity) and the criterion margin c (δ = v·E[u_stable] + c) solved by bisection.

**Between-person spread.** log v SD .30, c SD 25%, log a SD .15, log λ SD .40. The Quest pre-run's
estimate of each person's 50% magnitude is off by log-SD .25.

**Breathing.** Paced breaths vary by log-SD .06 from breath to breath (true). The belt measures
each period with log-SD .02 error (`--sigma-meas`). The analyst only sees the belt values.

## Fitting and scoring

- **Fitting.** All three models are fitted to every session by maximum likelihood over the entire
  press stream, using exact density propagation on a 50-cell grid with the same discrete dynamics
  as the simulator. This needs no trial classification and handles ramps (time-varying drift)
  natively. The leaky fit is seeded from the level fit, so the nested comparison is fair.
  Ter is fixed and assumed known.
- **Model recovery.** Lowest AIC per participant, and summed ΔAIC for the group.
- **Scoring (for the yield table only).** A *hit* is a first press within a change window (+ Ter).
  A *late* press falls within 40 s after a window closes. A *false alarm* is any other press
  outside windows, expressed per minute of settled time. *null_fa* and *return_press* are presses
  in null-trial windows and return-to-baseline windows.

## Known limits (read before quoting numbers)

- Participants are fitted one at a time. A hierarchical fit (what the real analysis would do)
  recovers parameters better, so recovery here is conservative.
- Follow only. Watch (visual-only evidence) is not simulated yet.
- Ter, σ and the reference time constant are fixed and known to the fitter. In real data they are
  free or need their own justification.
- Evidence about a breath arrives from that breath's onset. In reality a slower breath is only
  evident once its expected end has passed. This mostly shifts the absolute time scale, not the
  comparisons between designs.
- The three models are a deliberately small set. Mixed coding (level + transient) and reference
  adaptation rates other than 10 breaths are obvious next additions.

## Checks done (2026-10-01)

- Likelihood validated against the simulator. With exact measurement (`σ_meas = 0`), a transient
  observer with v = 70, δ = 10, a = 3.5 is recovered as v ≈ 65, δ ≈ 9.3, a ≈ 3.3, and the
  fitted negative log-likelihood is within 1–2 units of the truth.
- With σ_meas = .02, the same observer is recovered at about half its gain (v ≈ 30, a ≈ 1.7).
  This is errors-in-variables: the transient model's evidence is a difference of two noisy belt
  periods, so belt precision directly limits recovery under that model.
