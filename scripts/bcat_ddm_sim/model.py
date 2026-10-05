"""Observer models and exact free-response likelihood for the BCAT-DDM power simulation.

The observer is a one-boundary accumulator running continuously through the
pacing stream (a CUSUM-style change detector):

    dx = (v * u(t) - delta - lam * x) dt + dW        (sigma fixed at 1)
    reflect at 0, respond when x >= a, press = crossing + TER,
    accumulator off until press + REFRACT, then restarts near 0.

u(t) is the momentary evidence for "the breathing has changed", constant within
a breath and computed from the breath periods. The three generating/fitted
models differ only in u and lam:

    LEVEL     u_k = |L_k - R_k|, R = slow running reference (EWMA, TAU_R breaths), lam = 0
    LEAKY     same u, lam > 0 (evidence leaks: only recent deviation counts)
    TRANSIENT u_k = |L_k - L_(k-1)| (breath-to-breath change only), lam = 0

with L_k = log period of breath k. After any pause (probe, inter-trial) the
reference re-anchors to the first breath back and no transient is counted for
that breath — the observer knows the stream restarted.

Round 2 generalises this to two evidence channels with separate gains
(drive = vL*uL + vT*uT), so a participant can weight total change and
breath-to-breath change in any proportion; see channels() below.

The likelihood propagates the accumulator density on a grid (the same
discrete-time dynamics the simulator uses), so it is exact up to grid
resolution and handles time-varying evidence (ramps) natively — which the
brms `wiener` family cannot.
"""
import math

import numpy as np
from numba import njit

DT = 0.05            # s per simulation / likelihood step
TER = 0.35           # s, non-decision time (fixed, assumed known)
REFRACT = 1.0        # s after a press before accumulation restarts
NGRID = 50           # accumulator grid cells
TAU_R = 10.0         # breaths, reference time constant for LEVEL / LEAKY
H0 = 1.0 / (600.0 / DT)   # contaminant hazard per step: one random press per 10 min
SIGMA_BREATH = 0.04  # log-period breath-to-breath variability while paced (true breathing).
                     # Round 1 used 0.06; at that level even an ideal breath-to-breath detector can
                     # barely reach 50% detection of a 20% step at 0.3 FA/min, so a transient
                     # observer's gain could not be calibrated (it ran off to a plateau).
SIGMA_MEAS = 0.02    # belt measurement error on log period (what the analyst sees)

LEVEL, LEAKY, TRANSIENT = 0, 1, 2
MODEL_NAMES = {LEVEL: 'level', LEAKY: 'leaky', TRANSIENT: 'transient'}

TER_STEPS = int(round(TER / DT))
REF_STEPS = int(round(REFRACT / DT))


# ── timeline ────────────────────────────────────────────────────────────────
def timeline(schedule):
    """Per-step breath index (-1 in pauses), per-breath pause_before flags, paced log periods."""
    breaths = schedule['breaths']
    n_steps = int(math.ceil(schedule['durationMs'] / 1000.0 / DT))
    step_breath = np.full(n_steps, -1, np.int32)
    for b in breaths:
        s0 = int(round(b['startMs'] / 1000.0 / DT))
        s1 = int(round((b['startMs'] + b['periodMs']) / 1000.0 / DT))
        step_breath[s0:min(s1, n_steps)] = b['i']
    pause_before = np.zeros(len(breaths), np.bool_)
    pause_before[0] = True
    for p in schedule['pauses']:
        if p['beforeBreath'] < len(breaths):
            pause_before[p['beforeBreath']] = True
    log_paced = np.log(np.array([b['periodMs'] for b in breaths], np.float64) / 1000.0)
    breath_start_s = np.array([b['startMs'] for b in breaths], np.float64) / 1000.0
    return step_breath, pause_before, log_paced, breath_start_s


