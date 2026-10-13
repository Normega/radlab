# BCAT-DDM design-power simulation — results (round 5a: interleaving with big ramps; 40% ramp share)

> The `roving_ramp` rows are round 3's results, included as the reference. Same simulated participants and seeds, so the comparison is person for person.

Generated 2026-10-12 22:40 by `scripts/bcat_ddm_sim/run_power.py`. N = 30 simulated participants per design × generating observer; 40 min of task time per session; base breath 4 s; belt measurement error 0.02 (log period). Fitted models: level, transient, mixed, mixed_leaky.

## 1. Yield per session (mean over participants and observers)

| design | n_step | n_ramp | n_null | hit | hit_rate_step | hit_rate_ramp | n_bump_single | n_bump_pair | n_bump | late | stable_fa_per_min | median_rt_breaths |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| roving_ramp | 39.49 | 10.29 | 3.27 | 29.57 | 0.56 | 0.74 |  |  |  | 8.83 | 0.41 | 1.53 |
| roving_mixed_big | 23.01 | 21.75 | 0.00 | 27.91 | 0.54 | 0.71 | 0.00 | 0.00 | 0.00 | 11.40 | 0.50 | 2.29 |
| roving_ramp40 | 31.57 | 16.14 | 5.23 | 29.46 | 0.56 | 0.73 | 0.00 | 0.00 | 0.00 | 7.17 | 0.41 | 1.94 |

Ramp hit rate by observer:

| design | mem_short | mem_medium | mem_long | mem_long_leaky |
|---|---|---|---|---|
| roving_ramp | 0.73 | 0.71 | 0.73 | 0.80 |
| roving_mixed_big | 0.66 | 0.71 | 0.71 | 0.76 |
| roving_ramp40 | 0.69 | 0.74 | 0.68 | 0.80 |

## 2. Best overall model (summed AIC over the group)

Winner and its margin over the runner-up (ΔAIC). ✓ = the generating model wins.

| level_0 | level_1 | winner | margin | gen_minus_best |
|---|---|---|---|---|
| roving_ramp | mem_short | mixed ✓ | 38.18 | 0.00 |
| roving_ramp | mem_medium | mixed ✓ | 41.06 | 0.00 |
| roving_ramp | mem_long | mixed ✓ | 32.75 | 0.00 |
| roving_ramp | mem_long_leaky | mixed_leaky ✓ | 28.71 | 0.00 |
| roving_mixed_big | mem_short | mixed ✓ | 45.40 | 0.00 |
| roving_mixed_big | mem_medium | mixed ✓ | 45.59 | 0.00 |
| roving_mixed_big | mem_long | mixed ✓ | 27.52 | 0.00 |
| roving_mixed_big | mem_long_leaky | mixed | 11.98 | 11.98 |
| roving_ramp40 | mem_short | mixed ✓ | 49.87 | 0.00 |
| roving_ramp40 | mem_medium | mixed ✓ | 38.69 | 0.00 |
| roving_ramp40 | mem_long | mixed ✓ | 41.44 | 0.00 |
| roving_ramp40 | mem_long_leaky | mixed_leaky ✓ | 11.27 | 0.00 |

## 3. Per-person model choice (lowest AIC)

Share of participants whose lowest-AIC model is each fitted model; the diagonal is correct recovery.

| level_0 | level_1 | level | transient | mixed | mixed_leaky |
|---|---|---|---|---|---|
| roving_ramp | mem_short | 0.03 | 0.07 | 0.73 | 0.17 |
| roving_ramp | mem_medium | 0.10 | 0.03 | 0.77 | 0.10 |
| roving_ramp | mem_long | 0.07 | 0.13 | 0.67 | 0.13 |
| roving_ramp | mem_long_leaky | 0.07 | 0.00 | 0.53 | 0.40 |
| roving_mixed_big | mem_short | 0.07 | 0.07 | 0.80 | 0.07 |
| roving_mixed_big | mem_medium | 0.13 | 0.03 | 0.80 | 0.03 |
| roving_mixed_big | mem_long | 0.03 | 0.03 | 0.80 | 0.13 |
| roving_mixed_big | mem_long_leaky | 0.07 | 0.03 | 0.60 | 0.30 |
| roving_ramp40 | mem_short | 0.10 | 0.13 | 0.70 | 0.07 |
| roving_ramp40 | mem_medium | 0.07 | 0.03 | 0.73 | 0.17 |
| roving_ramp40 | mem_long | 0.10 | 0.07 | 0.73 | 0.10 |
| roving_ramp40 | mem_long_leaky | 0.03 | 0.00 | 0.60 | 0.37 |

Mean per-person recovery by design: roving_ramp 0.64, roving_mixed_big 0.68, roving_ramp40 0.63

## 4. Individual differences: breath-to-breath share s

r(true s, recovered s) across participants, and median |error|, using the mixed fit and the mixed_leaky fit. Pooled row adds the pure observers (s = 0 level/leaky, 1 transient).

