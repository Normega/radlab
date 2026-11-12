// Full screen: entry inside the gesture, an exit during a trial as one interruption, the page between trials,
// browsers that cannot or will not go full screen, the records, and the engine config hash.
// Run: node --test src/games/BcatThreshold/fullscreen.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fullscreenApi, createFullscreen, createReturnGate } from './fullscreen.js'
import { interruptionReasons, wasInterrupted, createTrialSequence } from './sequence.js'
import { makeConfig, configHash } from './config.js'
import { makeRunRecord, makeTrialRecord, makeResultRecord } from './records.js'
import { createLivePresenter } from './presenter.js'
import { practiceTrials, buildTrialPlan } from './trialPlan.js'
import { createEngineClient } from './engineClient.js'
import { createSimulatedPresenter } from './simulate.js'
import { createMemoryStore } from './store.js'
import { runPractice, runEngineTrials, runRepeats } from './session.js'
import { replay, savedTrial } from './engine/replay.js'
import { FULLSCREEN, CONTINUE_HINT } from './texts.js'

// A document with the standard API. reject: the request fails (as in an iframe without permission, or a
// request outside a gesture). dup: every change fires twice (a browser firing prefixed and standard events).
function fakeDoc({ api = 'std', enabled = true, reject = false, dup = false } = {}) {
  const listeners = {}
  const root = {}
  const doc = {
    documentElement: root, requests: 0,
    addEventListener(t, f) { (listeners[t] ||= new Set()).add(f) },
    removeEventListener(t, f) { listeners[t]?.delete(f) },
    fire(t) { for (const f of [...(listeners[t] || [])]) f({ type: t }) },
  }
  const change = () => { const t = api === 'std' ? 'fullscreenchange' : 'webkitfullscreenchange'; doc.fire(t); if (dup) doc.fire(t) }
  const set = on => { if (api === 'std') doc.fullscreenElement = on ? root : null; else doc.webkitFullscreenElement = on ? root : null }
  if (api === 'std') {
    doc.fullscreenElement = null
    doc.fullscreenEnabled = enabled
    root.requestFullscreen = () => {
      doc.requests += 1
      if (reject) return Promise.reject(new TypeError('Permissions check failed'))
      set(true); change(); return Promise.resolve()
    }
    doc.exitFullscreen = () => { set(false); change(); return Promise.resolve() }
  } else if (api === 'webkit') {
    doc.webkitFullscreenElement = null
    doc.webkitFullscreenEnabled = enabled
    root.webkitRequestFullscreen = () => { doc.requests += 1; setTimeout(() => { set(true); change() }, 5) }   // returns nothing
    doc.webkitExitFullscreen = () => { set(false); change() }
  }
  doc.userExit = () => { set(false); change() }   // the participant presses Esc
  return doc
}

test('the request is made inside the gesture: enter() calls the browser synchronously', async () => {
  const doc = fakeDoc()
  const fs = createFullscreen({ doc, now: () => 0 })
  fs.attach()
  assert.equal(fs.wanted, true)
  const p = fs.enter()
  assert.equal(doc.requests, 1, 'requested before enter() returns, so still inside the click or key press')
  assert.equal(await p, true)
  assert.equal(fs.isActive(), true)
  assert.deepStrictEqual(fs.runFacts(), { enabled: true, supported: true, entered: true, windowed_reason: null })
  assert.equal(await fs.enter(), true, 'asking again while in full screen is harmless')
  assert.equal(doc.requests, 1)
})

test("Safari's prefixed API works too (its request returns nothing)", async () => {
  const doc = fakeDoc({ api: 'webkit' })
  assert.equal(fullscreenApi(doc).event, 'webkitfullscreenchange')
  const fs = createFullscreen({ doc, now: () => 0 })
  fs.attach()
  assert.equal(await fs.enter(), true)
  assert.equal(fs.entered, true)
})

test('an exit is counted once (duplicate events), a task-made exit not at all, and subscribers hear only the participant', async () => {
  const doc = fakeDoc({ dup: true })
  const fs = createFullscreen({ doc, now: () => 0 })
  fs.attach()
  const heard = []
  fs.subscribe(t => heard.push(t))
  await fs.enter()
  doc.userExit()
  assert.equal(fs.exits, 1)
  assert.equal(fs.needsReturn(), true)
  await fs.enter()
  fs.exit()                                   // the end of the step
  assert.equal(fs.isActive(), false)
  assert.equal(fs.exits, 1, 'the task leaving full screen is not an exit')
  assert.deepStrictEqual(heard, ['fullscreen_enter', 'fullscreen_exit', 'fullscreen_enter'])
  const s = fs.summary()
  assert.equal(s.exits, 1)
  assert.deepStrictEqual(s.events.map(e => e.type),
    ['fullscreen_request', 'fullscreen_enter', 'fullscreen_exit', 'fullscreen_request', 'fullscreen_enter', 'fullscreen_exit_by_task'])
})

