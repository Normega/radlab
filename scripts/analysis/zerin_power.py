"""Power for the Zerin study team's four hypotheses (3 arms x pre/post).

With two timepoints, every group x time test in a mixed ANOVA is identical to a
one-way ANOVA on change scores, so effects are expressed in change-score SD units.
"""
import math
import numpy as np
from scipy import stats, optimize

ALPHA = 0.05
TARGET = 0.80


def paired_power(dz, n, alpha=ALPHA, sides=2):
    df = n - 1
    nc = dz * math.sqrt(n)
    tc = stats.t.ppf(1 - alpha / sides, df)
    p = float(np.nan_to_num(stats.nct.sf(tc, df, nc), nan=1.0))
    if sides == 2:
        p += float(np.nan_to_num(stats.nct.cdf(-tc, df, nc), nan=0.0))
    return p


def contrast_power(d, n, k=3, alpha=ALPHA, sides=2):
    """Two arms compared inside the 3-arm ANOVA (pooled error, df = k*n - k)."""
    df = k * n - k
    nc = d * math.sqrt(n / 2)
    tc = stats.t.ppf(1 - alpha / sides, df)
    p = float(np.nan_to_num(stats.nct.sf(tc, df, nc), nan=1.0))
    if sides == 2:
        p += float(np.nan_to_num(stats.nct.cdf(-tc, df, nc), nan=0.0))
    return p


def omnibus_power(means, n, alpha=ALPHA):
    """Group x time interaction F(k-1, k(n-1)); means in change-SD units."""
    k = len(means)
    m = np.mean(means)
    lam = n * sum((x - m) ** 2 for x in means)
    df1, df2 = k - 1, k * (n - 1)
    fc = stats.f.ppf(1 - alpha, df1, df2)
    return 1 - stats.ncf.cdf(fc, df1, df2, lam)


def n_for(fn, lo=4, hi=2000):
    for n in range(lo, hi):
        if fn(n) >= TARGET:
            return n
    return None


def mdes(fn_d, n):
    return optimize.brentq(lambda d: fn_d(d, n) - TARGET, 0.01, 2)


def mediation_power(n, a, b, cp=0.0, reps=2000, mc=4000, seed=1):
    """Relative indirect effect, reflection vs neutral, PROCESS model 4 with a
    multicategorical X (3 arms, indicator coding, neutral = reference).
    M = change in LMS, Y = change in PHQ-8, both standardized within arm.
    a: arm difference in M (SD units); b: standardized effect of M on Y.
    CI by Monte Carlo (Preacher & Selig 2012), which tracks the percentile
    bootstrap closely at a fraction of the cost."""
    rng = np.random.default_rng(seed)
    hits = 0
    for _ in range(reps):
        g = np.repeat([0, 1, 2], n)               # 0 neutral, 1 mood comparison, 2 reflection
        d1, d2 = (g == 1).astype(float), (g == 2).astype(float)
        M = a / 2 * d1 + a * d2 + rng.standard_normal(3 * n)
        Y = b * M + cp * d2 + rng.standard_normal(3 * n) * math.sqrt(max(1 - b * b, 1e-6))
        Xa = np.column_stack([np.ones(3 * n), d1, d2])
        ba, ra, *_ = np.linalg.lstsq(Xa, M, rcond=None)
        sa = math.sqrt(ra[0] / (3 * n - 3) * np.linalg.inv(Xa.T @ Xa)[2, 2])
        Xb = np.column_stack([np.ones(3 * n), d1, d2, M])
        bb, rb, *_ = np.linalg.lstsq(Xb, Y, rcond=None)
        sb = math.sqrt(rb[0] / (3 * n - 4) * np.linalg.inv(Xb.T @ Xb)[3, 3])
        ab = rng.normal(ba[2], sa, mc) * rng.normal(bb[3], sb, mc)
        lo, hi = np.percentile(ab, [2.5, 97.5])
        hits += (lo > 0) or (hi < 0)
    return hits / reps


