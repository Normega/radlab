# BCAT-DDM design-power simulation — results

Generated 2026-10-06 12:23 by `scripts/bcat_ddm_sim/run_power.py`. N = 30 simulated participants per design × generating observer; 40 min of task time per session; base breath 4 s; belt measurement error 0.02 (log period). Fitted models: level, transient, mixed, mixed_leaky.

## 1. Yield per session (mean over participants and observers)

| design | n_step | n_ramp | n_null | n_blip_single | n_blip_pair | n_blip | hit | hit_rate_step | hit_rate_ramp | hit_rate_blip_single | hit_rate_blip_pair | late | stable_fa_per_min | median_rt_breaths |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| roving_ramp | 39.49 | 10.29 | 3.27 | 0.00 | 0.00 | 0.00 | 29.57 | 0.56 | 0.74 |  |  | 8.83 | 0.41 | 1.53 |
| double_blip | 0.00 | 0.00 | 0.00 | 8.47 | 35.10 | 0.00 | 0.00 |  |  | 0.32 | 0.51 | 6.51 | 0.45 | 2.25 |
| blip_train | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 74.71 | 0.00 |  |  |  |  | 7.62 | 0.41 | 1.67 |
| blip_combo | 0.00 | 0.00 | 0.00 | 4.09 | 17.12 | 38.60 | 0.00 |  |  | 0.35 | 0.53 | 7.12 | 0.42 | 1.90 |

Ramp hit rate by observer:

| design | mem_short | mem_medium | mem_long | mem_long_leaky |
|---|---|---|---|---|
| roving_ramp | 0.73 | 0.71 | 0.73 | 0.80 |

Single-blip hit rate by observer:

| design | mem_short | mem_medium | mem_long | mem_long_leaky |
|---|---|---|---|---|
| double_blip | 0.35 | 0.26 | 0.31 | 0.38 |
| blip_combo | 0.43 | 0.22 | 0.33 | 0.43 |

Blip-pair hit rate by observer:

| design | mem_short | mem_medium | mem_long | mem_long_leaky |
|---|---|---|---|---|
| double_blip | 0.51 | 0.45 | 0.52 | 0.58 |
| blip_combo | 0.51 | 0.46 | 0.59 | 0.57 |

Blip-pair hit rate by gap (normal breaths between the blips) and blip size, by observer. The double-blip signature: does detection fall with the gap, and differently by size?

| design | gen | size | gap0 | gap1 | gap2 | gap4 | gap8 |
|---|---|---|---|---|---|---|---|
| blip_combo | mem_long | small | 0.26 | 0.38 | 0.56 | 0.43 | 0.60 |
| blip_combo | mem_long | large | 0.59 | 0.73 | 0.75 | 0.72 | 0.84 |
| blip_combo | mem_long_leaky | small | 0.29 | 0.39 | 0.60 | 0.47 | 0.57 |
| blip_combo | mem_long_leaky | large | 0.48 | 0.71 | 0.62 | 0.68 | 0.78 |
| blip_combo | mem_medium | small | 0.28 | 0.28 | 0.27 | 0.46 | 0.48 |
| blip_combo | mem_medium | large | 0.59 | 0.56 | 0.54 | 0.67 | 0.49 |
| blip_combo | mem_short | small | 0.35 | 0.36 | 0.36 | 0.43 | 0.47 |
| blip_combo | mem_short | large | 0.57 | 0.69 | 0.54 | 0.54 | 0.70 |
| double_blip | mem_long | small | 0.23 | 0.39 | 0.46 | 0.48 | 0.59 |
| double_blip | mem_long | large | 0.41 | 0.62 | 0.69 | 0.68 | 0.67 |
| double_blip | mem_long_leaky | small | 0.33 | 0.45 | 0.47 | 0.51 | 0.54 |
| double_blip | mem_long_leaky | large | 0.49 | 0.69 | 0.83 | 0.74 | 0.69 |
| double_blip | mem_medium | small | 0.23 | 0.34 | 0.34 | 0.32 | 0.44 |
| double_blip | mem_medium | large | 0.43 | 0.57 | 0.57 | 0.60 | 0.60 |
| double_blip | mem_short | small | 0.28 | 0.38 | 0.39 | 0.53 | 0.56 |
| double_blip | mem_short | large | 0.49 | 0.59 | 0.60 | 0.60 | 0.69 |