test('between trials: out of full screen, the page is shown and its Continue re-enters; in full screen, nothing', async () => {
  const doc = fakeDoc()
  const fs = createFullscreen({ doc, now: () => 0 })
  fs.attach()
  await fs.enter()
  let pages = 0
  const gate = createReturnGate({ fullscreen: fs, showPage: async gesture => { pages += 1; gesture() } })
  assert.equal(await gate(), false, 'in full screen: the trial starts at once')
  assert.equal(pages, 0)
  doc.userExit()
  assert.equal(await gate(), true, 'out of full screen: the page came first')
  assert.equal(pages, 1)
  assert.equal(fs.isActive(), true, 'its Continue switched back')
  assert.equal(await gate(), false)
})

test('between trials: the page waits for Continue, and asks again until the participant is back', async () => {
  const doc = fakeDoc()
  const fs = createFullscreen({ doc, now: () => 0 })
  fs.attach()
  await fs.enter()
  doc.userExit()
  let pages = 0, release
  const gate = createReturnGate({ fullscreen: fs, showPage: gesture => new Promise(r => {
    pages += 1
    // first page: Continue without re-entering (as if the gesture were lost); second: a real Continue
    release = () => { if (pages > 1) gesture(); r() }
  }) })
  let started = false
  const g = gate().then(v => { started = true; return v })
  await new Promise(r => setTimeout(r, 5))
  assert.equal(started, false, 'the next trial does not start while the page is up')
  release()
  await new Promise(r => setTimeout(r, 5))
  assert.equal(pages, 2, 'still out of full screen: the page again')
  release()
  assert.equal(await g, true)
  assert.equal(fs.isActive(), true)
})

test('a browser that refuses on return: the task goes on windowed, records it, and does not ask again', async () => {
  const doc = fakeDoc()
  const fs = createFullscreen({ doc, now: () => 0 })
  fs.attach()
  await fs.enter()
  doc.userExit()
  doc.documentElement.requestFullscreen = () => Promise.reject(new TypeError('Permissions check failed'))
  let pages = 0
  const gate = createReturnGate({ fullscreen: fs, showPage: async gesture => { pages += 1; gesture() } })
  assert.equal(await gate(), true)
  assert.equal(await gate(), false)
  assert.equal(pages, 1)
  const s = fs.summary()
  assert.deepStrictEqual([s.windowed_reason, s.failed_requests, s.entered, s.exits], ['rejected', 1, true, 1])
})

test('unsupported browsers do not block: no API, not enabled (iframe), refused at entry, switched off, simulated', async () => {
  const cases = [
    { doc: fakeDoc({ api: 'none' }), reason: 'no_api', supported: false, requests: 0 },
    { doc: fakeDoc({ enabled: false }), reason: 'not_enabled', supported: false, requests: 0 },
    { doc: fakeDoc({ reject: true }), reason: 'rejected', supported: true, requests: 1 },
    { doc: fakeDoc(), enabled: false, reason: 'config_off', supported: true, requests: 0 },
    { doc: fakeDoc(), simulated: true, reason: 'simulated', supported: null, requests: 0 },
  ]
  for (const c of cases) {
    const fs = createFullscreen({ doc: c.doc, enabled: c.enabled ?? true, simulated: !!c.simulated, now: () => 0 })
    fs.attach()
    assert.equal(await fs.enter(), false, c.reason)
    assert.equal(c.doc.requests ?? 0, c.requests, `${c.reason}: requests`)
    assert.equal(fs.wanted, false, c.reason)
    assert.equal(fs.needsReturn(), false, `${c.reason}: never gates a trial`)
    let pages = 0
    assert.equal(await createReturnGate({ fullscreen: fs, showPage: async () => { pages += 1 } })(), false)
    assert.equal(pages, 0)
    const f = fs.runFacts()
    assert.deepStrictEqual([f.windowed_reason, f.supported, f.entered], [c.reason, c.supported, false], c.reason)
    fs.exit()                                 // harmless
    fs.detach()
  }
  assert.equal(fullscreenApi(undefined), null)
})

