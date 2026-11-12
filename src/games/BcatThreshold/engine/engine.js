// ── BCAT threshold engine: factorized QUEST+ (ES module port) ──────────────
//
// Pure, React-free and node-testable. A faithful port of
// NextStudy/Thresholds/6_online_pilot/js/engine.js (sha256 9ef14632…29dd7, 2026-11-11), which is itself a
// port of 4_task_prototype/ae_engine.py. The port is mechanical: the UMD wrapper became ES exports and the
// body was de-indented by two spaces; the only addition is a lint switch around the Cephes coefficients
// (no-loss-of-precision). No line of the computation was changed, so the numerics are the
// source's. engine.test.mjs replays the seven reference sessions against the Python output at 1e-9.
// Do not "improve" this file: any change must keep engine.test.mjs passing unchanged.
//
// Source header, unchanged:
//
/*
 * engine.js: factorized QUEST+ engine for the BCAT threshold task (browser / Web Worker / Node).
 *
 * JavaScript port of NextStudy/Thresholds/4_task_prototype/ae_engine.py (itself an unchanged copy of
 * 1_quest_simulation/aya_population/ae_engine.py), for ONE session (n = 1), with separate slopes per
 * direction (slope_own = True), as in the approved `sdt` configuration of bcat_threshold_config.yaml.
 *
 * Model, for a change of size x in a direction with own parameters (alpha, mu, beta) and shared (c, lapse):
 *   d' = (x / alpha)^beta
 *   P(correct dir) = (1-mu) [(1-lam) Phi(d'-c) + lam/3];  P(wrong dir) = (1-mu) [(1-lam) Phi(-d'-c) + lam/3]
 *   P(same) = rest.  Each probability is clipped to [1e-12, 1] and the three renormalized (as in Python).
 *   2-category option: change = correct + wrong.
 * No-change trial: P(change) = (1-lam) 2 Phi(-c) + 2 lam/3 (updates only the shared (c, lapse) factor).
 *
 * Layout (identical to Python): own index o = (ia * M + im) * B + ib; shared index j = ic * L + il.
 * The likelihood tables are NOT stored (they would be ~200 MB for the slowing cell); each needed slice is
 * computed on the fly from a small table of Phi values. Results agree with the Python engine to ~1e-12
 * (see tests/test_engine_equivalence.js).
 */


// ---------------------------------------------------------------- normal CDF (Cephes ndtr, as scipy)
// The Cephes coefficients are kept exactly as the source writes them (21 significant digits, more than a double
// holds); each still parses to the double Cephes and scipy use, so the lint rule is off for this block only.
/* eslint-disable no-loss-of-precision */
const P = [2.46196981473530512524E-10, 5.64189564831068821977E-1, 7.46321056442269912687E0,
  4.86371970985681366614E1, 1.96520832956077098242E2, 5.26445194995477358631E2,
  9.34528527171957607540E2, 1.02755188689515710272E3, 5.57535335369399327526E2];
const Q = [1.32281951154744992508E1, 8.67072140885989742329E1, 3.54937778887819891062E2,
  9.75708501743205489753E2, 1.82390916687909736289E3, 2.24633760818710981792E3,
  1.65666309194161350182E3, 5.57535340817727675546E2];
const R = [5.64189583547755073984E-1, 1.27536670759978104416E0, 5.01905042251180477414E0,
  6.16021097993053585195E0, 7.40974269950448939160E0, 2.97886665372100240670E0];
const S = [2.26052863220117276590E0, 9.39603524938001434673E0, 1.20489539808096656605E1,
  1.70814450747565897222E1, 9.60896809063285878198E0, 3.36907645100081516050E0];
const T = [9.60497373987051638749E0, 9.00260197203842689217E1, 2.23200534594684319226E3,
  7.00332514112805075473E3, 5.55923013010394962768E4];
const U = [3.35617141647503099647E1, 5.21357949780152679795E2, 4.59432382970980127987E3,
  2.26290000613890934246E4, 4.92673942608635921086E4];
const MAXLOG = 7.09782712893383996843E2;
/* eslint-enable no-loss-of-precision */

function polevl(x, c) { let a = c[0]; for (let i = 1; i < c.length; i++) a = a * x + c[i]; return a; }
function p1evl(x, c) { let a = x + c[0]; for (let i = 1; i < c.length; i++) a = a * x + c[i]; return a; }

function erf(x) {
  if (Math.abs(x) > 1.0) return 1.0 - erfc(x);
  const z = x * x;
  return x * polevl(z, T) / p1evl(z, U);
}

