"""Ideal-observer comparison: BCAT-style 3AFC Quest vs the free-response pre-run.

Both observers obey their procedure's own model exactly (no model mismatch), with the SAME
detection function F(m) = logistic((ln m - mu)/0.39), lapse .03. Procedure efficiency only.

A  3AFC Quest per direction (BCAT): P(correct) = 1/3 + 2/3 (1-lam) F. 1D grid over mu.
   20% null trials (no threshold info, cost time). Placed at posterior mean + the 3AFC
   max-information offset. 22.2 s / trial (as run, with ratings) or 16 s (lean).
B  free-response pre-run (run_prerun.py Quest, separate): P(hit) = 1 - exp(-h w)(1 - (1-lam) F),
   w = 20 s; 1-3 steady breaths (4 s) before each change inform h. Joint (mu_f, mu_s, h) grid,
   factorised exactly (the mu's are independent given h). Directions alternate. 28.2 s / change.
   Placement: posterior mean (as built) or the max expected-information offset.
"""
import math
import numpy as np

S, LAM = 0.39, 0.03
MU = np.linspace(math.log(0.02), math.log(0.9), 81)
HFA = np.exp(np.linspace(math.log(0.05 / 60), math.log(2.0 / 60), 15))
LP_MU = -0.5 * ((MU - math.log(0.2)) / 0.7) ** 2
M_MIN, M_MAX = 0.03, 0.6
W, BREATH = 20.0, 4.0
SEC = {'A (22.2 s)': 22.2, 'A-lean (16 s)': 16.0, 'B mean': 28.2, 'B sweet': 28.2}
TIMES = [3, 5, 7.4, 11.3, 15, 22.5]
TMAX = 60.0
N = 2000
DEL = np.linspace(-2.5, 2.5, 501)


def F(x, mu):
    return 1.0 / (1.0 + np.exp(-(x - mu) / S))


def lse(a, axis):
    m = a.max(axis=axis, keepdims=True)
    return (m + np.log(np.exp(a - m).sum(axis=axis, keepdims=True))).squeeze(axis)


def info_afc(d):
    f = F(d, 0.0)
    p = 1 / 3 + 2 / 3 * (1 - LAM) * f
    dp = 2 / 3 * (1 - LAM) * f * (1 - f) / S
    return dp ** 2 / (p * (1 - p))


def info_yn(d, h):
    f = F(d, 0.0)
    q = np.exp(-h * W)
    p = 1 - q * (1 - (1 - LAM) * f)
    dp = q * (1 - LAM) * f * (1 - f) / S
    return dp ** 2 / (p * (1 - p))


I_A = info_afc(DEL)
D_A = DEL[I_A.argmax()]
I_TAB = np.stack([info_yn(DEL, h) for h in HFA])          # (15, nDEL)


def post_mean_1d(lp):
    p = np.exp(lp - lp.max(1, keepdims=True))
    p /= p.sum(1, keepdims=True)
    return p @ MU


def run_A(mu, rng, n):
    """One direction. Returns est (N, n+1): posterior mean after k trials (nulls included)."""
    nP = len(mu)
    lp = np.tile(LP_MU, (nP, 1))
    null = np.zeros((nP, n), bool)
    ar = np.arange(nP)
    for b in range(0, n, 5):
        idx = b + rng.integers(0, 5, nP)
        ok = idx < n
        null[ar[ok], idx[ok]] = True
    est = np.empty((nP, n + 1))
    est[:, 0] = post_mean_1d(lp)
    for k in range(n):
        x = np.log(np.clip(np.exp(est[:, k] + D_A), M_MIN, M_MAX))
        resp = rng.random(nP) < 1 / 3 + 2 / 3 * (1 - LAM) * F(x, mu)
        pg = 1 / 3 + 2 / 3 * (1 - LAM) * F(x[:, None], MU[None, :])
        ll = np.where(resp[:, None], np.log(pg), np.log(1 - pg))
        lp += np.where(null[:, k][:, None], 0.0, ll)
        est[:, k + 1] = post_mean_1d(lp)
    return est


def marginals(Lf, Ls, Lg):
    tf = LP_MU[None, :, None] + Lf                         # (N, 81, 15)
    ts = LP_MU[None, :, None] + Ls
    Af, As = lse(tf, 1), lse(ts, 1)                        # (N, 15)
    lw = Lg + Af + As
    wh = np.exp(lw - lw.max(1, keepdims=True))
    wh /= wh.sum(1, keepdims=True)
    out = []
    for t, other in ((tf, As), (ts, Af)):
        lm = lse(t + (Lg + other)[:, None, :], 2)          # (N, 81)
        out.append(post_mean_1d(lm))
    return out[0], out[1], wh


