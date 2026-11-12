// ── BCAT threshold adaptive procedure (ES module port) ─────────────────────
//
// Pure, React-free and node-testable. A faithful port of
// NextStudy/Thresholds/6_online_pilot/js/adaptive.js (sha256 d1c4e4b2…f4a780, 2026-11-11), the port of
// 4_task_prototype/bcat_adaptive.py 0.3.0, model `sdt` (the approved configuration of 2026-11-11). The
// port is mechanical: the UMD wrapper became ES imports and exports, the body was de-indented by two
// spaces. Two lines were changed on purpose, neither in the computation:
//   1. AdaptiveSession no longer falls back to an unseeded Math.random() seed when no rng is passed; it
//      throws. A session is always seeded, so it can be replayed (replay.js).
//   2. makeController's default clock is performance.now() only (the source fell back to Date.now()).
// Everything else, including the stable sort in weightedQuantile, is the source's.
// Do not "improve" this file: any change must keep engine.test.mjs passing unchanged.
//
// Source header, unchanged:
//
/*
 * adaptive.js: the adaptive procedure of the BCAT threshold task (browser / Web Worker / Node).
 *
 * JavaScript port of 4_task_prototype/bcat_adaptive.py (version 0.3.0), model `sdt` only (the approved
 * configuration of 2026-11-11): SDTProcedure, AdaptiveSession (scheduler, catch trials, scoring, readout,
 * running columns), SimulatedObserver. No display code. Uses engine.js.
 *
 * Names and config keys follow the Python code (snake_case) so the same config JSON drives both.
 * Known, documented difference: medians and intervals of quantities whose grid has tied values (criterion,
 * lapse, miss rate, the d' = 1 point) use a stable sort here; numpy's argsort is not stable, so Python's
 * values for these can differ by tie order (means, the d' = 2 readout, level choices and flags do not depend on it).
 */

import * as E from './engine.js';

const VERSION = '0.3.0-js1';
const CELLS = ['speeding', 'slowing'];
const NO_CHANGE = 'no_change';
const RESPONSES = ['slowed', 'same', 'sped_up'];
const DIRECTION_SIGN = { speeding: -1, slowing: 1, no_change: 0 };
const CORRECT_DIRECTION_RESPONSE = { speeding: 'sped_up', slowing: 'slowed' };
const PLACEMENTS_THAT_UPDATE = ['infogain', 'fixed_sub', 'fixed_supra'];
const LN2 = Math.log(2.0);

// ------------------------------------------------------------------ small utilities
function num(v) {
  if (typeof v === 'string' && v.trim().toLowerCase() === 'ln2') return LN2;
  return Number(v);
}
/** numpy.linspace (start + i*step, last element = stop). */
function linspace(a, b, n) {
  const out = new Float64Array(n);
  if (n === 1) { out[0] = a; return out; }
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = i * step + a;
  out[n - 1] = b;
  return out;
}
function buildGrid(spec) {
  if (spec && !Array.isArray(spec) && typeof spec === 'object') {
    if (spec.geomspace) { const [a, b, n] = spec.geomspace; return linspace(Math.log(num(a)), Math.log(num(b)), Number(n)).map(Math.exp); }
    if (spec.linspace) { const [a, b, n] = spec.linspace; return linspace(num(a), num(b), Number(n)); }
    throw new Error('Unknown grid spec: ' + JSON.stringify(spec));
  }
  return Float64Array.from(spec.map(num));
}
/** Python's round(): halves go to the even neighbor. */
function roundHalfEven(x) {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return (f % 2 === 0) ? f : f + 1;
}
function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
function deepMerge(base, over) {
  const out = deepCopy(base);
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = deepCopy(v);
  }
  return out;
}

// ------------------------------------------------------------------ seeded RNG (sfc32 seeded by splitmix32)
function makeRng(seed) {
  let s = (seed >>> 0) ^ 0x9E3779B9;
  const sm = () => { s = (s + 0x9E3779B9) >>> 0; let z = s; z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B) >>> 0; z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35) >>> 0; return (z ^ (z >>> 16)) >>> 0; };
  let a = sm(), b = sm(), c = sm(), d = sm();
  function next() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0;
    const r = (t + d) | 0; c = (c + r) | 0; return (r >>> 0) / 4294967296;
  }
  const rng = {
    random: next,
    normal() { let u = 0; while (u === 0) u = next(); const v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
    integer(n) { return Math.floor(next() * n); },
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; },
  };
  for (let i = 0; i < 8; i++) next();
  return rng;
}

