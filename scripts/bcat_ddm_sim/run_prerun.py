"""Pre-run simulation (2026-10-15): separate speeding and slowing thresholds.

Norm decided the pre-run estimates speeding and slowing thresholds separately (plan §7). Two
questions:
  1. Length. How close do separate estimates get after N pre-run changes, compared with one
     shared estimate from the same changes?
  2. Consequences. Does centring each direction on its own threshold change what the 40 min
     roving + ramp session recovers (asymmetry kappa, breath-to-breath share s, model choice)?

People: round 3's medium-memory mixed observer plus a direction asymmetry kappa (model.py,
"Round 5"). Three populations:
  none     kappa = 0
  modest   kappa ~ N(0, 0.11): true log(slower/faster threshold) SD about 0.25
  wide     kappa ~ N(0, 0.23): SD about 0.5
The real Intero2025 Quest thresholds (N = 290 inside the bounds) give an observed SD of 0.72 and a
faster/slower correlation of .25; both include the Quest's own error, so the truth is probably
between modest and wide. Their median is close to symmetric, so kappa is centred on 0.

The pre-run is a short version of the main task: a free-response roving stream of steps, same
pacer and button. A press within 5 breaths of a change is a hit. Each change's direction follows
the main task's rule (random, steered back toward 4 s near the bounds; schedule.js chooseStep),
with 1-3 steady breaths before each. Strict faster/slower alternation was tried first and
dropped: with unequal sizes per direction the pacer drifted to the slow bound and one pre-run
took 32 min.
A Bayesian adaptive procedure (QUEST-style grid) picks each change's size: the posterior-mean
threshold for that direction. Its model is logistic detection in log magnitude with a fixed slope
(fitted to these observers), a false-alarm rate estimated from presses in the steady breaths, and
a small lapse rate.
  shared    one threshold for both directions
  separate  one threshold per direction (the decided design)
Estimates are recorded after 12, 16, ..., 48 changes, so each person's run gives every length.

Main task (stage 2): roving_ramp, 40 min, with each direction scaled by
  shared@L     the shared estimate after L changes, for both directions
  separate@L   the separate estimates after L changes
  true         each person's true thresholds (a perfect pre-run)
Each session is fitted with m_base and m_asym (run_round5b.py).

Usage (repo root):
  python scripts/bcat_ddm_sim/run_prerun.py --stage 1 --n 100 --workers 14
  python scripts/bcat_ddm_sim/run_prerun.py --stage 2 --n2 40 --workers 14 --resume \
      --main shared@24,separate@24,separate@40,true
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

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import model as M  # noqa: E402
import run_power as R  # noqa: E402
import run_round5b as B  # noqa: E402

POPS = {'none': 0.0, 'modest': 0.11, 'wide': 0.23}      # SD of kappa
KAPPA_CLIP = 0.45
BASE_S = 4.0
WIN = 5                       # breaths in which a press counts as a hit
CHECKPOINTS = [12, 16, 20, 24, 32, 40, 48]
N_MAX = CHECKPOINTS[-1]

# QUEST-style model
S_SLOPE = 0.39                # logistic scale in log magnitude (fitted to mem_medium observers)
LAPSE = 0.03
MU = np.linspace(math.log(0.02), math.log(0.9), 81)
HFA = np.exp(np.linspace(math.log(0.05 / 60), math.log(2.0 / 60), 15))   # false alarms per second
PRIOR_MU, PRIOR_SD = math.log(0.2), 0.7
M_MIN, M_MAX = 0.03, 0.6
W_REF = WIN * BASE_S          # window length for the 50%-hit conversion


class Quest:
    def __init__(self, separate):
        self.separate = separate
        lp_mu = -0.5 * ((MU - PRIOR_MU) / PRIOR_SD) ** 2
        if separate:                                   # axes: faster, slower, FA rate
            self.lp = lp_mu[:, None, None] + lp_mu[None, :, None] + np.zeros(len(HFA))[None, None, :]
        else:                                          # axes: shared, FA rate
            self.lp = lp_mu[:, None] + np.zeros(len(HFA))[None, :]

    def update_change(self, d, m, w_dur, hit):
        F = 1.0 / (1.0 + np.exp(-(math.log(m) - MU) / S_SLOPE))
        pdet = (1.0 - LAPSE) * F
        q = np.exp(-HFA * w_dur)
        ph = np.clip(1.0 - q[None, :] * (1.0 - pdet[:, None]), 1e-9, 1 - 1e-9)
        ll = np.log(ph) if hit else np.log(1.0 - ph)
        if not self.separate:
            self.lp += ll
        elif d < 0:
            self.lp += ll[:, None, :]
        else:
            self.lp += ll[None, :, :]

    def update_gap(self, g_dur, pressed):
        q = np.clip(np.exp(-HFA * g_dur), 1e-12, 1 - 1e-12)
        self.lp += np.log(1.0 - q) if pressed else np.log(q)

    def _post(self):
        p = np.exp(self.lp - self.lp.max())
        return p / p.sum()

    def mu_hat(self, d):
        p = self._post()
        if not self.separate:
            return float(p.sum(axis=1) @ MU)
        return float(p.sum(axis=(1, 2)) @ MU) if d < 0 else float(p.sum(axis=(0, 2)) @ MU)

    def h_hat(self):
        p = self._post()
        return float(p.sum(axis=tuple(range(p.ndim - 1))) @ HFA)

    def next_mag(self, d):
        return float(np.clip(math.exp(self.mu_hat(d)), M_MIN, M_MAX))

    def m50_hat(self, d):
        """Magnitude giving 50% hits within the window, the meaning of a schedule's m50Hat."""
        q = math.exp(-self.h_hat() * W_REF)
        F = float(np.clip((1.0 - 0.5 / q) / (1.0 - LAPSE), 0.02, 0.98))
        return math.exp(self.mu_hat(d) + S_SLOPE * math.log(F / (1.0 - F)))