function erfc(a) {
  const x = a < 0 ? -a : a;
  if (x < 1.0) return 1.0 - erf(a);
  let z = -a * a;
  if (z < -MAXLOG) return a < 0 ? 2.0 : 0.0;
  z = Math.exp(z);
  let p, q;
  if (x < 8.0) { p = polevl(x, P); q = p1evl(x, Q); } else { p = polevl(x, R); q = p1evl(x, S); }
  let y = (z * p) / q;
  if (a < 0) y = 2.0 - y;
  if (y === 0.0) return a < 0 ? 2.0 : 0.0;
  return y;
}

function ndtr(a) {
  if (Number.isNaN(a)) return NaN;
  const x = a * Math.SQRT1_2;
  const z = Math.abs(x);
  if (z < Math.SQRT1_2) return 0.5 + 0.5 * erf(x);
  let y = 0.5 * erfc(z);
  if (x > 0) y = 1.0 - y;
  return y;
}

// ---------------------------------------------------------------- helpers
function normalize(w) {
  let s = 0; for (let i = 0; i < w.length; i++) s += w[i];
  const out = new Float64Array(w.length); for (let i = 0; i < w.length; i++) out[i] = w[i] / s;
  return out;
}
function logit(p) { return Math.log(p / (1 - p)); }

/** Lapse prior weights; prior is "flat", ["beta", a, b], ["logitnormal", median, logit_sd] or a list. */
function lamWeights(grid, prior) {
  const n = grid.length;
  if (prior === 'flat') return normalize(new Float64Array(n).fill(1));
  if (Array.isArray(prior) && prior[0] === 'beta') {
    // scipy beta.pdf up to its normalizing constant (which cancels on normalization)
    const a = prior[1], b = prior[2], w = new Float64Array(n);
    for (let i = 0; i < n; i++) { const g = Math.max(grid[i], 1e-6); w[i] = Math.pow(g, a - 1) * Math.pow(1 - g, b - 1); }
    return normalize(w);
  }
  if (Array.isArray(prior) && prior[0] === 'logitnormal') {
    const edges = [0.0];
    for (let i = 1; i < n; i++) edges.push((grid[i] + grid[i - 1]) / 2);
    edges.push(1.0);
    const cdf = edges.map(e => ndtr((logit(Math.min(Math.max(e, 1e-9), 1 - 1e-9)) - logit(prior[1])) / prior[2]));
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = Math.max(cdf[i + 1] - cdf[i], 1e-6);
    return normalize(w);
  }
  return normalize(Float64Array.from(prior));
}

// ---------------------------------------------------------------- Spec (one direction)
/**
 * opts: {x, a, b, cGrid, cPrior: ["normal", mean, sd] | ["flat"], lamGrid, lamPrior, muGrid, muPrior ("flat" | weights),
 *        aPrior: [lnMedian, logSd], bPrior: [lnMedian, logSd], cats: 2|3}
 */