@njit(cache=True)
def evidence(L, pause_before, model, base_log, tau_r):
    n = L.shape[0]
    u = np.zeros(n)
    if model == TRANSIENT:
        for k in range(n):
            if k == 0 or pause_before[k]:
                u[k] = 0.0
            else:
                u[k] = abs(L[k] - L[k - 1])
        return u
    alpha = 1.0 / tau_r
    R = base_log
    for k in range(n):
        if pause_before[k] and k > 0:
            R = L[k]
        u[k] = abs(L[k] - R)
        R = R + alpha * (L[k] - R)
    return u


# ── simulator ───────────────────────────────────────────────────────────────
@njit(cache=True)
def simulate(step_breath, u, v, delta, a, lam, seed):
    """Returns a bool array flagging the step at which each boundary crossing happens."""
    np.random.seed(seed)
    n = step_breath.shape[0]
    cross = np.zeros(n, np.bool_)
    x0 = 0.5 * a / NGRID
    x = x0
    off_until = -1
    sq = math.sqrt(DT)
    for s in range(n):
        b = step_breath[s]
        if b < 0:
            x = x0
            continue
        if s < off_until:
            continue
        x += (v * u[b] - delta - lam * x) * DT + sq * np.random.randn()
        if x < 0.0:
            x = -x
        if x >= a:
            cross[s] = True
            x = x0
            off_until = s + 1 + TER_STEPS + REF_STEPS
    return cross


# ── likelihood ──────────────────────────────────────────────────────────────
@njit(cache=True)
def _phi(z):
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


@njit(cache=True)
def _build(M, A, mu, lam, a, ngrid):
    h = a / ngrid
    sd = math.sqrt(DT)
    edges_cdf = np.empty(ngrid + 1)
    mirror_cdf = np.empty(ngrid + 1)
    for j in range(ngrid):
        xj = (j + 0.5) * h
        m = xj + (mu - lam * xj) * DT
        for e in range(ngrid + 1):
            edges_cdf[e] = _phi((e * h - m) / sd)
            mirror_cdf[e] = _phi((-e * h - m) / sd)
        A[j] = 1.0 - edges_cdf[ngrid]
        for i in range(ngrid):
            # direct mass in cell i + mass reflected from [-(i+1)h, -ih]
            M[i, j] = (edges_cdf[i + 1] - edges_cdf[i]) + (mirror_cdf[i] - mirror_cdf[i + 1])


@njit(cache=True)
def loglik(step_breath, u, cross, v, delta, a, lam):
    ngrid = NGRID
    n = step_breath.shape[0]
    M = np.empty((ngrid, ngrid))
    A = np.empty(ngrid)
    p = np.zeros(ngrid)
    p[0] = 1.0
    tmp = np.empty(ngrid)
    cur_b = -2
    off_until = -1
    ll = 0.0
    for s in range(n):
        b = step_breath[s]
        if b < 0:
            p[:] = 0.0
            p[0] = 1.0
            continue
        if s < off_until:
            continue
        if b != cur_b:
            _build(M, A, v * u[b] - delta, lam, a, ngrid)
            cur_b = b
        absorbed = 0.0
        for j in range(ngrid):
            absorbed += A[j] * p[j]
        haz = absorbed + (1.0 - absorbed) * H0
        if cross[s]:
            ll += math.log(max(haz, 1e-300))
            p[:] = 0.0
            p[0] = 1.0
            off_until = s + 1 + TER_STEPS + REF_STEPS
        else:
            ll += math.log(max(1.0 - haz, 1e-300))
            tot = 0.0
            for i in range(ngrid):
                acc = 0.0
                for j in range(ngrid):
                    acc += M[i, j] * p[j]
                tmp[i] = acc
                tot += acc
            if tot < 1e-280:
                # (nearly) all mass absorbed — the log(1 - haz) term has already
                # charged for surviving; park the survivor just under the bound
                p[:] = 0.0
                p[ngrid - 1] = 1.0
            else:
                for i in range(ngrid):
                    p[i] = tmp[i] / tot
    return ll