# ── participants ────────────────────────────────────────────────────────────
def sample(pop_name, base_pop, rng):
    p = R.sample_participant(base_pop, rng)
    sd = POPS[pop_name]
    p.update({'kappa': float(np.clip(rng.normal(0.0, sd), -KAPPA_CLIP, KAPPA_CLIP)) if sd > 0 else 0.0,
              'tau_r': B.TAU_R0, 'restart_mode': 0, 'omega': 0.0, 'nu': 0.0, 'lo': 0.0})
    return p


def _truth_job(args):
    t, seed = args
    return (M.find_m50_dir(t['vL'], t['vT'], t['kappa'], t['delta'], t['a'], t['lam'], -1, BASE_S, WIN, 600,
                           t['tau_r'], seed),
            M.find_m50_dir(t['vL'], t['vT'], t['kappa'], t['delta'], t['a'], t['lam'], +1, BASE_S, WIN, 600,
                           t['tau_r'], seed + 1))


# ── stage 1: the pre-run ────────────────────────────────────────────────────
def _simulate_prefix(periods, noise, t, obs_seed):
    per = np.asarray(periods, np.float64)
    starts = np.concatenate([[0.0], np.cumsum(per)[:-1]])
    st = np.round(starts / M.DT).astype(np.int64)
    en = np.round((starts + per) / M.DT).astype(np.int64)
    sb = np.repeat(np.arange(len(per), dtype=np.int32), en - st)
    L = np.log(per) + M.SIGMA_BREATH * noise[:len(per)]
    pb = np.zeros(len(per), np.bool_)
    pb[0] = True
    sL, sT = M.signed_channels(L, pb, math.log(BASE_S), t['tau_r'])
    drive = M.drive_from(sL, sT, t['vL'], t['vT'], t['kappa'])
    cross = M.simulate2(sb, drive, st, t['delta'], t['a'], t['lam'], 0.0, 0.0, 0.0, 0, obs_seed)
    return np.flatnonzero(cross) + M.TER_STEPS, st, en


