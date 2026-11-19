// The live presenter with a fake window, document, frame clock and full-screen controller: a trial never starts
// out of full screen, including when full screen is left while the keys-up gate waits (the Stage B gap).
// Run: node --test src/games/BcatThreshold/presenter.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeConfig } from './config.js'
import { createLivePresenter } from './presenter.js'
import { practiceTrials } from './trialPlan.js'

function setup({ arm = 'touch', outOfFullscreen = false } = {}) {
  const cfg = makeConfig()
  const listeners = {}
  const win = { addEventListener: (t, f) => { listeners[t] = f }, removeEventListener: t => { delete listeners[t] } }
  const doc = { visibilityState: 'visible', addEventListener: (t, f) => { listeners[t] = f }, removeEventListener: t => { delete listeners[t] } }
  const fs = { out: outOfFullscreen, subs: [] }
  const fullscreen = {
    needsReturn: () => fs.out, isActive: () => !fs.out,
    subscribe(fn) { fs.subs.push(fn); return () => { fs.subs = fs.subs.filter(f => f !== fn) } },
  }
  const frames = []
  const ui = []
  let cancelled = false
  const els = { circle: { style: {} }, question: { style: {} }, cue: { style: {} } }
  const p = createLivePresenter({
    cfg, arm, els: () => els, setCue: () => {}, isCancelled: () => cancelled, framePeriodMs: () => 1000 / 60, runStart: 0,
    onUi: u => ui.push(u.what), raf: cb => frames.push(cb), now: () => 0, doc, win, fullscreen,
  })
  p.attach()
  const key = (type, k, code) => listeners[type]({ key: k, code, timeStamp: 1, repeat: false, preventDefault() {} })
  const exitFullscreen = () => { fs.out = true; for (const f of fs.subs) f('fullscreen_exit') }
  return { cfg, p, ui, frames, key, exitFullscreen, cancel: () => { cancelled = true }, spec: practiceTrials(cfg)[0] }
}

const tick = () => new Promise(r => setTimeout(r, 0))

test('leaving full screen while the keys-up gate waits: no circle starts; present says so', async () => {
  const s = setup({ arm: 'touch' })
  s.key('keydown', 'w', 'KeyW')
  const pending = s.p.present({ phase: 'main', spec: s.spec })
  await tick()
  assert.deepStrictEqual(s.ui, ['gate'], 'waiting for W to be let go')
  s.exitFullscreen()
  const out = await pending
  assert.deepStrictEqual(out, { fullscreen_lost: true })
  assert.equal(s.frames.length, 0, 'no frame was asked for: the circle never started')
  assert.ok(s.ui.includes('fullscreen_lost'))
  s.p.detach()
})

test('out of full screen with no key down: present starts nothing', async () => {
  const s = setup({ arm: 'vision', outOfFullscreen: true })
  const out = await s.p.present({ phase: 'practice', spec: s.spec })
  assert.deepStrictEqual(out, { fullscreen_lost: true })
  assert.equal(s.frames.length, 0)
})

test('in full screen, once the keys are up, the circle starts as before', async () => {
  const s = setup({ arm: 'touch' })
  s.key('keydown', 'w', 'KeyW')
  const pending = s.p.present({ phase: 'main', spec: s.spec })
  await tick()
  s.key('keyup', 'w', 'KeyW')
  await tick()
  assert.equal(s.frames.length, 1, 'the first frame was asked for')
  s.cancel()
  s.frames.shift()(16)
  assert.deepStrictEqual(await pending, { cancelled: true })
})