## 2. Best overall model (summed AIC over the group)

Winner and its margin over the runner-up (ΔAIC). ✓ = the generating model wins.

| level_0 | level_1 | winner | margin | gen_minus_best |
|---|---|---|---|---|
| roving_ramp | mem_short | mixed ✓ | 38.18 | 0.00 |
| roving_ramp | mem_medium | mixed ✓ | 41.06 | 0.00 |
| roving_ramp | mem_long | mixed ✓ | 32.75 | 0.00 |
| roving_ramp | mem_long_leaky | mixed_leaky ✓ | 28.71 | 0.00 |
| double_blip | mem_short | mixed ✓ | 39.22 | 0.00 |
| double_blip | mem_medium | mixed ✓ | 38.87 | 0.00 |
| double_blip | mem_long | mixed ✓ | 43.23 | 0.00 |
| double_blip | mem_long_leaky | mixed | 8.15 | 8.15 |
| blip_train | mem_short | mixed ✓ | 51.87 | 0.00 |
| blip_train | mem_medium | mixed ✓ | 53.10 | 0.00 |
| blip_train | mem_long | mixed ✓ | 29.89 | 0.00 |
| blip_train | mem_long_leaky | mixed | 6.22 | 6.22 |
| blip_combo | mem_short | mixed ✓ | 41.43 | 0.00 |
| blip_combo | mem_medium | mixed ✓ | 32.12 | 0.00 |
| blip_combo | mem_long | mixed ✓ | 44.76 | 0.00 |
| blip_combo | mem_long_leaky | mixed | 16.86 | 16.86 |

## 3. Per-person model choice (lowest AIC)

Share of participants whose lowest-AIC model is each fitted model; the diagonal is correct recovery.

| level_0 | level_1 | level | transient | mixed | mixed_leaky |
|---|---|---|---|---|---|
| roving_ramp | mem_short | 0.03 | 0.07 | 0.73 | 0.17 |
| roving_ramp | mem_medium | 0.10 | 0.03 | 0.77 | 0.10 |
| roving_ramp | mem_long | 0.07 | 0.13 | 0.67 | 0.13 |
| roving_ramp | mem_long_leaky | 0.07 | 0.00 | 0.53 | 0.40 |
| double_blip | mem_short | 0.10 | 0.53 | 0.30 | 0.07 |
| double_blip | mem_medium | 0.37 | 0.30 | 0.30 | 0.03 |
| double_blip | mem_long | 0.27 | 0.43 | 0.27 | 0.03 |
| double_blip | mem_long_leaky | 0.23 | 0.37 | 0.23 | 0.17 |
| blip_train | mem_short | 0.13 | 0.33 | 0.53 | 0.00 |
| blip_train | mem_medium | 0.27 | 0.33 | 0.37 | 0.03 |
| blip_train | mem_long | 0.20 | 0.53 | 0.17 | 0.10 |
| blip_train | mem_long_leaky | 0.20 | 0.40 | 0.23 | 0.17 |
| blip_combo | mem_short | 0.07 | 0.43 | 0.40 | 0.10 |
| blip_combo | mem_medium | 0.20 | 0.33 | 0.33 | 0.13 |
| blip_combo | mem_long | 0.17 | 0.60 | 0.20 | 0.03 |
| blip_combo | mem_long_leaky | 0.17 | 0.50 | 0.20 | 0.13 |

Mean per-person recovery by design: roving_ramp 0.64, double_blip 0.26, blip_train 0.31, blip_combo 0.27

## 4. Individual differences: breath-to-breath share s