def prerun(t, separate, seed):
    """One adaptive pre-run. Returns one row per checkpoint."""
    rs = np.random.default_rng(seed)               # same breaths, gaps and noise for both methods
    noise = rs.standard_normal(4000)
    gaps = rs.integers(1, 4, N_MAX)
    coin = rs.random(N_MAX)
    obs_seed = int(seed % (2 ** 31))
    q = Quest(separate)
    periods = [BASE_S] * 4                          # lead-in
    P = BASE_S
    lo, hi = BASE_S * 0.55, BASE_S * 1.8
    rows, n_dir, hits_dir = [], {-1: 0, 1: 0}, {-1: 0, 1: 0}
    gap_start = 0
    for j in range(N_MAX):
        # the main task's direction rule (schedule.js chooseStep, meanRevert)
        x = math.log(P / BASE_S)
        span = math.log(1.8) if x >= 0 else -math.log(0.55)
        d = 1 if coin[j] < 0.5 - 0.5 * max(-1.0, min(1.0, x / span)) else -1
        m = q.next_mag(d)
        if not lo <= P * (1 + d * m) <= hi:
            d = -d
            m = q.next_mag(d)
        if not lo <= P * (1 + d * m) <= hi:
            d = 1 if P < BASE_S else -1
            m = q.next_mag(d)
            while m > 0.01 and not lo <= P * (1 + d * m) <= hi:
                m *= 0.9
        periods += [P] * int(gaps[j])
        onset = len(periods)
        P = P * (1 + d * m)
        periods += [P] * WIN
        presses, st, en = _simulate_prefix(periods, noise, t, obs_seed)
        g0, g1 = st[gap_start], st[onset]
        w0, w1 = st[onset], en[onset + WIN - 1]
        q.update_gap((g1 - g0) * M.DT, bool(np.any((presses >= g0) & (presses < g1))))
        hit = bool(np.any((presses >= w0) & (presses < w1)))
        q.update_change(d, m, (w1 - w0) * M.DT, hit)
        n_dir[d] += 1
        hits_dir[d] += hit
        gap_start = onset + WIN
        if j + 1 in CHECKPOINTS:
            rows.append({'n_changes': j + 1, 'minutes': float(np.sum(periods)) / 60.0,
                         'est_fast': q.m50_hat(-1), 'est_slow': q.m50_hat(1),
                         'n_fast': n_dir[-1], 'n_slow': n_dir[1],
                         'hit_fast': hits_dir[-1] / max(n_dir[-1], 1), 'hit_slow': hits_dir[1] / max(n_dir[1], 1),
                         'fa_per_min': q.h_hat() * 60.0})
    return rows


def _prerun_job(job):
    out = []
    for method in ('shared', 'separate'):
        for r in prerun(job['truth'], method == 'separate', job['seed']):
            out.append({'pop': job['pop'], 'pid': job['pid'], 'method': method, **r})
    return out


# ── stage 2: the main task ──────────────────────────────────────────────────
_SCHED = None
_BASE = None


def _init(sched_path, base_pop):
    global _SCHED, _BASE
    with open(sched_path) as f:
        _SCHED = json.load(f)
    _BASE = base_pop


def _dir_hits(sched, presses_s):
    out = {}
    for typ in ('step', 'ramp'):
        for d, name in ((-1, 'fast'), (1, 'slow')):
            ev = [e for e in sched['events'] if e['type'] == typ and e['dir'] == d]
            h = [bool(np.any((presses_s >= e['onsetMs'] / 1000.0) & (presses_s < e['windowEndMs'] / 1000.0)))
                 for e in ev]
            out[f'n_{typ}_{name}'] = len(ev)
            out[f'hit_{typ}_{name}'] = float(np.mean(h)) if h else np.nan
    return out


def _fit_two(ctx, pop):
    base_start = {'vL': pop['vL'], 'vT': pop['vT'], 'delta': pop['delta'], 'a': pop['a']}
    half = {**base_start, 'vL': pop['vL'] * 0.5, 'vT': pop['vT'] * 0.5, 'delta': pop['delta'] * 0.5}
    b = B.fit('m_base', ctx, [base_start, half])
    a = B.fit('m_asym', ctx, [{**b, 'kappa': 0.0}, {**b, 'kappa': 0.25}, {**b, 'kappa': -0.25}])
    return {'m_base': b, 'm_asym': a}


