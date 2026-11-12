// Compliance reminders: the rule per arm, the run count and its reset, the line at the next fixation only and
// gone when the circle moves, no effect on what the engine is told, the config hash, and the row fields.
// Run: node --test src/games/BcatThreshold/compliance.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeConfig, configHash } from './config.js'
import { assessCompliance, createComplianceTracker, createCompliance } from './compliance.js'
import { createKeyLog } from './keyLog.js'
import { timelineForTrial } from './pacerClock.js'
import { practiceTrials, buildTrialPlan } from './trialPlan.js'
import { createLivePresenter } from './presenter.js'
import { createSimulatedPresenter } from './simulate.js'
import { createTrialSequence } from './sequence.js'
import { createMemoryStore } from './store.js'
import { makeRunRecord, makeResultRecord, makeTrialRecord } from './records.js'
import { runPractice, runEngineTrials, runRepeats } from './session.js'
import { createEngineClient } from './engineClient.js'
import { replay, savedTrial } from './engine/replay.js'
import { instructionPages, pacerReminder, complianceLine, armReminderPage, richParts } from './texts.js'

const cfg = makeConfig()
const NO_CHANGE = practiceTrials(cfg)[2]          // four 4-s pulses: fixation 0-1500, halves of 2000 ms, end 17500
const TL = timelineForTrial(NO_CHANGE, cfg)
const END = TL.totalMs
const pres = { timeline: TL, t_end: END }

// A trial's key log from presses [{ role: 'grow'|'shrink'|'arrow', t0, t1 }], with optional blurs and keys held at onset.
function keysOf(presses, { blurAt = null, heldAtOnset = [] } = {}) {
  const log = createKeyLog(cfg.keys)
  const k = r => (r === 'grow' ? cfg.keys.grow : r === 'shrink' ? cfg.keys.shrink : { key: 'ArrowUp', code: 'ArrowUp' })
  log.begin(0, heldAtOnset.map(r => ({ key: k(r).key, code: k(r).code })))
  const evs = []
  for (const p of presses) { evs.push({ type: 'keydown', p, t: p.t0 }); if (p.t1 !== null) evs.push({ type: 'keyup', p, t: p.t1 }) }
  if (blurAt !== null) evs.push({ type: 'blur', t: blurAt })
  evs.sort((a, b) => a.t - b.t)
  for (const e of evs) {
    if (e.type === 'blur') log.blur({ t: e.t })
    else log[e.type]({ key: k(e.p.role).key, code: k(e.p.role).code, t: e.t })
  }
  return log.end(END, [])
}
// Holds of every half from its start for `frac` of its length, with the right key (or the wrong one).
const along = (frac, { wrong = false } = {}) => TL.pulses.flatMap(p => [
  { role: wrong ? 'shrink' : 'grow', t0: p.startMs, t1: p.startMs + frac * (p.midMs - p.startMs) },
  { role: wrong ? 'grow' : 'shrink', t0: p.midMs, t1: p.midMs + frac * (p.endMs - p.midMs) },
])

// ── the rule ────────────────────────────────────────────────────────────────

test('touch and breath: coverage is the share of the movement time with the right key held; < 0.5 is non-compliant', () => {
  for (const arm of ['touch', 'breath']) {
    const full = assessCompliance({ arm, cfg, keys: keysOf(along(1)), pres })
    assert.equal(full.compliant, true)
    assert.ok(Math.abs(full.coverage - 1) < 1e-9, `${full.coverage}`)
    assert.equal(full.ws_presses, null)
    const half = assessCompliance({ arm, cfg, keys: keysOf(along(0.5)), pres })
    assert.ok(Math.abs(half.coverage - 0.5) < 1e-9)
    assert.equal(half.compliant, true, 'exactly at the cutoff is compliant')
    const under = assessCompliance({ arm, cfg, keys: keysOf(along(0.45)), pres })
    assert.equal(under.compliant, false)
    const none = assessCompliance({ arm, cfg, keys: keysOf([]), pres })
    assert.deepStrictEqual([none.compliant, none.coverage, none.skip], [false, 0, null], 'holding nothing')
    const wrong = assessCompliance({ arm, cfg, keys: keysOf(along(1, { wrong: true })), pres })
    assert.equal(wrong.compliant, false, 'the wrong key covers nothing')
    assert.equal(wrong.coverage, 0)
  }
})

