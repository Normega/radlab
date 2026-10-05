# BCAT-DDM design-power simulation — results

Generated 2026-10-01 22:37 by `scripts/bcat_ddm_sim/run_power.py`. N = 30 simulated participants per design × generating model; 40 min of task time per session; base breath 4 s; belt measurement error 0.02 (log period).

## 1. Yield per session (mean over participants and generating models)

| design | n_change | n_null | n_return | hit | hit_rate | late | stable_fa_per_min | null_fa | return_press | median_rt_breaths | median_ramp_mag_at_detect |
|---|---|---|---|---|---|---|---|---|---|---|---|
| brief | 23.00 | 0.00 | 23.00 | 15.91 | 0.69 | 9.21 | 0.47 | 0.00 | 8.52 | 1.33 |  |
| roving | 52.98 | 0.00 | 0.00 | 26.76 | 0.51 | 13.76 | 0.49 | 0.00 | 0.00 | 0.96 |  |
| trials | 47.71 | 16.14 | 0.00 | 24.34 | 0.51 | 4.97 | 0.65 | 2.71 | 0.00 | 0.99 |  |
| ramp | 39.76 | 12.62 | 0.00 | 25.97 | 0.66 | 2.86 | 0.22 | 3.23 | 0.00 | 3.33 | 0.28 |
| roving_ramp | 49.47 | 3.22 | 0.00 | 26.91 | 0.55 | 10.01 | 0.44 | 0.81 | 0.00 | 1.34 | 0.28 |

## 2. Parameter recovery (fit model = generating model)

Pearson r between true and fitted parameter across participants (log scale for v, a, lam); `bias` = median log(fitted/true) for v.

| level_0 | level_1 | r_v | r_a | r_lam | r_delta | bias_logv |
|---|---|---|---|---|---|---|
| brief | level | 0.78 | 0.61 |  | 0.30 | 0.04 |
| brief | leaky | 0.56 | 0.45 | 0.55 | -0.09 | 0.03 |
| brief | transient | 0.89 | 0.81 |  | 0.85 | -0.16 |
| roving | level | 0.56 | 0.61 |  | 0.01 | -0.03 |
| roving | leaky | 0.59 | 0.36 | 0.41 | 0.03 | 0.04 |
| roving | transient | 0.92 | 0.83 |  | 0.81 | -0.15 |
| trials | level | 0.64 | 0.47 |  | 0.06 | -0.01 |
| trials | leaky | 0.62 | 0.27 | 0.24 | 0.02 | 0.02 |
| trials | transient | 0.51 | 0.44 |  | 0.05 | -0.14 |
| ramp | level | 0.91 | 0.87 |  | 0.71 | 0.04 |
| ramp | leaky | 0.61 | 0.32 | 0.24 | 0.04 | 0.09 |
| ramp | transient | 0.57 | 0.61 |  | 0.05 | -0.22 |
| roving_ramp | level | 0.81 | 0.64 |  | 0.34 | 0.03 |
| roving_ramp | leaky | 0.56 | 0.31 | 0.43 | 0.02 | 0.09 |
| roving_ramp | transient | 0.77 | 0.76 |  | 0.69 | -0.13 |

## 3. Model recovery

Per participant: share of datasets where the lowest-AIC model is the generating one. Group: summed ΔAIC (best wrong model − generating model; positive = generating model wins).

| level_0 | level_1 | indiv_correct | group_dAIC | picked_level | picked_leaky | picked_transient |
|---|---|---|---|---|---|---|
| brief | level | 0.90 | -41.67 | 0.90 | 0.10 | 0.00 |
| brief | leaky | 0.17 | 62.33 | 0.83 | 0.17 | 0.00 |
| brief | transient | 1.00 | 7178.09 | 0.00 | 0.00 | 1.00 |
| roving | level | 0.87 | -13.09 | 0.87 | 0.13 | 0.00 |
| roving | leaky | 0.17 | -39.02 | 0.83 | 0.17 | 0.00 |
| roving | transient | 1.00 | 7895.30 | 0.00 | 0.00 | 1.00 |
| trials | level | 0.83 | 37.99 | 0.83 | 0.17 | 0.00 |
| trials | leaky | 0.17 | 182.16 | 0.83 | 0.17 | 0.00 |
| trials | transient | 0.97 | 6133.78 | 0.00 | 0.03 | 0.97 |
| ramp | level | 0.97 | 51.93 | 0.97 | 0.03 | 0.00 |
| ramp | leaky | 0.23 | 215.68 | 0.77 | 0.23 | 0.00 |
| ramp | transient | 0.90 | 3347.79 | 0.10 | 0.00 | 0.90 |
| roving_ramp | level | 0.93 | 43.53 | 0.93 | 0.07 | 0.00 |
| roving_ramp | leaky | 0.17 | 225.63 | 0.83 | 0.17 | 0.00 |
| roving_ramp | transient | 1.00 | 7059.16 | 0.00 | 0.00 | 1.00 |

Overall individual-level model recovery by design (mean over generating models):

| index | indiv_correct |
|---|---|
| brief | 0.69 |
| roving | 0.68 |
| trials | 0.66 |
| ramp | 0.70 |
| roving_ramp | 0.70 |