def _main_job(job):
    t = job['truth']
    sched = _SCHED[job['key']]
    sb, pb, lp, bs = M.timeline(sched)
    bst = M.breath_start_steps(sched)
    rng = np.random.default_rng(job['seed'])
    L_true = lp + M.SIGMA_BREATH * rng.standard_normal(len(lp))
    L_obs = L_true + M.SIGMA_MEAS * rng.standard_normal(len(lp))
    base_log = math.log(BASE_S)
    sL, sT = M.signed_channels(L_true, pb, base_log, t['tau_r'])
    drive = M.drive_from(sL, sT, t['vL'], t['vT'], t['kappa'])
    cross = M.simulate2(sb, drive, bst, t['delta'], t['a'], t['lam'], 0.0, 0.0, 0.0, 0, job['seed'] % (2 ** 31))
    presses_s = (np.flatnonzero(cross) + M.TER_STEPS) * M.DT
    row = {'pop': job['pop'], 'pid': job['pid'], 'cond': job['cond'], **{f'true_{k}': v for k, v in t.items()},
           'm50_fast_used': job['m50_fast'], 'm50_slow_used': job['m50_slow'],
           **R.score(sched, cross, bs, sb), **_dir_hits(sched, presses_s)}
    ctx = {'sb': sb, 'pb': pb, 'bst': bst, 'cross': cross, 'L_obs': L_obs, 'base_log': base_log}
    fits = _fit_two(ctx, _BASE)
    refL, refT = _BASE['refL'], _BASE['refT']
    frows = []
    for name, f in fits.items():
        a_, b_ = f['vT'] / refT, f['vL'] / refL
        frows.append({'pop': job['pop'], 'pid': job['pid'], 'cond': job['cond'], 'fit': name,
                      's_hat': a_ / (a_ + b_) if a_ + b_ > 0 else np.nan, **f})
    return row, frows


# ── summaries ───────────────────────────────────────────────────────────────
def _rho(x, y):
    x, y = pd.Series(x), pd.Series(y)
    ok = x.notna() & y.notna()
    return float(x[ok].rank().corr(y[ok].rank())) if ok.sum() > 3 else np.nan


def md(df, floatfmt='.2f'):
    cols = list(df.columns)
    out = ['| ' + ' | '.join(str(c) for c in cols) + ' |', '|' + '---|' * len(cols)]
    for _, r in df.iterrows():
        out.append('| ' + ' | '.join(format(v, floatfmt) if isinstance(v, (float, np.floating)) and not pd.isna(v)
                                     else ('' if pd.isna(v) else str(v)) for v in r.values) + ' |')
    return '\n'.join(out)


def summarize_stage1(people, pr):
    t = people.set_index(['pop', 'pid'])
    d = pr.join(t[['m50_fast', 'm50_slow', 'kappa']], on=['pop', 'pid'])
    d['err_fast'] = np.log(d.est_fast / d.m50_fast)
    d['err_slow'] = np.log(d.est_slow / d.m50_slow)
    L = ['## Stage 1: the pre-run', '']
    pp = people.assign(lr=np.log(people.m50_slow / people.m50_fast))
    chk = pp.groupby('pop').apply(lambda g: pd.Series({
        'sd_true_log_ratio': g.lr.std(), 'corr_log_fast_slow': np.corrcoef(np.log(g.m50_fast), np.log(g.m50_slow))[0, 1],
        'median_m50_fast': g.m50_fast.median(), 'median_m50_slow': g.m50_slow.median()}), include_groups=False)
    L += ['Simulated people (real Intero2025 Quest thresholds for comparison: SD of log ratio .72, '
          'faster/slower correlation .25, both including Quest error).', '', md(chk.reset_index()), '']
    rows = []
    for (pop, method, n), g in d.groupby(['pop', 'method', 'n_changes']):
        e = np.concatenate([g.err_fast.values, g.err_slow.values])
        rows.append({'pop': pop, 'method': method, 'changes': n, 'minutes': g.minutes.median(),
                     'rmse_log': float(np.sqrt(np.mean(e ** 2))), 'bias_log': float(np.mean(e)),
                     'off_by_>50%': float(np.mean(np.abs(e) > math.log(1.5))),
                     'off_by_>2x': float(np.mean(np.abs(e) > math.log(2.0))),
                     'rho_ratio': _rho(np.log(g.m50_slow / g.m50_fast), np.log(g.est_slow / g.est_fast))
                     if method == 'separate' else np.nan})
    tab = pd.DataFrame(rows).sort_values(['pop', 'changes', 'method'])
    L += ['Error of each direction\'s threshold estimate, log(estimate / truth), pooled over both directions. '
          '`rmse_log` 0.25 is about 25% off. `rho_ratio`: how well the pre-run ranks people\'s own '
          'slower/faster ratio (separate only). Minutes exclude the ~2 min of practice.', '',
          md(tab.reset_index(drop=True)), '']
    return '\n'.join(L), tab