test('touch: coverage is time-weighted over unequal halves (a change trial), and the cutoff is the config value', () => {
  const spec = practiceTrials(cfg)[1]   // slowing: two 4-s pulses, then two 6-s pulses
  const tl = timelineForTrial(spec, cfg)
  // hold only the two baseline pulses fully: 8 s of 20 s
  const log = createKeyLog(cfg.keys); log.begin(0, [])
  for (const p of tl.pulses.slice(0, 2)) {
    log.keydown({ key: 'w', code: 'KeyW', t: p.startMs }); log.keyup({ key: 'w', code: 'KeyW', t: p.midMs })
    log.keydown({ key: 's', code: 'KeyS', t: p.midMs }); log.keyup({ key: 's', code: 'KeyS', t: p.endMs })
  }
  const keys = log.end(tl.totalMs, [])
  const a = assessCompliance({ arm: 'touch', cfg, keys, pres: { timeline: tl, t_end: tl.totalMs } })
  assert.ok(Math.abs(a.coverage - 8 / 20) < 1e-9, `${a.coverage} (a mean over halves would say 0.5)`)
  assert.equal(a.compliant, false)
  const lax = makeConfig(); lax.compliance.min_coverage = 0.4
  assert.equal(assessCompliance({ arm: 'touch', cfg: lax, keys, pres: { timeline: tl, t_end: tl.totalMs } }).compliant, true)
})

test('vision: any W or S press during the pulses is non-compliant; fixation-only presses and arrow keys are not', () => {
  const ok = assessCompliance({ arm: 'vision', cfg, keys: keysOf([]), pres })
  assert.deepStrictEqual([ok.compliant, ok.ws_presses, ok.ws_press_ms, ok.coverage], [true, 0, 0, null])
  const w = assessCompliance({ arm: 'vision', cfg, keys: keysOf([{ role: 'grow', t0: 4000, t1: 4800 }]), pres })
  assert.deepStrictEqual([w.compliant, w.ws_presses, w.ws_press_ms], [false, 1, 800])
  const tap = assessCompliance({ arm: 'vision', cfg, keys: keysOf([{ role: 'shrink', t0: 9000, t1: 9050 }]), pres })
  assert.equal(tap.compliant, false, 'a 50-ms tap counts: any press (vision_min_press_ms 0)')
  const fix = assessCompliance({ arm: 'vision', cfg, keys: keysOf([{ role: 'grow', t0: 200, t1: 1200 }]), pres })
  assert.deepStrictEqual([fix.compliant, fix.ws_presses], [true, 0], 'inside the still fixation only')
  const into = assessCompliance({ arm: 'vision', cfg, keys: keysOf([{ role: 'grow', t0: 1000, t1: 2000 }]), pres })
  assert.deepStrictEqual([into.compliant, into.ws_presses, into.ws_press_ms], [false, 1, 500], 'held into the pulses: the part during them')
  const held = assessCompliance({ arm: 'vision', cfg, keys: keysOf([], { heldAtOnset: ['grow'] }), pres })
  assert.equal(held.compliant, false, 'W held from before the trial and never let go')
  const arrows = assessCompliance({ arm: 'vision', cfg, keys: keysOf([{ role: 'arrow', t0: 5000, t1: 5200 }]), pres })
  assert.deepStrictEqual([arrows.compliant, arrows.ws_presses], [true, 0], 'only W and S count')
  const strict = makeConfig(); strict.compliance.vision_min_press_ms = 300
  assert.equal(assessCompliance({ arm: 'vision', cfg: strict, keys: keysOf([{ role: 'shrink', t0: 9000, t1: 9050 }]), pres }).compliant, true)
})

test('an interrupted or blurred trial is not assessed (compliant null), in every arm', () => {
  for (const arm of ['vision', 'touch', 'breath']) {
    const i = assessCompliance({ arm, cfg, keys: keysOf([]), pres, interrupted: true })
    assert.deepStrictEqual([i.compliant, i.skip], [null, 'interrupted'])
    const b = assessCompliance({ arm, cfg, keys: keysOf(arm === 'vision' ? [{ role: 'grow', t0: 4000, t1: 4500 }] : along(0.2), { blurAt: 6000 }), pres })
    assert.deepStrictEqual([b.compliant, b.skip], [null, 'blurred'])
    assert.equal(assessCompliance({ arm, cfg, keys: null, pres }).skip, 'no_score')
  }
})

