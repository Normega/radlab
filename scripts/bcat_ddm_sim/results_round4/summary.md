# BCAT-DDM design-power simulation — results (round 4: smooth bumps)

> The `roving_ramp` rows are round 3's results, included as the reference. Same simulated participants, same seeds (verified identical), so the comparison is person for person.

Generated 2026-10-06 14:21 by `scripts/bcat_ddm_sim/run_power.py`. N = 30 simulated participants per design × generating observer; 40 min of task time per session; base breath 4 s; belt measurement error 0.02 (log period). Fitted models: level, transient, mixed, mixed_leaky.

## 1. Yield per session (mean over participants and observers)

| design | n_step | n_ramp | n_null | hit | hit_rate_step | hit_rate_ramp | n_bump_single | n_bump_pair | n_bump | hit_rate_bump_single | hit_rate_bump_pair | late | stable_fa_per_min | median_rt_breaths |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| roving_ramp | 39.49 | 10.29 | 3.27 | 29.57 | 0.56 | 0.74 |  |  |  |  |  | 8.83 | 0.41 | 1.53 |
| double_bump | 0.00 | 0.00 | 0.00 | 0.00 |  |  | 6.17 | 25.49 | 0.00 | 0.39 | 0.58 | 4.92 | 0.37 | 3.99 |
| bump_train | 0.00 | 0.00 | 0.00 | 0.00 |  |  | 0.00 | 0.00 | 42.22 |  |  | 6.19 | 0.43 | 2.79 |
| roving_bump | 38.97 | 0.00 | 0.00 | 22.48 | 0.58 |  | 1.66 | 6.20 | 0.00 | 0.35 | 0.60 | 9.31 | 0.51 | 1.22 |
| roving_ramp_bump | 31.34 | 8.59 | 2.78 | 24.10 | 0.57 | 0.74 | 1.47 | 4.88 | 0.00 | 0.35 | 0.58 | 8.28 | 0.40 | 1.69 |

Ramp hit rate by observer:

| design | mem_short | mem_medium | mem_long | mem_long_leaky |
|---|---|---|---|---|
| roving_ramp | 0.73 | 0.71 | 0.73 | 0.80 |
| roving_ramp_bump | 0.71 | 0.76 | 0.69 | 0.81 |

Single-bump hit rate by observer:

| design | mem_short | mem_medium | mem_long | mem_long_leaky |
|---|---|---|---|---|
| double_bump | 0.37 | 0.36 | 0.39 | 0.44 |
| roving_bump | 0.37 | 0.35 | 0.24 | 0.44 |
| roving_ramp_bump | 0.36 | 0.34 | 0.28 | 0.39 |

Bump-pair hit rate by observer:

| design | mem_short | mem_medium | mem_long | mem_long_leaky |
|---|---|---|---|---|
| double_bump | 0.53 | 0.52 | 0.63 | 0.63 |
| roving_bump | 0.53 | 0.55 | 0.68 | 0.66 |
| roving_ramp_bump | 0.56 | 0.51 | 0.60 | 0.64 |

Pair hit rate (blip or bump pairs) by gap (normal breaths between the two) and size, by observer. The double-blip signature: does detection fall with the gap, and differently by size?

| design | gen | size | gap0 | gap2 | gap4 | gap8 |
|---|---|---|---|---|---|---|
| double_bump | mem_long | small | 0.38 | 0.46 | 0.59 | 0.61 |
| double_bump | mem_long | large | 0.74 | 0.71 | 0.83 | 0.72 |
| double_bump | mem_long_leaky | small | 0.51 | 0.46 | 0.53 | 0.59 |
| double_bump | mem_long_leaky | large | 0.73 | 0.74 | 0.76 | 0.71 |
| double_bump | mem_medium | small | 0.33 | 0.44 | 0.45 | 0.45 |
| double_bump | mem_medium | large | 0.59 | 0.65 | 0.53 | 0.77 |
| double_bump | mem_short | small | 0.41 | 0.48 | 0.44 | 0.55 |
| double_bump | mem_short | large | 0.50 | 0.59 | 0.63 | 0.64 |
| roving_bump | mem_long | small | 0.38 | 0.64 | 0.65 | 0.58 |
| roving_bump | mem_long | large | 0.80 | 0.74 | 0.76 | 0.83 |
| roving_bump | mem_long_leaky | small | 0.67 | 0.39 | 0.60 | 0.46 |
| roving_bump | mem_long_leaky | large | 0.79 | 0.89 | 0.73 | 0.84 |
| roving_bump | mem_medium | small | 0.50 | 0.24 | 0.25 | 0.52 |
| roving_bump | mem_medium | large | 0.65 | 0.69 | 0.72 | 0.80 |
| roving_bump | mem_short | small | 0.43 | 0.29 | 0.56 | 0.41 |
| roving_bump | mem_short | large | 0.47 | 0.64 | 0.50 | 0.91 |
| roving_ramp_bump | mem_long | small | 0.53 | 0.44 | 0.61 | 0.53 |
| roving_ramp_bump | mem_long | large | 0.75 | 0.50 | 0.72 | 0.68 |
| roving_ramp_bump | mem_long_leaky | small | 0.58 | 0.50 | 0.48 | 0.62 |
| roving_ramp_bump | mem_long_leaky | large | 0.73 | 0.44 | 0.88 | 0.94 |
| roving_ramp_bump | mem_medium | small | 0.40 | 0.39 | 0.25 | 0.43 |
| roving_ramp_bump | mem_medium | large | 0.50 | 0.62 | 0.79 | 0.87 |
| roving_ramp_bump | mem_short | small | 0.27 | 0.31 | 0.55 | 0.58 |
| roving_ramp_bump | mem_short | large | 0.38 | 0.72 | 0.71 | 0.77 |

