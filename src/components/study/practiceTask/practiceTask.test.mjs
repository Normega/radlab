// Run directly:  node src/components/study/practiceTask/practiceTask.test.mjs
//
// The two pieces of the practice task whose arithmetic decides what is saved:
// where the breathing pacer is at a given visible time, and how time away from
// the page is counted.

import { breathAt, BREATH_DEFAULTS } from './breathTiming.js'
import { createAwayTracker } from './awayTracker.js'
import { PASSAGES } from './readingPassages.js'

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

console.log(`practiceTask: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
