# BCAT-DDM pre-run simulation, stage 1

Generated 2026-10-15 14:14 by `scripts/bcat_ddm_sim/run_prerun.py`.

## Stage 1: the pre-run

Simulated people (real Intero2025 Quest thresholds for comparison: SD of log ratio .72, faster/slower correlation .25, both including Quest error).

| pop | sd_true_log_ratio | corr_log_fast_slow | median_m50_fast | median_m50_slow |
|---|---|---|---|---|
| modest | 0.24 | 0.76 | 0.21 | 0.18 |
| none | 0.06 | 0.99 | 0.22 | 0.20 |
| wide | 0.52 | 0.40 | 0.21 | 0.19 |

Error of each direction's threshold estimate, log(estimate / truth), pooled over both directions. `rmse_log` 0.25 is about 25% off. `rho_ratio`: how well the pre-run ranks people's own slower/faster ratio (separate only). Minutes exclude the ~2 min of practice.

| pop | method | changes | minutes | rmse_log | bias_log | off_by_>50% | off_by_>2x | rho_ratio |
|---|---|---|---|---|---|---|---|---|
| modest | separate | 12 | 5.76 | 0.31 | -0.04 | 0.18 | 0.03 | 0.28 |
| modest | shared | 12 | 5.78 | 0.30 | -0.02 | 0.17 | 0.02 |  |
| modest | separate | 16 | 7.59 | 0.30 | -0.05 | 0.17 | 0.04 | 0.38 |
| modest | shared | 16 | 7.61 | 0.27 | -0.03 | 0.12 | 0.02 |  |
| modest | separate | 20 | 9.54 | 0.29 | -0.05 | 0.15 | 0.03 | 0.44 |
| modest | shared | 20 | 9.50 | 0.25 | -0.04 | 0.07 | 0.02 |  |
| modest | separate | 24 | 11.28 | 0.27 | -0.05 | 0.14 | 0.01 | 0.49 |
| modest | shared | 24 | 11.25 | 0.23 | -0.03 | 0.06 | 0.01 |  |
| modest | separate | 32 | 15.05 | 0.27 | -0.07 | 0.12 | 0.01 | 0.48 |
| modest | shared | 32 | 14.94 | 0.24 | -0.05 | 0.10 | 0.01 |  |
| modest | separate | 40 | 18.93 | 0.25 | -0.07 | 0.11 | 0.01 | 0.48 |
| modest | shared | 40 | 18.67 | 0.23 | -0.06 | 0.10 | 0.00 |  |
| modest | separate | 48 | 22.58 | 0.24 | -0.06 | 0.10 | 0.01 | 0.58 |
| modest | shared | 48 | 22.27 | 0.23 | -0.07 | 0.08 | 0.01 |  |
| none | separate | 12 | 5.87 | 0.30 | -0.02 | 0.17 | 0.03 | 0.19 |
| none | shared | 12 | 5.87 | 0.26 | -0.00 | 0.10 | 0.02 |  |
| none | separate | 16 | 7.70 | 0.29 | -0.01 | 0.18 | 0.01 | 0.20 |
| none | shared | 16 | 7.83 | 0.23 | -0.00 | 0.07 | 0.01 |  |
| none | separate | 20 | 9.64 | 0.28 | -0.01 | 0.17 | 0.01 | 0.14 |
| none | shared | 20 | 9.55 | 0.21 | 0.00 | 0.06 | 0.00 |  |
| none | separate | 24 | 11.50 | 0.27 | -0.01 | 0.15 | 0.00 | 0.17 |
| none | shared | 24 | 11.40 | 0.19 | 0.00 | 0.06 | 0.00 |  |
| none | separate | 32 | 15.22 | 0.25 | -0.03 | 0.10 | 0.01 | 0.16 |
| none | shared | 32 | 15.02 | 0.17 | -0.02 | 0.03 | 0.00 |  |
| none | separate | 40 | 18.77 | 0.25 | -0.04 | 0.12 | 0.00 | 0.10 |
| none | shared | 40 | 18.66 | 0.15 | -0.02 | 0.01 | 0.00 |  |
| none | separate | 48 | 22.62 | 0.25 | -0.05 | 0.09 | 0.01 | 0.01 |
| none | shared | 48 | 22.26 | 0.15 | -0.02 | 0.01 | 0.00 |  |
| wide | separate | 12 | 5.70 | 0.32 | -0.04 | 0.21 | 0.04 | 0.66 |
| wide | shared | 12 | 5.62 | 0.36 | -0.05 | 0.24 | 0.07 |  |
| wide | separate | 16 | 7.73 | 0.31 | -0.04 | 0.20 | 0.01 | 0.74 |
| wide | shared | 16 | 7.56 | 0.35 | -0.07 | 0.22 | 0.07 |  |
| wide | separate | 20 | 9.48 | 0.28 | -0.03 | 0.15 | 0.03 | 0.80 |
| wide | shared | 20 | 9.46 | 0.34 | -0.05 | 0.21 | 0.06 |  |
| wide | separate | 24 | 11.23 | 0.27 | -0.02 | 0.10 | 0.02 | 0.82 |
| wide | shared | 24 | 11.32 | 0.34 | -0.05 | 0.23 | 0.04 |  |
| wide | separate | 32 | 15.01 | 0.26 | -0.02 | 0.10 | 0.02 | 0.87 |
| wide | shared | 32 | 14.96 | 0.33 | -0.05 | 0.21 | 0.04 |  |
| wide | separate | 40 | 18.83 | 0.27 | -0.05 | 0.11 | 0.02 | 0.87 |
| wide | shared | 40 | 18.70 | 0.33 | -0.05 | 0.20 | 0.06 |  |
| wide | separate | 48 | 22.78 | 0.26 | -0.05 | 0.09 | 0.02 | 0.90 |
| wide | shared | 48 | 22.29 | 0.33 | -0.06 | 0.17 | 0.06 |  |