test('a full-screen exit during the circle interrupts the trial; a blur at the same time is still one interruption', () => {
  const span = { startMs: 0, endMs: 17500 }
  assert.deepStrictEqual(interruptionReasons([{ type: 'fullscreen_exit', t: 6000 }], span), ['fullscreen_exit'])
  const both = [{ type: 'blur', t: 6000 }, { type: 'fullscreen_exit', t: 6000 }, { type: 'focus', t: 6100 }, { type: 'fullscreen_exit', t: 9000 }]
  assert.deepStrictEqual(interruptionReasons(both, span), ['blur', 'fullscreen_exit'], 'each reason once')
  assert.equal(wasInterrupted(both, span), true)
  assert.equal(wasInterrupted([{ type: 'fullscreen_enter', t: 100 }], span), false)
  assert.equal(wasInterrupted([{ type: 'fullscreen_exit', t: 17501 }], span), false, 'leaving at the question is allowed')
  assert.deepStrictEqual(interruptionReasons([], { ...span, hiddenAtStart: true }), ['hidden_at_start'])
  // the rule sees one interrupted trial: withheld once, queued once
  const s = createTrialSequence()
  const spec = { trial_index: 3, cell: 'slowing', placement: 'infogain', magnitude: 0.2 }
  assert.deepStrictEqual(s.mainAnswered({ spec, response: 'slowed', interrupted: wasInterrupted(both, span) }),
    { engineResponse: null, withheld: true, repeatQueued: true })
  assert.equal(s.pendingRepeats, 1)
})

// ── the live presenter, on a fake frame clock ──
function fakeWindow() {
  const h = {}
  return { h, addEventListener(t, f) { h[t] = f }, removeEventListener(t) { delete h[t] } }
}
function fakeController(active = true) {
  let sub = null
  return { active, isActive() { return this.active }, subscribe(fn) { sub = fn; return () => { sub = null } }, emit(t) { this.active = t === 'fullscreen_enter'; if (sub) sub(t) } }
}
async function liveTrial({ events = [], answerAfterMs = 300, fsActive = true }) {
  const cfg = makeConfig({ fixationMs: 200 })
  const spec = practiceTrials(cfg)[0]
  const win = fakeWindow(), fsc = fakeController(fsActive)
  const els = { circle: { style: {} }, question: { style: {} }, cue: { style: {} } }
  let t = 1000, t0 = null, answered = false, questionAt = null
  const pending = events.slice()
  const ev = (key, extra = {}) => ({ key, code: key, timeStamp: t, repeat: false, preventDefault() {}, ...extra })
  const raf = cb => setImmediate(() => {
    t += 1000 / 60
    if (t0 !== null) {
      while (pending.length && t - t0 >= pending[0].at) {
        const e = pending.shift()
        if (e.type === 'blur') win.h.blur(ev('', { timeStamp: t }))
        else fsc.emit(e.type)
      }
    }
    if (els.question.style.visibility === 'visible' && !answered) {
      questionAt ??= t
      if (t - questionAt >= answerAfterMs) {
        while (pending.length) { const e = pending.shift(); if (e.type === 'blur') win.h.blur(ev('')); else fsc.emit(e.type) }
        answered = true
        win.h.keydown(ev('ArrowUp'))
      }
    }
    cb(t)
    if (answered) return
    if (els.question.style.visibility === 'visible') raf(() => {})   // keep the clock running while the question is up
  })
  const live = createLivePresenter({
    cfg, arm: 'vision', els: () => els, setCue: () => {}, isCancelled: () => false, framePeriodMs: () => 1000 / 60,
    runStart: 0, raf: cb => raf(ts => { if (t0 === null) t0 = ts; cb(ts) }), now: () => t,
    doc: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }, win, fullscreen: fsc,
  })
  live.attach()
  const shown = await live.present({ phase: 'practice', spec })
  live.detach()
  return shown
}

