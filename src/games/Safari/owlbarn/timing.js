/* ── Owl Barn timing ─────────────────────────────────────────────────────────

   Pure functions, no DOM - the engine and the tests share them.

   The task is Norm's Risk Flexibility paradigm (RiskFlex.iqx, 2013) in a barn:
   silence windows whose length rises and falls on a triangle wave; in each one
   the player may tap 3 times (1 step, safe) or 8 times (2 steps, risky).

   Calibration follows RiskFlex: a window's worth of taps is timed from the go
   cue to the last tap, so the measured value includes reaction time - which is
   what the player really needs inside a silence window.

   Decisions recorded in docs/markdowns/safari_build_plan.md:
     * D6  two corridors, 20 steps
     * D9  a wrong tap count is a swoop, back 2 steps (the doorway is a checkpoint)
     * §2.2 a window is "long" (8 taps optimal) only if it is at least the
       player's measured 8-tap time - the old build labelled windows 6-10 long
       by position, which marked windows the player could not physically use.
──────────────────────────────────────────────────────────────────────────── */

export const STEPS_PER_CORRIDOR = 10
export const STEPS_TOTAL = 20
export const SWOOP_BACK = 2
export const HOOT_MIN_MS = 3000
export const HOOT_MAX_MS = 5000
export const HOOT_MEAN_MS = (HOOT_MIN_MS + HOOT_MAX_MS) / 2
export const SAFE_CLAMP = [300, 1000]
export const RISKY_MAX = 2500
export const RISKY_HEADROOM_MS = 300   // RiskFlex adds this once, before the first test window
export const WINNUM_MAX = 10
export const MAX_WINDOWS = 120         // a session that has not crossed by now ends gracefully

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function median(xs) {
  const a = xs.filter(Number.isFinite).slice().sort((p, q) => p - q)
  if (!a.length) return null
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/** Calibration → the two anchor windows. `t3` / `t8`: ms from go cue to the 3rd / 8th tap on valid trials. */
export function summariseCalibration(t3, t8) {
  const m3 = median(t3), m8 = median(t8)
  if (m3 == null || m8 == null) return null
  const safeMs = Math.round(clamp(m3, SAFE_CLAMP[0], SAFE_CLAMP[1]))
  const riskyMs = Math.round(clamp(m8, safeMs + 100, RISKY_MAX))
  return { safeMs, riskyMs, raw3: m3, raw8: m8 }
}

/** The RiskFlex schedule: windownum 10→1→10…, window = safe + (n-1)·step, top window = risky + headroom. */
export function makeSchedule({ safeMs, riskyMs }) {
  const stepMs = Math.round((riskyMs + RISKY_HEADROOM_MS - safeMs) / (WINNUM_MAX - 1))
  return {
    safeMs, riskyMs, stepMs,
    windowMs: (winnum) => safeMs + (winnum - 1) * stepMs,
  }
}

/** Advance the triangle wave. Starts at 10 going down; bounces at 1 and 10. */
export function nextWinnum(winnum, dir) {
  let n = winnum + dir, d = dir
  if (n <= 1) { n = 1; d = 1 }
  else if (n >= WINNUM_MAX) { n = WINNUM_MAX; d = -1 }
  return { winnum: n, dir: d }
}

/** 8 taps is the optimal choice only when the window can physically hold them. */
export const optimalChoice = (windowMs, riskyMs) => (windowMs >= riskyMs ? '8tap' : '3tap')

/** What a completed silence window earns. 8 taps resolve early (on the 8th tap), everything else at expiry. */
export function resolveWindow(tapCount) {
  if (tapCount === 0) return { choice: 'no_input', outcome: 'no_input', delta: 0 }
  if (tapCount === 3) return { choice: '3tap', outcome: 'success', delta: 1 }
  if (tapCount === 8) return { choice: '8tap', outcome: 'success', delta: 2 }
  return { choice: `${tapCount}tap`, outcome: 'wrong_count', delta: -SWOOP_BACK }
}

/** Apply a step change; the doorway (step 10) is a checkpoint once the mouse is through it. */
export function applySteps(step, delta) {
  const floor = step >= STEPS_PER_CORRIDOR ? STEPS_PER_CORRIDOR : 0
  return clamp(step + delta, floor, STEPS_TOTAL)
}

/**
 * Best possible crossing time for this calibration: play the schedule from the start, choosing
 * optimally every window with an average hoot between windows. A 3-tap window lasts its full
 * length (the count resolves at expiry); an 8-tap window lasts only as long as the 8 taps.
 */
export function theoreticalMinimumMs(schedule, hootMs = HOOT_MEAN_MS) {
  let winnum = WINNUM_MAX, dir = -1, steps = 0, t = 0, guard = 0
  while (steps < STEPS_TOTAL && guard++ < 1000) {
    const w = schedule.windowMs(winnum)
    const eight = w >= schedule.riskyMs
    t += hootMs + (eight ? schedule.riskyMs : w)
    steps += eight ? 2 : 1
    ;({ winnum, dir } = nextWinnum(winnum, dir))
  }
  return Math.round(t)
}

export const TIERS = [
  { max: 1.25, name: 'Master of Silence', line: 'You are uncomfortably competent.' },
  { max: 1.75, name: 'Owl Approved', line: 'Not bad. For something without wings.' },
  { max: 2.5, name: 'Adequately Stealthy', line: 'You made it. We choose not to be embarrassed.' },
  { max: Infinity, name: 'Lucky Mouse', line: 'We had you. We simply chose not to try.' },
]
export const tierFor = (ratio) => TIERS.find(t => ratio <= t.max)

/** Summary rates over the recorded windows (swoop-lockout windows excluded, as in the spec). */
export function summariseWindows(windows) {
  const act = windows.filter(w => w.kind === 'silence' && !w.locked)
  const long = act.filter(w => w.optimal === '8tap'), short = act.filter(w => w.optimal === '3tap')
  const acted = act.filter(w => w.choice !== 'no_input')
  const rate = (n, d) => (d ? +(n / d).toFixed(3) : null)
  return {
    windows: act.length,
    efficiency: rate(acted.filter(w => w.choice === w.optimal && w.outcome === 'success').length, acted.length),
    long_window_8tap_rate: rate(long.filter(w => w.choice === '8tap' && w.outcome === 'success').length, long.length),
    short_window_3tap_rate: rate(short.filter(w => w.choice === '3tap' && w.outcome === 'success').length, short.length),
    short_window_8tap_attempt_rate: rate(short.filter(w => w.tapCount > 3).length, short.length),
    no_input_rate: rate(act.filter(w => w.choice === 'no_input').length, act.length),
    wrong_count: act.filter(w => w.outcome === 'wrong_count').length,
    hoot_taps: windows.filter(w => w.kind === 'hoot_tap').length,
  }
}
