// Run directly:  node src/components/study/practiceTask/practiceTask.test.mjs
//
// The two pieces of the practice task whose arithmetic decides what is saved:
// where the breathing pacer is at a given visible time, and how time away from
// the page is counted.

import { breathAt, BREATH_DEFAULTS } from './breathTiming.js'
import { createAwayTracker } from './awayTracker.js'
import { PASSAGES } from './readingPassages.js'
import { holdSummary } from './breathHold.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}
const near = (a, b) => Math.abs(a - b) < 1e-9

// ── 1. Pacer timing (4 s in, 6 s out, 2.5 s settle, 240 s) ───────────────────
check('settles first, circle small', breathAt(0).phase === 'settle' && breathAt(2499).phase === 'settle' && breathAt(0).scale === 0.55)
check('first breath in starts after the settle', breathAt(2500).phase === 'in' && breathAt(2500).cycle === 1 && near(breathAt(2500).scale, 0.55))
check('full at the end of the in-breath', near(breathAt(2500 + 3999.999).scale, 1) || breathAt(2500 + 3999.999).scale > 0.9999)
check('out-breath follows at 4 s', breathAt(6500).phase === 'out' && near(breathAt(6500).scale, 1))
check('second breath at 14.5 s', breathAt(14500).phase === 'in' && breathAt(14500).cycle === 2)
check('6 breaths a minute', BREATH_DEFAULTS.inhale_ms + BREATH_DEFAULTS.exhale_ms === 10000)
check('done at the planned length, not before', !breathAt(239999).done && breathAt(240000).done && breathAt(240000).progress === 1)
check('a short preview length is honoured', breathAt(30000, { breathing_seconds: 30 }).done)

// the natural shape: an even S in, front-loaded out; symmetric keeps the prototype's cosine
const outAt = (x, shape) => breathAt(2500 + 4000 + 6000 * x, { shape }).scale
const fill = s => (s - 0.55) / 0.45
check('natural is the default shape', BREATH_DEFAULTS.shape === 'natural')
check('natural exhale is past halfway out by its midpoint', fill(outAt(0.5)) < 0.45 && near(fill(outAt(0.5, 'symmetric')), 0.5))
check('natural exhale settles slowly at the end', fill(outAt(0.9)) > fill(outAt(0.9, 'symmetric')))
check('natural inhale is about half in at its midpoint', Math.abs(fill(breathAt(2500 + 2000).scale) - 0.47) < 0.01)
check('natural meets the end points', near(breathAt(6500).scale, 1) && near(outAt(0.9999999), 0.55) || Math.abs(outAt(0.9999999) - 0.55) < 1e-6)
{
  let prev = 2, mono = true
  for (let x = 0; x <= 1; x += 0.01) { const v = outAt(x); if (v > prev + 1e-12) mono = false; prev = v }
  check('natural exhale never refills', mono)
}

// ── 2. Time away ────────────────────────────────────────────────────────────
{
  let t = 0
  const doc = { hidden: false, l: null, addEventListener(_, f) { this.l = f }, removeEventListener() { this.l = null } }
  const away = createAwayTracker({ doc, now: () => t })
  t = 1000; doc.hidden = true;  doc.l()
  t = 4000; doc.hidden = false; doc.l()
  t = 5000; doc.hidden = true;  doc.l()
  t = 5500; doc.hidden = true;  doc.l()     // a repeated hidden event is not a second departure
  check('read() includes time still away', away.read().hidden_ms === 3500 && away.read().left_page_count === 2)
  t = 6000
  const out = away.stop()
  check('stop() closes an open absence and counts departures', out.hidden_ms === 4000 && out.left_page_count === 2)
  t = 9000
  check('stop() is idempotent', away.stop().hidden_ms === 4000 && doc.l === null)
}
{
  let t = 100
  const doc = { hidden: true, addEventListener() {}, removeEventListener() {} }
  const away = createAwayTracker({ doc, now: () => t })
  t = 600
  check('starting hidden counts the time but not a departure', away.stop().hidden_ms === 500 && away.read().left_page_count === 0)
}

// ── 3. The stand-in passage is intact ──────────────────────────────────────────
{
  const p = PASSAGES.mail_sorting_centre
  check('eight paragraphs and three questions', p.paragraphs.length === 8 && p.questions.length === 3)
  check('every question has four options and a valid key', p.questions.every(q => q.o.length === 4 && q.o[q.correct] !== undefined))
  check('keys match section 2c', p.questions.map(q => q.correct).join() === '0,1,1')
}

// ── 4. The hold-while-breathing-in check ───────────────────────────────────────
{
  const END = 240000
  const starts = Array.from({ length: 24 }, (_, k) => 2500 + 10000 * k)
  const exact = holdSummary(starts.map(s => ({ down: s, up: s + 4000 })), BREATH_DEFAULTS, END)
  check('holding exactly through each in-breath scores 100',
    exact.breaths === 24 && exact.cycles_pressed === 24 && exact.inhale_held_pct === 100 && exact.exhale_held_pct === 0 &&
    exact.balanced_pct === 100 && exact.onset_lag_ms === 0 && exact.release_lag_ms === 0 && exact.phase_r === 1 && exact.phase_lag_ms === 0)
  const always = holdSummary([{ down: 0, up: END }], BREATH_DEFAULTS, END)
  check('holding throughout scores 50, like never pressing',
    always.inhale_held_pct === 100 && always.exhale_held_pct === 100 && always.balanced_pct === 50 && always.release_lag_ms === null)
  const never = holdSummary([], BREATH_DEFAULTS, END)
  check('never pressing scores 50 with no lags', never.balanced_pct === 50 && never.cycles_pressed === 0 && never.phase_r === null && never.onset_lag_ms === null)
  const late = holdSummary(starts.map(s => ({ down: s + 500, up: s + 4500 })), BREATH_DEFAULTS, END)
  check('half a second late in both directions',
    late.inhale_held_pct === 87.5 && late.exhale_held_pct === 8.5 && late.onset_lag_ms === 500 && late.release_lag_ms === 500 && late.phase_lag_ms === 500 && late.phase_r === 1)
  const early = holdSummary([{ down: 1500, up: 6000 }], BREATH_DEFAULTS, END)
  check('a press just before the in-breath counts for it, as a negative lag', early.cycles_pressed === 1 && early.onset_lag_ms === -1000)
  const open = holdSummary([{ down: 232500, up: null }], BREATH_DEFAULTS, END)
  check('a press still held at the end closes there and has no release', open.presses === 1 && open.release_lag_ms === null && open.cycles_pressed === 1)
}

console.log(`practiceTask: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
