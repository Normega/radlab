# BCAT-DDM pre-run simulation, stage 2

Generated 2026-10-15 14:55 by `scripts/bcat_ddm_sim/run_prerun.py`.

## Stage 2: the main task (roving + ramp, 40 min)

Hit rates are means over people. `mean_|fast-slow|`: average gap between a person's step hit rates in the two directions. `rho_kappa`, `kappa_rmse`: recovery of the asymmetry from the m_asym fit. `asym_chosen`: share of people whose AIC prefers m_asym (with no asymmetry, a false-positive rate). `group_dAIC`: summed AIC advantage of m_asym.

| pop | cond | step_hit_fast | step_hit_slow | mean_|fast-slow| | ramp_hit_fast | ramp_hit_slow | hits | rho_kappa | kappa_rmse | rho_s | asym_chosen | group_dAIC | degenerate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| modest | separate@16 | 0.46 | 0.54 | 0.16 | 0.62 | 0.76 | 26.40 | 0.70 | 0.11 | 0.92 | 0.40 | 63.87 | 0.00 |
| modest | separate@24 | 0.49 | 0.58 | 0.17 | 0.63 | 0.68 | 27.70 | 0.84 | 0.07 | 0.93 | 0.45 | 65.82 | 0.00 |
| modest | shared@24 | 0.53 | 0.56 | 0.15 | 0.67 | 0.72 | 28.52 | 0.82 | 0.12 | 0.82 | 0.42 | 90.32 | 0.00 |
| modest | true | 0.59 | 0.54 | 0.13 | 0.71 | 0.74 | 29.35 | 0.86 | 0.08 | 0.95 | 0.53 | 101.06 | 0.00 |
| none | separate@16 | 0.52 | 0.56 | 0.16 | 0.56 | 0.79 | 27.75 |  | 0.08 | 0.86 | 0.15 | -34.33 | 0.00 |
| none | separate@24 | 0.54 | 0.55 | 0.16 | 0.66 | 0.72 | 28.25 |  | 0.07 | 0.89 | 0.20 | -37.48 | 0.00 |
| none | shared@24 | 0.52 | 0.56 | 0.13 | 0.59 | 0.79 | 28.57 |  | 0.07 | 0.83 | 0.20 | -31.92 | 0.00 |
| none | true | 0.55 | 0.55 | 0.13 | 0.70 | 0.78 | 29.35 |  | 0.06 | 0.87 | 0.12 | -44.49 | 0.00 |
| wide | separate@16 | 0.48 | 0.56 | 0.17 | 0.59 | 0.80 | 27.12 | 0.94 | 0.09 | 0.93 | 0.70 | 458.80 | 0.00 |
| wide | separate@24 | 0.50 | 0.59 | 0.16 | 0.58 | 0.81 | 27.85 | 0.90 | 0.10 | 0.94 | 0.70 | 463.12 | 0.00 |
| wide | shared@24 | 0.52 | 0.54 | 0.23 | 0.68 | 0.73 | 28.23 | 0.97 | 0.08 | 0.92 | 0.85 | 496.16 | 0.00 |
| wide | true | 0.55 | 0.51 | 0.15 | 0.71 | 0.77 | 28.82 | 0.96 | 0.08 | 0.84 | 0.88 | 499.77 | 0.00 |
