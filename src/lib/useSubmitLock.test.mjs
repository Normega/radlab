// Run directly:  node src/lib/useSubmitLock.test.mjs
//
// The regression this pins down is not "a submit ran twice" -- it is a submit
// that never ran at all. On 2026-08-20 two Breath Belt participants froze on
// PHQ-4: StudySessionRunner rendered StepDispatcher without a per-step key, so
// PANAS and PHQ-4 shared one QuestionnaireStepWrapper, and the lock PANAS left
// held made PHQ-4's submit a no-op. Because onComplete is called INSIDE the
// locked callback, skipping the submit also skips the advance -- the session
// stops dead, with no insert and no request of any kind to show for it.
//
// So the cases below come in pairs: the lock must still refuse a genuine
// repeat, and must still let go the moment the subject changes.

import { createSubmitLock } from './useSubmitLock.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

// 1. One-shot: a completed submit does not repeat.
{
  const lock = createSubmitLock()
  let runs = 0
  const a = await lock.run(async () => { runs++ })
  const b = await lock.run(async () => { runs++ })
  check('first run executes',        a.skipped === false && runs === 1)
  check('second run is skipped',     b.skipped === true  && runs === 1)
}

// 2. A failed submit stays retryable -- otherwise a participant whose insert
//    failed is stranded on a dead button.
{
  const lock = createSubmitLock()
  let runs = 0
  await lock.run(async () => { runs++; throw new Error('insert failed') })
    .then(() => check('failure rethrows', false), () => check('failure rethrows', true))
  check('lock released after failure', lock.locked === false)
  const retry = await lock.run(async () => { runs++ })
  check('retry executes', retry.skipped === false && runs === 2)
}

// 3. THE REGRESSION. One instance, two subjects in turn: the second must run.
{
  const lock = createSubmitLock()
  const ran = []
  lock.rekey('panas')
  await lock.run(async () => { ran.push('panas') })
  check('first questionnaire submitted', ran.length === 1)

  lock.rekey('phq-4')                       // wrapper reused, renderer remounted
  check('lock released on new subject', lock.locked === false)
  const second = await lock.run(async () => { ran.push('phq-4') })
  check('second questionnaire submitted',  second.skipped === false)
  check('both subjects recorded',          ran.join(',') === 'panas,phq-4')
}

// 4. Rekeying to the SAME subject must not release -- a re-render mid-submit
//    would otherwise reopen the very gap the lock exists to close.
{
  const lock = createSubmitLock()
  let runs = 0
  lock.rekey('panas')
  await lock.run(async () => { runs++ })
  lock.rekey('panas')                       // re-render, same step
  lock.rekey('panas')
  const again = await lock.run(async () => { runs++ })
  check('same subject stays locked', again.skipped === true && runs === 1)
}

// 5. An unkeyed lock (the form steps, which submit one thing and finish) keeps
//    the plain one-shot behaviour, including across a re-render.
{
  const lock = createSubmitLock()
  let runs = 0
  lock.rekey(undefined)
  await lock.run(async () => { runs++ })
  lock.rekey(undefined)
  const again = await lock.run(async () => { runs++ })
  check('unkeyed lock is one-shot', again.skipped === true && runs === 1)
}

// 6. Same-tick double fire -- the original reason the lock is a ref and not
//    state. Both calls are made before either has a chance to settle.
{
  const lock = createSubmitLock()
  let runs = 0
  const slow = async () => { runs++; await new Promise(r => setTimeout(r, 10)) }
  const [x, y] = await Promise.all([lock.run(slow), lock.run(slow)])
  check('same-tick double fire runs once', runs === 1)
  check('one of the two is skipped', (x.skipped === true) !== (y.skipped === true))
}

console.log(`useSubmitLock: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