def summarize_stage2(main, fits):
    L = ['## Stage 2: the main task (roving + ramp, 40 min)', '']
    a = fits[fits.fit == 'm_asym'].set_index(['pop', 'pid', 'cond'])
    b = fits[fits.fit == 'm_base'].set_index(['pop', 'pid', 'cond'])
    m = main.set_index(['pop', 'pid', 'cond'])
    m = m.join(a[['kappa', 's_hat', 'aic', 'a', 'delta']].add_suffix('_asym')).join(b[['aic', 'a', 'delta']].add_suffix('_base'))
    m['d_aic'] = m.aic_base - m.aic_asym
    m['degenerate'] = (m.a_asym >= 29) | (m.delta_asym >= 29)
    rows = []
    for (pop, cond), g in m.groupby(level=['pop', 'cond']):
        rows.append({'pop': pop, 'cond': cond,
                     'step_hit_fast': g.hit_step_fast.mean(), 'step_hit_slow': g.hit_step_slow.mean(),
                     'mean_|fast-slow|': (g.hit_step_fast - g.hit_step_slow).abs().mean(),
                     'ramp_hit_fast': g.hit_ramp_fast.mean(), 'ramp_hit_slow': g.hit_ramp_slow.mean(),
                     'hits': g.hit.mean() if 'hit' in g else np.nan,
                     'rho_kappa': _rho(g.true_kappa, g.kappa_asym) if g.true_kappa.std() > 0 else np.nan,
                     'kappa_rmse': float(np.sqrt(np.mean((g.kappa_asym - g.true_kappa) ** 2))),
                     'rho_s': _rho(g.true_s, g.s_hat_asym),
                     'asym_chosen': float(np.mean(g.d_aic > 0)), 'group_dAIC': float(g.d_aic.sum()),
                     'degenerate': float(g.degenerate.mean())})
    tab = pd.DataFrame(rows)
    L += ['Hit rates are means over people. `mean_|fast-slow|`: average gap between a person\'s step hit '
          'rates in the two directions. `rho_kappa`, `kappa_rmse`: recovery of the asymmetry from the m_asym '
          'fit. `asym_chosen`: share of people whose AIC prefers m_asym (with no asymmetry, a false-positive '
          'rate). `group_dAIC`: summed AIC advantage of m_asym.', '', md(tab), '']
    return '\n'.join(L), tab