// ── the run count and the reminders ─────────────────────────────────────────

const C = { compliant: true }, N = { compliant: false }, X = { compliant: null }

test('the line comes only at the trial after a non-compliant one; three in a row bring the page, then the count restarts', () => {
  const t = createComplianceTracker(makeConfig())
  const steps = []
  for (const a of [C, N, C, N, N, N, C, N, N, N, N, N, N]) {
    const due = t.before()
    const after = t.after(a)
    steps.push(`${due.line ? 'L' : '-'}${due.page ? 'P' : '-'}${after.streak}`)
  }
  assert.deepStrictEqual(steps, [
    '--0', '--1', 'L-0', '--1', 'L-2', 'L-3',
    'LP0',            // after three in a row: the page, and the line too (its previous trial was non-compliant); count restarts
    '--1', 'L-2', 'L-3', 'LP1', 'L-2', 'L-3',
  ])
  assert.deepStrictEqual(t.before(), { line: true, page: true })
})

test('a trial not assessed (interrupted) brings no reminder and neither adds to nor ends the run', () => {
  const t = createComplianceTracker(makeConfig())
  const seen = []
  for (const a of [N, X, N, N, C]) { const d = t.before(); seen.push([d.line, d.page, t.after(a).streak]) }
  assert.deepStrictEqual(seen, [[false, false, 1], [true, false, 1], [false, false, 2], [true, false, 3], [true, true, 0]])
})

test('with reminders off nothing is shown, but compliance is still scored and counted', () => {
  const t = createComplianceTracker(makeConfig({ reminders: false }))
  for (const a of [N, N, N, N]) { assert.deepStrictEqual(t.before(), { line: false, page: false }); t.after(a) }
  assert.equal(t.streak, 4)
  assert.equal(makeConfig().compliance.reminders, true, 'on by default')
})

// ── the live presenter: what the cue line does ──────────────────────────────

const P = 1000 / 60
function liveHarness(arm) {
  let t = 1000, queued = null
  const listeners = {}
  const target = { addEventListener: (type, fn) => { listeners[type] = fn }, removeEventListener() {} }
  const els = { circle: { style: {} }, question: { style: {} }, cue: { style: {} } }
  const cues = [], uis = []
  const live = createLivePresenter({
    cfg, arm, els: () => els, isCancelled: () => false, runStart: 0, framePeriodMs: () => P,
    setCue: c => cues.push({ kind: c ? c.kind : null, t }), onUi: u => uis.push({ ...u, t }),
    raf: cb => { queued = cb }, now: () => t, doc: { visibilityState: 'visible', ...target }, win: target,
  })
  live.attach()
  const key = (type, k, code) => listeners[type]({ key: k, code, timeStamp: t, repeat: false, preventDefault() {} })
  const tick = () => new Promise(r => setImmediate(r))
  async function run(req, { whileWaiting = null } = {}) {
    let done = false, out, answered = false, idle = 0
    live.present(req).then(v => { done = true; out = v })
    for (let guard = 0; guard < 100000; guard++) {
      await tick()
      if (done) return out
      if (!answered && els.question.style.visibility === 'visible') { answered = true; t += 500; key('keydown', 'ArrowUp', 'ArrowUp'); continue }
      const cb = queued; queued = null
      if (cb) { t += P; cb(t) } else if (whileWaiting && ++idle === 5) whileWaiting()
    }
    throw new Error('the trial never ended')
  }
  return { run, cues, uis, els, key, frameT0: () => uis.find(u => u.what === 'circle').t0 }
}

test('main trial after a non-compliant one: the line during fixation, gone in the first frame the circle moves', async () => {
  const h = liveHarness('touch')
  const shown = await h.run({ phase: 'main', spec: NO_CHANGE, reminder: true })
  const t0 = h.frameT0()
  assert.deepStrictEqual(h.cues.map(c => c.kind), ['compliance', null])
  assert.ok(h.cues[0].t <= t0, 'on screen from fixation onset')
  const off = h.cues[1].t - t0
  assert.ok(off >= TL.fixationMs && off < TL.fixationMs + P + 1e-9, `removed ${off} ms after fixation onset: the first moving frame`)
  assert.equal(shown.pres.reminder_off_ms, off)
  assert.ok(Math.abs(shown.pres.delivered_boundaries_ms[1] - off) <= P + 1e-9, 'with the first pulse')
  assert.equal(h.els.cue.style.visibility, 'hidden', 'hidden on the element itself in that frame')
  assert.equal(h.uis.find(u => u.what === 'circle').reminder, true)
})

