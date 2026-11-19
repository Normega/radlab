// The Stage B review's findings (NextStudy/Thresholds/7_radlab_site_plan/STAGE_B_REVIEW.md, 2026-11-19), one test
// per fix, each failing on b07c15bf; plus the four mutations the suite missed (RT from question onset, a blur
// clearing the key tracker, hidden_at_start, ArrowLeft = slowed and ArrowRight = sped up).
// Run: node --test src/games/BcatThreshold/reviewFixes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeConfig, tryMakeConfig } from './config.js'
import { createLivePresenter } from './presenter.js'
import { presentCircle } from './trialLoop.js'
import { practiceTrials } from './trialPlan.js'
import { roleOf, createKeyTracker, createKeyLog } from './keyLog.js'
import { mustWaitForRelease } from './keysGate.js'
import { assessCompliance } from './compliance.js'
import { halfPulses } from './pacerClock.js'
import { createEngineClient, EngineTimeoutError } from './engineClient.js'
import { createSimulatedPresenter } from './simulate.js'
import { createTrialSequence, INTERRUPTION_POLICY } from './sequence.js'
import { runSession } from './session.js'
import { buildTrialPlan } from './trialPlan.js'
import { makeRunRecord } from './records.js'
import { pageContinueAllowed, MIN_PAGE_MS } from './pageInput.js'
import { instructionPages } from './texts.js'

const FRAME = 1000 / 60

// A live presenter on a fake window, document and frame clock. run() shows one whole trial and answers it.
function rig({ arm = 'touch', fixationMs = 100, hidden = false, hasFocus = true, timeOrigin = 1.7e12 } = {}) {
  const cfg = makeConfig({ fixationMs })
  const L = {}
  const win = { addEventListener: (t, f) => { L[t] = f }, removeEventListener: t => { delete L[t] } }
  const doc = { visibilityState: hidden ? 'hidden' : 'visible', hasFocus: () => hasFocus,
    addEventListener: (t, f) => { L[t] = f }, removeEventListener: t => { delete L[t] } }
  const frames = []
  let t = 1000
  const els = { circle: { style: {} }, question: { style: {} }, cue: { style: {} } }
  const p = createLivePresenter({ cfg, arm, els: () => els, setCue: () => {}, isCancelled: () => false, framePeriodMs: () => FRAME, runStart: 0,
    raf: cb => frames.push(cb), now: () => t, doc, win, timeOrigin })
  p.attach()
  const ev = (k, code, extra = {}) => ({ key: k, code, timeStamp: t, repeat: false, preventDefault() {}, ...extra })
  const key = (type, k, code, extra) => L[type](ev(k, code, extra))
  async function run({ spec = practiceTrials(cfg)[0], answers = [['ArrowRight', 300]], during = null, beforePresent = null, afterStart = null } = {}) {
    if (beforePresent) beforePresent(key, L)
    const shown = p.present({ phase: 'main', spec })
    await new Promise(r => setTimeout(r, 0))
    if (afterStart) { afterStart(key, L); await new Promise(r => setTimeout(r, 0)) }
    let onset = null
    for (let i = 0; i < 5000 && onset === null; i++) {
      const cb = frames.shift()
      if (!cb) { await new Promise(r => setTimeout(r, 0)); continue }
      cb(t)
      if (during) during(t, key, L, doc)
      if (els.question.style.visibility === 'visible') onset = t
      t += FRAME
      await Promise.resolve()
    }
    for (const [k, dt] of answers) {
      const at = onset + dt
      if (dt >= 0) t = at
      L.keydown({ key: k, code: k, timeStamp: at, repeat: false, preventDefault() {} })
      await Promise.resolve()
    }
    return { out: await shown, onset }
  }
  return { cfg, p, key, run, L, doc, setTime: v => { t = v }, get t() { return t } }
}

// ── the four mutations the suite missed ──

test('mutation: the response time is measured from the question onset, not from fixation', async () => {
  const r = rig({ arm: 'vision' })
  const { out } = await r.run({ answers: [['ArrowUp', 437]] })
  assert.ok(Math.abs(out.answer.rtMs - 437) < 1e-6, `rt ${out.answer.rtMs}`)
  assert.ok(out.answer.questionOnsetMs > 0)
})

