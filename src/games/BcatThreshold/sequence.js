// ── BCAT threshold: trial sequencing and the interruption rule ──────────────
//
// Pure and node-testable (sequence.test.mjs). The ONE place that decides what happens to a trial during
// which the participant left the page: INTERRUPTION_POLICY below. Change it here, nowhere else.
//
// A trial is interrupted when the window lost focus or the page was hidden at any time from fixation onset
// to the end of the last pulse (the circle), or the page was already hidden when the circle started. Leaving
// while the question is up is allowed: the instructions tell people to take breaks before answering.
//
// With the policy on (the default, PLAN.md decision 9.8 "flag and repeat once"):
//   - the trial is flagged (`interrupted: true` on its row) and the participant still answers it, so the
//     flow does not change and their answer is kept as data;
//   - its answer is NOT given to the engine: the engine gets response null, its own path for a trial that
//     gives no information (the posterior is untouched; replay accepts null). For a change trial the engine
//     then adds a change trial of that direction at its current level, so the threshold estimate loses
//     nothing; see trialPlan.js's header for exactly how an unanswered trial shifts the rest;
//   - the same stimulus (cell, level, pulses) is shown once more after the last engine trial, as a
//     `repeat` trial with `repeat_of` set. It is data only: the engine has finished by then and never sees
//     it. A repeat that is itself interrupted is flagged and not repeated again ("once").
// Practice trials are flagged but never withheld or repeated.
//
// With repeatOnce false the interrupted trial is flagged only and nothing is shown again; with
// withholdFromEngine false its answer goes to the engine as given. The two switches are independent.

export const INTERRUPTION_POLICY = Object.freeze({
  /** show an interrupted main trial once more after the last engine trial (data only) */
  repeatOnce: true,
  /** send an interrupted main trial to the engine as unanswered (response null) */
  withholdFromEngine: true,
})

/**
 * Was the circle interrupted? focusEvents: [{ type: 'blur'|'focus'|'hidden'|'visible', t }] on the trial clock
 * (ms from fixation onset). Only losses count; a 'focus' or 'visible' alone does not.
 * @param {{ startMs?: number, endMs: number, hiddenAtStart?: boolean }} window  the circle's span
 */
export function wasInterrupted(focusEvents, { startMs = 0, endMs, hiddenAtStart = false }) {
  if (hiddenAtStart) return true
  if (typeof endMs !== 'number' || Number.isNaN(endMs)) throw new Error('wasInterrupted: endMs is required')
  return (focusEvents || []).some(e => (e.type === 'blur' || e.type === 'hidden') && e.t >= startMs && e.t <= endMs)
}

/**
 * The running order of one session's trials: a numbering of everything shown (seq, 1-based, practice
 * included) and the queue of repeats. One per run.
 * @param {{ repeatOnce?: boolean, withholdFromEngine?: boolean }} [policy]
 */
export function createTrialSequence(policy = INTERRUPTION_POLICY) {
  const pol = { ...INTERRUPTION_POLICY, ...policy }
  let seq = 0
  const queue = []              // repeats still to show: { spec, repeatOf }
  const repeated = new Set()    // trial_index values already queued (each at most once)
  return {
    policy: Object.freeze({ ...pol }),
    /** The next row number. Every trial shown gets one, in order. */
    nextSeq() { seq += 1; return seq },
    get seq() { return seq },
    /**
     * A main (engine) trial was answered. Returns what to send to the engine and whether it was queued again.
     * @param {{ spec: object, response: string|null, interrupted: boolean }} t
     */
    mainAnswered({ spec, response, interrupted }) {
      if (!spec || typeof spec.trial_index !== 'number') throw new Error('mainAnswered: spec with a trial_index is required')
      if (response === undefined) throw new Error('mainAnswered: response is required (null when unanswered)')
      const engineResponse = interrupted && pol.withholdFromEngine ? null : response
      let repeatQueued = false
      if (interrupted && pol.repeatOnce && !repeated.has(spec.trial_index)) {
        repeated.add(spec.trial_index)
        queue.push({ spec, repeatOf: spec.trial_index })
        repeatQueued = true
      }
      return { engineResponse, withheld: engineResponse === null && response !== null, repeatQueued }
    },
    /** The next repeat to show once the engine has finished, or null. A repeat is never queued again. */
    takeRepeat() { return queue.length ? queue.shift() : null },
    get pendingRepeats() { return queue.length },
  }
}