# ── main ────────────────────────────────────────────────────────────────────
def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--stage', type=int, choices=[1, 2], required=True)
    ap.add_argument('--n', type=int, default=100, help='people per population (stage 1)')
    ap.add_argument('--n2', type=int, default=40, help='people per population carried into stage 2')
    ap.add_argument('--main', default='shared@24,separate@24,separate@40,true')
    ap.add_argument('--workers', type=int, default=12)
    ap.add_argument('--out', default=os.path.join(HERE, 'results_prerun'))
    ap.add_argument('--calibration', default=os.path.join(HERE, 'results_round3', 'calibration.json'))
    ap.add_argument('--seed', type=int, default=20261015)
    ap.add_argument('--resume', action='store_true')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    with open(args.calibration) as fh:
        base_pop = json.load(fh)['mem_medium']
    ppl_path, pr_path = os.path.join(args.out, 'people.csv'), os.path.join(args.out, 'prerun.csv')

    if args.stage == 1:
        rng = np.random.default_rng(args.seed)
        people = [{'pop': p, 'pid': i, 'truth': sample(p, base_pop, rng), 'seed': int(rng.integers(1, 2 ** 31 - 1))}
                  for p in POPS for i in range(args.n)]
        t0 = time.time()
        with Pool(args.workers) as pool:
            truths = pool.map(_truth_job, [(p['truth'], p['seed'] % 1_000_000) for p in people])
            print(f'true thresholds  {time.time() - t0:.0f}s', flush=True)
            for p, (f, s) in zip(people, truths):
                p['truth']['m50_fast'], p['truth']['m50_slow'] = f, s
            rows = []
            for i, r in enumerate(pool.imap_unordered(_prerun_job, people, chunksize=2)):
                rows.extend(r)
                if (i + 1) % 25 == 0:
                    print(f'{i + 1}/{len(people)} pre-runs  {time.time() - t0:.0f}s', flush=True)
        pd.DataFrame([{'pop': p['pop'], 'pid': p['pid'], 'seed': p['seed'], **p['truth']} for p in people]) \
            .to_csv(ppl_path, index=False, lineterminator='\n')
        pd.DataFrame(rows).to_csv(pr_path, index=False, lineterminator='\n')
        text, _ = summarize_stage1(pd.read_csv(ppl_path), pd.read_csv(pr_path))
        with open(os.path.join(args.out, 'summary_stage1.md'), 'w', encoding='utf-8', newline='\n') as fh:
            fh.write('# BCAT-DDM pre-run simulation, stage 1\n\nGenerated ' + time.strftime('%Y-%m-%d %H:%M')
                     + ' by `scripts/bcat_ddm_sim/run_prerun.py`.\n\n' + text)
        print(text)
        return

    people = pd.read_csv(ppl_path)
    pr = pd.read_csv(pr_path)
    people = people[people.pid < args.n2]
    conds = args.main.split(',')
    jobs, specs = [], []
    tcols = ['s', 'k', 'c', 'vL', 'vT', 'delta', 'a', 'lam', 'kappa', 'tau_r', 'restart_mode', 'omega', 'nu', 'lo']
    for _, p in people.iterrows():
        truth = {c: (int(p[c]) if c == 'restart_mode' else float(p[c])) for c in tcols}
        for cond in conds:
            if cond == 'true':
                f, s = p.m50_fast, p.m50_slow
            else:
                method, n = cond.split('@')
                r = pr[(pr['pop'] == p['pop']) & (pr.pid == p.pid) & (pr.method == method) & (pr.n_changes == int(n))].iloc[0]
                f, s = r.est_fast, r.est_slow
            key = f"{p['pop']}_{p.pid}_{cond}"
            # same schedule seed for every condition: only the sizes differ
            specs.append({'key': key, 'design': 'roving_ramp',
                          'options': {'m50Hat': float(math.sqrt(f * s)), 'm50HatFaster': float(f), 'm50HatSlower': float(s),
                                      'seed': int(p.seed) % 1_000_000, 'minutes': 40}})
            jobs.append({'key': key, 'pop': p['pop'], 'pid': int(p.pid), 'cond': cond, 'truth': truth,
                         'seed': int(p.seed), 'm50_fast': float(f), 'm50_slow': float(s)})
    spec_path, sched_path = os.path.join(args.out, 'schedule_spec.json'), os.path.join(args.out, 'schedules.json')
    with open(spec_path, 'w', newline='\n') as fh:
        json.dump(specs, fh)
    subprocess.run(['node', os.path.join(HERE, 'make_schedules.mjs'), spec_path, sched_path], check=True, cwd=R.REPO)
    ds_path, fit_path = os.path.join(args.out, 'main.csv'), os.path.join(args.out, 'main_fits.csv')
    rows, frows = [], []
    if args.resume and os.path.exists(ds_path) and os.path.exists(fit_path):
        d0, f0 = pd.read_csv(ds_path), pd.read_csv(fit_path)
        done = {k for k, v in f0.groupby(['pop', 'pid', 'cond']).size().items() if v == 2}
        rows = [r for r in d0.to_dict('records') if (r['pop'], r['pid'], r['cond']) in done]
        frows = [r for r in f0.to_dict('records') if (r['pop'], r['pid'], r['cond']) in done]
        jobs = [j for j in jobs if (j['pop'], j['pid'], j['cond']) not in done]
        print(f'resume: {len(done)} done, {len(jobs)} to go', flush=True)
    t0 = time.time()
    with Pool(args.workers, initializer=_init, initargs=(sched_path, base_pop)) as pool:
        for i, (row, fr) in enumerate(pool.imap_unordered(_main_job, jobs, chunksize=1)):
            rows.append(row)
            frows.extend(fr)
            if (i + 1) % 10 == 0 or i + 1 == len(jobs):
                print(f'{i + 1}/{len(jobs)} sessions  {time.time() - t0:.0f}s', flush=True)
                pd.DataFrame(rows).to_csv(ds_path, index=False, lineterminator='\n')
                pd.DataFrame(frows).to_csv(fit_path, index=False, lineterminator='\n')
    os.remove(sched_path)
    text, _ = summarize_stage2(pd.read_csv(ds_path), pd.read_csv(fit_path))
    with open(os.path.join(args.out, 'summary_stage2.md'), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('# BCAT-DDM pre-run simulation, stage 2\n\nGenerated ' + time.strftime('%Y-%m-%d %H:%M')
                 + ' by `scripts/bcat_ddm_sim/run_prerun.py`.\n\n' + text)
    print(text)


if __name__ == '__main__':
    main()