test('live presenter: an exit during the circle is an interruption, recorded with its reason and the onset state', async () => {
  const shown = await liveTrial({ events: [{ type: 'fullscreen_exit', at: 4000 }] })
  assert.equal(shown.interrupted, true)
  assert.deepStrictEqual(shown.interruptionReasons, ['fullscreen_exit'])
  assert.equal(shown.fullscreenAtOnset, true)
  assert.ok(shown.focusEvents.some(e => e.type === 'fullscreen_exit' && e.t > 3900 && e.t < 4100), JSON.stringify(shown.focusEvents))
  assert.equal(shown.answer.response, 'same')
  const row = makeTrialRecord({ runId: 'r', seq: 1, phase: 'practice', spec: shown.pres.spec, pres: shown.pres, answer: shown.answer,
    interrupted: shown.interrupted, interruptionReasons: shown.interruptionReasons, fullscreenAtOnset: shown.fullscreenAtOnset,
    focusEvents: shown.focusEvents, keys: shown.keys })
  assert.deepStrictEqual([row.interruption_reason, row.fullscreen_at_onset, row.shown_fullscreen, row.fullscreen_exits], ['fullscreen_exit', true, false, 1])
})

test('live presenter: a blur and an exit together are one interrupted trial with both reasons', async () => {
  const shown = await liveTrial({ events: [{ type: 'blur', at: 5000 }, { type: 'fullscreen_exit', at: 5000 }] })
  assert.equal(shown.interrupted, true)
  assert.deepStrictEqual(shown.interruptionReasons, ['blur', 'fullscreen_exit'])
})

test('live presenter: an exit while the question is up does not interrupt; a trial begun windowed is not shown in full screen', async () => {
  const late = await liveTrial({ events: [{ type: 'fullscreen_exit', at: 1e9 }] })   // delivered at the answer
  assert.equal(late.interrupted, false)
  assert.equal(late.fullscreenAtOnset, true)
  assert.equal(late.focusEvents.filter(e => e.type === 'fullscreen_exit').length, 1)
  const windowed = await liveTrial({ fsActive: false })
  assert.equal(windowed.interrupted, false)
  const row = makeTrialRecord({ runId: 'r', seq: 1, phase: 'practice', spec: windowed.pres.spec, pres: windowed.pres, answer: windowed.answer,
    interrupted: false, fullscreenAtOnset: windowed.fullscreenAtOnset, focusEvents: windowed.focusEvents, keys: windowed.keys })
  assert.deepStrictEqual([row.fullscreen_at_onset, row.shown_fullscreen, row.interruption_reason, row.interruption_reasons], [false, false, null, []])
})

// ── a whole simulated session with exits and the page between trials ──
test('session: exits during trials follow the interruption rule once each, the page is recorded, replay still works', async () => {
  const seed = 91
  const cfg = makeConfig({ demo: true })
  const engine = createEngineClient({ worker: false })
  const store = createMemoryStore()
  const sequence = createTrialSequence()
  const sim = createSimulatedPresenter({ cfg, arm: 'vision', seed })
  let mainShown = 0
  const present = async req => {
    const out = await sim(req)
    if (out.no_trial) return out
    out.fullscreenAtOnset = true
    if (req.phase === 'main') {
      mainShown += 1
      // main 2: a blur and a full-screen exit together (alt-tab out of full screen); main 4: Esc alone
      if (mainShown === 2) return { ...out, interrupted: true, focusEvents: [{ type: 'blur', t: 3000 }, { type: 'fullscreen_exit', t: 3000 }, { type: 'focus', t: 4000 }] }
      if (mainShown === 4) return { ...out, interrupted: true, focusEvents: [{ type: 'fullscreen_exit', t: 6000 }] }
    }
    return out
  }
  let gateCalls = 0
  const gate = async () => { gateCalls += 1; return gateCalls === 6 }   // the page before the 6th trial shown
  const runId = 'fs-run'
  await store.saveRun(makeRunRecord({ id: runId, arm: 'vision', cfg, seed, kind: 'simulated', plannedTrials: buildTrialPlan(cfg, seed).counts.total,
    fullscreen: { enabled: true, supported: true, entered: true, windowed_reason: null } }))
  const saveTrial = row => store.saveTrial(row)
  await runPractice({ cfg, present, sequence, saveTrial, runId, gate })
  await runEngineTrials({ engine, cfg, seed, present, sequence, saveTrial, runId, gate })
  await runRepeats({ present, sequence, saveTrial, runId, gate })
  const { readout } = await engine.call({ type: 'readout' })
  const rows = store.snapshot(runId).trials
  await store.saveResult(makeResultRecord({ runId, trials: rows, readout, fullscreen: { exits: 2 } }))
  engine.terminate()
  const snap = store.snapshot(runId)

  assert.equal(gateCalls, rows.length, 'the gate is asked before every trial shown, practice and repeats included')
  assert.deepStrictEqual(rows.map(r => r.fullscreen_return_shown), rows.map((_, i) => i === 5))
  const mains = rows.filter(r => r.phase === 'main')
  const [a, b] = [mains[1], mains[3]]
  assert.deepStrictEqual([a.interruption_reason, a.interruption_reasons, a.shown_fullscreen], ['blur', ['blur', 'fullscreen_exit'], false])
  assert.deepStrictEqual([b.interruption_reason, b.interruption_reasons, b.shown_fullscreen, b.fullscreen_exits], ['fullscreen_exit', ['fullscreen_exit'], false, 1])
  for (const r of [a, b]) assert.deepStrictEqual([r.interrupted, r.engine_response, r.repeat_queued, r.response !== null], [true, null, true, true])
  assert.ok(mains.filter(r => r !== a && r !== b).every(r => r.interruption_reason === null && r.shown_fullscreen === true))
  const reps = rows.filter(r => r.phase === 'repeat')
  assert.deepStrictEqual(reps.map(r => r.repeat_of), [a.trial_index, b.trial_index], 'one repeat each, not two for the blur + exit trial')
  assert.equal(readout.n_missing_responses, 2)
  assert.deepStrictEqual([snap.result.n_interrupted, snap.result.n_withheld, snap.result.n_repeats, snap.result.n_interrupted_fullscreen,
    snap.result.n_fullscreen_exits, snap.result.n_fullscreen_return_pages], [2, 2, 2, 2, 2, 1])
  assert.deepStrictEqual(snap.run.fullscreen, { enabled: true, supported: true, entered: true, windowed_reason: null })

  const saved = rows.filter(r => r.sent_to_engine).map(r => savedTrial(r, r.engine_response))
  const rep = replay(saved, cfg.engine, seed, { expect: { engine_version: snap.run.engine_version, config_hash: snap.run.config_hash } })
  assert.equal(rep.finished, true, 'replay with engine_response reproduces the run')
  assert.deepStrictEqual(rep.session.readout().cells.slowing.threshold, readout.cells.slowing.threshold)
})

