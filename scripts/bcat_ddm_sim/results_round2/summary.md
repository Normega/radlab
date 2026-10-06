# BCAT-DDM design-power simulation — results

Generated 2026-10-05 23:11 by `scripts/bcat_ddm_sim/run_power.py`. N = 30 simulated participants per design × generating observer; 40 min of task time per session; base breath 4 s; belt measurement error 0.02 (log period). Fitted models: level, leaky, transient, mixed, mixed_leaky.

## 1. Yield per session (mean over participants and observers)

| design | n_step | n_ramp | n_null | hit | hit_rate_step | hit_rate_ramp | late | stable_fa_per_min | median_rt_breaths |
|---|---|---|---|---|---|---|---|---|---|
| ramp | 0.00 | 39.79 | 12.93 | 27.80 |  | 0.70 | 3.49 | 0.33 | 3.25 |
| roving_ramp | 39.00 | 10.17 | 3.39 | 27.99 | 0.54 | 0.69 | 11.21 | 0.48 | 1.33 |
| roving_ramp50 | 26.17 | 20.33 | 6.54 | 27.88 | 0.54 | 0.68 | 8.83 | 0.58 | 1.85 |
| roving_mixed | 22.61 | 22.29 | 0.00 | 22.57 | 0.54 | 0.47 | 11.69 | 0.63 | 1.88 |

Ramp hit rate by observer (does the design expose the coding difference?):

| design | level | leaky | transient | mixed | mixed_leaky |
|---|---|---|---|---|---|
| ramp | 0.83 | 0.82 | 0.50 | 0.68 | 0.67 |
| roving_ramp | 0.84 | 0.82 | 0.44 | 0.68 | 0.67 |
| roving_ramp50 | 0.81 | 0.81 | 0.47 | 0.68 | 0.62 |
| roving_mixed | 0.57 | 0.57 | 0.40 | 0.42 | 0.39 |

## 2. Best overall model (summed AIC over the group)

Winner and its margin over the runner-up (ΔAIC). ✓ = the generating model wins.

| level_0 | level_1 | winner | margin | gen_minus_best |
|---|---|---|---|---|
| ramp | level | level ✓ | 42.61 | 0.00 |
| ramp | leaky | mixed | 43.01 | 308.45 |
| ramp | transient | transient ✓ | 26.36 | 0.00 |
| ramp | mixed | mixed ✓ | 42.37 | 0.00 |
| ramp | mixed_leaky | mixed | 31.55 | 31.55 |
| roving_ramp | level | level ✓ | 36.70 | 0.00 |
| roving_ramp | leaky | level | 44.51 | 47.35 |
| roving_ramp | transient | transient ✓ | 46.58 | 0.00 |
| roving_ramp | mixed | mixed ✓ | 53.18 | 0.00 |
| roving_ramp | mixed_leaky | mixed | 15.79 | 15.79 |
| roving_ramp50 | level | level ✓ | 45.30 | 0.00 |
| roving_ramp50 | leaky | level | 40.13 | 40.13 |
| roving_ramp50 | transient | transient ✓ | 42.78 | 0.00 |
| roving_ramp50 | mixed | mixed ✓ | 40.09 | 0.00 |
| roving_ramp50 | mixed_leaky | mixed | 5.44 | 5.44 |
| roving_mixed | level | level ✓ | 39.24 | 0.00 |
| roving_mixed | leaky | level | 43.19 | 43.19 |
| roving_mixed | transient | transient ✓ | 48.10 | 0.00 |
| roving_mixed | mixed | mixed ✓ | 49.55 | 0.00 |
| roving_mixed | mixed_leaky | mixed | 46.88 | 46.88 |

## 3. Per-person model choice (lowest AIC)

Share of participants whose lowest-AIC model is each fitted model; the diagonal is correct recovery.