// ------------------------------------------------------------------ stimulus helpers
function safeMaxMagnitude(st) { return Math.min(Math.log(st.baseline_pulse_s / st.min_pulse_s), Math.log(st.max_pulse_s / st.baseline_pulse_s)); }
function signedLogRatio(cell, m) { return DIRECTION_SIGN[cell] * Number(m); }
function changedPulseDuration(b, lr) { return Number(b) * Math.exp(Number(lr)); }
function pctPulseChange(cell, m) { return 100.0 * (Math.exp(signedLogRatio(cell, m)) - 1.0); }
function pulseSchedule(st, lr) {
  const b = st.baseline_pulse_s, c = changedPulseDuration(b, lr), k = st.change_after_pulse;
  const out = []; for (let i = 0; i < Number(st.n_lead_in_pulses); i++) out.push(b);
  for (let i = 0; i < st.n_pulses; i++) out.push(i < k ? b : c);
  return out;
}
function changeIndex(st) { return Number(st.n_lead_in_pulses) + Number(st.change_after_pulse); }
function clampMagnitude(m, st) { const hi = safeMaxMagnitude(st); m = Number(m); if (m > hi) return [hi, true]; if (m < 0) return [0.0, true]; return [m, false]; }
function breathsPerMinute(p) { return 60.0 / Number(p); }
function stimGridWithinSafeRange(spec, st) {
  const x = buildGrid(spec), mx = safeMaxMagnitude(st);
  const keep = [], dropped = [];
  for (const v of x) { if (v <= mx + 1e-6) keep.push(Math.min(v, mx)); else dropped.push(v); }
  if (keep.length < 2) throw new Error('Fewer than 2 stimulus grid values are within the safe range.');
  return [Float64Array.from(keep), dropped];
}
function lapsePriorForAe(spec) {
  if (spec === null || spec === undefined || spec === 'uniform' || spec === 'flat') return 'flat';
  if (spec.logit_normal) return ['logitnormal', Number(spec.logit_normal.median), Number(spec.logit_normal.logit_sd)];
  if (spec.beta) return ['beta', Number(spec.beta.a), Number(spec.beta.b)];
  return spec.map(Number);
}

// ------------------------------------------------------------------ discrete summaries
/** numpy.interp for increasing xp. */
function interp(x, xp, fp) {
  const n = xp.length;
  if (x < xp[0]) return fp[0];
  if (x > xp[n - 1]) return fp[n - 1];
  if (x === xp[n - 1]) return fp[n - 1];
  let lo = 0, hi = n - 1;               // largest j with xp[j] <= x
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xp[mid] <= x) lo = mid; else hi = mid; }
  const j = lo;
  const slope = (fp[j + 1] - fp[j]) / (xp[j + 1] - xp[j]);
  let r = slope * (x - xp[j]) + fp[j];
  if (Number.isNaN(r)) { r = slope * (x - xp[j + 1]) + fp[j + 1]; if (Number.isNaN(r) && fp[j] === fp[j + 1]) r = fp[j]; }
  return r;
}
function weightedQuantile(values, weights, q) {
  const n = values.length, idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => (values[a] - values[b]) || (a - b));   // stable (see header)
  let s = 0; for (let i = 0; i < n; i++) s += weights[i];
  const v = new Float64Array(n), cdf = new Float64Array(n);
  let cs = 0;
  for (let i = 0; i < n; i++) { const w = weights[idx[i]] / s; v[i] = values[idx[i]]; cs += w; cdf[i] = cs - w / 2; }
  return interp(q, cdf, v);
}
function summarizeDiscrete(values, weights, ci) {
  let s = 0; for (let i = 0; i < weights.length; i++) s += weights[i];
  let mean = 0, m2 = 0;
  for (let i = 0; i < values.length; i++) { const w = weights[i] / s; mean += values[i] * w; m2 += values[i] * values[i] * w; }
  return { mean, sd: Math.sqrt(Math.max(m2 - mean * mean, 0)), median: weightedQuantile(values, weights, 0.5),
    ci_low: weightedQuantile(values, weights, (1 - ci) / 2), ci_high: weightedQuantile(values, weights, 1 - (1 - ci) / 2) };
}
function thresholdBlock(s, definition) {
  return { definition, ln_mean: s.mean, ln_sd: s.sd, ln_median: s.median, ln_ci_low: s.ci_low, ln_ci_high: s.ci_high,
    x: Math.exp(s.mean), x_ci_low: Math.exp(s.ci_low), x_ci_high: Math.exp(s.ci_high) };
}

// Jeffreys interval (regularized incomplete beta + bisection)
function lgamma(x) {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0]; const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(a, b, x) {
  const MAXIT = 300, EPS = 1e-16, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betainc(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return (x < (a + 1) / (a + b + 2)) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
function betaPpf(p, a, b) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (betainc(a, b, mid) < p) lo = mid; else hi = mid; if (hi - lo < 1e-15) break; }
  return (lo + hi) / 2;
}
function jeffreysInterval(k, n, ci = 0.95) {
  if (n === 0) return [NaN, NaN];
  const a = k + 0.5, b = n - k + 0.5;
  return [k === 0 ? 0.0 : betaPpf((1 - ci) / 2, a, b), k === n ? 1.0 : betaPpf(1 - (1 - ci) / 2, a, b)];
}

function sdtResponseProbs(signedX, alpha, beta, criterion, lapse) {
  const s = Number(signedX);
  const dp = s !== 0 ? Math.sign(s) * Math.pow(Math.abs(s) / alpha, beta) : 0.0;
  const pSlow = E.ndtr(dp - criterion), pSped = E.ndtr(-criterion - dp), pSame = 1.0 - pSlow - pSped;
  return [(1 - lapse) * pSlow + lapse / 3, (1 - lapse) * pSame + lapse / 3, (1 - lapse) * pSped + lapse / 3];
}
function responseCategory(cell, response) {
  if (response === 'same') return 1;
  return response === CORRECT_DIRECTION_RESPONSE[cell] ? 0 : 2;
}

