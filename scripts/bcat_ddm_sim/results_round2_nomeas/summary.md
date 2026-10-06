# BCAT-DDM design-power simulation — results

Generated 2026-10-06 00:33 by `scripts/bcat_ddm_sim/run_power.py`. N = 30 simulated participants per design × generating observer; 40 min of task time per session; base breath 4 s; belt measurement error 0.0 (log period). Fitted models: level, leaky, transient, mixed, mixed_leaky.

## 1. Yield per session (mean over participants and observers)

| design | n_step | n_ramp | n_null | hit | hit_rate_step | hit_rate_ramp | late | stable_fa_per_min | median_rt_breaths |
|---|---|---|---|---|---|---|---|---|---|
| roving_ramp | 39.00 | 10.17 | 3.39 | 27.99 | 0.54 | 0.69 | 11.21 | 0.48 | 1.33 |
| roving_ramp50 | 26.17 | 20.33 | 6.54 | 27.88 | 0.54 | 0.68 | 8.83 | 0.58 | 1.85 |

Ramp hit rate by observer (does the design expose the coding difference?):

| design | level | leaky | transient | mixed | mixed_leaky |
|---|---|---|---|---|---|
| roving_ramp | 0.84 | 0.82 | 0.44 | 0.68 | 0.67 |
| roving_ramp50 | 0.81 | 0.81 | 0.47 | 0.68 | 0.62 |

## 2. Best overall model (summed AIC over the group)

Winner and its margin over the runner-up (ΔAIC). ✓ = the generating model wins.

| level_0 | level_1 | winner | margin | gen_minus_best |
|---|---|---|---|---|
| roving_ramp | level | level ✓ | 34.35 | 0.00 |
| roving_ramp | leaky | level | 42.68 | 42.68 |
| roving_ramp | transient | transient ✓ | 53.45 | 0.00 |
| roving_ramp | mixed | mixed ✓ | 52.99 | 0.00 |
| roving_ramp | mixed_leaky | mixed | 12.45 | 12.45 |
| roving_ramp50 | level | level ✓ | 44.73 | 0.00 |
| roving_ramp50 | leaky | level | 40.14 | 40.14 |
| roving_ramp50 | transient | transient ✓ | 51.27 | 0.00 |
| roving_ramp50 | mixed | mixed ✓ | 36.15 | 0.00 |
| roving_ramp50 | mixed_leaky | mixed_leaky ✓ | 2.62 | 0.00 |

## 3. Per-person model choice (lowest AIC)

Share of participants whose lowest-AIC model is each fitted model; the diagonal is correct recovery.

| level_0 | level_1 | level | leaky | transient | mixed | mixed_leaky |
|---|---|---|---|---|---|---|
| roving_ramp | level | 0.80 | 0.03 | 0.00 | 0.17 | 0.00 |
| roving_ramp | leaky | 0.87 | 0.07 | 0.00 | 0.07 | 0.00 |
| roving_ramp | transient | 0.00 | 0.00 | 0.93 | 0.07 | 0.00 |
| roving_ramp | mixed | 0.13 | 0.00 | 0.20 | 0.67 | 0.00 |
| roving_ramp | mixed_leaky | 0.07 | 0.00 | 0.00 | 0.67 | 0.27 |
| roving_ramp50 | level | 0.90 | 0.03 | 0.00 | 0.03 | 0.03 |
| roving_ramp50 | leaky | 0.80 | 0.13 | 0.00 | 0.07 | 0.00 |
| roving_ramp50 | transient | 0.03 | 0.00 | 0.93 | 0.03 | 0.00 |
| roving_ramp50 | mixed | 0.10 | 0.03 | 0.10 | 0.67 | 0.10 |
| roving_ramp50 | mixed_leaky | 0.10 | 0.00 | 0.13 | 0.53 | 0.23 |

Mean per-person recovery by design: roving_ramp 0.55, roving_ramp50 0.57

## 4. Individual differences: breath-to-breath share s

r(true s, recovered s) across participants, and median |error|, using the mixed fit and the mixed_leaky fit. Pooled row adds the pure observers (s = 0 level/leaky, 1 transient).

| design | gen | r_s_mixed | mae_s_mixed | r_s_mixed_leaky | mae_s_mixed_leaky |
|---|---|---|---|---|---|
| roving_ramp | mixed | 0.97 | 0.04 | 0.97 | 0.04 |
| roving_ramp | mixed_leaky | 0.82 | 0.06 | 0.86 | 0.06 |
| roving_ramp | pooled | 0.97 | 0.03 | 0.97 | 0.03 |
| roving_ramp50 | mixed | 0.94 | 0.07 | 0.94 | 0.06 |
| roving_ramp50 | mixed_leaky | 0.71 | 0.08 | 0.79 | 0.09 |
| roving_ramp50 | pooled | 0.96 | 0.04 | 0.96 | 0.03 |

## 5. Leak and decision parameters (fit = generating model)

r(true, fitted) for λ, criterion δ and boundary a (log scale for λ, a); `lam_floor` = share of true leaks estimated at the floor.

| design | gen | r_delta | r_a | r_lam | lam_floor |
|---|---|---|---|---|---|
| roving_ramp | level | 0.65 | 0.57 |  |  |
| roving_ramp | leaky | -0.03 | 0.63 | 0.08 | 0.37 |
| roving_ramp | transient | 0.74 | 0.67 |  |  |
| roving_ramp | mixed | 0.81 | 0.71 |  |  |
| roving_ramp | mixed_leaky | -0.02 | 0.35 | -0.14 | 0.30 |
| roving_ramp50 | level | 0.70 | 0.73 |  |  |
| roving_ramp50 | leaky | 0.02 | 0.65 | 0.10 | 0.33 |
| roving_ramp50 | transient | 0.35 | 0.55 |  |  |
| roving_ramp50 | mixed | 0.76 | 0.64 |  |  |
| roving_ramp50 | mixed_leaky | -0.15 | 0.41 | -0.17 | 0.40 |

