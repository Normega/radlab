"""BCAT-DDM design-power simulation.

For each candidate design (src/games/BcatDdm/schedule.js) x generating model
(level / leaky / transient), simulate N participants through a full session,
then fit all three models to every dataset by maximum likelihood. Reports:

  * yield        — changes, hits, false alarms per session
  * recovery     — true vs fitted parameters (fit model = generating model)
  * model recovery — how often AIC picks the generating model, per participant
                     and summed over the group

Usage (from the repo root):
  python scripts/bcat_ddm_sim/run_power.py                 # full run
  python scripts/bcat_ddm_sim/run_power.py --n 4 --quick   # smoke test
Outputs land in scripts/bcat_ddm_sim/results/ (or --out).
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
DESIGNS = ['brief', 'roving', 'trials', 'ramp', 'roving_ramp']
GEN_MODELS = [M.LEVEL, M.LEAKY, M.TRANSIENT]
BASE_S = 4.0

# Population targets (Study 1-like: ~50% detection of a 20% step within 5
# breaths; a few false alarms per 10 min of stable pacing).
TARGET_M50 = 0.20
TARGET_FA_PER_MIN = 0.3
A0 = 3.0
LAM0 = 0.35            # leaky model, 1/s (integration time constant ~3 s)
# Between-person spread. The criterion is drawn as a margin c above the person's
# own noise floor (delta = v * E[u_stable] + c), not independently of v: an
# independent delta gives high-v people runaway false-alarm rates, which no
# real participant who kept doing the task would show.
SD_LOGV, SD_C, SD_LOGA, SD_LOGLAM = 0.30, 0.25, 0.15, 0.40
QUEST_ERR_SD = 0.25    # log-scale error of the pre-run's m50 estimate
LATE_S = 40.0          # presses this soon after a window closes count as "late", not false alarms


# ── calibration ─────────────────────────────────────────────────────────────
def calibrate(model, n_trials=3000, seed=11):
    lam = LAM0 if model == M.LEAKY else 0.0
    u0 = M.stable_evidence_mean(model)

    def c_for_fa(v):
        lo, hi = -5.0, 15.0
        for _ in range(30):
            mid = 0.5 * (lo + hi)
            _, fa = M.mc_step(model, v, v * u0 + mid, A0, lam, TARGET_M50, n_trials // 3, 15, 1, BASE_S, seed)
            if fa > TARGET_FA_PER_MIN:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    lo, hi = math.log(0.5), math.log(200.0)
    for _ in range(22):
        mid = 0.5 * (lo + hi)
        v = math.exp(mid)
        c = c_for_fa(v)
        hit, _ = M.mc_step(model, v, v * u0 + c, A0, lam, TARGET_M50, n_trials, 4, 5, BASE_S, seed + 1)
        if hit < 0.5:
            lo = mid
        else:
            hi = mid
    v = math.exp(0.5 * (lo + hi))
    c = c_for_fa(v)
    d = v * u0 + c
    hit, _ = M.mc_step(model, v, d, A0, lam, TARGET_M50, n_trials, 4, 5, BASE_S, seed + 2)
    _, fa = M.mc_step(model, v, d, A0, lam, TARGET_M50, n_trials, 15, 1, BASE_S, seed + 3)
    return {'model': M.MODEL_NAMES[model], 'v': v, 'delta': d, 'c': c, 'u0': u0, 'a': A0, 'lam': lam,
            'check_hit_at_m50': hit, 'check_fa_per_min': fa}


# ── participants ────────────────────────────────────────────────────────────
def sample_participant(pop, rng):
    v = pop['v'] * math.exp(SD_LOGV * rng.standard_normal())
    c = pop['c'] + SD_C * abs(pop['c']) * rng.standard_normal()
    return {
        'v': v,
        'delta': v * pop['u0'] + c,
        'c': c,
        'a': pop['a'] * math.exp(SD_LOGA * rng.standard_normal()),
        'lam': pop['lam'] * math.exp(SD_LOGLAM * rng.standard_normal()) if pop['lam'] > 0 else 0.0,
    }


def _m50_job(args):
    model, p, seed = args
    return M.find_m50(model, p['v'], p['delta'], p['a'], p['lam'], BASE_S, 5, 600, seed)


# ── scoring ─────────────────────────────────────────────────────────────────
def score(schedule, cross, breath_start_s, step_breath):
    """Classify presses against the schedule's events. Press time = crossing + TER."""
    press_steps = np.flatnonzero(cross)
    press_t = press_steps * M.DT + M.TER
    events = sorted(schedule['events'], key=lambda e: e['onsetMs'])
    used = set()
    out = {'n_step': 0, 'n_ramp': 0, 'n_null': 0, 'n_return': 0,
           'hit': 0, 'null_fa': 0, 'return_press': 0, 'late': 0, 'stable_fa': 0, 'extra': 0}
    rts_breaths = []
    ramp_mag_at_detect = []
    for e in events:
        key = {'step': 'n_step', 'ramp': 'n_ramp', 'null': 'n_null', 'return': 'n_return'}[e['type']]
        out[key] += 1
    covered_s = 0.0
    for e in events:
        covered_s += (e['windowEndMs'] - e['onsetMs']) / 1000.0
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
        if typ in ('step', 'ramp'):
            if hit_event['id'] in used:
                out['extra'] += 1
                continue
            used.add(hit_event['id'])
            out['hit'] += 1
            b = step_breath[min(s, len(step_breath) - 1)]
            if b >= 0:
                frac = (s * M.DT - breath_start_s[b]) / (schedule['breaths'][b]['periodMs'] / 1000.0)
                rts_breaths.append(b - hit_event['onsetBreath'] + frac)
                if typ == 'ramp':
                    ramp_mag_at_detect.append(abs(schedule['breaths'][b]['periodMs'] / 4000.0 - 1))
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
        'hit_rate': out['hit'] / n_change if n_change else np.nan,
        'stable_fa_per_min': out['stable_fa'] / stable_min,
        'settled_min': stable_min,
        'median_rt_breaths': float(np.median(rts_breaths)) if rts_breaths else np.nan,
        'median_ramp_mag_at_detect': float(np.median(ramp_mag_at_detect)) if ramp_mag_at_detect else np.nan,
        'n_presses': int(len(press_steps)),
    })
    return out