// ------------------------------------------------------------------ config validation (sdt model only)
function validateConfig(cfg) {
  if (cfg.model !== 'sdt') throw new Error("The online build supports only model: sdt (the approved configuration).");
  const st = cfg.stimulus;
  if (!(0 < st.min_pulse_s && st.min_pulse_s < st.baseline_pulse_s && st.baseline_pulse_s < st.max_pulse_s)) throw new Error('Need 0 < min_pulse_s < baseline_pulse_s < max_pulse_s.');
  if (!(1 <= st.change_after_pulse && st.change_after_pulse < st.n_pulses)) throw new Error('change_after_pulse must be between 1 and n_pulses - 1.');
  if (Number(st.n_lead_in_pulses) < 0) throw new Error('n_lead_in_pulses must be >= 0.');
  const d = cfg.design;
  if (!(d.no_change_rate > 0 && d.no_change_rate < 1)) throw new Error('The sdt model needs 0 < no_change_rate < 1.');
  if (!['drop', 'filler'].includes(d.after_cell_stops)) throw new Error("after_cell_stops must be 'drop' or 'filler'.");
  const ct = d.catch_trials;
  if (!CELLS.includes(ct.cell) || Number(ct.n_trials) < 0 || !(num(ct.magnitude) > 0)) throw new Error('catch_trials needs cell speeding|slowing, n_trials >= 0, magnitude > 0.');
  const sp = cfg.stopping;
  if (!(Number(sp.change_trials_per_cell) >= 1)) throw new Error('change_trials_per_cell must be >= 1.');
  const pr = sp.precision_rule;
  if (!(1 <= pr.min_change_trials_per_cell && pr.min_change_trials_per_cell <= pr.max_change_trials_per_cell)) throw new Error('Need 1 <= precision_rule min <= max.');
  const pl = cfg.placement;
  if (pl.reserved_every !== null && Number(pl.reserved_every) < 2) throw new Error('placement.reserved_every must be >= 2 (or null).');
  if (!(0 < pl.sub_target_dprime && pl.sub_target_dprime < pl.supra_target_dprime)) throw new Error('Need 0 < sub_target_dprime < supra_target_dprime.');
  const s = cfg.sdt;
  if (![2, 3].includes(Number(s.likelihood_categories))) throw new Error('sdt.likelihood_categories must be 2 or 3.');
  if (s.separate_slopes !== true) throw new Error('The online build implements separate_slopes: true only (the approved configuration).');
  for (const c of CELLS) {
    const m = s.miss[c];
    if (m.grid.length !== m.prior_weights.length || m.grid.some(v => !(v >= 0 && v < 1))) throw new Error(`sdt.miss.${c}: grid values in [0, 1) and one weight per value.`);
  }
  if (s.lapse_grid.some(v => !(v >= 0 && v < 1))) throw new Error('sdt.lapse_grid values must be in [0, 1).');
  if (Array.from(buildGrid(s.stim_grid)).some(v => !(v > 0))) throw new Error('Stimulus grid values must be > 0.');
  if (Number(s.n_best) !== 1) throw new Error('The online build implements n_best: 1 only (the approved configuration).');
}

// ------------------------------------------------------------------ per-cell bookkeeping
class CellState {
  constructor(cell) { this.cell = cell; this.n_trials = 0; this.n_infogain = 0; this.n_fixed = { sub: 0, supra: 0 }; this.history = []; this.stop_reason = null; }
  get done() { return this.stop_reason !== null; }
}
function reservedPlacement(cfg, nDone) {
  const pl = cfg.placement, k = pl.reserved_every, tn = nDone + 1;
  if (!k || tn <= pl.reserved_after || tn % k !== 0) return 'infogain';
  return (Math.floor(tn / k) % 2 === 1) ? 'fixed_supra' : 'fixed_sub';
}
function maxTrials(cfg) { const sp = cfg.stopping, pr = sp.precision_rule; return Number(pr.enabled ? pr.max_change_trials_per_cell : sp.change_trials_per_cell); }
function checkStop(cfg, st, sdLn) {
  const pr = cfg.stopping.precision_rule;
  if (st.n_trials >= maxTrials(cfg)) st.stop_reason = pr.enabled ? 'max_trials' : 'fixed_trials';
  else if (pr.enabled && st.n_trials >= pr.min_change_trials_per_cell && sdLn <= pr.max_sd_ln_threshold) st.stop_reason = 'precision';
}
function snap(grid, m) {
  const lm = Math.log(Math.max(Number(m), 1e-12)); let best = 0, bd = Infinity;
  for (let i = 0; i < grid.length; i++) { const d = Math.abs(Math.log(grid[i]) - lm); if (d < bd) { bd = d; best = i; } }
  return best;
}
function gridIndex(grid, m) {
  for (let i = 0; i < grid.length; i++) if (Math.abs(grid[i] - Number(m)) <= 1e-9) return i;
  throw new Error(`Magnitude ${m} is not on the stimulus grid.`);
}