test('mutation: ArrowLeft answers slowed, ArrowUp same, ArrowRight sped up', async () => {
  for (const [k, want] of [['ArrowLeft', 'slowed'], ['ArrowUp', 'same'], ['ArrowRight', 'sped_up']]) {
    const { out } = await rig({ arm: 'vision' }).run({ answers: [[k, 200]] })
    assert.equal(out.answer.response, want, k)
    assert.equal(out.answer.key, k)
  }
})

test('mutation: a page hidden when the circle starts makes the trial interrupted (hidden_at_start)', async () => {
  const { out } = await rig({ arm: 'vision', hidden: true }).run()
  assert.equal(out.interrupted, true)
  assert.ok(out.interruptionReasons.includes('hidden_at_start'))
})

test('mutation: a blur during the circle lets go of every key in the tracker', async () => {
  const r = rig({ arm: 'vision' })
  let blurred = false, heldBefore = null, heldAfter = null
  const { out } = await r.run({ during: (t, key, L) => {
    if (!blurred && t > 3000) { key('keydown', 'w', 'KeyW'); heldBefore = r.p.tracker.held().length; L.blur({ timeStamp: t }); heldAfter = r.p.tracker.held().length; blurred = true }
  } })
  assert.deepStrictEqual([heldBefore, heldAfter], [1, 0], 'W was held, and the blur let go of it')
  assert.equal(out.interrupted, true)
  assert.ok(out.keys.events.some(e => e.type === 'blur'), 'the key log closed its presses at the blur')
})

// ── item 1, scenario A: no focus at the trial's onset ──

test('item 1: a blur that lets go of W opens the keys-up gate, and the trial that starts unfocused is interrupted', async () => {
  const r = rig({ arm: 'touch' })
  let gateWaited = false
  const { out } = await r.run({
    beforePresent: key => key('keydown', 'w', 'KeyW'),                 // W still down: the gate waits
    afterStart: (key, L) => { gateWaited = r.p.tracker.held().length === 1; L.blur({ timeStamp: r.t }) },   // alt-tab
  })
  assert.equal(gateWaited, true)
  assert.equal(out.interrupted, true, 'it ran unfocused, so it is not a clean trial')
  assert.ok(out.interruptionReasons.includes('unfocused_at_start'))
  const before = await rig({ arm: 'touch', hasFocus: false }).run()
  assert.ok(before.out.interruptionReasons.includes('unfocused_at_start'), 'a window without the focus from the start')
  const focused = await rig({ arm: 'touch' }).run()
  assert.equal(focused.out.interrupted, false, 'with the focus nothing changes')
})

// ── item 3: layouts ──

test('item 3: W and S by the physical key on non-Latin layouts, Dvorak and IMEs; AZERTY keeps the character rule', () => {
  const keys = makeConfig().keys
  const cases = [
    ['ц', 'KeyW', 'grow'], ['ы', 'KeyS', 'shrink'], ['ς', 'KeyW', 'grow'], ['σ', 'KeyS', 'shrink'],
    ['Process', 'KeyW', 'grow'], [',', 'KeyW', 'grow'], ['o', 'KeyS', 'other'],
    ['w', 'KeyZ', 'grow'], ['z', 'KeyW', 'other'], ['W', 'KeyW', 'grow'], ['s', 'KeyS', 'shrink'],
    ['', 'KeyW', 'grow'], ['Unidentified', 'KeyS', 'shrink'], ['a', 'KeyA', 'other'],
  ]
  for (const [k, c, want] of cases) assert.equal(roleOf(k, c, keys), want, `${k} at ${c}`)
  // the instructions name the keys the physical codes are: W at KeyW, S at KeyS
  assert.equal(keys.grow.code, `Key${keys.grow.label}`)
  assert.equal(keys.shrink.code, `Key${keys.shrink.label}`)
  assert.match(instructionPages('touch', 4, keys)[1].paragraphs[0], /\[\[W\]\].*\[\[S\]\]/)
})

// ── item 10: lost key-ups, repeats after a blur, early answers ──