# ── fitting ─────────────────────────────────────────────────────────────────
PARAM_NAMES = {M.LEVEL: ['v', 'delta', 'a'], M.LEAKY: ['v', 'delta', 'a', 'lam'], M.TRANSIENT: ['v', 'delta', 'a']}


def _unpack(model, th):
    v, delta, a = math.exp(th[0]), th[1], math.exp(th[2])
    lam = math.exp(th[3]) if model == M.LEAKY else 0.0
    return v, delta, a, lam


def fit(model, step_breath, u, cross, start, extra_starts=()):
    th0 = [math.log(start['v']), start['delta'], math.log(start['a'])]
    bounds = [(math.log(0.3), math.log(400.0)), (-5.0, 30.0), (math.log(0.5), math.log(15.0))]
    if model == M.LEAKY:
        th0.append(math.log(max(start['lam'], LAM0)))
        bounds.append((math.log(0.005), math.log(5.0)))

    def nll(th):
        v, d, a, lam = _unpack(model, th)
        return -M.loglik(step_breath, u, cross, v, d, a, lam)

    best = None
    starts = [np.array(th0)]
    alt = list(th0)
    alt[0] += math.log(0.5)
    alt[1] *= 0.5
    starts.append(np.array(alt))
    starts.extend(np.array(s) for s in extra_starts)
    for x0 in starts:
        r = minimize(nll, x0, method='L-BFGS-B', bounds=bounds, options={'eps': 1e-4, 'maxiter': 300})
        if best is None or r.fun < best.fun:
            best = r
    v, d, a, lam = _unpack(model, best.x)
    k = len(th0)
    return {'v': v, 'delta': d, 'a': a, 'lam': lam, 'nll': float(best.fun), 'k': k,
            'aic': 2 * k + 2 * float(best.fun), 'converged': bool(best.success), 'nfev': int(best.nfev)}


# ── one dataset ─────────────────────────────────────────────────────────────
_SCHEDULES = None
_POPS = None


def _init_worker(sched_path, pops):
    global _SCHEDULES, _POPS
    with open(sched_path) as f:
        _SCHEDULES = json.load(f)
    _POPS = pops


