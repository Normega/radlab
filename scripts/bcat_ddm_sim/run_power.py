"""BCAT-DDM design-power simulation.

Every observer is one accumulator driven by two evidence channels (model.py):
total change from a running baseline (gain vL) and breath-to-breath change
(gain vT), with or without a leak. The generating observers and fitted models
are the special cases:

  level        vL          perfect        transient    vT        perfect
  leaky        vL          leak           mixed        vL + vT   perfect
                                          mixed_leaky  vL + vT   leak

For each design x generating observer, simulate N participants through a full
session, fit every model to every session by maximum likelihood, and report:

  * yield              changes, hits (steps vs ramps), false alarms per session
  * best overall model summed AIC across the group: does it pick the generator?
  * per-person model   share of participants whose lowest-AIC model is the generator
  * coding share       true vs recovered breath-to-breath share s (mixed observers)
  * leak / parameters  true vs recovered lambda, criterion, boundary

Usage (from the repo root):
  python scripts/bcat_ddm_sim/run_power.py --n 4 --quick --designs roving_mixed --out <dir>   # smoke
  python scripts/bcat_ddm_sim/run_power.py --out scripts/bcat_ddm_sim/results_round2           # round 2
  Round 1 (committed in results/) was --gens level,leaky,transient --fits level,leaky,transient
  --designs brief,roving,trials,ramp,roving_ramp on the round-1 version of this script.
"""
import argparse
import json
import math
import os
import subprocess
import sys
import time
from multiprocessing import Pool

import numpy as np
import pandas as pd
from scipy.optimize import minimize

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import model as M  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
BASE_S = 4.0

# name -> (schedule.js design, option overrides)
DESIGN_VARIANTS = {
    'brief':         ('brief', {}),
    'roving':        ('roving', {}),
    'trials':        ('trials', {}),
    'ramp':          ('ramp', {}),
    'roving_ramp':   ('roving_ramp', {}),
    'roving_ramp50': ('roving_ramp', {'rampFrac': 0.5}),
    'roving_mixed':  ('roving_mixed', {}),
    'double_blip':   ('double_blip', {}),
    'blip_train':    ('blip_train', {}),
    'blip_combo':    ('blip_combo', {}),
}
ROUND2_DESIGNS = ['roving_ramp', 'roving_ramp50', 'roving_mixed', 'ramp']
ROUND3_DESIGNS = ['roving_ramp', 'double_blip', 'blip_train', 'blip_combo']
# Blip sizes tuned so a single blip is usually missed (~20% small, ~45% large) by a typical observer
BLIP_OPTIONS = {'blipSizes': [0.5, 0.8], 'blipTrainRelMin': 0.4, 'blipTrainRelMax': 0.9}

# which channels / leak each observer or model has
SPECS = {
    'level':       {'L': True,  'T': False, 'leak': False},
    'leaky':       {'L': True,  'T': False, 'leak': True},
    'transient':   {'L': False, 'T': True,  'leak': False},
    'mixed':       {'L': True,  'T': True,  'leak': False},
    'mixed_leaky': {'L': True,  'T': True,  'leak': True},
    # Round 3: mixed observers that differ in how long they hold evidence. Study 1's
    # hit and false-alarm targets are met equally by a high boundary with a weak
    # criterion (long memory) or a low boundary with a strong one (short memory), so
    # memory span is a free dimension the task has to measure.
    'mem_short':      {'L': True, 'T': True, 'leak': False},
    'mem_medium':     {'L': True, 'T': True, 'leak': False},
    'mem_long':       {'L': True, 'T': True, 'leak': False},
    'mem_long_leaky': {'L': True, 'T': True, 'leak': True},
}
ALL = list(SPECS)
FIT_MODELS = ['level', 'leaky', 'transient', 'mixed', 'mixed_leaky']
CAL_ORDER = ['level', 'transient', 'leaky', 'mixed', 'mixed_leaky',
             'mem_short', 'mem_medium', 'mem_long', 'mem_long_leaky']   # mixed needs the pure gains first
# per-observer boundary and leak (defaults A0 / LAM0); lam_dist 'logu' draws each person's leak
# log-uniformly over LEAK_RANGE instead of around the population value
GEN_CFG = {
    'mem_short':      {'a0': 3.0},
    'mem_medium':     {'a0': 6.0},
    'mem_long':       {'a0': 10.0},
    'mem_long_leaky': {'a0': 10.0, 'lam0': 1 / 15, 'lam_dist': 'logu'},
}
LEAK_RANGE = (1 / 60, 1 / 5)          # leak time constants of 5-60 s
# the fitted model that matches each generating observer
TRUE_FIT = {'mem_short': 'mixed', 'mem_medium': 'mixed', 'mem_long': 'mixed', 'mem_long_leaky': 'mixed_leaky'}


def true_fit(g):
    return TRUE_FIT.get(g, g)


def memory_span(delta, a, lam, vL, vT, u0L, u0T):
    """Evidence half-life in seconds. With a leak, any accumulated evidence decays by a fixed
    fraction per second, so its half-life is ln 2 / lam. Without one, the criterion drains a fixed
    amount per second (c, beyond normal breathing noise), so half a full accumulator is gone after
    a / (2c); inf if c <= 0 (nothing drains)."""
    if lam > 1e-9:
        return math.log(2.0) / lam
    c = delta - vL * u0L - vT * u0T
    return a / (2 * c) if c > 0 else np.inf