if __name__ == "__main__":
    print("== H1: paired t within one arm ==")
    for n in (37, 30, 25):
        print(f"  n={n}: minimum detectable dz = {mdes(paired_power, n):.2f}")

    print("\n== H2/H4: reflection vs neutral, change scores (follow-up contrast) ==")
    for n in (37, 30, 25):
        print(f"  n={n}/arm: MDES d = {mdes(contrast_power, n):.2f} (2-sided), "
              f"{mdes(lambda d, n: contrast_power(d, n, sides=1), n):.2f} (1-sided)")
    print("  n per arm for 80% power:")
    for d in (0.3, 0.4, 0.5, 0.6, 0.7, 0.8):
        n2 = n_for(lambda n: contrast_power(d, n))
        n1 = n_for(lambda n: contrast_power(d, n, sides=1))
        print(f"    d={d}: {n2}/arm 2-sided ({3*n2} total), {n1}/arm 1-sided ({3*n1} total)")

    print("\n== H2: omnibus group x time interaction F(2, 3n-3) ==")
    for label, pat in (("linear 0, d/2, d", (0, 0.5, 1)), ("only reflection 0, 0, d", (0, 0, 1))):
        for d in (0.4, 0.5, 0.6):
            n = n_for(lambda n: omnibus_power([d * p for p in pat], n))
            print(f"  {label}, d={d}: {n}/arm for 80%  | power at 37/arm = "
                  f"{omnibus_power([d * p for p in pat], 37):.2f}")

    print("\n== H3: relative indirect effect (reflection vs neutral), Monte Carlo CI ==")
    for a, b in ((0.5, 0.39), (0.5, 0.26), (0.39, 0.39), (0.8, 0.26)):
        row = []
        for n in (25, 37, 50, 64):
            row.append(f"{n}/arm={mediation_power(n, a, b, reps=1000):.2f}")
        print(f"  a={a}, b={b}: " + "  ".join(row))


# ---------------------------------------------------------------------------
# v3.2 (2026-10-05): effect sizes in POST-intervention SD units, which is the
# definition §5.2 reports. The confirmatory cLDA model equals ANCOVA with
# complete data, so its residual variance is (1 - r^2) x the post variance.
# This replaces the earlier change-score-unit tables: their "(1 + r)/2" saving
# assumed equal pre and post variances, which the 5-9 baseline truncation
# rules out. These numbers reproduce prereg §3.4.

def contrast_power_post(eff, w2, n, r, alpha=ALPHA):
    """eff: true contrast in post-SD units; w2: sum of squared contrast weights."""
    df = 3 * n - 4
    nc = eff / math.sqrt((1 - r * r) * w2 / n)
    tc = stats.t.ppf(1 - alpha / 2, df)
    return (float(np.nan_to_num(stats.nct.sf(tc, df, nc), nan=1.0))
            + float(np.nan_to_num(stats.nct.cdf(-tc, df, nc), nan=0.0)))


def mediation_power_c1(n, a_pat, b, reps=1000, mc=4000, seed=7):
    """Relative indirect effect of C1 (rating vs neutral) through M, X coded C1/C2."""
    rng = np.random.default_rng(seed)
    g = np.repeat([0, 1, 2], n)
    C1 = np.array([-2 / 3, 1 / 3, 1 / 3])[g]
    C2 = np.array([0, -0.5, 0.5])[g]
    hits = 0
    for _ in range(reps):
        M = np.array(a_pat)[g] + rng.standard_normal(3 * n)
        Y = b * M + rng.standard_normal(3 * n) * math.sqrt(1 - b * b)
        Xa = np.column_stack([np.ones(3 * n), C1, C2])
        ba, ra, *_ = np.linalg.lstsq(Xa, M, rcond=None)
        sa = math.sqrt(ra[0] / (3 * n - 3) * np.linalg.inv(Xa.T @ Xa)[1, 1])
        Xb = np.column_stack([np.ones(3 * n), C1, C2, M])
        bb, rb, *_ = np.linalg.lstsq(Xb, Y, rcond=None)
        sb = math.sqrt(rb[0] / (3 * n - 4) * np.linalg.inv(Xb.T @ Xb)[3, 3])
        ab = rng.normal(ba[1], sa, mc) * rng.normal(bb[3], sb, mc)
        lo, hi = np.percentile(ab, [2.5, 97.5])
        hits += (lo > 0) or (hi < 0)
    return hits / reps


def v32_tables(r=0.3, d=0.5, target=56):
    print(f"\n== v3.2: post-SD units, r = {r}, d = {d}, power at {target}/arm ==")
    pats = {"equal": (0, d, d), "graded": (0, d / 2, d), "reflection only": (0, 0, d)}
    for name, (m0, m1, m2) in pats.items():
        cells = {"H2a C1": ((m1 + m2) / 2 - m0, 1.5), "H2b C2": (m2 - m1, 2.0),
                 "R vs N": (m2 - m0, 2.0)}
        out = []
        for lab, (eff, w2) in cells.items():
            if eff <= 0:
                out.append(f"{lab}: no effect")
                continue
            n = next(k for k in range(4, 5000) if contrast_power_post(eff, w2, k, r) >= TARGET)
            out.append(f"{lab}: n={n} (power@{target}={contrast_power_post(eff, w2, target, r):.2f})")
        print(f"  {name:16s} " + " | ".join(out))
    print("  H3 C1 indirect effect (Monte Carlo CI):")
    for label, pat in (("equal a=.5", (0, .5, .5)), ("graded a=.5", (0, .25, .5))):
        for b in (0.26, 0.39):
            row = " ".join(f"{n}/arm={mediation_power_c1(n, pat, b):.2f}" for n in (37, 56, 78))
            print(f"    {label}, b={b}: {row}")


if __name__ == "__main__":
    v32_tables()