def run_dataset(job):
    gen, pid, design, truth, m50, m50_hat, seed = (job[k] for k in
                                                    ('gen', 'pid', 'design', 'truth', 'm50', 'm50_hat', 'seed'))
    sched = _SCHEDULES[job['key']]
    step_breath, pause_before, log_paced, breath_start_s = M.timeline(sched)
    rng = np.random.default_rng(seed)
    L_true = log_paced + M.SIGMA_BREATH * rng.standard_normal(len(log_paced))
    L_obs = L_true + job['sigma_meas'] * rng.standard_normal(len(log_paced))
    base_log = math.log(BASE_S)

    u_gen = M.evidence(L_true, pause_before, gen, base_log, M.TAU_R)
    cross = M.simulate(step_breath, u_gen, truth['v'], truth['delta'], truth['a'], truth['lam'], seed % (2**31))
    sc = score(sched, cross, breath_start_s, step_breath)

    row = {'gen': M.MODEL_NAMES[gen], 'pid': pid, 'design': design, 'm50': m50, 'm50_hat': m50_hat,
           **{f'true_{k}': v for k, v in truth.items()}, **sc}
    fits = []
    level_fit = None
    for fm in GEN_MODELS:   # LEVEL first: its optimum seeds LEAKY, so the nested fit can't do worse
        u_fit = M.evidence(L_obs, pause_before, fm, base_log, M.TAU_R)
        t0 = time.time()
        extra = []
        if fm == M.LEAKY and level_fit is not None:
            extra = [[math.log(level_fit['v']), level_fit['delta'], math.log(level_fit['a']), math.log(0.006)]]
        f = fit(fm, step_breath, u_fit, cross, _POPS[M.MODEL_NAMES[fm]], extra)
        if fm == M.LEVEL:
            level_fit = f
        fits.append({'gen': M.MODEL_NAMES[gen], 'pid': pid, 'design': design, 'fit': M.MODEL_NAMES[fm],
                     'secs': time.time() - t0, **f})
    return row, fits


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