// ------------------------------------------------------------------ SDT procedure (approved model)
class SDTProcedure {
  constructor(cfg) {
    this.cfg = cfg; this.model = 'sdt';
    const s = cfg.sdt;
    const [x, dropped] = stimGridWithinSafeRange(s.stim_grid, cfg.stimulus);
    this.dropped_grid_values = dropped;
    const common = {
      x, a: buildGrid(s.alpha_grid), b: buildGrid(s.beta_grid), cGrid: buildGrid(s.criterion_grid),
      cPrior: ['normal', Number(s.criterion_prior.mean), Number(s.criterion_prior.sd)],
      lamGrid: s.lapse_grid.map(Number), lamPrior: lapsePriorForAe(s.lapse_prior),
      aPrior: [Math.log(s.alpha_prior.median), Number(s.alpha_prior.log_sd)],
      bPrior: [Math.log(s.beta_prior.median), Number(s.beta_prior.log_sd)], cats: Number(s.likelihood_categories) };
    this.specs = CELLS.map(c => new E.Spec(Object.assign({}, common, { muGrid: s.miss[c].grid.map(Number), muPrior: s.miss[c].prior_weights.map(Number) })));
    this.stim_grid = this.specs[0].x;
    this.engine = new E.Engine(this.specs);
    this.cells = { speeding: new CellState('speeding'), slowing: new CellState('slowing') };
    this.n_no_change_updates = 0; this.no_change_history = []; this._cache = {};
  }
  static k(cell) { return CELLS.indexOf(cell); }
  marginal(cell) { const key = 'marg_' + cell; if (!(key in this._cache)) this._cache[key] = this.engine.marg(SDTProcedure.k(cell)); return this._cache[key]; }

  summary(cell) {
    const key = 'summary_' + cell; if (key in this._cache) return this._cache[key];
    const sp = this.specs[SDTProcedure.k(cell)], s = this.cfg.sdt, ci = s.credible_interval;
    const ref = E.summarize(this.marginal(cell), sp);
    const { Mab, Mj, Mm } = ref;   // normalized
    const A = sp.A, B = sp.B, dMain = s.threshold_dprime, dSec = s.secondary_dprime;
    const tMain = new Float64Array(A * B), tSec = new Float64Array(A * B);
    for (let ia = 0; ia < A; ia++) for (let ib = 0; ib < B; ib++) { tMain[ia * B + ib] = sp.lna[ia] + Math.log(dMain) / sp.b[ib]; tSec[ia * B + ib] = sp.lna[ia] + Math.log(dSec) / sp.b[ib]; }
    const thr = summarizeDiscrete(tMain, Mab, ci);
    if (Math.abs(dMain - 2.0) < 1e-9 && Math.abs(ci - 0.95) < 1e-9) {
      thr.mean = ref.ln_t2_mean; thr.sd = ref.ln_t2_sd; thr.ci_low = ref.ln_t2_q025; thr.ci_high = ref.ln_t2_q975;
    }
    const MaRow = new Float64Array(A), MbCol = new Float64Array(B);
    for (let ia = 0; ia < A; ia++) for (let ib = 0; ib < B; ib++) { MaRow[ia] += Mab[ia * B + ib]; MbCol[ib] += Mab[ia * B + ib]; }
    const q = s.quality_flag;
    const lapsePost = {};
    for (const v of sp.lamGrid) { let t = 0; for (let j = 0; j < sp.J; j++) if (sp.lam_v[j] === v) t += Mj[j]; lapsePost[fmtG(v)] = t; }
    let pCut = 0; for (let j = 0; j < sp.J; j++) if (sp.lam_v[j] >= q.lapse_at_least - 1e-12) pCut += Mj[j];
    const faVals = new Float64Array(sp.J);
    for (let j = 0; j < sp.J; j++) faVals[j] = (1 - sp.lam_v[j]) * 2 * E.ndtr(-sp.c_v[j]) + sp.lam_v[j] * 2 / 3;
    const out = {
      threshold: thresholdBlock(thr, `change at which d' = ${fmtG(dMain)}`),
      threshold_secondary: thresholdBlock(summarizeDiscrete(tSec, Mab, ci), `change at which d' = ${fmtG(dSec)}`),
      ln_alpha: summarizeDiscrete(sp.lna, MaRow, ci),
      slope: summarizeDiscrete(sp.b, MbCol, ci),
      ln_slope: summarizeDiscrete(sp.lnb, MbCol, ci),
      criterion: summarizeDiscrete(sp.c_v, Mj, ci),
      lapse_rate: summarizeDiscrete(sp.lam_v, Mj, ci),
      lapse_posterior: lapsePost,
      p_lapse_at_least_cutoff: pCut,
      miss_rate: summarizeDiscrete(sp.muGrid, Mm, ci),
      model_false_alarm_rate: summarizeDiscrete(faVals, Mj, ci),
    };
    out.censored = out.threshold.ln_mean > Math.log(safeMaxMagnitude(this.cfg.stimulus));
    this._cache[key] = out;
    return out;
  }