# ── two-channel drive ───────────────────────────────────────────────────────
# Every observer is a special case of one accumulator driven by two evidence
# channels with their own gains:
#     drive_k = vL * uL_k + vT * uT_k        (uL = LEVEL evidence, uT = TRANSIENT)
# level: vT = 0; transient: vL = 0; mixed: both > 0; any of them with or without a leak.
# simulate()/loglik() take the drive as `u` with v = 1.
def channels(L, pause_before, base_log):
    return (evidence(L, pause_before, LEVEL, base_log, TAU_R),
            evidence(L, pause_before, TRANSIENT, base_log, TAU_R))


# ── Monte Carlo psychometrics (calibration, per-participant m50) ────────────
@njit(cache=True)
def mc_step(vL, vT, delta, a, lam, mag, n_trials, n_pre, n_post, base_s, seed):
    """Steps from a settled baseline. Returns (hit rate within n_post breaths, stable FA per minute).
    Direction alternates trial by trial (half faster, half slower)."""
    np.random.seed(seed)
    steps_per_breath = int(round(base_s / DT))
    base_log = math.log(base_s)
    n_b = n_pre + n_post
    L = np.empty(n_b)
    pb = np.zeros(n_b, np.bool_)
    hits = 0
    fas = 0
    sq = math.sqrt(DT)
    x0 = 0.5 * a / NGRID
    for t in range(n_trials):
        d = 1.0 if t % 2 == 0 else -1.0
        for k in range(n_b):
            per = base_log if k < n_pre else math.log(base_s * (1.0 + d * mag))
            L[k] = per + SIGMA_BREATH * np.random.randn()
        uL = evidence(L, pb, LEVEL, base_log, TAU_R)
        uT = evidence(L, pb, TRANSIENT, base_log, TAU_R)
        x = x0
        off_until = -1
        hit = False
        s = 0
        for k in range(n_b):
            nst = steps_per_breath if k < n_pre else int(round(base_s * (1.0 + d * mag) / DT))
            drv = vL * uL[k] + vT * uT[k]
            for _ in range(nst):
                if s >= off_until:
                    x += (drv - delta - lam * x) * DT + sq * np.random.randn()
                    if x < 0.0:
                        x = -x
                    if x >= a:
                        if k < n_pre:
                            fas += 1
                        else:
                            hit = True
                        x = x0
                        off_until = s + 1 + TER_STEPS + REF_STEPS
                s += 1
            if hit:
                break
        if hit:
            hits += 1
    pre_min = n_trials * n_pre * base_s / 60.0
    return hits / n_trials, fas / pre_min


def stable_evidence_mean(model, n=200_000, seed=3):
    """E[u] during steady pacing for one channel (LEVEL or TRANSIENT) — the noise floor."""
    rng = np.random.default_rng(seed)
    L = math.log(4.0) + SIGMA_BREATH * rng.standard_normal(n)
    pb = np.zeros(n, np.bool_)
    u = evidence(L, pb, model, math.log(4.0), TAU_R)
    return float(u[100:].mean())


def find_m50(vL, vT, delta, a, lam, base_s=4.0, n_post=5, n_trials=600, seed=1):
    """Step magnitude giving 50% hits within n_post breaths (bisection in log m)."""
    lo, hi = math.log(0.01), math.log(0.8)
    p_hi, _ = mc_step(vL, vT, delta, a, lam, 0.8, n_trials, 4, n_post, base_s, seed)
    if p_hi < 0.5:
        return 0.8
    for _ in range(14):
        mid = 0.5 * (lo + hi)
        p, _ = mc_step(vL, vT, delta, a, lam, math.exp(mid), n_trials, 4, n_post, base_s, seed)
        if p < 0.5:
            lo = mid
        else:
            hi = mid
    return math.exp(0.5 * (lo + hi))
