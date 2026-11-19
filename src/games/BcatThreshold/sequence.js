// ── BCAT threshold: trial sequencing and the interruption rule ──────────────
//
// Pure and node-testable (sequence.test.mjs). The ONE place that decides what happens to a trial during
// which the participant left the page: INTERRUPTION_POLICY below. Change it here, nowhere else.
//
// A trial is interrupted when the window lost focus, the page was hidden, or full screen was left
// (fullscreen.js) at any time from fixation onset to the end of the last pulse (the circle), or the page was
// already hidden when the circle started ('hidden_at_start'), or the window did not have the focus when it
// started ('unfocused_at_start'; review item 1, 2026-11-19: a blur that let go of W and S could open the keys-up
// gate and start the circle in an unfocused window). Leaving while the question is up is allowed: the instructions tell
// people to take breaks before answering. Several losses in one trial (a blur and a full-screen exit together)
// are one interruption: the trial is flagged, withheld and repeated once, and every reason is recorded.
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
//
// The cap (review item 2, 2026-11-19): each withheld change trial makes the engine add one, so a participant whose
// every trial is interrupted would never finish (a 9-trial demo was still running after 300 trials). Past
// maxWithheld withheld main trials in a session (a resume chain counts as one), mainAnswered says `capped`, the
// trial is not queued again, and session.js ends the run with status 'interruption_cap' (records.js). Repeats are
// at most one per withheld trial, so they are capped with it. The 60-minute time limit (sessionRules.js) bounds
// the session as well; both stay.

export const INTERRUPTION_POLICY = Object.freeze({
  /** show an interrupted main trial once more after the last engine trial (data only) */
  repeatOnce: true,
  /** send an interrupted main trial to the engine as unanswered (response null) */
  withholdFromEngine: true,
  /** end the run once more than this many main trials have been withheld (null: no cap) */
  maxWithheld: 10,
})

/** The focus events that interrupt a circle. A 'focus', 'visible' or 'fullscreen_enter' alone does not. */
export const LOSS_EVENTS = Object.freeze(['blur', 'hidden', 'fullscreen_exit'])

/**
 * Why the circle was interrupted: the distinct losses during it, in the order they first came
 * ('hidden_at_start' first when the page was hidden as it began); [] when it was not.
 * focusEvents: [{ type: 'blur'|'focus'|'hidden'|'visible'|'fullscreen_exit'|'fullscreen_enter', t }] on the
 * trial clock (ms from fixation onset).
 * @param {{ startMs?: number, endMs: number, hiddenAtStart?: boolean }} window  the circle's span
 */
export function interruptionReasons(focusEvents, { startMs = 0, endMs, hiddenAtStart = false, unfocusedAtStart = false }) {
  if (typeof endMs !== 'number' || Number.isNaN(endMs)) throw new Error('interruptionReasons: endMs is required')
  const out = hiddenAtStart ? ['hidden_at_start'] : []
  if (unfocusedAtStart) out.push('unfocused_at_start')
  for (const e of focusEvents || []) {
    if (LOSS_EVENTS.includes(e.type) && e.t >= startMs && e.t <= endMs && !out.includes(e.type)) out.push(e.type)
  }
  return out
}

/** Was the circle interrupted? (interruptionReasons is not empty) */
export function wasInterrupted(focusEvents, { startMs = 0, endMs, hiddenAtStart = false, unfocusedAtStart = false }) {
  if (hiddenAtStart || unfocusedAtStart) return true
  if (typeof endMs !== 'number' || Number.isNaN(endMs)) throw new Error('wasInterrupted: endMs is required')
  return interruptionReasons(focusEvents, { startMs, endMs }).length > 0
}

/**
 * The running order of one session's trials: a numbering of everything shown (seq, 1-based, practice
 * included) and the queue of repeats. One per run.
 * @param {{ repeatOnce?: boolean, withholdFromEngine?: boolean }} [policy]
 */
export function createTrialSequence(policy = INTERRUPTION_POLICY, restored = null) {
  const pol = { ...INTERRUPTION_POLICY, ...policy }
  let seq = 0
  const queue = []              // repeats still to show: { spec, repeatOf }
  const repeated = new Set()    // trial_index values already queued (each at most once)
  // Resume (resume.js): the repeats the chain had queued and not yet shown, and every trial_index already queued.
  // seq starts again at 1: it numbers what is shown in THIS run (records.js).
  let withheldN = restored && Number.isInteger(restored.withheld) ? restored.withheld : 0
  if (restored) {
    for (const t of restored.repeated || []) repeated.add(t)
    for (const p of restored.pending || []) { queue.push({ spec: p.spec, repeatOf: p.repeatOf }); repeated.add(p.repeatOf) }
  }
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
      if (interrupted && pol.withholdFromEngine) withheldN += 1
      const capped = pol.maxWithheld !== null && pol.maxWithheld !== undefined && withheldN > pol.maxWithheld
      let repeatQueued = false
      if (interrupted && pol.repeatOnce && !capped && !repeated.has(spec.trial_index)) {
        repeated.add(spec.trial_index)
        queue.push({ spec, repeatOf: spec.trial_index })
        repeatQueued = true
      }
      return { engineResponse, withheld: engineResponse === null && response !== null, repeatQueued, ...(capped ? { capped: true } : {}) }
    },
    /** Main trials withheld from the engine so far (interrupted ones, whatever was answered). */
    get withheldCount() { return withheldN },
    /** The next repeat to show once the engine has finished, or null. A repeat is never queued again. */
    takeRepeat() { return queue.length ? queue.shift() : null },
    get pendingRepeats() { return queue.length },
  }
}
