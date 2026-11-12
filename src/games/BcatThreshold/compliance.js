// ── BCAT threshold: compliance and the reminders ───────────────────────────
//
// Pure and node-testable (compliance.test.mjs). Did the participant do what their arm asks while the circle
// pulsed, and what to show before the next trial (Norm, 2026-11-12). Compliance is data and a prompt, never an
// input: it changes nothing the engine is told (session.js sends the answer exactly as before) and nothing in
// cfg.engine (the settings are cfg.compliance, outside the config hash).
//
// The rule, per trial, from its key log (keyLog.js) and the circle's schedule:
//   touch, breath  coverage = the share of the circle's movement time (every half-pulse, grow and shrink) during
//                  which the right key was held: sum over halves of the existing per-half coverage times the
//                  half's planned length, over the summed length. Same parse and scoring as the trial's
//                  key_summary (scoreHolds; blur-closed holds give no coverage). Non-compliant when
//                  coverage < cfg.compliance.min_coverage (0.5).
//   vision         non-compliant when W or S was down at any time during the pulses (first pulse start to the
//                  circle's end) in a press of at least cfg.compliance.vision_min_press_ms (0: any press). Only
//                  the grow and shrink keys count. The key log closes when the circle ends, so the arrow-key
//                  answer is never in it; a press entirely inside the still fixation does not count.
//   not assessed   (compliant null) when the trial was interrupted (sequence.js: focus lost or page hidden
//                  during the circle) or its key log has a blur, or nothing could be scored. Such a trial
//                  follows the interruption rule only: it brings no reminder, and it neither adds to nor ends a
//                  run of non-compliant trials.
//
// The reminders (createComplianceTracker), when cfg.compliance.reminders is on:
//   line  the trial after a non-compliant one shows texts.complianceLine in the cue area during its fixation;
//         the presenter removes it in the first frame the circle moves (presenter.js).
//   page  after cfg.compliance.page_after (3) non-compliant trials in a row, a page with the arm's own
//         instruction sentences (texts.armReminderPage) and Continue comes before the next trial; the run
//         count then starts again from 0. That trial still gets the line (its previous trial was non-compliant).
// One run of trials across the whole session: practice, engine trials and repeats, in the order shown.

import { parseKeyLog, scoreHolds } from './keyLog.js'
import { halfPulses } from './pacerClock.js'
import { armUsesPacerKeys } from './keysGate.js'

const NOT_ASSESSED = reason => ({ compliant: null, coverage: null, ws_presses: null, ws_press_ms: null, skip: reason })

/**
 * Score one trial.
 * @param {object} o
 * @param {'vision'|'touch'|'breath'} o.arm
 * @param {object} o.cfg            makeConfig()
 * @param {{ events: object[] }} o.keys   the trial's key log (present()'s `keys`)
 * @param {{ timeline: object, t_end: number }} o.pres   the circle as it ran
 * @param {boolean} [o.interrupted]
 * @returns {{ compliant: boolean|null, coverage: number|null, ws_presses: number|null, ws_press_ms: number|null,
 *   skip: null|'interrupted'|'blurred'|'no_score' }}
 */
export function assessCompliance({ arm, cfg, keys, pres, interrupted = false }) {
  const pacer = armUsesPacerKeys(arm)
  if (interrupted) return NOT_ASSESSED('interrupted')
  if (!keys || !Array.isArray(keys.events) || !pres || !pres.timeline || typeof pres.t_end !== 'number') return NOT_ASSESSED('no_score')
  const kl = cfg.keyLog, cc = cfg.compliance
  let parsed
  try {
    parsed = parseKeyLog(keys.events, { endMs: pres.t_end, minHoldMs: kl.min_hold_ms, mergeGapMs: kl.merge_gap_ms })
  } catch (_) { return NOT_ASSESSED('no_score') }
  if (parsed.blurred) return NOT_ASSESSED('blurred')
  if (pacer) {
    const halves = scoreHolds(parsed, halfPulses(pres.timeline), { onsetWindowFrac: kl.onset_window_frac }).halves
      .filter(h => h.coverage !== null && h.plannedMs > 0)
    const total = halves.reduce((a, h) => a + h.plannedMs, 0)
    if (!(total > 0)) return NOT_ASSESSED('no_score')
    const coverage = halves.reduce((a, h) => a + h.coverage * h.plannedMs, 0) / total
    return { compliant: coverage >= cc.min_coverage, coverage, ws_presses: null, ws_press_ms: null, skip: null }
  }
  const from = pres.timeline.pulses.length ? pres.timeline.pulses[0].startMs : pres.timeline.fixationMs
  const to = pres.t_end
  const during = parsed.presses.filter(p => (p.role === 'grow' || p.role === 'shrink') &&
    p.t1 > from && p.t0 < to && p.durationMs >= cc.vision_min_press_ms)
  const ms = during.reduce((a, p) => a + Math.max(0, Math.min(p.t1, to) - Math.max(p.t0, from)), 0)
  return { compliant: during.length === 0, coverage: null, ws_presses: during.length, ws_press_ms: ms, skip: null }
}

/**
 * What session.js uses: the tracker plus the page. One per run.
 * @param {{ cfg: object, arm: string, showPage?: (() => Promise<void>) | null }} o
 *   showPage — shows the page reminder and resolves on Continue (the live step); null where nothing is shown
 *   (a simulated preview), in which case a page that falls due is recorded as not shown
 */
export function createCompliance({ cfg, arm, showPage = null }) {
  const tracker = createComplianceTracker(cfg)
  return {
    tracker,
    /** Before a trial: shows the page if one is due; resolves to { line, page } as shown. */
    async before() {
      const due = tracker.before()
      let page = false
      if (due.page && showPage) { await showPage(); page = true }
      return { line: due.line, page }
    },
    /** After a trial: its assessment (and the run count), from present()'s result. */
    after(shown) {
      return tracker.after(assessCompliance({ arm, cfg, keys: shown.keys, pres: shown.pres, interrupted: !!shown.interrupted }))
    },
  }
}

/**
 * The reminder state of one run. Ask before() before each trial is shown, and give after() each trial's
 * assessment once it has ended.
 * @param {object} cfg  makeConfig()
 */
export function createComplianceTracker(cfg) {
  const cc = cfg.compliance
  let previousNonCompliant = false, streak = 0
  return {
    get streak() { return streak },
    /**
     * What to show before the next trial: { line, page }. A page due now restarts the run count.
     * With reminders off both are false (compliance is still scored and recorded).
     */
    before() {
      if (!cc.reminders) return { line: false, page: false }
      const page = streak >= cc.page_after
      if (page) streak = 0
      return { line: previousNonCompliant, page }
    },
    /** A trial ended: returns its assessment with `streak`, the non-compliant run including it. */
    after(assessment) {
      if (assessment.compliant === null) previousNonCompliant = false          // not assessed: no reminder, run unchanged
      else if (assessment.compliant) { previousNonCompliant = false; streak = 0 } else { previousNonCompliant = true; streak += 1 }
      return { ...assessment, streak }
    },
  }
}