  sessionFlags() {
    const q = this.cfg.sdt.quality_flag, S = this.summary('speeding'), p = S.p_lapse_at_least_cutoff;
    return {
      quality_flag: p > q.probability_above,
      quality_rule: `posterior P(lapse >= ${fmtG(q.lapse_at_least)}) > ${fmtG(q.probability_above)}`,
      p_lapse_at_least_cutoff: p, lapse_rate: S.lapse_rate, lapse_posterior: S.lapse_posterior,
      censored: { speeding: this.summary('speeding').censored, slowing: this.summary('slowing').censored },
      censored_rule: "posterior mean of the d' = 2 point exceeds the largest testable change " +
        `(${safeMaxMagnitude(this.cfg.stimulus).toFixed(4)} = ln 2)`,
    };
  }

  choosePlacement(cell) { return reservedPlacement(this.cfg, this.cells[cell].n_trials); }

  nextMagnitude(cell, placement) {
    const sp = this.specs[SDTProcedure.k(cell)];
    let target = null, reference = null, requested, mi = null;
    if (placement === 'infogain') {
      mi = E.mutualInfo(this.marginal(cell), sp);
      let best = 0; for (let i = 1; i < mi.length; i++) if (mi[i] > mi[best]) best = i;   // np.argmax: first maximum
      requested = sp.x[best];
    } else if (['fixed_sub', 'fixed_supra', 'filler'].includes(placement)) {
      const pl = this.cfg.placement;
      target = placement === 'fixed_sub' ? pl.sub_target_dprime : pl.supra_target_dprime;
      const S = this.summary(cell);
      requested = Math.exp(S.ln_alpha.mean + Math.log(target) / Math.exp(S.ln_slope.mean));
      reference = Math.exp(S.ln_alpha.mean);
    } else throw new Error('Unknown placement ' + placement);
    const out = this._finishLevel(sp.x, requested, reference, target);
    this._lastMI = mi;
    return out;
  }

  _finishLevel(grid, requested, reference, target) {
    const [cv, clamped] = clampMagnitude(requested, this.cfg.stimulus);
    const idx = snap(grid, cv);
    const outOfGrid = requested > grid[grid.length - 1] * 1.0001 || requested < grid[0] / 1.0001;
    return { requested_magnitude: Number(requested), magnitude: grid[idx], grid_index: idx, clamped: clamped || outOfGrid,
      reference_threshold: reference, target_dprime: target };
  }

  updateChange(cell, magnitude, response, placement) {
    if (!PLACEMENTS_THAT_UPDATE.includes(placement)) throw new Error(`Placement ${placement} must not update the posterior.`);
    if (!(Number(magnitude) > 0)) throw new Error('Only change trials (magnitude > 0) can update the threshold.');
    const k = SDTProcedure.k(cell), sp = this.specs[k];
    const sidx = gridIndex(sp.x, magnitude), cat = responseCategory(cell, response);
    const outcome = sp.cats === 3 ? cat : (cat === 1 ? 1 : 0);
    this.engine.updateChange(k, sidx, outcome);
    this._record(cell, sp.x[sidx], response, placement);
  }

  updateNoChange(saidChange) {
    this.engine.updateNoChange(!!saidChange);
    this.n_no_change_updates += 1; this.no_change_history.push(!!saidChange);
    this._cache = {}; this._recheckPrecision();
    return true;
  }

  _record(cell, m, response, placement) {
    const st = this.cells[cell];
    st.n_trials += 1;
    if (placement === 'infogain') st.n_infogain += 1; else st.n_fixed[placement.split('_')[1]] += 1;
    st.history.push([Number(m), response, placement]);
    this._cache = {};
    checkStop(this.cfg, st, this.summary(cell).threshold.ln_sd);
  }
  _recheckPrecision() {
    if (this.cfg.stopping.precision_rule.enabled) for (const c of CELLS) { const st = this.cells[c]; if (!st.done && st.n_trials > 0) checkStop(this.cfg, st, this.summary(c).threshold.ln_sd); }
  }
}

function fmtG(v) { return String(Number(v)); }   // Python's f"{v:g}" for the grid values used here