test('item 10: a key-up of Cmd (Meta) lets go of keys macOS never sent a key-up for; the keys-up gate opens', () => {
  const keys = makeConfig().keys
  const tr = createKeyTracker()
  tr.keydown({ key: 'w', code: 'KeyW' })
  tr.keydown({ key: 'Meta', code: 'MetaLeft' })
  tr.keyup({ key: 'Meta', code: 'MetaLeft' })   // no key-up for W arrives
  assert.equal(mustWaitForRelease('touch', tr.held(), keys), false)
})

test('item 10: after a blur, the auto-repeat of a key still held counts it as down again and is logged', () => {
  const keys = makeConfig().keys
  const tr = createKeyTracker()
  tr.keydown({ key: 's', code: 'KeyS' })
  tr.releaseAll()
  assert.equal(tr.keydown({ key: 's', code: 'KeyS', repeat: true }), 'resumed')
  assert.equal(tr.held().length, 1)
  assert.equal(tr.keydown({ key: 's', code: 'KeyS', repeat: true }), 'repeat', 'later repeats are repeats')
  const log = createKeyLog(keys)
  log.begin(0, [])
  assert.equal(log.keydown({ key: 's', code: 'KeyS', t: 50, repeat: true, resumed: true }), true)
  assert.equal(log.keydown({ key: 's', code: 'KeyS', t: 80, repeat: true }), false)
  assert.equal(log.events[0].resumed_by_repeat, true)
  assert.equal(log.repeats, 1)
})

test('item 10: an arrow press stamped before the question was painted is ignored and counted', async () => {
  const { out } = await rig({ arm: 'vision' }).run({ answers: [['ArrowLeft', -40], ['ArrowRight', 250]] })
  assert.equal(out.answer.response, 'sped_up', 'the first press after onset is the answer')
  assert.ok(out.answer.rtMs > 0)
  assert.equal(out.pres.answers_ignored_early, 1)
})

test('item 10: a worker that never answers fails the call instead of hanging', async () => {
  const silent = { postMessage() {}, terminate() {} }
  const engine = createEngineClient({ workerFactory: () => silent, timeouts: { default: 30 } })
  await assert.rejects(engine.call({ type: 'respond', trial_index: 1, response: 'same' }), EngineTimeoutError)
  engine.terminate()
})

test('item 10: an unknown mode comes back as an error for the error screen, not a throw', () => {
  const r = tryMakeConfig({ mode: 'belt' })
  assert.ok(r.error instanceof Error)
  assert.ok(tryMakeConfig({ mode: 'online' }).cfg)
})

test('item 10: Enter on a focused Continue (a keyboard click, detail 0) does not continue; nor anything too soon', () => {
  assert.equal(pageContinueAllowed({ detail: 0, shownAt: 0, now: 10000 }), false, 'Enter or Space on the focused button')
  assert.equal(pageContinueAllowed({ detail: 1, shownAt: 0, now: MIN_PAGE_MS - 1 }), false)
  assert.equal(pageContinueAllowed({ detail: 1, shownAt: 0, now: MIN_PAGE_MS }), true)
  assert.equal(pageContinueAllowed({ detail: 2, shownAt: 0, now: 5000 }), true)
})

// ── item 7: a late level shifts the schedule compliance is scored against ──

test('item 7: when the level comes late the circle holds, and the timeline it reports is the one that ran', async () => {
  const cfg = makeConfig({ fixationMs: 100 })
  const spec = practiceTrials(cfg)[1]
  let resolveSpec
  const specPromise = new Promise(r => { resolveSpec = r })
  const frames = []
  let t = 0
  const recP = presentCircle({ cfg, specPromise, raf: cb => frames.push(cb), now: () => t, framePeriodMs: FRAME, render: () => {} })
  const t0 = 0
  for (let i = 0; i < 4000; i++) {
    const cb = frames.shift()
    if (!cb) break
    cb(t)
    if (t - t0 > 9600 + 1500 && resolveSpec) { resolveSpec(spec); resolveSpec = null }   // 1.5 s late
    t += FRAME
    await Promise.resolve()
  }
  const rec = await recP
  assert.ok(rec.level_wait_ms > 1000)
  const planned = rec.planned_timeline.pulses[2].startMs
  assert.ok(Math.abs(rec.timeline.pulses[2].startMs - (planned + rec.level_wait_ms)) < 1e-9, 'the changed pulses start after the hold')
  assert.equal(rec.timeline.pulses[0].startMs, rec.planned_timeline.pulses[0].startMs, 'the known pulses do not move')
  // holds that follow the circle as it ran are fully compliant; scored on the planned schedule they would not be
  const halves = halfPulses(rec.timeline)
  const keys = cfg.keys
  const events = []
  for (const h of halves) {
    const k = h.phase === 'grow' ? keys.grow : keys.shrink
    events.push({ i: events.length, type: 'keydown', key: k.key, code: k.code, role: h.phase, t: h.startMs + 100, t_handler: null })
    events.push({ i: events.length, type: 'keyup', key: k.key, code: k.code, role: h.phase, t: h.endMs - 20, t_handler: null })
  }
  const asRan = assessCompliance({ arm: 'touch', cfg, keys: { events }, pres: rec })
  const asPlanned = assessCompliance({ arm: 'touch', cfg, keys: { events }, pres: { ...rec, timeline: rec.planned_timeline } })
  assert.ok(asRan.coverage > 0.85, `as ran ${asRan.coverage}`)
  assert.ok(asPlanned.coverage < asRan.coverage - 0.1, `planned ${asPlanned.coverage}`)
})