r(true s, recovered s) across participants, and median |error|, using the mixed fit and the mixed_leaky fit. Pooled row adds the pure observers (s = 0 level/leaky, 1 transient).

| design | gen | r_s_mixed | mae_s_mixed | r_s_mixed_leaky | mae_s_mixed_leaky |
|---|---|---|---|---|---|
| roving_ramp | mem_short | 0.84 | 0.05 | 0.85 | 0.06 |
| roving_ramp | mem_medium | 0.82 | 0.08 | 0.82 | 0.08 |
| roving_ramp | mem_long | 0.81 | 0.08 | 0.83 | 0.10 |
| roving_ramp | mem_long_leaky | 0.93 | 0.04 | 0.93 | 0.06 |
| roving_ramp | pooled | 0.87 | 0.07 | 0.87 | 0.07 |
| double_blip | mem_short | 0.71 | 0.13 | 0.70 | 0.12 |
| double_blip | mem_medium | 0.40 | 0.26 | 0.44 | 0.25 |
| double_blip | mem_long | 0.57 | 0.21 | 0.48 | 0.27 |
| double_blip | mem_long_leaky | 0.63 | 0.22 | 0.65 | 0.18 |
| double_blip | pooled | 0.58 | 0.21 | 0.58 | 0.20 |
| blip_train | mem_short | 0.57 | 0.23 | 0.56 | 0.24 |
| blip_train | mem_medium | 0.26 | 0.22 | 0.27 | 0.22 |
| blip_train | mem_long | 0.62 | 0.26 | 0.66 | 0.23 |
| blip_train | mem_long_leaky | 0.69 | 0.17 | 0.72 | 0.17 |
| blip_train | pooled | 0.56 | 0.22 | 0.58 | 0.21 |
| blip_combo | mem_short | 0.67 | 0.20 | 0.68 | 0.18 |
| blip_combo | mem_medium | 0.41 | 0.18 | 0.42 | 0.18 |
| blip_combo | mem_long | 0.60 | 0.23 | 0.58 | 0.21 |
| blip_combo | mem_long_leaky | 0.45 | 0.20 | 0.48 | 0.18 |
| blip_combo | pooled | 0.57 | 0.20 | 0.56 | 0.18 |

## 5. Leak and decision parameters (fit = generating model)

r(true, fitted) for λ, criterion δ and boundary a (log scale for λ, a); `lam_floor` = share of true leaks estimated at the floor.

| design | gen | r_delta | r_a | r_lam | lam_floor |
|---|---|---|---|---|---|
| roving_ramp | mem_short | 0.65 | 0.65 |  |  |
| roving_ramp | mem_medium | 0.58 | 0.73 |  |  |
| roving_ramp | mem_long | 0.46 | 0.70 |  |  |
| roving_ramp | mem_long_leaky | 0.45 | 0.63 | 0.37 | 0.20 |
| double_blip | mem_short | 0.53 | 0.67 |  |  |
| double_blip | mem_medium | 0.55 | 0.23 |  |  |
| double_blip | mem_long | 0.46 | 0.46 |  |  |
| double_blip | mem_long_leaky | -0.01 | 0.52 | 0.10 | 0.20 |
| blip_train | mem_short | 0.05 | 0.26 |  |  |
| blip_train | mem_medium | 0.28 | 0.61 |  |  |
| blip_train | mem_long | 0.18 | 0.43 |  |  |
| blip_train | mem_long_leaky | 0.48 | 0.60 | 0.41 | 0.27 |
| blip_combo | mem_short | 0.53 | 0.71 |  |  |
| blip_combo | mem_medium | 0.20 | 0.27 |  |  |
| blip_combo | mem_long | 0.40 | 0.53 |  |  |
| blip_combo | mem_long_leaky | 0.17 | 0.25 | 0.15 | 0.40 |

## 6. Memory span: how long accumulated evidence lasts

Evidence half-life in seconds: ln 2 / λ with a leak, a / 2c (criterion drain) without.  r = correlation of log true vs log recovered span, using the fit that matches the generator and the leaky fit; `median_true` / `median_hat` in seconds.