test('the full-screen switch is outside the engine config: configHash(cfg.engine) is unchanged', () => {
  assert.equal(makeConfig().fullscreen.enabled, true, 'on by default')
  assert.equal(makeConfig({ mode: 'lab' }).fullscreen.enabled, true, 'in both modes')
  assert.equal(makeConfig({ fullscreen: false }).fullscreen.enabled, false)
  assert.equal(configHash(makeConfig().engine), 'fnv1a64:64c7ed04da72a6ae')
  assert.equal(configHash(makeConfig({ mode: 'lab' }).engine), 'fnv1a64:a1d7baf4861119a6')
  assert.equal(configHash(makeConfig({ fullscreen: false }).engine), configHash(makeConfig().engine))
  assert.ok(!JSON.stringify(makeConfig().engine).includes('fullscreen'))
})

test('rows without full-screen facts (old callers, simulated runs) read as unknown, not as windowed', () => {
  const row = makeTrialRecord({ runId: 'r', seq: 1, phase: 'main', spec: { trial_index: 1, cell: 'no_change', placement: 'infogain', magnitude: 0, log_ratio: 0, pulse_durations_s: [4, 4, 4, 4] },
    pres: { t_end: 17500 }, answer: { response: 'same' }, interrupted: true, focusEvents: [{ type: 'hidden', t: 100 }, { type: 'visible', t: 300 }] })
  assert.deepStrictEqual([row.fullscreen_at_onset, row.shown_fullscreen, row.fullscreen_exits, row.fullscreen_return_shown], [null, null, 0, false])
  assert.deepStrictEqual([row.interruption_reason, row.interruption_reasons], ['hidden', ['hidden']], 'derived from the focus events')
  const res = makeResultRecord({ runId: 'r', trials: [row] })
  assert.deepStrictEqual([res.n_fullscreen_exits, res.fullscreen, res.n_interrupted_fullscreen], [null, null, 0])
})

test('the full-screen texts are the test build\'s sentences', () => {
  assert.equal(FULLSCREEN.enter, 'The task runs in full screen.')
  assert.equal(FULLSCREEN.return, 'The task needs full screen. Please return to full screen to continue.')
  assert.equal(FULLSCREEN.hint, 'Press the [[space bar]] to switch to full screen.')
  assert.equal(CONTINUE_HINT, 'Press the [[space bar]] to continue.')
})