class Spec {
  constructor(o) {
    this.x = Float64Array.from(o.x); this.a = Float64Array.from(o.a); this.b = Float64Array.from(o.b);
    this.lnx = this.x.map(Math.log); this.lna = this.a.map(Math.log); this.lnb = this.b.map(Math.log);
    this.cGrid = Float64Array.from(o.cGrid); this.lamGrid = Float64Array.from(o.lamGrid);
    this.muGrid = Float64Array.from(o.muGrid); this.cats = o.cats;
    const A = this.a.length, M = this.muGrid.length, B = this.b.length, C = this.cGrid.length, L = this.lamGrid.length;
    this.A = A; this.M = M; this.B = B; this.C = C; this.L = L; this.J = C * L; this.S = this.x.length;
    this.AM = A * M * B;   // own size (slope_own = True)
    const pa = normalize(this.lna.map(v => Math.exp(-0.5 * ((v - o.aPrior[0]) / o.aPrior[1]) ** 2)));
    const pb = normalize(this.lnb.map(v => Math.exp(-0.5 * ((v - o.bPrior[0]) / o.bPrior[1]) ** 2)));
    const pc = (o.cPrior[0] === 'flat') ? normalize(new Float64Array(C).fill(1))
      : normalize(this.cGrid.map(v => Math.exp(-0.5 * ((v - o.cPrior[1]) / o.cPrior[2]) ** 2)));
    const pl = lamWeights(this.lamGrid, o.lamPrior);
    const pm = (o.muPrior === 'flat') ? normalize(new Float64Array(M).fill(1)) : normalize(Float64Array.from(o.muPrior));
    this.c_v = new Float64Array(this.J); this.lam_v = new Float64Array(this.J);
    const pjRaw = new Float64Array(this.J);
    for (let ic = 0; ic < C; ic++) for (let il = 0; il < L; il++) {
      const j = ic * L + il; this.c_v[j] = this.cGrid[ic]; this.lam_v[j] = this.lamGrid[il]; pjRaw[j] = pc[ic] * pl[il];
    }
    const pj = normalize(pjRaw);
    this.lp_shared = pj.map(Math.log);
    const lpOwn = new Float64Array(this.AM);
    for (let ia = 0; ia < A; ia++) for (let im = 0; im < M; im++) for (let ib = 0; ib < B; ib++) {
      lpOwn[(ia * M + im) * B + ib] = Math.log(pa[ia]) + Math.log(pm[im]) + Math.log(pb[ib]);
    }
    let s = 0; for (let i = 0; i < this.AM; i++) s += Math.exp(lpOwn[i]);
    const ls = Math.log(s); for (let i = 0; i < this.AM; i++) lpOwn[i] -= ls;
    this.lp_own = lpOwn;
    this.priors = { pa, pb, pc, pl, pm, pj };
    // Phi tables over (s, a, b, c): Phi(d' - c) and Phi(-d' - c)
    const n = this.S * A * B * C;
    this.phiP = new Float64Array(n); this.phiN = new Float64Array(n);
    for (let is = 0; is < this.S; is++) for (let ia = 0; ia < A; ia++) for (let ib = 0; ib < B; ib++) {
      const dp = Math.pow(this.x[is] / this.a[ia], this.b[ib]);
      const base = ((is * A + ia) * B + ib) * C;
      for (let ic = 0; ic < C; ic++) {
        this.phiP[base + ic] = ndtr(dp - this.cGrid[ic]);
        this.phiN[base + ic] = ndtr(-dp - this.cGrid[ic]);
      }
    }
    // no-change likelihood over j
    this.lognc0 = new Float64Array(this.J); this.lognc1 = new Float64Array(this.J);
    for (let j = 0; j < this.J; j++) {
      const pnc = (1 - this.lam_v[j]) * 2 * ndtr(-this.c_v[j]) + this.lam_v[j] * 2 / 3;
      this.lognc0[j] = Math.log(Math.min(Math.max(pnc, 1e-12), 1));
      this.lognc1[j] = Math.log(Math.min(Math.max(1 - pnc, 1e-12), 1));
    }
    // d' = 2 points: t2[a, b] = ln a + ln 2 / b, and its sort order
    this.t2 = new Float64Array(A * B);
    for (let ia = 0; ia < A; ia++) for (let ib = 0; ib < B; ib++) this.t2[ia * B + ib] = this.lna[ia] + Math.log(2.0) / this.b[ib];
    this.t2Order = Array.from(this.t2.keys()).sort((p, q) => (this.t2[p] - this.t2[q]) || (p - q));
  }

  /** Likelihood row for one stimulus index and outcome, written into out (length AM*J), as log L. */
  logLikRow(sidx, outcome, out) {
    const { A, M, B, C, L, J } = this;
    const one = 1;
    for (let ia = 0; ia < A; ia++) for (let im = 0; im < M; im++) {
      const mu = this.muGrid[im];
      for (let ib = 0; ib < B; ib++) {
        const own = (ia * M + im) * B + ib;
        const pbase = ((sidx * A + ia) * B + ib) * C;
        for (let ic = 0; ic < C; ic++) {
          const fP = this.phiP[pbase + ic], fN = this.phiN[pbase + ic];
          for (let il = 0; il < L; il++) {
            const lam = this.lamGrid[il];
            const pcor = (one - mu) * ((one - lam) * fP + lam / 3);
            const pwrong = (one - mu) * ((one - lam) * fN + lam / 3);
            const psame = one - pcor - pwrong;
            let v;
            if (this.cats === 3) {
              const l0 = clip(pcor), l1 = clip(psame), l2 = clip(pwrong);
              const sum = l0 + l1 + l2;
              v = outcome === 0 ? l0 / sum : (outcome === 1 ? l1 / sum : l2 / sum);
            } else {
              const l0 = clip(pcor + pwrong), l1 = clip(psame);
              const sum = l0 + l1;
              v = outcome === 0 ? l0 / sum : l1 / sum;
            }
            out[own * J + ic * L + il] = Math.log(v);
          }
        }
      }
    }
    return out;
  }

