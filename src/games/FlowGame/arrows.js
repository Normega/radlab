// ── Flow game: arrow task (arrow flanker) trial lists and scoring ──────────
//
// Pure, DOM-free and node-testable. The prototype imports a byte-identical copy
// from public/prototypes/flow-game/arrows.js (arrows.test.mjs fails if they
// drift).
//
// Five arrows; the participant reports the middle one (F = left, J = right).
// Congruent: all five agree. Incongruent: the four flankers point the other way.

export const ARROW_DEFAULTS = {
  trials: 48,
  practice: 8,
  fixationMs: 500,
  deadlineMs: 2000,
  itiMinMs: 500,
  itiMaxMs: 1000,
  feedbackMs: 800,
  maxRun: 3, // no more than this many identical stimuli in a row
  minRtMs: 150, // faster correct responses are counted as anticipations, not RTs
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TYPES = [
  { target: 'left', congruency: 'congruent' },
  { target: 'left', congruency: 'incongruent' },
  { target: 'right', congruency: 'congruent' },
  { target: 'right', congruency: 'incongruent' },
]

// '<' / '>' per arrow, middle one is the target.
export function stimulusOf(target, congruency) {
  const t = target === 'left' ? '<' : '>'
  const f = congruency === 'congruent' ? t : (t === '<' ? '>' : '<')
  return f + f + t + f + f
}

function hasLongRun(list, maxRun) {
  let run = 1
  for (let i = 1; i < list.length; i++) {
    run = list[i].stimulus === list[i - 1].stimulus ? run + 1 : 1
    if (run > maxRun) return true
  }
  return false
}

// n trials, an equal number of each of the four types (n must be a multiple
// of 4), shuffled until no stimulus repeats more than maxRun times in a row.
// Each trial carries its own jittered gap, so the whole block is fixed by seed.
export function buildTrials(n, seed, opts = {}) {
  const o = { ...ARROW_DEFAULTS, ...opts }
  if (n % 4 !== 0) throw new Error(`trial count must be a multiple of 4, got ${n}`)
  const rand = mulberry32(seed)
  const base = []
  for (let i = 0; i < n / 4; i++) for (const t of TYPES) base.push({ ...t, stimulus: stimulusOf(t.target, t.congruency) })
  let list = base
  for (let attempt = 0; attempt < 10000; attempt++) {
    list = base.slice()
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]]
    }
    if (!hasLongRun(list, o.maxRun)) break
  }
  return list.map((t, i) => ({
    ...t,
    index: i + 1,
    itiMs: Math.round(o.itiMinMs + rand() * (o.itiMaxMs - o.itiMinMs)),
  }))
}

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

// trials: [{ congruency, correct, rtMs, timeout }]
export function scoreBlock(trials, opts = {}) {
  const o = { ...ARROW_DEFAULTS, ...opts }
  const answered = trials.filter(t => !t.timeout)
  const rtOk = t => t.correct && !t.timeout && t.rtMs >= o.minRtMs
  const by = c => trials.filter(t => t.congruency === c)
  const acc = ts => (ts.length ? ts.filter(t => t.correct).length / ts.length : null)
  const rt = ts => mean(ts.filter(rtOk).map(t => t.rtMs))
  const con = rt(by('congruent'))
  const inc = rt(by('incongruent'))
  return {
    n: trials.length,
    timeouts: trials.length - answered.length,
    anticipations: trials.filter(t => t.correct && !t.timeout && t.rtMs < o.minRtMs).length,
    accuracy: acc(trials),
    accuracyCongruent: acc(by('congruent')),
    accuracyIncongruent: acc(by('incongruent')),
    meanRtMs: rt(trials),
    meanRtCongruentMs: con,
    meanRtIncongruentMs: inc,
    congruencyEffectMs: con != null && inc != null ? inc - con : null,
  }
}