// ------------------------------------------------------------------ session (scheduler, scoring, readout)
class AdaptiveSession {
  /** opts.shuffle(items) -> items: override the queue shuffle (used by the equivalence test). */
  constructor(cfg, rng, opts = {}) {
    validateConfig(cfg);
    if (!rng) throw new Error('AdaptiveSession needs a seeded rng (makeRng(seed)); an unseeded session cannot be replayed.');
    this.cfg = cfg; this.rng = rng;
    this.shuffle = opts.shuffle || (items => this.rng.shuffle(items));
    this.proc = new SDTProcedure(cfg);
    this.trial_index = 0; this.n_no_change = 0; this.n_false_alarms = 0;
    this.fa_responses = { slowed: 0, sped_up: 0 };
    this.cell_counts = { speeding: 0, slowing: 0 };
    this.direction_tally = { speeding: { detected: 0, correct: 0 }, slowing: { detected: 0, correct: 0 } };
    this.n_missing = 0; this._queue = []; this._emitted_change = 0; this._emitted_no_change = 0; this.aborted = false;
    const ct = cfg.design.catch_trials, n = ct.enabled ? Number(ct.n_trials) : 0, N = maxTrials(cfg);
    this._catch_due = []; for (let i = 0; i < n; i++) this._catch_due.push(roundHalfEven((i + 1) * N / (n + 1)));
    this.catch_tally = { n: 0, detected: 0, direction_correct: 0 };
  }
  get model() { return 'sdt'; }
  get activeCells() { return CELLS.filter(c => !this.proc.cells[c].done); }
  get finished() { return this.aborted || (this.activeCells.length === 0 && !this._catchPending()); }
  _catchPending() {
    if (!this._catch_due.length) return false;
    return this.proc.cells[this.cfg.design.catch_trials.cell].n_trials >= this._catch_due[0];
  }
  _refillQueue() {
    const rate = this.cfg.design.no_change_rate, k = Number(this.cfg.design.block_change_trials_per_cell);
    const cells = this.cfg.design.after_cell_stops === 'filler' ? CELLS.slice() : this.activeCells;
    let items = []; for (const c of cells) for (let i = 0; i < k; i++) items.push(c);
    const targetNc = rate / (1 - rate) * (this._emitted_change + items.length);
    const nNc = Math.max(0, roundHalfEven(targetNc - this._emitted_no_change));
    for (let i = 0; i < nNc; i++) items.push(NO_CHANGE);
    items = this.shuffle(items);
    this._queue = items;
  }
  _nextCell() {
    for (let i = 0; i < 1000; i++) {
      if (!this._queue.length) this._refillQueue();
      const item = this._queue.shift();
      if (item === NO_CHANGE || !this.proc.cells[item].done) return item;
      if (this.cfg.design.after_cell_stops === 'filler') return item;
    }
    throw new Error('Scheduler could not find a trial.');
  }
  _spec(kw) {
    const st = this.cfg.stimulus, lr = kw.log_ratio;
    return Object.assign({ baseline_pulse_s: st.baseline_pulse_s, n_lead_in_pulses: Number(st.n_lead_in_pulses),
      change_after_pulse: Number(st.change_after_pulse), change_index: changeIndex(st),
      changed_pulse_s: changedPulseDuration(st.baseline_pulse_s, lr), pulse_durations_s: pulseSchedule(st, lr) }, kw);
  }
  nextTrial() {
    if (this.finished) return null;
    if (this._catchPending()) {
      this._catch_due.shift();
      const ct = this.cfg.design.catch_trials, cell = ct.cell, [m, clamped] = clampMagnitude(num(ct.magnitude), this.cfg.stimulus);
      this.trial_index += 1;
      return this._spec({ trial_index: this.trial_index, cell, placement: 'catch', is_change: true, cell_trial_index: this.cell_counts[cell] + 1,
        requested_magnitude: num(ct.magnitude), magnitude: m, log_ratio: signedLogRatio(cell, m), clamped,
        reference_threshold: null, target_dprime: null });
    }
    const cell = this._nextCell();
    this.trial_index += 1;
    if (cell === NO_CHANGE) {
      this._emitted_no_change += 1;
      return this._spec({ trial_index: this.trial_index, cell: NO_CHANGE, placement: NO_CHANGE, is_change: false, cell_trial_index: this.n_no_change + 1,
        requested_magnitude: 0.0, magnitude: 0.0, log_ratio: 0.0, clamped: false, reference_threshold: null, target_dprime: null });
    }
    this._emitted_change += 1;
    const placement = this.proc.cells[cell].done ? 'filler' : this.proc.choosePlacement(cell);
    const mag = this.proc.nextMagnitude(cell, placement);
    return this._spec({ trial_index: this.trial_index, cell, placement, is_change: true, cell_trial_index: this.cell_counts[cell] + 1,
      requested_magnitude: mag.requested_magnitude, magnitude: mag.magnitude, log_ratio: signedLogRatio(cell, mag.magnitude),
      clamped: mag.clamped, reference_threshold: mag.reference_threshold, target_dprime: mag.target_dprime });
  }

  recordResponse(trial, response) {
    if (response !== null && !RESPONSES.includes(response)) throw new Error('Unknown response ' + response);
    const saidChange = response === null ? null : (response !== 'same' ? 1 : 0);
    const detected = trial.is_change ? saidChange : null, falseAlarm = !trial.is_change ? saidChange : null;
    let directionCorrect = null;
    if (trial.is_change && response !== null) directionCorrect = response === CORRECT_DIRECTION_RESPONSE[trial.cell] ? 1 : 0;
    const correct3 = response === null ? null : (trial.is_change ? directionCorrect : (response === 'same' ? 1 : 0));
    const category = (trial.is_change && response !== null) ? responseCategory(trial.cell, response) : null;
    let update = 'none';
    if (response === null) this.n_missing += 1;
    else if (!trial.is_change) {
      this.n_no_change += 1;
      if (falseAlarm) { this.n_false_alarms += 1; this.fa_responses[response] += 1; }
      if (this.proc.updateNoChange(!!falseAlarm)) update = 'criterion_only';
    } else if (trial.placement === 'catch') {
      this.catch_tally.n += 1; this.catch_tally.detected += detected; this.catch_tally.direction_correct += directionCorrect;
    } else {
      if (trial.placement !== 'filler') { this.proc.updateChange(trial.cell, trial.magnitude, response, trial.placement); update = 'change'; }
      if (detected) { this.direction_tally[trial.cell].detected += 1; this.direction_tally[trial.cell].correct += directionCorrect; }
    }
    if (trial.is_change) this.cell_counts[trial.cell] += 1;
    return { response: response !== null ? response : 'none',
      response_category: category === null ? null : ['correct_direction', 'same', 'wrong_direction'][category],
      said_change: saidChange, detected, false_alarm: falseAlarm, direction_correct: directionCorrect, correct_3choice: correct3,
      updated_procedure: update !== 'none' ? 1 : 0, posterior_update: update };
  }

