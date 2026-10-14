"""Round 5b: can the mechanisms from Nansi's review (2026-10-10) be recovered and told apart?

Six observer populations, all built on the medium-memory mixed observer (round 3's
`mem_medium`), each adding ONE mechanism (model.py, "Round 5"):

  r5_base     none
  r5_asym     direction asymmetry kappa ~ N(0.25, 0.1): slowing is easier to notice (Study 1)
  r5_taur     baseline catch-up time tau_r ~ log-uniform 4-30 breaths (fixed at 10 elsewhere)
  r5_inhale   accumulation restarts at the next inhale after a press (not a fixed 1 s)
  r5_urgency  the criterion relaxes with time since the last restart, omega ~ U(0.15, 0.35)
  r5_sr       Shiryaev-Roberts-style soft floor, nu ~ log-uniform 0.1-0.6, floor at -3

Every session is fitted with the six matching models (m_base, m_asym, m_taur, m_inhale,
m_urg, m_sr). Reported: per-person and group-level model choice (does each mechanism show up
when present, and stay out when absent?) and recovery of each mechanism's own parameter.

Usage (repo root):
  python scripts/bcat_ddm_sim/run_round5b.py --n 30 --workers 10 --resume
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
import run_power as R  # noqa: E402

GENS = ['r5_base', 'r5_asym', 'r5_taur', 'r5_inhale', 'r5_urgency', 'r5_sr']
FITS = ['m_base', 'm_asym', 'm_taur', 'm_inhale', 'm_urg', 'm_sr']
TRUE_FIT = dict(zip(GENS, FITS))
FEATURE_PARAM = {'r5_asym': 'kappa', 'r5_taur': 'tau_r', 'r5_urgency': 'omega', 'r5_sr': 'nu'}
SR_LO = -3.0
TAU_R0 = 10.0


# ── participants ────────────────────────────────────────────────────────────
def sample(gen, pop, rng):
    p = R.sample_participant(pop, rng)          # mixed, medium memory (a ~ 6)
    p.update({'kappa': 0.0, 'tau_r': TAU_R0, 'restart_mode': 0, 'omega': 0.0, 'nu': 0.0, 'lo': 0.0})
    if gen == 'r5_asym':
        p['kappa'] = float(np.clip(rng.normal(0.25, 0.1), -0.5, 0.7))
    elif gen == 'r5_taur':
        p['tau_r'] = float(math.exp(rng.uniform(math.log(4), math.log(30))))
    elif gen == 'r5_inhale':
        p['restart_mode'] = 1
    elif gen == 'r5_urgency':
        p['omega'] = float(rng.uniform(0.15, 0.35))
    elif gen == 'r5_sr':
        p['nu'] = float(math.exp(rng.uniform(math.log(0.1), math.log(0.6))))
        p['lo'] = SR_LO
    return p


# ── fitting ─────────────────────────────────────────────────────────────────
FIT_SPEC = {
    # name: (extra parameter or None, restart_mode, lo)
    'm_base':   (None, 0, 0.0),
    'm_asym':   ('kappa', 0, 0.0),
    'm_taur':   ('tau_r', 0, 0.0),
    'm_inhale': (None, 1, 0.0),
    'm_urg':    ('omega', 0, 0.0),
    'm_sr':     ('nu', 0, SR_LO),
}
BASE_BOUNDS = [(math.log(0.01), math.log(400.0)), (math.log(0.01), math.log(400.0)), (-5.0, 30.0),
               (math.log(0.5), math.log(30.0))]
EXTRA_BOUNDS = {'kappa': (-0.8, 0.8), 'tau_r': (math.log(2.0), math.log(60.0)),
                'omega': (0.0, 3.0), 'nu': (math.log(0.005), math.log(5.0))}


def unpack(name, th):
    extra, restart, lo = FIT_SPEC[name]
    p = {'vL': math.exp(th[0]), 'vT': math.exp(th[1]), 'delta': th[2], 'a': math.exp(th[3]),
         'kappa': 0.0, 'tau_r': TAU_R0, 'omega': 0.0, 'nu': 0.0, 'restart_mode': restart, 'lo': lo}
    if extra == 'kappa':
        p['kappa'] = th[4]
    elif extra == 'tau_r':
        p['tau_r'] = math.exp(th[4])
    elif extra == 'omega':
        p['omega'] = th[4]
    elif extra == 'nu':
        p['nu'] = math.exp(th[4])
    return p


def to_theta(name, st):
    extra = FIT_SPEC[name][0]
    th = [math.log(max(st['vL'], 0.02)), math.log(max(st['vT'], 0.02)), st['delta'], math.log(st['a'])]
    if extra == 'kappa':
        th.append(st.get('kappa', 0.0))
    elif extra == 'tau_r':
        th.append(math.log(st.get('tau_r', TAU_R0)))
    elif extra == 'omega':
        th.append(st.get('omega', 0.0))
    elif extra == 'nu':
        th.append(math.log(st.get('nu', 0.1)))
    return th


def fit(name, ctx, starts):
    extra = FIT_SPEC[name][0]
    bounds = BASE_BOUNDS + ([EXTRA_BOUNDS[extra]] if extra else [])
    cache = {}

    def channels(tau_r):
        key = round(tau_r, 6)
        if key not in cache:
            cache.clear()
            cache[key] = M.signed_channels(ctx['L_obs'], ctx['pb'], ctx['base_log'], tau_r)
        return cache[key]

    def nll(th):
        p = unpack(name, th)
        sL, sT = channels(p['tau_r'])
        drive = M.drive_from(sL, sT, p['vL'], p['vT'], p['kappa'])
        return -M.loglik2(ctx['sb'], drive, ctx['cross'], ctx['bst'], p['delta'], p['a'], 0.0,
                          p['omega'], p['nu'], p['lo'], p['restart_mode'])

    best = None
    for st in starts:
        x0 = np.clip(np.array(to_theta(name, st)), [b[0] for b in bounds], [b[1] for b in bounds])
        r = minimize(nll, x0, method='L-BFGS-B', bounds=bounds, options={'eps': 1e-4, 'maxiter': 300})
        if best is None or r.fun < best.fun:
            best = r
    p = unpack(name, best.x)
    k = len(bounds)
    return {**p, 'nll': float(best.fun), 'k': k, 'aic': 2 * k + 2 * float(best.fun),
            'converged': bool(best.success), 'nfev': int(best.nfev)}


def fit_all(ctx, pop):
    out = {}
    base_start = {'vL': pop['vL'], 'vT': pop['vT'], 'delta': pop['delta'], 'a': pop['a']}
    half = {**base_start, 'vL': pop['vL'] * 0.5, 'vT': pop['vT'] * 0.5, 'delta': pop['delta'] * 0.5}
    t0 = time.time()
    out['m_base'] = {**fit('m_base', ctx, [base_start, half]), 'secs': time.time() - t0}
    b = out['m_base']
    extra_starts = {
        'm_asym':   [{**b, 'kappa': 0.0}, {**b, 'kappa': 0.25}],
        'm_taur':   [{**b, 'tau_r': 10.0}, {**b, 'tau_r': 4.0}, {**b, 'tau_r': 25.0}],
        'm_inhale': [b, base_start],
        'm_urg':    [{**b, 'omega': 0.0}, {**b, 'omega': 0.3}],
        'm_sr':     [{**b, 'nu': 0.05}, {**b, 'nu': 0.3}],
    }
    for name, starts in extra_starts.items():
        t0 = time.time()
        out[name] = {**fit(name, ctx, starts), 'secs': time.time() - t0}
    return out


# ── one dataset ─────────────────────────────────────────────────────────────
_SCHED = None
_POP = None


def _init(sched_path, pop):
    global _SCHED, _POP
    with open(sched_path) as f:
        _SCHED = json.load(f)
    _POP = pop


def run_dataset(job):
    t = job['truth']
    sched = _SCHED[job['key']]
    sb, pb, lp, bs = M.timeline(sched)
    bst = M.breath_start_steps(sched)
    rng = np.random.default_rng(job['seed'])
    L_true = lp + M.SIGMA_BREATH * rng.standard_normal(len(lp))
    L_obs = L_true + M.SIGMA_MEAS * rng.standard_normal(len(lp))
    base_log = math.log(R.BASE_S)
    sL, sT = M.signed_channels(L_true, pb, base_log, t['tau_r'])
    drive = M.drive_from(sL, sT, t['vL'], t['vT'], t['kappa'])
    cross = M.simulate2(sb, drive, bst, t['delta'], t['a'], 0.0, t['omega'], t['nu'], t['lo'],
                        t['restart_mode'], job['seed'] % (2**31))
    sc = R.score(sched, cross, bs, sb)
    row = {'gen': job['gen'], 'pid': job['pid'], 'design': job['design'],
           **{f'true_{k}': v for k, v in t.items()}, **sc}
    ctx = {'sb': sb, 'pb': pb, 'bst': bst, 'cross': cross, 'L_obs': L_obs, 'base_log': base_log}
    fits = fit_all(ctx, _POP)
    return row, [{'gen': job['gen'], 'pid': job['pid'], 'design': job['design'], 'fit': n, **f}
                 for n, f in fits.items()]


# ── summary ─────────────────────────────────────────────────────────────────
def summarize(d, f, out_dir, meta):
    L = ['# BCAT-DDM round 5b: mechanisms from Nansi\'s review', '',
         f"Generated {time.strftime('%Y-%m-%d %H:%M')} by `scripts/bcat_ddm_sim/run_round5b.py`. "
         f"N = {meta['n']} per population, design `{meta['design']}`, 40 min, medium-memory mixed observers. "
         'Each population adds one mechanism; every session is fitted with all six models.', '']
    L += ['## 1. Behaviour by population', '',
          R.md(d.groupby('gen')[['n_presses', 'hit_rate', 'stable_fa_per_min', 'median_rt_breaths']].mean().reindex(GENS)), '']
    piv = f.pivot_table(index=['gen', 'pid'], columns='fit', values='aic')[FITS]
    rows = []
    for g, grp in piv.groupby(level='gen'):
        tot = grp.sum().sort_values()
        tf = TRUE_FIT[g]
        picked = grp.idxmin(axis=1).value_counts(normalize=True)
        rows.append({'gen': g, 'group_winner': tot.index[0] + (' ✓' if tot.index[0] == tf else ''),
                     'margin': float(tot.iloc[1] - tot.iloc[0]),
                     'true_minus_best': float(tot[tf] - tot.iloc[0]),
                     **{fm: float(picked.get(fm, 0.0)) for fm in FITS}})
    L += ['## 2. Model choice', '',
          'Group: summed AIC winner (✓ = the mechanism actually present) and its margin over the runner-up. '
          'Columns m_*: share of people whose lowest-AIC model is that model (the matching one is correct).', '',
          R.md(pd.DataFrame(rows).set_index('gen').reindex(GENS)), '']
    rows = []
    m = f.merge(d, on=['gen', 'pid', 'design'])
    for g, par in FEATURE_PARAM.items():
        q = m[(m.gen == g) & (m.fit == TRUE_FIT[g])]
        if len(q):
            tr, fi = q[f'true_{par}'], q[par]
            if par in ('tau_r', 'nu'):
                tr, fi = np.log(tr), np.log(fi)
            rows.append({'gen': g, 'parameter': par, 'rho': R._r(tr, fi),
                         'median_true': float(np.median(q[f'true_{par}'])), 'median_fit': float(np.median(q[par]))})
    L += ['## 3. Recovery of each mechanism\'s parameter (fit = matching model, Spearman)', '',
          R.md(pd.DataFrame(rows).set_index('gen')), '']
    L += ['## 4. Degenerate fits', '',
          R.md(f.assign(deg=(f.a > 29.9) | (f.delta > 29.9)).groupby('fit').deg.mean().reindex(FITS)), '']
    text = '\n'.join(L) + '\n'
    with open(os.path.join(out_dir, 'summary.md'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(text)
    return text


# ── main ────────────────────────────────────────────────────────────────────
def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--n', type=int, default=30)
    ap.add_argument('--design', default='roving_ramp')
    ap.add_argument('--workers', type=int, default=10)
    ap.add_argument('--out', default=os.path.join(HERE, 'results_round5b'))
    ap.add_argument('--calibration', default=os.path.join(HERE, 'results_round3', 'calibration.json'))
    ap.add_argument('--seed', type=int, default=20261012)
    ap.add_argument('--resume', action='store_true')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    with open(args.calibration) as fh:
        pops = json.load(fh)
    pop = pops['mem_medium']

    rng = np.random.default_rng(args.seed)
    people = [{'gen': g, 'pid': i, 'truth': sample(g, pop, rng), 'seed': int(rng.integers(1, 2**31 - 1))}
              for g in GENS for i in range(args.n)]
    with Pool(args.workers) as pool:
        m50s = pool.map(R._m50_job, [(p['truth'], p['seed']) for p in people])
    for p, m50 in zip(people, m50s):
        p['m50_hat'] = float(np.clip(m50 * math.exp(R.QUEST_ERR_SD * rng.standard_normal()), 0.04, 0.6))

    base_design, overrides = R.DESIGN_VARIANTS[args.design]
    specs = [{'key': f"{p['gen']}_{p['pid']}", 'design': base_design,
              'options': {**overrides, 'm50Hat': p['m50_hat'], 'seed': p['seed'] % 1_000_000, 'minutes': 40}}
             for p in people]
    jobs = [{'key': f"{p['gen']}_{p['pid']}", 'gen': p['gen'], 'pid': p['pid'], 'design': args.design,
             'truth': p['truth'], 'seed': p['seed']} for p in people]
    spec_path, sched_path = os.path.join(args.out, 'schedule_spec.json'), os.path.join(args.out, 'schedules.json')
    with open(spec_path, 'w', newline='\n') as fh:
        json.dump(specs, fh)
    subprocess.run(['node', os.path.join(HERE, 'make_schedules.mjs'), spec_path, sched_path], check=True, cwd=R.REPO)

    ds_path, fit_path = os.path.join(args.out, 'datasets.csv'), os.path.join(args.out, 'fits.csv')
    rows, fit_rows = [], []
    if args.resume and os.path.exists(ds_path) and os.path.exists(fit_path):
        pd_, pf = pd.read_csv(ds_path), pd.read_csv(fit_path)
        done = {k for k, v in pf.groupby(['gen', 'pid']).size().items() if v == len(FITS)}
        keep = lambda df: df[[(g, i) in done for g, i in zip(df.gen, df.pid)]]
        rows, fit_rows = keep(pd_).to_dict('records'), keep(pf).to_dict('records')
        jobs = [j for j in jobs if (j['gen'], j['pid']) not in done]
        print(f'resume: {len(done)} done, {len(jobs)} to go', flush=True)
    t0 = time.time()
    with Pool(args.workers, initializer=_init, initargs=(sched_path, pop)) as pool:
        for i, (row, fr) in enumerate(pool.imap_unordered(run_dataset, jobs, chunksize=1)):
            rows.append(row)
            fit_rows.extend(fr)
            if (i + 1) % 5 == 0 or i + 1 == len(jobs):
                print(f'{i + 1}/{len(jobs)} sessions  {time.time() - t0:.0f}s', flush=True)
                pd.DataFrame(rows).to_csv(ds_path, index=False, lineterminator='\n')
                pd.DataFrame(fit_rows).to_csv(fit_path, index=False, lineterminator='\n')
    os.remove(sched_path)
    print(summarize(pd.DataFrame(rows), pd.DataFrame(fit_rows), args.out, {'n': args.n, 'design': args.design}))


if __name__ == '__main__':
    main()
