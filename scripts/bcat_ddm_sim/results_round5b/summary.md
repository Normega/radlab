# BCAT-DDM round 5b: mechanisms from Nansi's review

Generated 2026-10-13 00:10 by `scripts/bcat_ddm_sim/run_round5b.py`. N = 30 per population, design `roving_ramp`, 40 min, medium-memory mixed observers. Each population adds one mechanism; every session is fitted with all six models.

## 1. Behaviour by population

| gen | n_presses | hit_rate | stable_fa_per_min | median_rt_breaths |
|---|---|---|---|---|
| r5_base | 53.23 | 0.62 | 0.45 | 1.50 |
| r5_asym | 55.23 | 0.58 | 0.48 | 1.37 |
| r5_taur | 51.03 | 0.57 | 0.52 | 1.48 |
| r5_inhale | 49.03 | 0.62 | 0.27 | 1.35 |
| r5_urgency | 54.50 | 0.66 | 0.48 | 1.36 |
| r5_sr | 43.27 | 0.52 | 0.25 | 1.31 |

## 2. Model choice

Group: summed AIC winner (✓ = the mechanism actually present) and its margin over the runner-up. Columns m_*: share of people whose lowest-AIC model is that model (the matching one is correct).

| gen | group_winner | margin | true_minus_best | m_base | m_asym | m_taur | m_inhale | m_urg | m_sr |
|---|---|---|---|---|---|---|---|---|---|
| r5_base | m_base ✓ | 17.29 | 0.00 | 0.30 | 0.10 | 0.20 | 0.20 | 0.10 | 0.10 |
| r5_asym | m_asym ✓ | 653.63 | 0.00 | 0.00 | 0.93 | 0.03 | 0.03 | 0.00 | 0.00 |
| r5_taur | m_taur ✓ | 34.56 | 0.00 | 0.33 | 0.10 | 0.30 | 0.13 | 0.13 | 0.00 |
| r5_inhale | m_inhale ✓ | 168.85 | 0.00 | 0.13 | 0.03 | 0.03 | 0.73 | 0.07 | 0.00 |
| r5_urgency | m_urg ✓ | 57.68 | 0.00 | 0.10 | 0.10 | 0.13 | 0.13 | 0.50 | 0.03 |
| r5_sr | m_base | 17.48 | 51.56 | 0.23 | 0.23 | 0.03 | 0.27 | 0.07 | 0.17 |

## 3. Recovery of each mechanism's parameter (fit = matching model, Spearman)

| gen | parameter | rho | median_true | median_fit |
|---|---|---|---|---|
| r5_asym | kappa | 0.81 | 0.27 | 0.28 |
| r5_taur | tau_r | 0.63 | 10.36 | 10.30 |
| r5_urgency | omega | 0.50 | 0.22 | 0.43 |
| r5_sr | nu | 0.02 | 0.27 | 0.31 |

## 4. Degenerate fits

| fit | deg |
|---|---|
| m_base | 0.01 |
| m_asym | 0.01 |
| m_taur | 0.01 |
| m_inhale | 0.01 |
| m_urg | 0.01 |
| m_sr | 0.01 |