def run_B(mu_f, mu_s, h, rng, n, placement):
    nP = len(mu_f)
    Lf = np.zeros((nP, 81, 15))
    Ls = np.zeros((nP, 81, 15))
    Lg = np.zeros((nP, 15))
    start = rng.integers(0, 2, nP)
    ef, es = np.empty((nP, n + 1)), np.empty((nP, n + 1))
    qg = np.exp(-HFA * W)
    for j in range(n + 1):
        mf, ms, wh = marginals(Lf, Ls, Lg)
        ef[:, j], es[:, j] = mf, ms
        if j == n:
            break
        fast = (start + j) % 2 == 0
        mh = np.where(fast, mf, ms)
        off = 0.0 if placement == 'mean' else DEL[(wh @ I_TAB).argmax(1)]
        x = np.log(np.clip(np.exp(mh + off), M_MIN, M_MAX))
        gap = rng.integers(1, 4, nP) * BREATH
        pg = rng.random(nP) < 1 - np.exp(-h * gap)
        qgap = np.exp(-HFA[None, :] * gap[:, None])
        Lg += np.where(pg[:, None], np.log(np.clip(1 - qgap, 1e-12, 1)), np.log(qgap))
        mu_t = np.where(fast, mu_f, mu_s)
        hit = rng.random(nP) < 1 - np.exp(-h * W) * (1 - (1 - LAM) * F(x, mu_t))
        pdet = (1 - LAM) * F(x[:, None], MU[None, :])
        ph = np.clip(1 - qg[None, None, :] * (1 - pdet[:, :, None]), 1e-9, 1 - 1e-9)
        ll = np.where(hit[:, None, None], np.log(ph), np.log(1 - ph))
        Lf += np.where(fast[:, None, None], ll, 0.0)
        Ls += np.where(fast[:, None, None], 0.0, ll)
    return ef, es


def people(rng):
    return (rng.normal(math.log(0.25), 0.5, N), rng.normal(math.log(0.25), 0.5, N),
            np.exp(rng.uniform(math.log(0.1), math.log(1.0), N)) / 60.0)


def curves(mu_f, mu_s, h, seed):
    """est_f, est_s at each minute grid point for each procedure, as functions of minutes."""
    rng = np.random.default_rng(seed)
    out = {}
    nA = int(TMAX * 60 / (2 * 16.0)) + 1
    eAf, eAs = run_A(mu_f, rng, nA), run_A(mu_s, rng, nA)
    for name in ('A (22.2 s)', 'A-lean (16 s)'):
        sec = SEC[name]
        out[name] = lambda t, sec=sec: (eAf[:, min(int(t * 60 // (2 * sec)), nA)],
                                         eAs[:, min(int(t * 60 // (2 * sec)), nA)])
    nB = int(TMAX * 60 / 28.2) + 1
    for name, pl in (('B mean', 'mean'), ('B sweet', 'sweet')):
        ef, es = run_B(mu_f, mu_s, h, rng, nB, pl)
        out[name] = lambda t, ef=ef, es=es: (ef[:, min(int(t * 60 // 28.2), nB)],
                                              es[:, min(int(t * 60 // 28.2), nB)])
    return out


def rmse(est, mu_f, mu_s):
    ef, es = est
    return float(np.sqrt(0.5 * (np.mean((ef - mu_f) ** 2) + np.mean((es - mu_s) ** 2))))


def main():
    rng = np.random.default_rng(20261018)
    mu_f, mu_s, h = people(rng)
    c1 = curves(mu_f, mu_s, h, 1)
    c2 = curves(mu_f, mu_s, h, 2)
    print(f'3AFC sweet-spot offset {D_A:+.2f} ln units (p correct there '
          f'{1/3 + 2/3*(1-LAM)*F(D_A, 0):.2f}); max info/trial {I_A.max():.2f}')
    for hm in (0.1, 0.32, 1.0):
        Iy = info_yn(DEL, hm / 60)
        print(f'free response, h={hm}/min: max info/trial {Iy.max():.2f} at offset {DEL[Iy.argmax()]:+.2f}; '
              f'ratio 3AFC/FR per trial {I_A.max()/Iy.max():.2f}; per minute (A 22.2 s, 20% nulls vs B 28.2 s) '
              f'{(0.8*I_A.max()/22.2)/(Iy.max()/28.2):.2f}, A-lean {(0.8*I_A.max()/16)/(Iy.max()/28.2):.2f}')
    print('\nRMSE of mu per direction (ln units) by minutes')
    print('proc'.ljust(16) + ''.join(f'{t:>7}' for t in TIMES) + '   min->.30  min->.20')
    fine = np.arange(0.5, TMAX + 0.01, 0.1)
    for name in SEC:
        row = [rmse(c1[name](t), mu_f, mu_s) for t in TIMES]
        r_f = np.array([rmse(c1[name](t), mu_f, mu_s) for t in fine])
        cross = []
        for tgt in (0.30, 0.20):
            k = np.flatnonzero(r_f <= tgt)
            cross.append(f'{fine[k[0]]:.1f}' if len(k) else f'>{TMAX:.0f}')
        print(name.ljust(16) + ''.join(f'{v:7.2f}' for v in row) + f'{cross[0]:>10}{cross[1]:>9}')
    print('\nRetest r (two independent runs, same people): per direction (fast/slow) | asymmetry slow-fast')
    for name in SEC:
        parts = []
        for t in (7.4, 11.3):
            a1, a2 = c1[name](t), c2[name](t)
            rf = np.corrcoef(a1[0], a2[0])[0, 1]
            rs = np.corrcoef(a1[1], a2[1])[0, 1]
            ra = np.corrcoef(a1[1] - a1[0], a2[1] - a2[0])[0, 1]
            rt = np.corrcoef(a1[1] - a1[0], mu_s - mu_f)[0, 1]
            parts.append(f'{t:>4} min: {rf:.2f}/{rs:.2f} | asym {ra:.2f} (vs truth {rt:.2f})')
        print(name.ljust(16) + '   '.join(parts))


if __name__ == '__main__':
    main()