test('main trial with no reminder: no text at all, in any arm', async () => {
  for (const arm of ['vision', 'touch', 'breath']) {
    const h = liveHarness(arm)
    const shown = await h.run({ phase: 'main', spec: NO_CHANGE })
    assert.deepStrictEqual(h.cues.map(c => c.kind), [null], arm)
    assert.equal(shown.pres.reminder_off_ms, null)
  }
})

test('the keys-up cue comes first; the line then gets the whole fixation', async () => {
  const h = liveHarness('touch')
  h.key('keydown', 'w', 'KeyW')
  let releasedAt = null
  await h.run({ phase: 'main', spec: NO_CHANGE, reminder: true }, { whileWaiting: () => { releasedAt = h.cues.length; h.key('keyup', 'w', 'KeyW') } })
  assert.deepStrictEqual(h.cues.map(c => c.kind), ['release', 'compliance', null])
  assert.equal(releasedAt, 1, 'only the release cue while waiting')
  const t0 = h.frameT0()
  assert.ok(h.cues[1].t <= t0 && h.cues[2].t - t0 >= TL.fixationMs)
})

test('practice: the line at fixation, then the practice cue as before; without a reminder, the practice cue only', async () => {
  const a = liveHarness('vision')
  await a.run({ phase: 'practice', spec: NO_CHANGE, reminder: true })
  assert.deepStrictEqual(a.cues.map(c => c.kind), ['compliance', 'practice'])
  const b = liveHarness('vision')
  await b.run({ phase: 'practice', spec: NO_CHANGE })
  assert.deepStrictEqual(b.cues.map(c => c.kind), ['practice'])
})

// ── whole simulated sessions ────────────────────────────────────────────────

async function session({ arm, seed, offTask = null, reminders = true, withCompliance = true }) {
  const c = makeConfig({ demo: true, reminders })
  const engine = createEngineClient({ worker: false })
  const store = createMemoryStore()
  const sequence = createTrialSequence()
  const present = createSimulatedPresenter({ cfg: c, arm, seed, offTask })
  const pagesBefore = []
  const compliance = withCompliance ? createCompliance({ cfg: c, arm, showPage: async () => { pagesBefore.push(sequence.seq + 1) } }) : null
  const runId = `run-${seed}`
  await store.saveRun(makeRunRecord({ id: runId, arm, cfg: c, seed, kind: 'simulated', plannedTrials: buildTrialPlan(c, seed).counts.total }))
  const saveTrial = row => store.saveTrial(row)
  const sent = []
  const spy = { mode: engine.mode, call: msg => { if (msg.type === 'respond') sent.push([msg.trial_index, msg.response]); return engine.call(msg) } }
  await runPractice({ cfg: c, present, sequence, saveTrial, runId, compliance })
  await runEngineTrials({ engine: spy, cfg: c, seed, present, sequence, saveTrial, runId, compliance })
  await runRepeats({ present, sequence, saveTrial, runId, compliance })
  const { readout } = await engine.call({ type: 'readout' })
  await store.saveResult(makeResultRecord({ runId, trials: store.snapshot(runId).trials, readout }))
  engine.terminate()
  return { cfg: c, snap: store.snapshot(runId), readout, sent, pagesBefore }
}

test('the simulated observer is compliant by default: no reminders in any arm', async () => {
  for (const arm of ['vision', 'touch', 'breath']) {
    const { snap } = await session({ arm, seed: 31 })
    assert.ok(snap.trials.every(r => r.compliant === true), arm)
    assert.ok(snap.trials.every(r => !r.reminder_shown && !r.reminder_page_shown))
    assert.deepStrictEqual([snap.result.n_noncompliant, snap.result.n_reminder_lines, snap.result.n_reminder_pages], [0, 0, 0])
    if (arm !== 'vision') assert.ok(snap.trials.every(r => r.compliance_coverage > 0.5 && r.compliance_ws_presses === null))
    else assert.ok(snap.trials.every(r => r.compliance_ws_presses === 0 && r.compliance_coverage === null))
  }
})