# ── summary ─────────────────────────────────────────────────────────────────
def summarize(datasets, fits, out_dir, meta):
    designs = [d for d in DESIGNS if d in set(datasets['design'])]
    lines = ['# BCAT-DDM design-power simulation — results', '',
             f"Generated {time.strftime('%Y-%m-%d %H:%M')} by `scripts/bcat_ddm_sim/run_power.py`. "
             f"N = {meta['n']} simulated participants per design × generating model; "
             f"{meta['minutes']} min of task time per session; base breath {BASE_S:.0f} s; "
             f"belt measurement error {meta['sigma_meas']} (log period).", '']

    lines += ['## 1. Yield per session (mean over participants and generating models)', '']
    y = datasets.groupby('design')[['n_change', 'n_null', 'n_return', 'hit', 'hit_rate', 'late',
                                    'stable_fa_per_min', 'null_fa', 'return_press', 'median_rt_breaths',
                                    'median_ramp_mag_at_detect']].mean().reindex(designs)
    lines.append(md(y))
    lines.append('')

    lines += ['## 2. Parameter recovery (fit model = generating model)', '',
              'Pearson r between true and fitted parameter across participants '
              '(log scale for v, a, lam); `bias` = median log(fitted/true) for v.', '']
    rec_rows = []
    f_own = fits[fits['fit'] == fits['gen']].merge(datasets, on=['gen', 'pid', 'design'])
    for (design, gen), g in f_own.groupby(['design', 'gen']):
        r = {'design': design, 'gen': gen}
        for p in ['v', 'a', 'lam']:
            if p == 'lam' and gen != 'leaky':
                continue
            tr, fi = np.log(g[f'true_{p}']), np.log(g[p])
            r[f'r_{p}'] = np.corrcoef(tr, fi)[0, 1] if len(g) > 2 else np.nan
        r['r_delta'] = np.corrcoef(g['true_delta'], g['delta'])[0, 1] if len(g) > 2 else np.nan
        r['bias_logv'] = float(np.median(np.log(g['v'] / g['true_v'])))
        rec_rows.append(r)
    rec = pd.DataFrame(rec_rows).set_index(['design', 'gen'])
    rec = rec.reindex(pd.MultiIndex.from_product([designs, ['level', 'leaky', 'transient']]))
    lines.append(md(rec))
    lines.append('')

    lines += ['## 3. Model recovery', '',
              'Per participant: share of datasets where the lowest-AIC model is the generating one. '
              'Group: summed ΔAIC (best wrong model − generating model; positive = generating model wins).', '']
    pivot = fits.pivot_table(index=['design', 'gen', 'pid'], columns='fit', values='aic')
    mr_rows = []
    for (design, gen), g in pivot.groupby(level=['design', 'gen']):
        best = g.idxmin(axis=1)
        acc = float((best == gen).mean())
        others = [c for c in g.columns if c != gen]
        summed = g.sum()
        dgroup = float(min(summed[o] for o in others) - summed[gen])
        confusion = best.value_counts(normalize=True).to_dict()
        mr_rows.append({'design': design, 'gen': gen, 'indiv_correct': acc, 'group_dAIC': dgroup,
                        **{f'picked_{k}': v for k, v in confusion.items()}})
    mr = pd.DataFrame(mr_rows).set_index(['design', 'gen']).fillna(0.0)
    mr = mr.reindex(pd.MultiIndex.from_product([designs, ['level', 'leaky', 'transient']]))
    lines.append(md(mr))
    lines.append('')
    lines.append('Overall individual-level model recovery by design (mean over generating models):')
    lines.append('')
    lines.append(md(mr.groupby(level=0)['indiv_correct'].mean().reindex(designs)))
    lines.append('')

    with open(os.path.join(out_dir, 'summary.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines) + '\n')
    return '\n'.join(lines)


# ── main ────────────────────────────────────────────────────────────────────
def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=30, help='participants per design x generating model')
    ap.add_argument('--minutes', type=float, default=40)
    ap.add_argument('--designs', default=','.join(DESIGNS))
    ap.add_argument('--workers', type=int, default=max(1, (os.cpu_count() or 2) - 2))
    ap.add_argument('--out', default=os.path.join(HERE, 'results'))
    ap.add_argument('--seed', type=int, default=20261001)
    ap.add_argument('--quick', action='store_true', help='smaller calibration (smoke test)')
    ap.add_argument('--sigma-meas', type=float, default=M.SIGMA_MEAS,
                    help='belt measurement error on log breath period (analyst side)')
    args = ap.parse_args()
    designs = args.designs.split(',')
    os.makedirs(args.out, exist_ok=True)

    # 1. calibrate population means
    cal_path = os.path.join(args.out, 'calibration.json')
    if os.path.exists(cal_path):
        with open(cal_path) as f:
            pops = json.load(f)
        print('calibration: reused', cal_path)
    else:
        t0 = time.time()
        pops = {}
        for m in GEN_MODELS:
            pops[M.MODEL_NAMES[m]] = calibrate(m, n_trials=900 if args.quick else 3000)
            print('calibrated', pops[M.MODEL_NAMES[m]])
        with open(cal_path, 'w', newline='\n') as f:
            json.dump(pops, f, indent=2)
        print(f'calibration {time.time() - t0:.0f}s')

    # 2. participants + their true m50 (one participant set per generating model,
    #    shared across designs so design comparisons are paired)
    rng = np.random.default_rng(args.seed)
    people = []
    for m in GEN_MODELS:
        for pid in range(args.n):
            truth = sample_participant(pops[M.MODEL_NAMES[m]], rng)
            people.append({'gen': m, 'pid': pid, 'truth': truth, 'seed': int(rng.integers(1, 2**31 - 1))})
    with Pool(args.workers) as pool:
        m50s = pool.map(_m50_job, [(p['gen'], p['truth'], p['seed']) for p in people])
    for p, m50 in zip(people, m50s):
        p['m50'] = m50
        p['m50_hat'] = float(np.clip(m50 * math.exp(QUEST_ERR_SD * rng.standard_normal()), 0.04, 0.6))

    # 3. schedules via the task's own generator
    specs, jobs = [], []
    for p in people:
        for di, d in enumerate(designs):
            key = f"{M.MODEL_NAMES[p['gen']]}_{p['pid']}_{d}"
            specs.append({'key': key, 'design': d,
                          'options': {'m50Hat': p['m50_hat'], 'seed': p['seed'] % 1_000_000 + di, 'minutes': args.minutes}})
            jobs.append({'key': key, 'gen': p['gen'], 'pid': p['pid'], 'design': d, 'truth': p['truth'],
                         'm50': p['m50'], 'm50_hat': p['m50_hat'], 'seed': p['seed'] + 7919 * di,
                         'sigma_meas': args.sigma_meas})
    spec_path = os.path.join(args.out, 'schedule_spec.json')
    sched_path = os.path.join(args.out, 'schedules.json')
    with open(spec_path, 'w', newline='\n') as f:
        json.dump(specs, f)
    subprocess.run(['node', os.path.join(HERE, 'make_schedules.mjs'), spec_path, sched_path], check=True, cwd=REPO)

    # 4. simulate + fit
    t0 = time.time()
    rows, fit_rows = [], []
    with Pool(args.workers, initializer=_init_worker, initargs=(sched_path, pops)) as pool:
        for i, (row, fits) in enumerate(pool.imap_unordered(run_dataset, jobs, chunksize=1)):
            rows.append(row)
            fit_rows.extend(fits)
            if (i + 1) % 10 == 0 or i + 1 == len(jobs):
                print(f'{i + 1}/{len(jobs)} datasets  {time.time() - t0:.0f}s', flush=True)
    datasets = pd.DataFrame(rows)
    fits = pd.DataFrame(fit_rows)
    datasets.to_csv(os.path.join(args.out, 'datasets.csv'), index=False, lineterminator='\n')
    fits.to_csv(os.path.join(args.out, 'fits.csv'), index=False, lineterminator='\n')
    os.remove(sched_path)   # large and fully reproducible from schedule_spec.json

    print(summarize(datasets, fits, args.out, {'n': args.n, 'minutes': args.minutes, 'sigma_meas': args.sigma_meas}))


if __name__ == '__main__':
    main()