// ── item 8: one clock ──

test('item 8: wallclock_start is the participant clock at fixation onset; the run stores its clock references', async () => {
  const r = rig({ arm: 'vision', timeOrigin: Date.parse('2026-11-19T10:00:00Z') })
  const { out } = await r.run()
  assert.equal(out.wallclockStart, new Date(Date.parse('2026-11-19T10:00:00Z') + out.pres.t0).toISOString())
  const run = makeRunRecord({ id: 'r', arm: 'vision', cfg: makeConfig(), seed: 1, kind: 'study', runStartPerfMs: 1234.5, perfTimeOriginMs: 1.7e12 })
  assert.deepStrictEqual([run.run_start_perf_ms, run.perf_time_origin_ms], [1234.5, 1.7e12])
})

// ── item 9: the run's engine_mode is settled before the run is written ──

test('item 9: a worker that fails to load has fallen back to the main thread by the time ready() resolves', async () => {
  const broken = { postMessage() { setTimeout(() => this.onerror && this.onerror({ message: 'load error' }), 0) }, terminate() {} }
  const engine = createEngineClient({ workerFactory: () => broken, timeouts: null })
  assert.equal(engine.mode, 'worker', 'before ready() the mode is a guess')
  assert.equal(await engine.ready(), 'main_thread')
  const init = await engine.call({ type: 'init', cfg: makeConfig({ demo: true }).engine, seed: 3 })
  assert.ok(init.trial)
  assert.equal(engine.mode, 'main_thread', 'and it stays where the run says it is')
  engine.terminate()
})

// ── item 2: a cap on interrupted trials ──

test('item 2: past 10 withheld main trials the run ends interruption_cap, with no repeats and no endless session', async () => {
  const cfg = makeConfig({ demo: true })
  const engine = createEngineClient({ worker: false })
  const sim = createSimulatedPresenter({ cfg, arm: 'vision', seed: 2 })
  const present = async req => {
    const o = await sim(req)
    if (o.no_trial || req.phase !== 'main') return o
    return { ...o, interrupted: true, interruptionReasons: ['blur'], focusEvents: [{ type: 'blur', t: 3000 }] }
  }
  present.now = sim.now
  const rows = []
  const out = await runSession({ cfg, arm: 'vision', seed: 2, engine, present, sequence: createTrialSequence(), runId: 'r',
    saveTrial: async r => { rows.push(r) }, plannedTrials: buildTrialPlan(cfg, 2).counts.total, clock: sim.now })
  engine.terminate()
  assert.equal(INTERRUPTION_POLICY.maxWithheld, 10)
  assert.equal(out.status, 'interruption_cap')
  const mains = rows.filter(r => r.phase === 'main')
  assert.equal(mains.length, 11, 'the eleventh withheld trial ends the run')
  assert.equal(mains.filter(r => r.repeat_queued).length, 10)
  assert.equal(rows.filter(r => r.phase === 'repeat').length, 0, 'no repeats are shown after the cap')
  // the count carries over a reload
  const s = createTrialSequence(undefined, { withheld: 10 })
  assert.equal(s.mainAnswered({ spec: { trial_index: 1 }, response: 'same', interrupted: true }).capped, true)
})