test('touch: one off-task trial brings the line at the next fixation only; three in a row bring the page', async () => {
  const one = await session({ arm: 'touch', seed: 77, offTask: [4] })
  const rows = one.snap.trials
  assert.equal(rows[3].compliant, false)
  assert.equal(rows[3].compliance_coverage, 0)
  assert.deepStrictEqual(rows.map(r => r.reminder_shown), rows.map(r => r.seq === 5), 'the line at seq 5 only')
  assert.deepStrictEqual(one.pagesBefore, [])
  assert.equal(one.snap.result.n_reminder_lines, 1)

  const three = await session({ arm: 'touch', seed: 77, offTask: [4, 5, 6] })
  const r3 = three.snap.trials
  assert.deepStrictEqual(r3.slice(3, 6).map(r => r.noncompliant_streak), [1, 2, 3])
  assert.deepStrictEqual(three.pagesBefore, [7], 'the page before the trial after the third')
  assert.deepStrictEqual(r3.map(r => r.reminder_page_shown), r3.map(r => r.seq === 7))
  assert.deepStrictEqual(r3.filter(r => r.reminder_shown).map(r => r.seq), [5, 6, 7])
  assert.equal(r3[6].noncompliant_streak, 0, 'the count restarted')
  assert.deepStrictEqual([three.snap.result.n_noncompliant, three.snap.result.n_reminder_lines, three.snap.result.n_reminder_pages], [3, 3, 1])
})

test('vision: W during the pulses is non-compliant and brings the line next', async () => {
  const { snap } = await session({ arm: 'vision', seed: 9, offTask: [2] })
  const r = snap.trials
  assert.deepStrictEqual([r[1].compliant, r[1].compliance_ws_presses, r[1].compliance_ws_press_ms], [false, 1, 800])
  assert.deepStrictEqual(r.filter(x => x.reminder_shown).map(x => x.seq), [3], 'practice 2 off task: the line at practice 3')
})

test('compliance changes nothing the engine is told: same seed and answers give the same session with reminders on or off', async () => {
  const offTask = [2, 4, 5, 6, 8, 9, 10]
  const on = await session({ arm: 'touch', seed: 123, offTask, reminders: true })
  const off = await session({ arm: 'touch', seed: 123, offTask, reminders: false })
  const plainRun = await session({ arm: 'touch', seed: 123, withCompliance: false })
  assert.ok(on.pagesBefore.length >= 1 && on.snap.result.n_reminder_lines >= 4, 'reminders were shown in the "on" run')
  assert.equal(off.snap.result.n_reminder_lines + off.snap.result.n_reminder_pages, 0)
  assert.equal(off.snap.result.n_noncompliant, on.snap.result.n_noncompliant, 'scored the same either way')
  assert.deepStrictEqual(on.sent, off.sent, 'the engine got the same answers')
  assert.deepStrictEqual(on.sent, plainRun.sent, '... as in a compliant run with no compliance at all')
  assert.deepStrictEqual(on.readout, off.readout)
  assert.deepStrictEqual(on.readout, plainRun.readout)
  const strip = rows => rows.map(r => [r.seq, r.trial_index, r.cell, r.magnitude, r.response, r.engine_response])
  assert.deepStrictEqual(strip(on.snap.trials), strip(off.snap.trials))
  // and replay (Stage C's resume) still rebuilds the run from engine_response
  const saved = on.snap.trials.filter(r => r.sent_to_engine).map(r => savedTrial(r, r.engine_response))
  const rep = replay(saved, on.cfg.engine, on.snap.run.seed, { expect: { engine_version: on.snap.run.engine_version, config_hash: on.snap.run.config_hash } })
  assert.equal(rep.finished, true)
  assert.deepStrictEqual(rep.session.readout().cells.speeding.threshold, on.readout.cells.speeding.threshold)
})

test('an interrupted trial is not assessed even when off task, and brings no reminder', async () => {
  const c = makeConfig({ demo: true })
  const t = createCompliance({ cfg: c, arm: 'touch' })
  const sim = createSimulatedPresenter({ cfg: c, arm: 'touch', seed: 5, offTask: [1] })
  const shown = await sim({ phase: 'main', spec: NO_CHANGE })
  const a = t.after({ ...shown, interrupted: true })
  assert.deepStrictEqual([a.compliant, a.skip, a.streak], [null, 'interrupted', 0])
  assert.deepStrictEqual(await t.before(), { line: false, page: false })
})