## 2. Best overall model (summed AIC over the group)

Winner and its margin over the runner-up (ΔAIC). ✓ = the generating model wins.

| level_0 | level_1 | winner | margin | gen_minus_best |
|---|---|---|---|---|
| roving_ramp | mem_short | mixed ✓ | 38.18 | 0.00 |
| roving_ramp | mem_medium | mixed ✓ | 41.06 | 0.00 |
| roving_ramp | mem_long | mixed ✓ | 32.75 | 0.00 |
| roving_ramp | mem_long_leaky | mixed_leaky ✓ | 28.71 | 0.00 |
| double_bump | mem_short | mixed ✓ | 51.97 | 0.00 |
| double_bump | mem_medium | mixed ✓ | 38.66 | 0.00 |
| double_bump | mem_long | mixed ✓ | 31.63 | 0.00 |
| double_bump | mem_long_leaky | mixed | 11.50 | 11.50 |
| bump_train | mem_short | mixed ✓ | 42.30 | 0.00 |
| bump_train | mem_medium | mixed ✓ | 54.77 | 0.00 |
| bump_train | mem_long | mixed ✓ | 32.03 | 0.00 |
| bump_train | mem_long_leaky | mixed | 13.21 | 13.21 |
| roving_bump | mem_short | mixed ✓ | 38.17 | 0.00 |
| roving_bump | mem_medium | mixed ✓ | 36.27 | 0.00 |
| roving_bump | mem_long | mixed ✓ | 32.18 | 0.00 |
| roving_bump | mem_long_leaky | mixed_leaky ✓ | 6.07 | 0.00 |
| roving_ramp_bump | mem_short | mixed ✓ | 37.97 | 0.00 |
| roving_ramp_bump | mem_medium | mixed ✓ | 30.90 | 0.00 |
| roving_ramp_bump | mem_long | mixed ✓ | 31.26 | 0.00 |
| roving_ramp_bump | mem_long_leaky | mixed_leaky ✓ | 29.96 | 0.00 |

## 3. Per-person model choice (lowest AIC)

Share of participants whose lowest-AIC model is each fitted model; the diagonal is correct recovery.

| level_0 | level_1 | level | transient | mixed | mixed_leaky |
|---|---|---|---|---|---|
| roving_ramp | mem_short | 0.03 | 0.07 | 0.73 | 0.17 |
| roving_ramp | mem_medium | 0.10 | 0.03 | 0.77 | 0.10 |
| roving_ramp | mem_long | 0.07 | 0.13 | 0.67 | 0.13 |
| roving_ramp | mem_long_leaky | 0.07 | 0.00 | 0.53 | 0.40 |
| double_bump | mem_short | 0.20 | 0.40 | 0.40 | 0.00 |
| double_bump | mem_medium | 0.27 | 0.27 | 0.37 | 0.10 |
| double_bump | mem_long | 0.33 | 0.57 | 0.10 | 0.00 |
| double_bump | mem_long_leaky | 0.20 | 0.23 | 0.37 | 0.20 |
| bump_train | mem_short | 0.30 | 0.33 | 0.33 | 0.03 |
| bump_train | mem_medium | 0.40 | 0.43 | 0.17 | 0.00 |
| bump_train | mem_long | 0.33 | 0.43 | 0.17 | 0.07 |
| bump_train | mem_long_leaky | 0.20 | 0.30 | 0.30 | 0.20 |
| roving_bump | mem_short | 0.07 | 0.17 | 0.63 | 0.13 |
| roving_bump | mem_medium | 0.13 | 0.03 | 0.73 | 0.10 |
| roving_bump | mem_long | 0.07 | 0.13 | 0.63 | 0.17 |
| roving_bump | mem_long_leaky | 0.00 | 0.07 | 0.57 | 0.37 |
| roving_ramp_bump | mem_short | 0.07 | 0.10 | 0.73 | 0.10 |
| roving_ramp_bump | mem_medium | 0.10 | 0.00 | 0.70 | 0.20 |
| roving_ramp_bump | mem_long | 0.07 | 0.07 | 0.67 | 0.20 |
| roving_ramp_bump | mem_long_leaky | 0.03 | 0.03 | 0.53 | 0.40 |

