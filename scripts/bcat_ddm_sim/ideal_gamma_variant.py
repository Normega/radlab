"""Variant: BCAT observers who answer 'same' when they detect nothing (real NoChange accuracy ~.72),
so the effective guess rate on change trials is ~.14, not 1/3. Truth gamma .14; Quest model gamma
either .14 (correct) or 1/3 (as the real Quest assumes)."""
import math, numpy as np
import ideal_bcat_vs_prerun as I

def run_A(mu, rng, n, g_true, g_model):
    nP = len(mu)
    dd = I.DEL
    f = I.F(dd, 0.0); p = g_model + (1-g_model)*(1-I.LAM)*f
    info = ((1-g_model)*(1-I.LAM)*f*(1-f)/I.S)**2/(p*(1-p)); off = dd[info.argmax()]
    lp = np.tile(I.LP_MU, (nP, 1)); null = np.zeros((nP, n), bool); ar = np.arange(nP)
    for b in range(0, n, 5):
        idx = b + rng.integers(0, 5, nP); ok = idx < n; null[ar[ok], idx[ok]] = True
    est = np.empty((nP, n+1)); est[:, 0] = I.post_mean_1d(lp)
    for k in range(n):
        x = np.log(np.clip(np.exp(est[:, k] + off), I.M_MIN, I.M_MAX))
        resp = rng.random(nP) < g_true + (1-g_true)*(1-I.LAM)*I.F(x, mu)
        pg = g_model + (1-g_model)*(1-I.LAM)*I.F(x[:, None], I.MU[None, :])
        lp += np.where(null[:, k][:, None], 0.0, np.where(resp[:, None], np.log(pg), np.log(1-pg)))
        est[:, k+1] = I.post_mean_1d(lp)
    return est, off

rng = np.random.default_rng(20261018)
mu_f, mu_s, h = I.people(rng)
for g_model in (0.14, 1/3):
    for sec in (22.2, 16.0):
        nA = int(60*60/(2*sec)) + 1
        r1 = np.random.default_rng(1); r2 = np.random.default_rng(2)
        (ef, off), (es, _) = run_A(mu_f, r1, nA, 0.14, g_model), run_A(mu_s, r1, nA, 0.14, g_model)
        (ef2, _), (es2, _) = run_A(mu_f, r2, nA, 0.14, g_model), run_A(mu_s, r2, nA, 0.14, g_model)
        k = lambda t: min(int(t*60//(2*sec)), nA)
        rm = [math.sqrt(0.5*(np.mean((ef[:, k(t)]-mu_f)**2)+np.mean((es[:, k(t)]-mu_s)**2))) for t in I.TIMES]
        bias = np.mean(ef[:, k(11.3)]-mu_f)
        fine = np.arange(0.5, 60, 0.1)
        rf = np.array([math.sqrt(0.5*(np.mean((ef[:, k(t)]-mu_f)**2)+np.mean((es[:, k(t)]-mu_s)**2))) for t in fine])
        c = [f'{fine[np.flatnonzero(rf <= tg)[0]]:.1f}' if (rf <= tg).any() else '>60' for tg in (.3, .2)]
        rr = [np.corrcoef(ef[:, k(t)], ef2[:, k(t)])[0, 1] for t in (7.4, 11.3)]
        print(f'model g={g_model:.2f} {sec:>4}s off {off:+.2f}: RMSE ' + ' '.join(f'{v:.2f}' for v in rm)
              + f' | to .30/.20: {c[0]}/{c[1]} | bias@11.3 {bias:+.2f} | retest r 7.4/11.3 {rr[0]:.2f}/{rr[1]:.2f}')