# Population targets (Study 1-like: ~50% detection of a 20% step within 5
# breaths; a few false alarms per 10 min of stable pacing).
TARGET_M50 = 0.20
TARGET_FA_PER_MIN = 0.3
A0 = 3.0
LAM0 = 0.35            # 1/s for leaky observers (integration time constant ~3 s)
# Between-person spread. Overall gain k and criterion margin c (delta = drive
# noise floor + c) vary; mixed observers also vary in their breath-to-breath
# share s ~ Beta(2, 2).
SD_LOGK, SD_C, SD_LOGA, SD_LOGLAM = 0.30, 0.25, 0.15, 0.40
SHARE_BETA = (2.0, 2.0)
QUEST_ERR_SD = 0.25    # log-scale error of the pre-run's m50 estimate
LATE_S = 40.0          # presses this soon after a window closes count as "late", not false alarms
V_FLOOR = 0.01         # a channel gain at this floor is effectively off


# ── calibration ─────────────────────────────────────────────────────────────
def gains(pop, k, s):
    """Channel gains for overall gain k and breath-to-breath share s."""
    return k * (1.0 - s) * pop['refL'], k * s * pop['refT']


def calibrate(name, pops, n_trials=3000, seed=11):
    spec = SPECS[name]
    cfg = GEN_CFG.get(name, {})
    A0 = cfg.get('a0', globals()['A0'])
    lam = cfg.get('lam0', LAM0) if spec['leak'] else 0.0
    u0L = M.stable_evidence_mean(M.LEVEL)
    u0T = M.stable_evidence_mean(M.TRANSIENT)
    if spec['L'] and spec['T']:
        pop = {'s0': 0.5, 'refL': pops['level']['k'], 'refT': pops['transient']['k']}
    elif spec['T']:
        pop = {'s0': 1.0, 'refL': 1.0, 'refT': 1.0}
    else:
        pop = {'s0': 0.0, 'refL': 1.0, 'refT': 1.0}

    def floor(vL, vT):
        return vL * u0L + vT * u0T

    def c_for_fa(k):
        vL, vT = gains(pop, k, pop['s0'])
        lo, hi = -5.0, 15.0
        for _ in range(30):
            mid = 0.5 * (lo + hi)
            _, fa = M.mc_step(vL, vT, floor(vL, vT) + mid, A0, lam, TARGET_M50, n_trials // 3, 15, 1, BASE_S, seed)
            if fa > TARGET_FA_PER_MIN:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    def hit_at(k):
        c = c_for_fa(k)
        vL, vT = gains(pop, k, pop['s0'])
        h, _ = M.mc_step(vL, vT, floor(vL, vT) + c, A0, lam, TARGET_M50, n_trials, 4, 5, BASE_S, seed + 1)
        return h

    # The LOWEST gain that reaches the target. Hit rate at matched false alarms can
    # plateau at high gain (the observer becomes a deterministic threshold on noisy
    # evidence), so a plain bisection over a wide range can land anywhere on the
    # plateau. Scan upward for the first crossing, then bisect inside that bracket.
    grid = np.geomspace(0.05, 400.0, 28)
    prev = math.log(grid[0])
    lo = hi = None
    for kk in grid:
        if hit_at(kk) >= 0.5:
            lo, hi = prev, math.log(kk)
            break
        prev = math.log(kk)
    if lo is None:
        raise RuntimeError(f'{name}: no gain reaches 50% detection of a {TARGET_M50:.0%} step')
    for _ in range(12):
        mid = 0.5 * (lo + hi)
        if hit_at(math.exp(mid)) < 0.5:
            lo = mid
        else:
            hi = mid
    k = math.exp(0.5 * (lo + hi))
    c = c_for_fa(k)
    vL, vT = gains(pop, k, pop['s0'])
    d = floor(vL, vT) + c
    hit, _ = M.mc_step(vL, vT, d, A0, lam, TARGET_M50, n_trials, 4, 5, BASE_S, seed + 2)
    _, fa = M.mc_step(vL, vT, d, A0, lam, TARGET_M50, n_trials, 15, 1, BASE_S, seed + 3)
    pop.update({'lam_dist': cfg.get('lam_dist', 'lognormal')})
    pop.update({'model': name, 'k': k, 'c': c, 'vL': vL, 'vT': vT, 'delta': d, 'a': A0, 'lam': lam,
                'u0L': u0L, 'u0T': u0T, 'check_hit_at_m50': hit, 'check_fa_per_min': fa})
    return pop


# ── participants ────────────────────────────────────────────────────────────
def sample_participant(pop, rng):
    if 0.0 < pop['s0'] < 1.0:
        s = float(rng.beta(*SHARE_BETA))
    else:
        s = pop['s0']
    k = pop['k'] * math.exp(SD_LOGK * rng.standard_normal())
    c = pop['c'] + SD_C * abs(pop['c']) * rng.standard_normal()
    vL, vT = gains(pop, k, s)
    return {
        's': s, 'k': k, 'c': c, 'vL': vL, 'vT': vT,
        'delta': vL * pop['u0L'] + vT * pop['u0T'] + c,
        'a': pop['a'] * math.exp(SD_LOGA * rng.standard_normal()),
        'lam': (math.exp(rng.uniform(math.log(LEAK_RANGE[0]), math.log(LEAK_RANGE[1])))
                if pop.get('lam_dist') == 'logu' else
                pop['lam'] * math.exp(SD_LOGLAM * rng.standard_normal())) if pop['lam'] > 0 else 0.0,
    }


FA_SD_LOG = 0.4   # between-person spread of the false-alarm rate for per-person criteria


def _criterion_job(args):
    """Criterion that gives this person their own false-alarm rate. Used for observers whose leak
    is drawn per person: with a leak, one shared criterion would leave weak-leak people drifting
    into constant false alarms and strong-leak people never responding."""
    p, fa_target, seed = args
    lo, hi = -5.0, 15.0
    for _ in range(26):
        mid = 0.5 * (lo + hi)
        _, fa = M.mc_step(p['vL'], p['vT'], mid, p['a'], p['lam'], TARGET_M50, 400, 15, 1, BASE_S, seed)
        if fa > fa_target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def _m50_job(args):
    p, seed = args
    return M.find_m50(p['vL'], p['vT'], p['delta'], p['a'], p['lam'], BASE_S, 5, 600, seed)


# ── scoring ─────────────────────────────────────────────────────────────────
def score(schedule, cross, breath_start_s, step_breath):
    """Classify presses against the schedule's events. Press time = crossing + TER."""
    press_steps = np.flatnonzero(cross)
    press_t = press_steps * M.DT + M.TER
    events = sorted(schedule['events'], key=lambda e: e['onsetMs'])
    used = set()
    out = {'n_step': 0, 'n_ramp': 0, 'n_null': 0, 'n_return': 0, 'n_blip_single': 0, 'n_blip_pair': 0, 'n_blip': 0,
           'hit_step': 0, 'hit_ramp': 0, 'hit_blip_single': 0, 'hit_blip_pair': 0, 'hit_blip': 0,
           'null_fa': 0, 'return_press': 0, 'late': 0, 'stable_fa': 0, 'extra': 0}
    rts_breaths = []
    ramp_mag_at_detect = []
    pair_n, pair_hit = {}, {}
    for e in events:
        out['n_' + e['type']] += 1
        if e['type'] == 'blip_pair':
            key = f"g{e['gap']}_s{e['sizeIdx']}"
            pair_n[key] = pair_n.get(key, 0) + 1
            pair_hit.setdefault(key, 0)
    for t, s in zip(press_t, press_steps):
        hit_event = None
        for e in events:
            if e['onsetMs'] / 1000.0 <= t <= e['windowEndMs'] / 1000.0 + M.TER:
                hit_event = e
                break
        if hit_event is None:
            since = [t - e['windowEndMs'] / 1000.0 for e in events if e['windowEndMs'] / 1000.0 <= t]
            if since and min(since) <= LATE_S:
                out['late'] += 1
            else:
                out['stable_fa'] += 1
            continue
        typ = hit_event['type']
        if typ in ('step', 'ramp', 'blip_single', 'blip_pair', 'blip'):
            if hit_event['id'] in used:
                out['extra'] += 1
                continue
            used.add(hit_event['id'])
            out['hit_' + typ] += 1
            if typ == 'blip_pair':
                pair_hit[f"g{hit_event['gap']}_s{hit_event['sizeIdx']}"] += 1
            b = step_breath[min(s, len(step_breath) - 1)]
            if b >= 0:
                frac = (s * M.DT - breath_start_s[b]) / (schedule['breaths'][b]['periodMs'] / 1000.0)
                rts_breaths.append(b - hit_event['onsetBreath'] + frac)
                if typ == 'ramp' and 'fromPeriodMs' in hit_event:
                    ramp_mag_at_detect.append(abs(schedule['breaths'][b]['periodMs'] / hit_event['fromPeriodMs'] - 1))
        elif typ == 'null':
            out['null_fa'] += 1
        elif typ == 'return':
            out['return_press'] += 1
    # settled time = not paused, not inside an event window, not within LATE_S after one
    n_steps = len(step_breath)
    unsettled = step_breath < 0
    for e in events:
        s0 = int(e['onsetMs'] / 1000.0 / M.DT)
        s1 = int((e['windowEndMs'] / 1000.0 + LATE_S) / M.DT)
        unsettled[s0:min(s1, n_steps)] = True
    stable_min = max(1e-9, (~unsettled).sum() * M.DT / 60.0)
    n_change = out['n_step'] + out['n_ramp']
    out.update({
        'n_change': n_change,
        'hit': out['hit_step'] + out['hit_ramp'],
        'hit_rate': (out['hit_step'] + out['hit_ramp']) / n_change if n_change else np.nan,
        'hit_rate_step': out['hit_step'] / out['n_step'] if out['n_step'] else np.nan,
        'hit_rate_ramp': out['hit_ramp'] / out['n_ramp'] if out['n_ramp'] else np.nan,
        'hit_rate_blip_single': out['hit_blip_single'] / out['n_blip_single'] if out['n_blip_single'] else np.nan,
        'hit_rate_blip_pair': out['hit_blip_pair'] / out['n_blip_pair'] if out['n_blip_pair'] else np.nan,
        'stable_fa_per_min': out['stable_fa'] / stable_min,
        'settled_min': stable_min,
        'median_rt_breaths': float(np.median(rts_breaths)) if rts_breaths else np.nan,
        'median_ramp_mag_at_detect': float(np.median(ramp_mag_at_detect)) if ramp_mag_at_detect else np.nan,
        'n_presses': int(len(press_steps)),
    })
    for key, n in pair_n.items():
        out[f'pairn_{key}'] = n
        out[f'pairhit_{key}'] = pair_hit[key]
    return out


# ── fitting ─────────────────────────────────────────────────────────────────
def param_names(name):
    sp = SPECS[name]
    return (['vL'] if sp['L'] else []) + (['vT'] if sp['T'] else []) + ['delta', 'a'] + (['lam'] if sp['leak'] else [])


LOG_PARAMS = {'vL', 'vT', 'a', 'lam'}
BOUNDS = {'vL': (math.log(V_FLOOR), math.log(400.0)), 'vT': (math.log(V_FLOOR), math.log(400.0)),
          'delta': (-5.0, 30.0), 'a': (math.log(0.5), math.log(15.0)), 'lam': (math.log(0.005), math.log(5.0))}


def to_theta(name, p):
    return [math.log(p[k]) if k in LOG_PARAMS else p[k] for k in param_names(name)]


def from_theta(name, th):
    p = {'vL': 0.0, 'vT': 0.0, 'lam': 0.0}
    for k, x in zip(param_names(name), th):
        p[k] = math.exp(x) if k in LOG_PARAMS else x
    return p


def fit(name, step_breath, uL, uT, cross, starts):
    names = param_names(name)
    bounds = [BOUNDS[k] for k in names]

    def nll(th):
        p = from_theta(name, th)
        drive = p['vL'] * uL + p['vT'] * uT
        return -M.loglik(step_breath, drive, cross, 1.0, p['delta'], p['a'], p['lam'])

    best = None
    for st in starts:
        x0 = np.clip(np.array(to_theta(name, st)), [b[0] for b in bounds], [b[1] for b in bounds])
        r = minimize(nll, x0, method='L-BFGS-B', bounds=bounds, options={'eps': 1e-4, 'maxiter': 300})
        if best is None or r.fun < best.fun:
            best = r
    p = from_theta(name, best.x)
    k = len(names)
    return {**p, 'nll': float(best.fun), 'k': k, 'aic': 2 * k + 2 * float(best.fun),
            'converged': bool(best.success), 'nfev': int(best.nfev)}


def fit_all(fits_wanted, step_breath, uL, uT, cross, pops):
    """Fit every requested model. Nested models are seeded from their sub-models' optima,
    so a richer model can never fit worse than a model it contains."""
    out = {}
    tiny = 2 * V_FLOOR

    def pop_start(name):
        p = pops[name]
        return {'vL': max(p['vL'], tiny), 'vT': max(p['vT'], tiny), 'delta': p['delta'], 'a': p['a'],
                'lam': max(p['lam'], LAM0)}

    def half(st):
        return {**st, 'vL': st['vL'] * 0.5, 'vT': st['vT'] * 0.5, 'delta': st['delta'] * 0.5}

    order = [n for n in ['level', 'transient', 'leaky', 'mixed', 'mixed_leaky'] if n in fits_wanted]
    for name in order:
        starts = []
        if name in ('level', 'transient'):
            starts = [pop_start(name), half(pop_start(name))]
        elif name == 'leaky':
            starts = [pop_start(name)]
            if 'level' in out:
                starts.append({**out['level'], 'lam': 0.006})
                starts.append({**out['level'], 'lam': LAM0})
        elif name == 'mixed':
            if 'level' in out:
                starts.append({**out['level'], 'vT': tiny})
            if 'transient' in out:
                starts.append({**out['transient'], 'vL': tiny})
            if not starts:
                starts = [pop_start(name)]
        elif name == 'mixed_leaky':
            if 'mixed' in out:
                starts.append({**out['mixed'], 'lam': 0.006})
                starts.append({**out['mixed'], 'lam': 0.06})
                starts.append({**out['mixed'], 'lam': LAM0})
            if 'leaky' in out:
                starts.append({**out['leaky'], 'vT': tiny})
            if not starts:
                starts = [pop_start(name)]
        t0 = time.time()
        out[name] = {**fit(name, step_breath, uL, uT, cross, starts), 'secs': time.time() - t0}
    return out


def share_hat(f, pops):
    """Recovered breath-to-breath share, on the same scale the generator used."""
    ref = pops['mixed']
    a = f['vT'] / ref['refT']
    b = f['vL'] / ref['refL']
    return a / (a + b) if a + b > 0 else np.nan


# ── one dataset ─────────────────────────────────────────────────────────────
_SCHEDULES = None
_POPS = None


def _init_worker(sched_path, pops):
    global _SCHEDULES, _POPS
    with open(sched_path) as f:
        _SCHEDULES = json.load(f)
    _POPS = pops


KERNEL_LAGS = 12


def blip_kernel(schedule, cross, step_breath):
    """Press-triggered blip history in blip-train stretches: for each press, which of the
    preceding KERNEL_LAGS breaths were train blips (lag 0 = the breath the crossing fell in)."""
    tags = [b['tag'] for b in schedule['breaths']]
    counts = np.zeros(KERNEL_LAGS + 1)
    n = 0
    for st in np.flatnonzero(cross):
        b = step_breath[min(st, len(step_breath) - 1)]
        if b < KERNEL_LAGS or not any(t == 'tblip' for t in tags[b - KERNEL_LAGS:b + 1]):
            continue
        # only presses inside the train block (a train blip within the last 30 breaths)
        if not any(t == 'tblip' for t in tags[max(0, b - 30):b + 1]):
            continue
        n += 1
        for lag in range(KERNEL_LAGS + 1):
            counts[lag] += tags[b - lag] == 'tblip'
    in_train = [i for i, t in enumerate(tags) if t in ('tblip',)]
    base = len(in_train) / max(1, sum(1 for i, t in enumerate(tags) if t in ('tblip', 'stable', 'reentrain')
                                      and any(tt == 'tblip' for tt in tags[max(0, i - 30):i + 30])))
    return n, counts, base


def run_dataset(job):
    gen, pid, design, truth, seed = job['gen'], job['pid'], job['design'], job['truth'], job['seed']
    sched = _SCHEDULES[job['key']]
    step_breath, pause_before, log_paced, breath_start_s = M.timeline(sched)
    rng = np.random.default_rng(seed)
    L_true = log_paced + M.SIGMA_BREATH * rng.standard_normal(len(log_paced))
    L_obs = L_true + job['sigma_meas'] * rng.standard_normal(len(log_paced))
    base_log = math.log(BASE_S)

    uL, uT = M.channels(L_true, pause_before, base_log)
    drive = truth['vL'] * uL + truth['vT'] * uT
    cross = M.simulate(step_breath, drive, 1.0, truth['delta'], truth['a'], truth['lam'], seed % (2**31))
    sc = score(sched, cross, breath_start_s, step_breath)

    row = {'gen': gen, 'pid': pid, 'design': design, 'm50': job['m50'], 'm50_hat': job['m50_hat'],
           **{f'true_{k}': v for k, v in truth.items()}, **sc}
    pop = _POPS[gen]
    row['true_memory'] = memory_span(truth['delta'], truth['a'], truth['lam'], truth['vL'], truth['vT'],
                                     pop['u0L'], pop['u0T'])
    kn, kc, kbase = blip_kernel(sched, cross, step_breath)
    row['kernel_n'] = kn
    row['kernel_base'] = kbase
    for lag in range(KERNEL_LAGS + 1):
        row[f'kernel_{lag}'] = kc[lag]
    uL_o, uT_o = M.channels(L_obs, pause_before, base_log)
    fits = fit_all(job['fits'], step_breath, uL_o, uT_o, cross, _POPS)
    u0L, u0T = _POPS['mixed']['u0L'], _POPS['mixed']['u0T']
    fit_rows = [{'gen': gen, 'pid': pid, 'design': design, 'fit': name, 's_hat': share_hat(f, _POPS),
                 'memory_hat': memory_span(f['delta'], f['a'], f['lam'], f['vL'], f['vT'], u0L, u0T), **f}
                for name, f in fits.items()]
    return row, fit_rows


# ── summary ─────────────────────────────────────────────────────────────────
def md(df):
    """DataFrame/Series -> GitHub markdown table (no tabulate dependency)."""
    if isinstance(df, pd.Series):
        df = df.to_frame()
    df = df.reset_index()
    fmt = lambda x: '' if (isinstance(x, float) and np.isnan(x)) else (f'{x:.2f}' if isinstance(x, float) else str(x))
    head = '| ' + ' | '.join(str(c) for c in df.columns) + ' |'
    sep = '|' + '---|' * len(df.columns)
    body = ['| ' + ' | '.join(fmt(x) for x in r) + ' |' for r in df.itertuples(index=False)]
    return '\n'.join([head, sep] + body)


def _r(x, y):
    """Spearman rank correlation (from round 3). About 10% of fits collapse to a degenerate
    'presses are random' solution (criterion and boundary at their bounds), and one such point
    can swing a Pearson r from .8 to below zero. The round 1-2 summaries used Pearson."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    ok = np.isfinite(x) & np.isfinite(y)
    if ok.sum() < 3 or np.std(x[ok]) == 0 or np.std(y[ok]) == 0:
        return np.nan
    rx = pd.Series(x[ok]).rank().to_numpy()
    ry = pd.Series(y[ok]).rank().to_numpy()
    return float(np.corrcoef(rx, ry)[0, 1])


def summarize(datasets, fits, out_dir, meta):
    designs = [d for d in DESIGN_VARIANTS if d in set(datasets['design'])]
    gens = [g for g in ALL if g in set(datasets['gen'])]
    fitted = [f for f in FIT_MODELS if f in set(fits['fit'])]
    L = ['# BCAT-DDM design-power simulation — results', '',
         f"Generated {time.strftime('%Y-%m-%d %H:%M')} by `scripts/bcat_ddm_sim/run_power.py`. "
         f"N = {meta['n']} simulated participants per design × generating observer; "
         f"{meta['minutes']} min of task time per session; base breath {BASE_S:.0f} s; "
         f"belt measurement error {meta['sigma_meas']} (log period). Fitted models: {', '.join(fitted)}.", '']

    L += ['## 1. Yield per session (mean over participants and observers)', '']
    cols = ['n_step', 'n_ramp', 'n_null', 'n_blip_single', 'n_blip_pair', 'n_blip', 'hit', 'hit_rate_step',
            'hit_rate_ramp', 'hit_rate_blip_single', 'hit_rate_blip_pair', 'late', 'stable_fa_per_min',
            'median_rt_breaths']
    cols = [c for c in cols if c in datasets and datasets[c].notna().any() and (datasets[c] != 0).any()]
    L += [md(datasets.groupby('design')[cols].mean().reindex(designs)), '']
    for col, label in (('hit_rate_ramp', 'Ramp hit rate'), ('hit_rate_blip_single', 'Single-blip hit rate'),
                       ('hit_rate_blip_pair', 'Blip-pair hit rate')):
        if col in datasets and datasets[col].notna().any():
            piv_hr = datasets.pivot_table(index='design', columns='gen', values=col)
            L += [f'{label} by observer:', '', md(piv_hr.reindex([d for d in designs if d in piv_hr.index])
                                                   [[g for g in gens if g in piv_hr.columns]]), '']
    pair_cols = sorted(c for c in datasets.columns if c.startswith('pairn_'))
    if pair_cols:
        gaps = sorted({int(c.split('_')[1][1:]) for c in pair_cols})
        rows = []
        for (d, g), q in datasets.groupby(['design', 'gen']):
            for size in (0, 1):
                r = {'design': d, 'gen': g, 'size': 'small' if size == 0 else 'large'}
                for gap in gaps:
                    nc, hc = f'pairn_g{gap}_s{size}', f'pairhit_g{gap}_s{size}'
                    if nc in q and q[nc].sum() > 0:
                        r[f'gap{gap}'] = float(q[hc].sum() / q[nc].sum())
                if len(r) > 3:
                    rows.append(r)
        if rows:
            L += ['Blip-pair hit rate by gap (normal breaths between the blips) and blip size, by observer. '
                  'The double-blip signature: does detection fall with the gap, and differently by size?', '',
                  md(pd.DataFrame(rows).set_index(['design', 'gen', 'size'])), '']

    piv = fits.pivot_table(index=['design', 'gen', 'pid'], columns='fit', values='aic')[fitted]

    L += ['## 2. Best overall model (summed AIC over the group)', '',
          'Winner and its margin over the runner-up (ΔAIC). ✓ = the generating model wins.', '']
    rows = []
    for (d, g), grp in piv.groupby(level=['design', 'gen']):
        tot = grp.sum().sort_values()
        tf = true_fit(g)
        rows.append({'design': d, 'gen': g, 'winner': tot.index[0] + (' ✓' if tot.index[0] == tf else ''),
                     'margin': float(tot.iloc[1] - tot.iloc[0]),
                     'gen_minus_best': float(tot[tf] - tot.iloc[0]) if tf in tot else np.nan})
    best = pd.DataFrame(rows).set_index(['design', 'gen'])
    L += [md(best.reindex(pd.MultiIndex.from_product([designs, gens]))), '']

    L += ['## 3. Per-person model choice (lowest AIC)', '',
          'Share of participants whose lowest-AIC model is each fitted model; the diagonal is correct recovery.', '']
    rows = []
    for (d, g), grp in piv.groupby(level=['design', 'gen']):
        picked = grp.idxmin(axis=1).value_counts(normalize=True)
        rows.append({'design': d, 'gen': g, **{f: float(picked.get(f, 0.0)) for f in fitted}})
    per = pd.DataFrame(rows).set_index(['design', 'gen'])
    L += [md(per.reindex(pd.MultiIndex.from_product([designs, gens]))), '']
    acc = {d: np.mean([per.loc[(d, g), true_fit(g)] for g in gens
                       if (d, g) in per.index and true_fit(g) in per.columns]) for d in designs}
    L += ['Mean per-person recovery by design: ' + ', '.join(f'{d} {acc[d]:.2f}' for d in designs), '']

    extra = ['true_memory'] if 'true_memory' in datasets else []
    m = fits.merge(datasets[['gen', 'pid', 'design', 'true_s', 'true_lam', 'true_delta', 'true_a', 'true_k'] + extra],
                   on=['gen', 'pid', 'design'])
    mixed_gens = [g for g in gens if SPECS[g]['L'] and SPECS[g]['T']]
    if {'mixed'} <= set(fitted) and mixed_gens:
        L += ['## 4. Individual differences: breath-to-breath share s', '',
              'r(true s, recovered s) across participants, and median |error|, using the mixed fit and the '
              'mixed_leaky fit. Pooled row adds the pure observers (s = 0 level/leaky, 1 transient).', '']
        rows = []
        for d in designs:
            for g in mixed_gens + ['pooled']:
                sel = m[(m.design == d) & ((m.gen == g) if g != 'pooled' else True)]
                r = {'design': d, 'gen': g}
                for f in ('mixed', 'mixed_leaky'):
                    q = sel[sel.fit == f]
                    if len(q):
                        r[f'r_s_{f}'] = _r(q.true_s, q.s_hat)
                        r[f'mae_s_{f}'] = float(np.nanmedian(np.abs(q.true_s - q.s_hat)))
                rows.append(r)
        L += [md(pd.DataFrame(rows).set_index(['design', 'gen'])), '']

    L += ['## 5. Leak and decision parameters (fit = generating model)', '',
          'r(true, fitted) for λ, criterion δ and boundary a (log scale for λ, a); '
          '`lam_floor` = share of true leaks estimated at the floor.', '']
    rows = []
    for d in designs:
        for g in gens:
            q = m[(m.design == d) & (m.gen == g) & (m.fit == true_fit(g))]
            if not len(q):
                continue
            r = {'design': d, 'gen': g, 'r_delta': _r(q.true_delta, q.delta), 'r_a': _r(np.log(q.true_a), np.log(q.a))}
            if SPECS[g]['leak']:
                r['r_lam'] = _r(np.log(q.true_lam), np.log(q.lam))
                r['lam_floor'] = float((q.lam < 0.01).mean())
            rows.append(r)
    L += [md(pd.DataFrame(rows).set_index(['design', 'gen'])), '']

    if extra:
        L += ['## 6. Memory span: how long accumulated evidence lasts', '',
              'Evidence half-life in seconds: ln 2 / λ with a leak, a / 2c (criterion drain) without. '
              ' r = correlation of log true vs log recovered span, using the '
              'fit that matches the generator and the leaky fit; `median_true` / `median_hat` in seconds.', '']
        rows = []
        for d in designs:
            for g in gens:
                q = m[(m.design == d) & (m.gen == g)]
                if not len(q):
                    continue
                r = {'design': d, 'gen': g, 'median_true': float(np.median(q.true_memory))}
                for f in ('mixed', 'mixed_leaky'):
                    qq = q[q.fit == f]
                    ok = np.isfinite(qq.memory_hat) & np.isfinite(qq.true_memory)
                    r[f'r_{f}'] = _r(np.log(qq.true_memory[ok]), np.log(qq.memory_hat[ok]))
                    r[f'median_hat_{f}'] = float(np.median(qq.memory_hat[ok])) if ok.any() else np.nan
                rows.append(r)
        L += [md(pd.DataFrame(rows).set_index(['design', 'gen'])), '']

    if 'kernel_n' in datasets and datasets['kernel_n'].sum() > 0:
        L += ['## 7. Blip-train kernel (press-triggered blip history)', '',
              'P(train blip at each lag before a press) ÷ base blip rate, pooled over participants. '
              'Lag 0 = the breath the crossing fell in. A kernel that stays above 1 for many lags means '
              'evidence is held a long time.', '']
        rows = []
        for (d, g), q in datasets[datasets.kernel_n > 0].groupby(['design', 'gen']):
            n = q.kernel_n.sum()
            base = np.average(q.kernel_base, weights=q.kernel_n)
            r = {'design': d, 'gen': g, 'presses': int(n)}
            for lag in range(0, KERNEL_LAGS + 1, 2):
                r[f'lag{lag}'] = float(q[f'kernel_{lag}'].sum() / n / base) if base > 0 else np.nan
            rows.append(r)
        L += [md(pd.DataFrame(rows).set_index(['design', 'gen'])), '']

    deg = fits.assign(degenerate=(fits.a > 14.9) | (fits.delta > 29.9)).groupby('design').degenerate.mean()
    L += ['## 8. Degenerate fits', '',
          'Share of fits (all models) that collapsed to the bounds (a = 15 or δ = 30: presses treated as '
          'random). Correlations in this summary are Spearman rank correlations so these do not dominate.', '',
          md(deg.reindex(designs)), '']

    text = '\n'.join(L) + '\n'
    with open(os.path.join(out_dir, 'summary.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    return text


# ── main ────────────────────────────────────────────────────────────────────
def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=30, help='participants per design x generating observer')
    ap.add_argument('--minutes', type=float, default=40)
    ap.add_argument('--designs', default=','.join(ROUND2_DESIGNS))
    ap.add_argument('--gens', default=','.join(ALL))
    ap.add_argument('--fits', default=','.join(FIT_MODELS))
    ap.add_argument('--workers', type=int, default=max(1, (os.cpu_count() or 2) - 2))
    ap.add_argument('--out', default=os.path.join(HERE, 'results_round2'))
    ap.add_argument('--seed', type=int, default=20261005)
    ap.add_argument('--quick', action='store_true', help='smaller calibration (smoke test)')
    ap.add_argument('--resume', action='store_true', help='skip sessions already complete in <out>/fits.csv')
    ap.add_argument('--sigma-meas', type=float, default=M.SIGMA_MEAS,
                    help='belt measurement error on log breath period (analyst side)')
    args = ap.parse_args()
    designs, gens, fits_wanted = args.designs.split(','), args.gens.split(','), args.fits.split(',')
    os.makedirs(args.out, exist_ok=True)

    # 1. calibrate population means (pure observers first: mixed ones are built from their gains)
    cal_path = os.path.join(args.out, 'calibration.json')
    pops = {}
    if os.path.exists(cal_path):
        with open(cal_path) as f:
            pops = json.load(f)
        print('calibration: reused', ', '.join(pops), flush=True)
    need = [n for n in CAL_ORDER if n not in pops and (n in gens or n in fits_wanted or n in ('level', 'transient', 'mixed'))]
    if need:
        t0 = time.time()
        for name in need:
            pops[name] = calibrate(name, pops, n_trials=900 if args.quick else 3000)
            print('calibrated', {k: (round(v, 3) if isinstance(v, float) else v) for k, v in pops[name].items()}, flush=True)
        with open(cal_path, 'w', newline='\n') as f:
            json.dump(pops, f, indent=2)
        print(f'calibration {time.time() - t0:.0f}s', flush=True)

    # 2. participants + their true m50 (one set per observer, shared across designs: paired comparisons)
    rng = np.random.default_rng(args.seed)
    people = []
    for g in gens:
        for pid in range(args.n):
            people.append({'gen': g, 'pid': pid, 'truth': sample_participant(pops[g], rng),
                           'seed': int(rng.integers(1, 2**31 - 1))})
    per_person = [p for p in people if pops[p['gen']].get('lam_dist') == 'logu']
    if per_person:
        targets = [TARGET_FA_PER_MIN * math.exp(FA_SD_LOG * rng.standard_normal()) for _ in per_person]
        with Pool(args.workers) as pool:
            deltas = pool.map(_criterion_job, [(p['truth'], fa, p['seed']) for p, fa in zip(per_person, targets)])
        for p, d in zip(per_person, deltas):
            pop = pops[p['gen']]
            p['truth']['delta'] = d
            p['truth']['c'] = d - p['truth']['vL'] * pop['u0L'] - p['truth']['vT'] * pop['u0T']
        print(f'per-person criteria set for {len(per_person)} leaky observers', flush=True)
    with Pool(args.workers) as pool:
        m50s = pool.map(_m50_job, [(p['truth'], p['seed']) for p in people])
    for p, m50 in zip(people, m50s):
        p['m50'] = m50
        p['m50_hat'] = float(np.clip(m50 * math.exp(QUEST_ERR_SD * rng.standard_normal()), 0.04, 0.6))

    # 3. schedules via the task's own generator
    specs, jobs = [], []
    for p in people:
        for di, dname in enumerate(designs):
            base_design, overrides = DESIGN_VARIANTS[dname]
            key = f"{p['gen']}_{p['pid']}_{dname}"
            specs.append({'key': key, 'design': base_design,
                          'options': {**BLIP_OPTIONS, **overrides, 'm50Hat': p['m50_hat'], 'seed': p['seed'] % 1_000_000 + di,
                                      'minutes': args.minutes}})
            jobs.append({'key': key, 'gen': p['gen'], 'pid': p['pid'], 'design': dname, 'truth': p['truth'],
                         'm50': p['m50'], 'm50_hat': p['m50_hat'], 'seed': p['seed'] + 7919 * di,
                         'sigma_meas': args.sigma_meas, 'fits': fits_wanted})
    spec_path = os.path.join(args.out, 'schedule_spec.json')
    sched_path = os.path.join(args.out, 'schedules.json')
    with open(spec_path, 'w', newline='\n') as f:
        json.dump(specs, f)
    subprocess.run(['node', os.path.join(HERE, 'make_schedules.mjs'), spec_path, sched_path], check=True, cwd=REPO)

    # 4. simulate + fit. Partial CSVs are rewritten as results arrive, and --resume skips
    #    sessions already complete in them, so an interrupted run restarts where it stopped
    #    (participants, seeds and schedules are deterministic given --seed).
    t0 = time.time()
    rows, fit_rows = [], []
    ds_path, fit_path = os.path.join(args.out, 'datasets.csv'), os.path.join(args.out, 'fits.csv')
    if args.resume and os.path.exists(ds_path) and os.path.exists(fit_path):
        prev_ds, prev_fits = pd.read_csv(ds_path), pd.read_csv(fit_path)
        n_fit = prev_fits.groupby(['gen', 'pid', 'design']).size()
        done = {key for key, v in n_fit.items() if v == len(fits_wanted)}
        keep = lambda df: df[[(g, p, d) in done for g, p, d in zip(df.gen, df.pid, df.design)]]
        rows, fit_rows = keep(prev_ds).to_dict('records'), keep(prev_fits).to_dict('records')
        jobs = [j for j in jobs if (j['gen'], j['pid'], j['design']) not in done]
        print(f'resume: {len(done)} sessions already done, {len(jobs)} to go', flush=True)
    with Pool(args.workers, initializer=_init_worker, initargs=(sched_path, pops)) as pool:
        for i, (row, fr) in enumerate(pool.imap_unordered(run_dataset, jobs, chunksize=1)):
            rows.append(row)
            fit_rows.extend(fr)
            if (i + 1) % 5 == 0 or i + 1 == len(jobs):
                print(f'{i + 1}/{len(jobs)} datasets  {time.time() - t0:.0f}s', flush=True)
                pd.DataFrame(rows).to_csv(ds_path, index=False, lineterminator='\n')
                pd.DataFrame(fit_rows).to_csv(fit_path, index=False, lineterminator='\n')
    datasets, fits = pd.DataFrame(rows), pd.DataFrame(fit_rows)
    os.remove(sched_path)   # large and fully reproducible from schedule_spec.json
    print(summarize(datasets, fits, args.out, {'n': args.n, 'minutes': args.minutes, 'sigma_meas': args.sigma_meas}))


if __name__ == '__main__':
    main()