Mean per-person recovery by design: roving_ramp 0.64, double_bump 0.27, bump_train 0.22, roving_bump 0.59, roving_ramp_bump 0.62

## 4. Individual differences: breath-to-breath share s

r(true s, recovered s) across participants, and median |error|, using the mixed fit and the mixed_leaky fit. Pooled row adds the pure observers (s = 0 level/leaky, 1 transient).

| design | gen | r_s_mixed | mae_s_mixed | r_s_mixed_leaky | mae_s_mixed_leaky |
|---|---|---|---|---|---|
| roving_ramp | mem_short | 0.84 | 0.05 | 0.85 | 0.06 |
| roving_ramp | mem_medium | 0.82 | 0.08 | 0.82 | 0.08 |
| roving_ramp | mem_long | 0.81 | 0.08 | 0.83 | 0.10 |
| roving_ramp | mem_long_leaky | 0.93 | 0.04 | 0.93 | 0.06 |
| roving_ramp | pooled | 0.87 | 0.07 | 0.87 | 0.07 |
| double_bump | mem_short | 0.58 | 0.17 | 0.58 | 0.16 |
| double_bump | mem_medium | 0.63 | 0.16 | 0.65 | 0.16 |
| double_bump | mem_long | 0.66 | 0.24 | 0.60 | 0.20 |
| double_bump | mem_long_leaky | 0.73 | 0.20 | 0.71 | 0.19 |
| double_bump | pooled | 0.65 | 0.19 | 0.64 | 0.17 |
| bump_train | mem_short | 0.53 | 0.17 | 0.53 | 0.17 |
| bump_train | mem_medium | 0.35 | 0.25 | 0.33 | 0.22 |
| bump_train | mem_long | 0.49 | 0.32 | 0.55 | 0.23 |
| bump_train | mem_long_leaky | 0.55 | 0.19 | 0.51 | 0.16 |
| bump_train | pooled | 0.49 | 0.21 | 0.48 | 0.19 |
| roving_bump | mem_short | 0.80 | 0.06 | 0.80 | 0.07 |
| roving_bump | mem_medium | 0.85 | 0.06 | 0.80 | 0.08 |
| roving_bump | mem_long | 0.88 | 0.08 | 0.88 | 0.11 |
| roving_bump | mem_long_leaky | 0.96 | 0.04 | 0.97 | 0.05 |
| roving_bump | pooled | 0.88 | 0.06 | 0.87 | 0.08 |
| roving_ramp_bump | mem_short | 0.80 | 0.09 | 0.79 | 0.10 |
| roving_ramp_bump | mem_medium | 0.81 | 0.08 | 0.76 | 0.10 |
| roving_ramp_bump | mem_long | 0.86 | 0.09 | 0.83 | 0.11 |
| roving_ramp_bump | mem_long_leaky | 0.90 | 0.06 | 0.87 | 0.09 |
| roving_ramp_bump | pooled | 0.84 | 0.08 | 0.82 | 0.10 |

## 5. Leak and decision parameters (fit = generating model)

r(true, fitted) for λ, criterion δ and boundary a (log scale for λ, a); `lam_floor` = share of true leaks estimated at the floor.

| design | gen | r_delta | r_a | r_lam | lam_floor |
|---|---|---|---|---|---|
| roving_ramp | mem_short | 0.65 | 0.65 |  |  |
| roving_ramp | mem_medium | 0.58 | 0.73 |  |  |
| roving_ramp | mem_long | 0.46 | 0.70 |  |  |
| roving_ramp | mem_long_leaky | 0.45 | 0.63 | 0.37 | 0.20 |
| double_bump | mem_short | 0.38 | 0.56 |  |  |
| double_bump | mem_medium | 0.64 | 0.67 |  |  |
| double_bump | mem_long | 0.32 | 0.66 |  |  |
| double_bump | mem_long_leaky | 0.19 | 0.25 | -0.01 | 0.37 |
| bump_train | mem_short | 0.38 | 0.29 |  |  |
| bump_train | mem_medium | 0.30 | 0.56 |  |  |
| bump_train | mem_long | 0.19 | 0.21 |  |  |
| bump_train | mem_long_leaky | -0.13 | 0.37 | -0.01 | 0.43 |
| roving_bump | mem_short | 0.60 | 0.71 |  |  |
| roving_bump | mem_medium | 0.65 | 0.82 |  |  |
| roving_bump | mem_long | 0.53 | 0.53 |  |  |
| roving_bump | mem_long_leaky | 0.50 | 0.57 | 0.46 | 0.13 |
| roving_ramp_bump | mem_short | 0.60 | 0.60 |  |  |
| roving_ramp_bump | mem_medium | 0.77 | 0.62 |  |  |
| roving_ramp_bump | mem_long | 0.58 | 0.63 |  |  |
| roving_ramp_bump | mem_long_leaky | 0.19 | 0.60 | 0.45 | 0.17 |