  falseAlarmSummary() {
    const n = this.n_no_change, k = this.n_false_alarms, [lo, hi] = jeffreysInterval(k, n, 0.95);
    return { n_no_change: n, n_false_alarms: k, rate: n ? k / n : null, ci_low: n ? lo : null, ci_high: n ? hi : null,
      n_said_slowed: this.fa_responses.slowed, n_said_sped_up: this.fa_responses.sped_up, interval: 'Jeffreys 95%' };
  }

  readout() {
    const b = this.cfg.stimulus.baseline_pulse_s, cells = {};
    for (const c of CELLS) {
      const st = this.proc.cells[c], s = this.proc.summary(c), thr = s.threshold, dt = this.direction_tally[c];
      const pulse = changedPulseDuration(b, signedLogRatio(c, thr.x));
      cells[c] = Object.assign({
        n_change_trials: st.n_trials, n_infogain: st.n_infogain, n_fixed_sub: st.n_fixed.sub, n_fixed_supra: st.n_fixed.supra,
        n_presented_incl_filler_and_catch: this.cell_counts[c],
        stop_reason: st.stop_reason || (this.aborted ? 'aborted' : 'not_stopped'),
        threshold_pct_pulse_change: pctPulseChange(c, thr.x),
        threshold_pct_pulse_change_ci: [pctPulseChange(c, thr.x_ci_low), pctPulseChange(c, thr.x_ci_high)],
        threshold_pulse_s: pulse, threshold_breaths_per_min: breathsPerMinute(pulse),
        direction_accuracy_when_detected: dt.detected ? dt.correct / dt.detected : null, n_detected: dt.detected,
      }, s);
    }
    const out = { model: 'sdt',
      units: 'threshold.x and its CI are |ln(changed / baseline pulse duration)|; threshold.ln_* are on the natural-log scale of that magnitude',
      n_trials_total: this.trial_index, n_missing_responses: this.n_missing, aborted: this.aborted, cells,
      false_alarms: this.falseAlarmSummary(), flags: this.proc.sessionFlags() };
    if (this.cfg.design.catch_trials.enabled) out.catch_trials = Object.assign({}, this.catch_tally, { cell: this.cfg.design.catch_trials.cell, note: 'data only; not used by the adaptive procedure' });
    const S = this.proc.summary('speeding');
    out.shared = { criterion: S.criterion, lapse_rate: S.lapse_rate, lapse_posterior: S.lapse_posterior, model_false_alarm_rate: S.model_false_alarm_rate };
    return out;
  }

  runningColumns() {
    const out = {};
    for (const c of CELLS) {
      const s = this.proc.summary(c), thr = s.threshold;
      out[`${c}_threshold`] = thr.x; out[`${c}_threshold_ln_mean`] = thr.ln_mean; out[`${c}_threshold_ln_sd`] = thr.ln_sd;
      out[`${c}_threshold_ci_low`] = thr.x_ci_low; out[`${c}_threshold_ci_high`] = thr.x_ci_high; out[`${c}_slope_mean`] = s.slope.mean;
      out[`${c}_n_change_trials`] = this.proc.cells[c].n_trials; out[`${c}_done`] = this.proc.cells[c].done ? 1 : 0; out[`${c}_censored`] = s.censored ? 1 : 0;
    }
    const S = this.proc.summary('speeding');
    out.criterion_mean = S.criterion.mean; out.criterion_sd = S.criterion.sd; out.lapse_mean = S.lapse_rate.mean;
    const f = this.proc.sessionFlags();
    out.p_lapse_at_least_cutoff = f.p_lapse_at_least_cutoff; out.quality_flag = f.quality_flag ? 1 : 0;
    out.slowing_miss_mean = this.proc.summary('slowing').miss_rate.mean;
    const fa = this.falseAlarmSummary();
    out.fa_n_no_change = fa.n_no_change; out.fa_n_false_alarms = fa.n_false_alarms; out.fa_rate = fa.rate;
    return out;
  }

  /** Bookkeeping needed to rebuild the posterior (history of updates in order). */
  history() {
    return { speeding: this.proc.cells.speeding.history, slowing: this.proc.cells.slowing.history, no_change: this.proc.no_change_history };
  }
}

