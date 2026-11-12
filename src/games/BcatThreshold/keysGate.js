// ── BCAT threshold: the keys-up gate ────────────────────────────────────────
//
// Pure and node-testable (keysGate.test.mjs). In the touch and breath arms a trial does not start while W or
// S is down (PLAN.md section 3, timeline step 1): a hold already down at fixation onset has no onset to score
// (keyLog.js), so the circle waits, with a short cue, until both are up. The vision arm never waits: its keys
// are logged, not asked for.
//
// `held` is createKeyTracker().held() (keyLog.js): the keys down right now. A key whose key-up was lost
// (the window lost focus) is cleared by tracker.releaseAll() on blur, so the gate cannot wait on a phantom.

import { roleOf } from './keyLog.js'

export const ARMS = Object.freeze(['vision', 'touch', 'breath'])

/** True for the arms that hold W and S along with the circle. */
export function armUsesPacerKeys(arm) {
  if (!ARMS.includes(arm)) throw new Error(`Unknown arm ${JSON.stringify(arm)}`)
  return arm !== 'vision'
}

/** The pacer roles ('grow' | 'shrink') among the keys held now, in order, without duplicates. */
export function pacerKeysHeld(held, keys) {
  const out = []
  for (const h of held || []) {
    const r = roleOf(h.key, h.code, keys)
    if ((r === 'grow' || r === 'shrink') && !out.includes(r)) out.push(r)
  }
  return out
}

/** Must the next trial wait before fixation onset? */
export function mustWaitForRelease(arm, held, keys) {
  return armUsesPacerKeys(arm) && pacerKeysHeld(held, keys).length > 0
}