| design | gen | r_s_mixed | mae_s_mixed | r_s_mixed_leaky | mae_s_mixed_leaky |
|---|---|---|---|---|---|
| roving_ramp | mem_short | 0.84 | 0.05 | 0.85 | 0.06 |
| roving_ramp | mem_medium | 0.82 | 0.08 | 0.82 | 0.08 |
| roving_ramp | mem_long | 0.81 | 0.08 | 0.83 | 0.10 |
| roving_ramp | mem_long_leaky | 0.93 | 0.04 | 0.93 | 0.06 |
| roving_ramp | pooled | 0.87 | 0.07 | 0.87 | 0.07 |
| roving_mixed_big | mem_short | 0.86 | 0.08 | 0.86 | 0.08 |
| roving_mixed_big | mem_medium | 0.91 | 0.05 | 0.92 | 0.06 |
| roving_mixed_big | mem_long | 0.91 | 0.08 | 0.87 | 0.11 |
| roving_mixed_big | mem_long_leaky | 0.96 | 0.05 | 0.94 | 0.06 |
| roving_mixed_big | pooled | 0.92 | 0.07 | 0.91 | 0.08 |
| roving_ramp40 | mem_short | 0.83 | 0.08 | 0.83 | 0.08 |
| roving_ramp40 | mem_medium | 0.87 | 0.04 | 0.86 | 0.05 |
| roving_ramp40 | mem_long | 0.84 | 0.05 | 0.85 | 0.09 |
| roving_ramp40 | mem_long_leaky | 0.92 | 0.07 | 0.90 | 0.07 |
| roving_ramp40 | pooled | 0.87 | 0.06 | 0.86 | 0.07 |

## 5. Leak and decision parameters (fit = generating model)

r(true, fitted) for λ, criterion δ and boundary a (log scale for λ, a); `lam_floor` = share of true leaks estimated at the floor.

| design | gen | r_delta | r_a | r_lam | lam_floor |
|---|---|---|---|---|---|
| roving_ramp | mem_short | 0.65 | 0.65 |  |  |
| roving_ramp | mem_medium | 0.58 | 0.73 |  |  |
| roving_ramp | mem_long | 0.46 | 0.70 |  |  |
| roving_ramp | mem_long_leaky | 0.45 | 0.63 | 0.37 | 0.20 |
| roving_mixed_big | mem_short | 0.44 | 0.73 |  |  |
| roving_mixed_big | mem_medium | 0.62 | 0.74 |  |  |
| roving_mixed_big | mem_long | 0.79 | 0.87 |  |  |
| roving_mixed_big | mem_long_leaky | 0.72 | 0.70 | 0.57 | 0.43 |
| roving_ramp40 | mem_short | 0.64 | 0.62 |  |  |
| roving_ramp40 | mem_medium | 0.63 | 0.78 |  |  |
| roving_ramp40 | mem_long | 0.37 | 0.75 |  |  |
| roving_ramp40 | mem_long_leaky | 0.61 | 0.67 | 0.58 | 0.27 |

## 6. Memory span: how long accumulated evidence lasts

Evidence half-life in seconds: ln 2 / λ with a leak, a / 2c (criterion drain) without.  r = correlation of log true vs log recovered span, using the fit that matches the generator and the leaky fit; `median_true` / `median_hat` in seconds.

| design | gen | median_true | r_mixed | median_hat_mixed | r_mixed_leaky | median_hat_mixed_leaky |
|---|---|---|---|---|---|---|
| roving_ramp | mem_short | 1.40 | 0.36 | 1.30 | 0.16 | 7.12 |
| roving_ramp | mem_medium | 8.76 | 0.56 | 10.53 | -0.08 | 30.71 |
| roving_ramp | mem_long | 76.80 | 0.57 | 41.27 | -0.01 | 29.67 |
| roving_ramp | mem_long_leaky | 18.80 | 0.33 | 25.21 | 0.37 | 9.59 |
| roving_mixed_big | mem_short | 1.40 | 0.47 | 1.41 | 0.15 | 115.53 |
| roving_mixed_big | mem_medium | 8.76 | 0.55 | 9.37 | 0.04 | 14.27 |
| roving_mixed_big | mem_long | 76.80 | 0.33 | 47.91 | 0.14 | 38.44 |
| roving_mixed_big | mem_long_leaky | 18.80 | 0.51 | 33.28 | 0.57 | 22.45 |
| roving_ramp40 | mem_short | 1.40 | 0.49 | 1.25 | 0.03 | 138.63 |
| roving_ramp40 | mem_medium | 8.76 | 0.59 | 9.55 | 0.04 | 32.37 |
| roving_ramp40 | mem_long | 76.80 | 0.08 | 49.90 | -0.07 | 127.10 |
| roving_ramp40 | mem_long_leaky | 18.80 | 0.44 | 29.43 | 0.58 | 12.64 |

## 8. Degenerate fits

Share of fits (all models) that collapsed to the bounds (a = 15 or δ = 30: presses treated as random). Correlations in this summary are Spearman rank correlations so these do not dominate.

| design | degenerate |
|---|---|
| roving_ramp | 0.10 |
| roving_mixed_big | 0.07 |
| roving_ramp40 | 0.08 |