  /** Marginals of a normalized posterior M (own x J): Mab (A*B), Mj (J), Mm (M). */
  abMarginal(Mpost) {
    const { A, M, B, J } = this;
    const Mab = new Float64Array(A * B), Mj = new Float64Array(J), Mm = new Float64Array(M);
    for (let ia = 0; ia < A; ia++) for (let im = 0; im < M; im++) for (let ib = 0; ib < B; ib++) {
      const own = (ia * M + im) * B + ib; const off = own * J;
      let s = 0;
      for (let j = 0; j < J; j++) { const v = Mpost[off + j]; s += v; Mj[j] += v; }
      Mab[ia * B + ib] += s; Mm[im] += s;
    }
    return { Mab, Mj, Mm };
  }
}

function clip(v) { return v < 1e-12 ? 1e-12 : (v > 1 ? 1 : v); }

// ---------------------------------------------------------------- Engine (two directions, one session)
class Engine {
  constructor(specs) {
    this.ss = specs; this.s = specs[0];
    this.logL = specs.map(sk => new Float64Array(sk.AM * sk.J));
    this.lognc = new Float64Array(this.s.J);
    this._lse = [null, null];
    this._row = specs.map(sk => new Float64Array(sk.AM * sk.J));
  }

  _lseOwn(k) {
    if (this._lse[k] === null) {
      const sk = this.ss[k], J = sk.J, AM = sk.AM, lg = this.logL[k], lp = sk.lp_own;
      const mx = new Float64Array(J).fill(-Infinity);
      for (let o = 0; o < AM; o++) { const off = o * J, l = lp[o]; for (let j = 0; j < J; j++) { const v = l + lg[off + j]; if (v > mx[j]) mx[j] = v; } }
      const sm = new Float64Array(J);
      for (let o = 0; o < AM; o++) { const off = o * J, l = lp[o]; for (let j = 0; j < J; j++) sm[j] += Math.exp(l + lg[off + j] - mx[j]); }
      const out = new Float64Array(J);
      for (let j = 0; j < J; j++) out[j] = mx[j] + Math.log(sm[j]);
      this._lse[k] = out;
    }
    return this._lse[k];
  }

  /** Normalized posterior of cell k over (own, j), Float64Array(AM*J). */
  marg(k) {
    const sk = this.ss[k], J = sk.J, AM = sk.AM, lg = this.logL[k], lp = sk.lp_own;
    const other = this._lseOwn(1 - k);
    const sh = new Float64Array(J);
    for (let j = 0; j < J; j++) sh[j] = this.s.lp_shared[j] + this.lognc[j] + other[j];
    const out = new Float64Array(AM * J);
    let mx = -Infinity;
    for (let o = 0; o < AM; o++) { const off = o * J, l = lp[o]; for (let j = 0; j < J; j++) { const v = l + lg[off + j] + sh[j]; out[off + j] = v; if (v > mx) mx = v; } }
    let s = 0;
    for (let i = 0; i < out.length; i++) { const v = Math.exp(out[i] - mx); out[i] = v; s += v; }
    for (let i = 0; i < out.length; i++) out[i] /= s;
    return out;
  }

  updateChange(k, sidx, outcome) {
    const row = this.ss[k].logLikRow(sidx, outcome, this._row[k]);
    const lg = this.logL[k];
    for (let i = 0; i < lg.length; i++) lg[i] += row[i];
    this._lse[k] = null;
  }

  updateNoChange(change) {
    const t = change ? this.s.lognc0 : this.s.lognc1;
    for (let j = 0; j < this.lognc.length; j++) this.lognc[j] += t[j];
  }
}