// ------------------------------------------------------------------ simulated observer (as bcat_adaptive.SimulatedObserver, sdt)
class SimulatedObserver {
  constructor(p = {}) {
    Object.assign(this, { alpha_speeding: 0.16, alpha_slowing: 0.16, beta_speeding: 1.25, beta_slowing: 1.25, criterion: 1.3, lapse_rate: 0.03, miss_slowing: 0.0 }, p);
  }
  alpha(c) { return c === 'speeding' ? this.alpha_speeding : this.alpha_slowing; }
  beta(c) { return c === 'speeding' ? this.beta_speeding : this.beta_slowing; }
  trueThreshold(c, dprime = 2.0) { return this.alpha(c) * Math.pow(dprime, 1.0 / this.beta(c)); }
  probs(m, cell) {
    if (cell === NO_CHANGE || m <= 0) return sdtResponseProbs(0.0, 1.0, 1.0, this.criterion, this.lapse_rate);
    let [ps, psame, pf] = sdtResponseProbs(signedLogRatio(cell, m), this.alpha(cell), this.beta(cell), this.criterion, this.lapse_rate);
    if (cell === 'slowing' && this.miss_slowing > 0) { const mu = this.miss_slowing; ps *= (1 - mu); pf *= (1 - mu); psame = 1 - ps - pf; }
    return [ps, psame, pf];
  }
  respond(trial, rng) {
    const [ps, psame] = this.probs(trial.magnitude, trial.cell), u = rng.random();
    return u < ps ? 'slowed' : (u < ps + psame ? 'same' : 'sped_up');
  }
}

// ------------------------------------------------------------------ controller used by the Web Worker (and the main-thread fallback)
/**
 * Messages: {type:'init', cfg, seed} -> {type:'trial', trial, ...}
 *           {type:'respond', trial_index, response} -> {type:'result', scoring, running, next_trial, finished, procedure_ms}
 *           {type:'readout'} -> {type:'readout', readout};   {type:'abort'} -> {type:'readout', readout}
 */
function makeController(now) {
  const clock = now || (() => performance.now());
  let session = null, current = null;
  function debugInfo() {
    if (!session) return null;
    const r = session.runningColumns();
    return { speeding: [r.speeding_threshold, r.speeding_threshold_ci_low, r.speeding_threshold_ci_high, r.speeding_n_change_trials],
      slowing: [r.slowing_threshold, r.slowing_threshold_ci_low, r.slowing_threshold_ci_high, r.slowing_n_change_trials],
      criterion: r.criterion_mean, lapse: r.lapse_mean, p_lapse: r.p_lapse_at_least_cutoff, quality_flag: r.quality_flag,
      censored: [r.speeding_censored, r.slowing_censored], fa: [r.fa_n_false_alarms, r.fa_n_no_change], miss: r.slowing_miss_mean };
  }
  return function handle(msg) {
    if (msg.type === 'init') {
      const t0 = clock();
      session = new AdaptiveSession(msg.cfg, makeRng(msg.seed));
      const running0 = session.runningColumns();
      current = session.nextTrial();
      return { type: 'trial', trial: current, finished: current === null, init_ms: clock() - t0, prior_running: running0, debug: debugInfo(),
        dropped_grid_values: session.proc.dropped_grid_values, last_trial: willFinishAfter(session, current) };
    }
    if (msg.type === 'respond') {
      if (!current || msg.trial_index !== current.trial_index) throw new Error('Response for an unexpected trial');
      const t0 = clock();
      const scoring = session.recordResponse(current, msg.response === undefined ? null : msg.response);
      const running = session.runningColumns();
      const next = session.nextTrial();
      const procedure_ms = clock() - t0;
      current = next;
      return { type: 'result', trial_index: msg.trial_index, scoring, running, procedure_ms, next_trial: next, finished: next === null,
        last_trial: willFinishAfter(session, next), debug: debugInfo(), history: session.history() };
    }
    if (msg.type === 'abort') { if (session) session.aborted = true; return { type: 'readout', readout: session ? session.readout() : null }; }
    if (msg.type === 'readout') return { type: 'readout', readout: session ? session.readout() : null };
    throw new Error('Unknown message ' + msg.type);
  };
}

/**
 * True if the session must end after this trial whatever the response (so the display does not start a
 * lead-in for a trial that will not come). With the precision rule on, returns 'maybe' when it could end.
 */
function willFinishAfter(session, trial) {
  if (!trial) return true;
  const cfg = session.cfg;
  if (cfg.stopping.precision_rule.enabled) return 'maybe';
  const n = {}; for (const c of CELLS) n[c] = session.proc.cells[c].n_trials;
  if (trial.is_change && PLACEMENTS_THAT_UPDATE.includes(trial.placement)) n[trial.cell] += 1;
  const mx = maxTrials(cfg);
  const active = CELLS.filter(c => n[c] < mx);
  let catchPending = false;
  if (session._catch_due.length) catchPending = n[cfg.design.catch_trials.cell] >= session._catch_due[0];
  return active.length === 0 && !catchPending;
}
export { VERSION, CELLS, NO_CHANGE, RESPONSES, DIRECTION_SIGN, LN2, num, linspace, buildGrid, roundHalfEven, deepMerge, deepCopy,
  makeRng, safeMaxMagnitude, signedLogRatio, changedPulseDuration, pctPulseChange, pulseSchedule, changeIndex, clampMagnitude,
  interp, weightedQuantile, summarizeDiscrete, jeffreysInterval, betainc, sdtResponseProbs, responseCategory, validateConfig,
  reservedPlacement, maxTrials, SDTProcedure, AdaptiveSession, SimulatedObserver, makeController, willFinishAfter };
