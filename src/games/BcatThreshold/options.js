// ── BCAT threshold: which arm and which version a run is ───────────────────
//
// Pure and node-testable (options.test.mjs).
//
// In a study the arm comes ONLY from the assignment slot `bcat_arm`, drawn and balanced by the server
// (website.md section 28; PLAN.md section 5). With no valid value the step fails closed: it shows an error
// and never picks an arm itself. Nothing in a study run reads the URL: no arm, no demo, no simulation.
//
// In a preview (the Task Library's no-save player, website.md section 25a, or the dev route) the URL may set
// them:  ?arm=vision|touch|breath   &demo=1 (about 9 trials)   &simulate=1 (a simulated observer, no display)
//        &practice=0 (skip the practice).
// A share link with the short version on (quick_demo) counts as demo=1. No seed parameter exists: every run
// draws its own (records.js, newSeed).

import { ARMS } from './keysGate.js'

export const ARM_SLOT = 'bcat_arm'

/** The study arm from the step's assignments, or null (then the step must not start). */
export function armFromAssignments(assignments) {
  const v = assignments && typeof assignments === 'object' ? assignments[ARM_SLOT] : undefined
  return ARMS.includes(v) ? v : null
}

/** Preview options from a query string. `quickDemo`: the preview player's short-version switch. */
export function previewOptions(search, { quickDemo = false } = {}) {
  const q = new URLSearchParams(search || '')
  const arm = ARMS.includes(q.get('arm')) ? q.get('arm') : null
  return {
    arm,
    demo: quickDemo || q.get('demo') === '1',
    simulate: q.get('simulate') === '1',
    practice: q.get('practice') !== '0',
  }
}

/**
 * What a mounted step runs.
 * @returns {{ arm, demo, simulate, practice } | { chooser: true, demo, simulate, practice } | { error: 'no_arm' }}
 */
export function initialChoice({ studyMode, preview, assignments, search, quickDemo }) {
  if (studyMode) {
    const arm = armFromAssignments(assignments)
    return arm ? { arm, demo: false, simulate: false, practice: true } : { error: 'no_arm' }
  }
  if (preview) {
    const o = previewOptions(search, { quickDemo })
    return o.arm ? o : { ...o, chooser: true }
  }
  return { error: 'no_arm' }   // neither a study step nor a no-save preview: refuse rather than guess
}