| level_0 | level_1 | level | leaky | transient | mixed | mixed_leaky |
|---|---|---|---|---|---|---|
| ramp | level | 0.90 | 0.10 | 0.00 | 0.00 | 0.00 |
| ramp | leaky | 0.77 | 0.10 | 0.00 | 0.10 | 0.03 |
| ramp | transient | 0.07 | 0.00 | 0.73 | 0.17 | 0.03 |
| ramp | mixed | 0.20 | 0.07 | 0.07 | 0.60 | 0.07 |
| ramp | mixed_leaky | 0.10 | 0.00 | 0.03 | 0.67 | 0.20 |
| roving_ramp | level | 0.80 | 0.10 | 0.00 | 0.10 | 0.00 |
| roving_ramp | leaky | 0.90 | 0.03 | 0.00 | 0.03 | 0.03 |
| roving_ramp | transient | 0.00 | 0.00 | 0.93 | 0.07 | 0.00 |
| roving_ramp | mixed | 0.13 | 0.00 | 0.10 | 0.77 | 0.00 |
| roving_ramp | mixed_leaky | 0.10 | 0.00 | 0.00 | 0.63 | 0.27 |
| roving_ramp50 | level | 0.97 | 0.00 | 0.00 | 0.00 | 0.03 |
| roving_ramp50 | leaky | 0.90 | 0.10 | 0.00 | 0.00 | 0.00 |
| roving_ramp50 | transient | 0.03 | 0.00 | 0.83 | 0.10 | 0.03 |
| roving_ramp50 | mixed | 0.13 | 0.00 | 0.13 | 0.67 | 0.07 |
| roving_ramp50 | mixed_leaky | 0.10 | 0.00 | 0.07 | 0.57 | 0.27 |
| roving_mixed | level | 0.80 | 0.10 | 0.00 | 0.07 | 0.03 |
| roving_mixed | leaky | 0.83 | 0.07 | 0.00 | 0.10 | 0.00 |
| roving_mixed | transient | 0.03 | 0.00 | 0.87 | 0.03 | 0.07 |
| roving_mixed | mixed | 0.13 | 0.00 | 0.20 | 0.63 | 0.03 |
| roving_mixed | mixed_leaky | 0.10 | 0.00 | 0.10 | 0.70 | 0.10 |

Mean per-person recovery by design: ramp 0.51, roving_ramp 0.56, roving_ramp50 0.57, roving_mixed 0.49

## 4. Individual differences: breath-to-breath share s

r(true s, recovered s) across participants, and median |error|, using the mixed fit and the mixed_leaky fit. Pooled row adds the pure observers (s = 0 level/leaky, 1 transient).

| design | gen | r_s_mixed | mae_s_mixed | r_s_mixed_leaky | mae_s_mixed_leaky |
|---|---|---|---|---|---|
| ramp | mixed | 0.90 | 0.07 | 0.89 | 0.07 |
| ramp | mixed_leaky | 0.74 | 0.07 | 0.79 | 0.07 |
| ramp | pooled | 0.93 | 0.04 | 0.93 | 0.04 |
| roving_ramp | mixed | 0.96 | 0.05 | 0.97 | 0.05 |
| roving_ramp | mixed_leaky | 0.86 | 0.06 | 0.86 | 0.06 |
| roving_ramp | pooled | 0.97 | 0.03 | 0.96 | 0.03 |
| roving_ramp50 | mixed | 0.93 | 0.07 | 0.94 | 0.07 |
| roving_ramp50 | mixed_leaky | 0.80 | 0.06 | 0.79 | 0.08 |
| roving_ramp50 | pooled | 0.96 | 0.03 | 0.96 | 0.03 |
| roving_mixed | mixed | 0.91 | 0.05 | 0.91 | 0.05 |
| roving_mixed | mixed_leaky | 0.83 | 0.08 | 0.82 | 0.08 |
| roving_mixed | pooled | 0.96 | 0.05 | 0.96 | 0.04 |

## 5. Leak and decision parameters (fit = generating model)

r(true, fitted) for λ, criterion δ and boundary a (log scale for λ, a); `lam_floor` = share of true leaks estimated at the floor.

| design | gen | r_delta | r_a | r_lam | lam_floor |
|---|---|---|---|---|---|
| ramp | level | 0.72 | 0.78 |  |  |
| ramp | leaky | -0.20 | 0.61 | 0.13 | 0.40 |
| ramp | transient | 0.35 | 0.35 |  |  |
| ramp | mixed | 0.76 | 0.57 |  |  |
| ramp | mixed_leaky | -0.06 | 0.47 | 0.00 | 0.43 |
| roving_ramp | level | 0.63 | 0.52 |  |  |
| roving_ramp | leaky | -0.00 | 0.64 | 0.01 | 0.37 |
| roving_ramp | transient | 0.72 | 0.62 |  |  |
| roving_ramp | mixed | 0.80 | 0.72 |  |  |
| roving_ramp | mixed_leaky | 0.20 | 0.31 | -0.14 | 0.37 |
| roving_ramp50 | level | 0.66 | 0.70 |  |  |
| roving_ramp50 | leaky | 0.04 | 0.66 | 0.03 | 0.40 |
| roving_ramp50 | transient | 0.35 | 0.55 |  |  |
| roving_ramp50 | mixed | 0.72 | 0.60 |  |  |
| roving_ramp50 | mixed_leaky | -0.15 | 0.42 | -0.18 | 0.40 |
| roving_mixed | level | 0.44 | 0.45 |  |  |
| roving_mixed | leaky | -0.14 | 0.67 | 0.19 | 0.40 |
| roving_mixed | transient | 0.35 | 0.62 |  |  |
| roving_mixed | mixed | 0.69 | 0.16 |  |  |
| roving_mixed | mixed_leaky | -0.13 | 0.46 | -0.29 | 0.60 |