| design | gen | median_true | r_mixed | median_hat_mixed | r_mixed_leaky | median_hat_mixed_leaky |
|---|---|---|---|---|---|---|
| roving_ramp | mem_short | 1.40 | 0.36 | 1.30 | 0.16 | 7.12 |
| roving_ramp | mem_medium | 8.76 | 0.56 | 10.53 | -0.08 | 30.71 |
| roving_ramp | mem_long | 76.80 | 0.57 | 41.27 | -0.01 | 29.67 |
| roving_ramp | mem_long_leaky | 18.80 | 0.33 | 25.21 | 0.37 | 9.59 |
| double_blip | mem_short | 1.40 | 0.41 | 1.55 | 0.33 | 1.57 |
| double_blip | mem_medium | 8.76 | 0.20 | 8.91 | -0.16 | 19.98 |
| double_blip | mem_long | 76.80 | 0.31 | 34.13 | 0.11 | 53.46 |
| double_blip | mem_long_leaky | 18.80 | 0.52 | 28.42 | 0.10 | 10.57 |
| blip_train | mem_short | 1.40 | -0.03 | 1.53 | -0.13 | 115.52 |
| blip_train | mem_medium | 8.76 | 0.33 | 7.86 | 0.31 | 138.63 |
| blip_train | mem_long | 76.80 | -0.30 | 46.57 | 0.24 | 13.53 |
| blip_train | mem_long_leaky | 18.80 | 0.35 | 34.58 | 0.41 | 10.40 |
| blip_combo | mem_short | 1.40 | 0.56 | 1.53 | 0.03 | 19.34 |
| blip_combo | mem_medium | 8.76 | 0.33 | 6.73 | 0.26 | 8.83 |
| blip_combo | mem_long | 76.80 | 0.06 | 40.34 | -0.13 | 138.63 |
| blip_combo | mem_long_leaky | 18.80 | 0.53 | 40.43 | 0.15 | 8.10 |

## 7. Blip-train kernel (press-triggered blip history)

P(train blip at each lag before a press) ÷ base blip rate, pooled over participants. Lag 0 = the breath the crossing fell in. A kernel that stays above 1 for many lags means evidence is held a long time.

| design | gen | presses | lag0 | lag2 | lag4 | lag6 | lag8 | lag10 | lag12 |
|---|---|---|---|---|---|---|---|---|---|
| blip_combo | mem_long | 458 | 1.85 | 1.75 | 1.18 | 1.06 | 1.13 | 1.11 | 0.89 |
| blip_combo | mem_long_leaky | 527 | 2.21 | 1.47 | 1.07 | 1.09 | 1.10 | 0.96 | 1.04 |
| blip_combo | mem_medium | 430 | 2.31 | 1.41 | 0.82 | 1.15 | 1.20 | 1.13 | 0.99 |
| blip_combo | mem_short | 527 | 2.52 | 1.27 | 1.38 | 1.11 | 1.39 | 1.02 | 0.85 |
| blip_train | mem_long | 906 | 1.77 | 1.41 | 1.02 | 1.01 | 1.21 | 1.11 | 1.15 |
| blip_train | mem_long_leaky | 1010 | 2.31 | 1.26 | 1.08 | 1.02 | 0.98 | 1.19 | 1.01 |
| blip_train | mem_medium | 756 | 2.11 | 1.41 | 0.96 | 1.21 | 1.30 | 1.14 | 1.00 |
| blip_train | mem_short | 990 | 2.61 | 1.08 | 1.17 | 1.12 | 1.00 | 1.18 | 1.06 |

## 8. Degenerate fits

Share of fits (all models) that collapsed to the bounds (a = 15 or δ = 30: presses treated as random). Correlations in this summary are Spearman rank correlations so these do not dominate.

| design | degenerate |
|---|---|
| roving_ramp | 0.10 |
| double_blip | 0.14 |
| blip_train | 0.13 |
| blip_combo | 0.11 |