// ---------------------------------------------------------------- mutual information (expected information gain)
const PRUNE = 1e-30;  // posterior cells below this weight contribute < 1e-24 in total: below double precision of the sums
function mutualInfo(Mpost, sk) {
  const { A, M, B, C, L, J, S: NS } = sk;
  const mi = new Float64Array(NS);
  const one = 1;
  for (let is = 0; is < NS; is++) {
    let z0 = 0, z1 = 0, z2 = 0, hsum = 0;
    for (let ia = 0; ia < A; ia++) for (let im = 0; im < M; im++) {
      const mu = sk.muGrid[im];
      for (let ib = 0; ib < B; ib++) {
        const off = ((ia * M + im) * B + ib) * J;
        const pbase = ((is * A + ia) * B + ib) * C;
        for (let ic = 0; ic < C; ic++) {
          const fP = sk.phiP[pbase + ic], fN = sk.phiN[pbase + ic];
          const joff = off + ic * L;
          for (let il = 0; il < L; il++) {
            const w = Mpost[joff + il];
            if (w < PRUNE) continue;
            const lam = sk.lamGrid[il];
            const pcor = (one - mu) * ((one - lam) * fP + lam / 3);
            const pwrong = (one - mu) * ((one - lam) * fN + lam / 3);
            const psame = one - pcor - pwrong;
            if (sk.cats === 3) {
              let l0 = clip(pcor), l1 = clip(psame), l2 = clip(pwrong);
              const sum = l0 + l1 + l2; l0 /= sum; l1 /= sum; l2 /= sum;
              z0 += w * l0; z1 += w * l1; z2 += w * l2;
              hsum += w * -((l0 * Math.log(l0) + l1 * Math.log(l1)) + l2 * Math.log(l2));
            } else {
              let l0 = clip(pcor + pwrong), l1 = clip(psame);
              const sum = l0 + l1; l0 /= sum; l1 /= sum;
              z0 += w * l0; z1 += w * l1;
              hsum += w * -(l0 * Math.log(l0) + l1 * Math.log(l1));
            }
          }
        }
      }
    }
    const zc = v => Math.min(Math.max(v, 1e-15), 1);
    let H;
    if (sk.cats === 3) { const a = zc(z0), b = zc(z1), c = zc(z2); H = -((a * Math.log(a) + b * Math.log(b)) + c * Math.log(c)); }
    else { const a = zc(z0), b = zc(z1); H = -(a * Math.log(a) + b * Math.log(b)); }
    mi[is] = H - hsum;
  }
  return mi;
}

// ---------------------------------------------------------------- summarize (as ae_engine.summarize, n = 1)
function summarize(Mpost, sk) {
  const { Mab: Mab0, Mj: Mj0, Mm: Mm0 } = sk.abMarginal(Mpost);
  const norm = v => { let s = 0; for (const x of v) s += x; return v.map(x => x / s); };
  const Mab = norm(Mab0), Mj = norm(Mj0), Mm = norm(Mm0);
  const t2 = sk.t2; let mean = 0, m2 = 0;
  for (let i = 0; i < t2.length; i++) { mean += Mab[i] * t2[i]; m2 += Mab[i] * t2[i] * t2[i]; }
  const sd = Math.sqrt(Math.max(m2 - mean * mean, 0));
  const ord = sk.t2Order, n = ord.length;
  const v = new Float64Array(n), cdf = new Float64Array(n);
  let cs = 0;
  for (let i = 0; i < n; i++) { const w = Mab[ord[i]]; v[i] = t2[ord[i]]; cs += w; cdf[i] = cs - w / 2; }
  const q = {};
  for (const p of [0.025, 0.975]) {
    let cnt = 0; for (let i = 0; i < n; i++) if (cdf[i] < p) cnt++;
    const idx = Math.min(Math.max(cnt, 1), n - 1);
    const lo = cdf[idx - 1], hi = cdf[idx];
    const f = Math.min(Math.max((p - lo) / Math.max(hi - lo, 1e-15), 0), 1);
    q[p] = v[idx - 1] + f * (v[idx] - v[idx - 1]);
  }
  let lnA = 0, lnB = 0;
  for (let ia = 0; ia < sk.A; ia++) for (let ib = 0; ib < sk.B; ib++) { const w = Mab[ia * sk.B + ib]; lnA += w * sk.lna[ia]; lnB += w * sk.lnb[ib]; }
  let cMean = 0, lamMean = 0, pLam25 = 0, muMean = 0;
  for (let j = 0; j < sk.J; j++) { cMean += Mj[j] * sk.c_v[j]; lamMean += Mj[j] * sk.lam_v[j]; if (sk.lam_v[j] >= 0.25) pLam25 += Mj[j]; }
  for (let m = 0; m < sk.M; m++) muMean += Mm[m] * sk.muGrid[m];
  return { ln_t2_mean: mean, ln_t2_sd: sd, ln_t2_q025: q[0.025], ln_t2_q975: q[0.975], ln_a_mean: lnA, ln_b_mean: lnB,
    c_mean: cMean, lam_mean: lamMean, p_lam_ge_25: pLam25, mu_mean: muMean, Mab, Mj, Mm };
}
export { ndtr, erf, erfc, lamWeights, Spec, Engine, mutualInfo, summarize, PRUNE };