## 6. Memory span: how long accumulated evidence lasts

Evidence half-life in seconds: ln 2 / λ with a leak, a / 2c (criterion drain) without.  r = correlation of log true vs log recovered span, using the fit that matches the generator and the leaky fit; `median_true` / `median_hat` in seconds.

| design | gen | median_true | r_mixed | median_hat_mixed | r_mixed_leaky | median_hat_mixed_leaky |
|---|---|---|---|---|---|---|
| roving_ramp | mem_short | 1.40 | 0.36 | 1.30 | 0.16 | 7.12 |
| roving_ramp | mem_medium | 8.76 | 0.56 | 10.53 | -0.08 | 30.71 |
| roving_ramp | mem_long | 76.80 | 0.57 | 41.27 | -0.01 | 29.67 |
| roving_ramp | mem_long_leaky | 18.80 | 0.33 | 25.21 | 0.37 | 9.59 |
| double_bump | mem_short | 1.40 | 0.25 | 1.34 | 0.04 | 115.53 |
| double_bump | mem_medium | 8.76 | 0.41 | 6.80 | -0.12 | 115.52 |
| double_bump | mem_long | 76.80 | 0.09 | 51.41 | -0.14 | 138.63 |
| double_bump | mem_long_leaky | 18.80 | 0.23 | 27.97 | -0.01 | 18.83 |
| bump_train | mem_short | 1.40 | 0.09 | 1.49 | -0.21 | 59.59 |
| bump_train | mem_medium | 8.76 | 0.32 | 5.71 | -0.03 | 115.68 |
| bump_train | mem_long | 76.80 | -0.29 | 39.45 | -0.17 | 27.11 |
| bump_train | mem_long_leaky | 18.80 | 0.44 | 24.41 | -0.01 | 54.51 |
| roving_bump | mem_short | 1.40 | 0.45 | 1.30 | -0.02 | 64.85 |
| roving_bump | mem_medium | 8.76 | 0.64 | 9.23 | 0.11 | 6.79 |
| roving_bump | mem_long | 76.80 | 0.43 | 51.58 | -0.12 | 138.63 |
| roving_bump | mem_long_leaky | 18.80 | 0.44 | 28.16 | 0.46 | 10.32 |
| roving_ramp_bump | mem_short | 1.40 | 0.39 | 1.34 | 0.19 | 115.53 |
| roving_ramp_bump | mem_medium | 8.76 | 0.70 | 8.03 | 0.13 | 115.52 |
| roving_ramp_bump | mem_long | 76.80 | -0.09 | 36.96 | -0.27 | 33.81 |
| roving_ramp_bump | mem_long_leaky | 18.80 | 0.27 | 30.70 | 0.45 | 8.03 |

## 7. Blip-train kernel (press-triggered blip history)

P(train blip at each lag before a press) ÷ base blip rate, pooled over participants. Lag 0 = the breath the crossing fell in. A kernel that stays above 1 for many lags means evidence is held a long time.

| design | gen | presses | lag0 | lag2 | lag4 | lag6 | lag8 | lag10 | lag12 |
|---|---|---|---|---|---|---|---|---|---|
| bump_train | mem_long | 706 | 1.75 | 1.68 | 1.17 | 1.10 | 1.08 | 1.19 | 1.12 |
| bump_train | mem_long_leaky | 716 | 2.05 | 1.88 | 1.16 | 1.26 | 1.20 | 1.08 | 1.13 |
| bump_train | mem_medium | 538 | 1.91 | 1.76 | 1.15 | 1.02 | 1.20 | 1.20 | 1.21 |
| bump_train | mem_short | 745 | 1.79 | 1.43 | 1.23 | 1.19 | 1.15 | 1.27 | 1.15 |

## 8. Degenerate fits

Share of fits (all models) that collapsed to the bounds (a = 15 or δ = 30: presses treated as random). Correlations in this summary are Spearman rank correlations so these do not dominate.

| design | degenerate |
|---|---|
| roving_ramp | 0.10 |
| double_bump | 0.17 |
| bump_train | 0.18 |
| roving_bump | 0.08 |
| roving_ramp_bump | 0.09 |