// ── config, records, texts ──────────────────────────────────────────────────

test('the compliance settings are outside the engine config: configHash(cfg.engine) is unchanged', () => {
  // the hashes before compliance reminders existed (commit fdaf85fd)
  assert.equal(configHash(makeConfig().engine), 'fnv1a64:64c7ed04da72a6ae')
  assert.equal(configHash(makeConfig({ mode: 'lab' }).engine), 'fnv1a64:a1d7baf4861119a6')
  assert.equal(configHash(makeConfig({ demo: true }).engine), 'fnv1a64:41ad86136cf681ad')
  assert.equal(configHash(makeConfig({ reminders: false }).engine), configHash(makeConfig().engine))
  const c = makeConfig(); c.compliance.min_coverage = 0.9; c.compliance.page_after = 7
  assert.equal(configHash(c.engine), configHash(makeConfig().engine))
  assert.ok(!JSON.stringify(makeConfig().engine).includes('compliance'))
  assert.deepStrictEqual(makeConfig().compliance, { reminders: true, min_coverage: 0.5, vision_min_press_ms: 0, page_after: 3 })
  assert.equal(makeConfig({ reminders: false }).compliance.reminders, false)
})

test('trial rows carry the compliance facts, and the result counts them', () => {
  const base = { runId: 'r', seq: 1, phase: 'main', spec: NO_CHANGE, pres: { t_end: END }, answer: { response: 'same' }, focusEvents: [] }
  const row = makeTrialRecord({ ...base, compliance: { compliant: false, coverage: 0.2, ws_presses: null, ws_press_ms: null, skip: null, streak: 2 }, reminder: { line: true, page: false } })
  assert.deepStrictEqual(
    [row.compliant, row.compliance_coverage, row.compliance_ws_presses, row.compliance_ws_press_ms, row.compliance_skip, row.noncompliant_streak, row.reminder_shown, row.reminder_page_shown],
    [false, 0.2, null, null, null, 2, true, false])
  assert.equal(row.engine_response, 'same', 'compliance does not touch what the engine was given')
  assert.equal(row.timing.reminder_off_ms, null)
  const bare = makeTrialRecord(base)
  assert.deepStrictEqual([bare.compliant, bare.compliance_skip, bare.reminder_shown, bare.reminder_page_shown], [null, 'not_assessed', false, false])
  const res = makeResultRecord({ runId: 'r', trials: [
    { phase: 'main', compliant: false, reminder_shown: false, reminder_page_shown: false },
    { phase: 'main', compliant: false, reminder_shown: true, reminder_page_shown: false },
    { phase: 'main', compliant: null, reminder_shown: true, reminder_page_shown: true },
    { phase: 'main', compliant: true, reminder_shown: false, reminder_page_shown: false },
  ] })
  assert.deepStrictEqual([res.n_noncompliant, res.n_compliance_not_assessed, res.n_reminder_lines, res.n_reminder_pages], [2, 1, 2, 1])
})

test('every reminder text is an existing instruction text, word for word', () => {
  const keys = cfg.keys
  const plainText = t => richParts(t).map(p => (typeof p === 'string' ? p : p.key)).join('')
  for (const arm of ['vision', 'touch', 'breath']) {
    const page = instructionPages(arm, 4, keys)[1].paragraphs.join(' ')
    for (const p of armReminderPage(arm, keys).paragraphs) assert.ok(page.includes(p), `${arm}: "${p}" is on the instruction page`)
    const line = complianceLine(arm, keys)
    if (arm === 'vision') {
      assert.equal(line, 'Please just watch the circle. Do not press any keys while the circle is pulsing.')
      assert.ok(page.includes(line))
    } else assert.equal(line, pacerReminder(arm, keys))
    assert.ok(plainText(line).length > 0)
  }
  assert.deepStrictEqual(armReminderPage('touch', keys).paragraphs, [
    'As the circle pulses, please tap along with the circle: hold down the [[W]] key while the circle expands, and hold down the [[S]] key while the circle shrinks. Use your left hand.',
  ])
  assert.deepStrictEqual(armReminderPage('breath', keys).paragraphs, [
    'As the circle pulses, please breathe along with the circle. Please breathe in when the circle expands, and breathe out when the circle shrinks.',
    'As you breathe in, hold down the [[W]] key. As you breathe out, hold down the [[S]] key. Use your left hand.',
  ])
})
