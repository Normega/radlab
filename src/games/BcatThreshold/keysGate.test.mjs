// Headless checks for the keys-up gate and the device check.
// Run: node --test src/games/BcatThreshold/keysGate.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { armUsesPacerKeys, pacerKeysHeld, mustWaitForRelease } from './keysGate.js'
import { createKeyTracker } from './keyLog.js'
import { deviceProblem, readDeviceEnv } from './device.js'
import { makeConfig } from './config.js'

const keys = makeConfig().keys
const W = { key: 'w', code: 'KeyW' }, S = { key: 's', code: 'KeyS' }

test('only the touch and breath arms wait for W and S', () => {
  assert.equal(armUsesPacerKeys('vision'), false)
  assert.equal(armUsesPacerKeys('touch'), true)
  assert.equal(armUsesPacerKeys('breath'), true)
  assert.throws(() => armUsesPacerKeys('smell'), /Unknown arm/)
  assert.throws(() => armUsesPacerKeys(undefined), /Unknown arm/)
})

test('the gate follows the tracker: down, up, and a blur that lets everything go', () => {
  const tr = createKeyTracker()
  assert.equal(mustWaitForRelease('touch', tr.held(), keys), false)
  tr.keydown(W)
  assert.deepStrictEqual(pacerKeysHeld(tr.held(), keys), ['grow'])
  assert.equal(mustWaitForRelease('touch', tr.held(), keys), true)
  assert.equal(mustWaitForRelease('breath', tr.held(), keys), true)
  assert.equal(mustWaitForRelease('vision', tr.held(), keys), false, 'vision never waits')
  tr.keydown(S)
  assert.deepStrictEqual(pacerKeysHeld(tr.held(), keys), ['grow', 'shrink'])
  tr.keyup(W)
  assert.equal(mustWaitForRelease('touch', tr.held(), keys), true, 'S is still down')
  tr.keyup(S)
  assert.equal(mustWaitForRelease('touch', tr.held(), keys), false)
  tr.keydown(W); tr.keydown(S)
  tr.releaseAll()     // window blur: key-ups may never come
  assert.equal(mustWaitForRelease('touch', tr.held(), keys), false)
})

test('other keys held (an arrow still down after the answer) do not hold the trial back', () => {
  const tr = createKeyTracker()
  tr.keydown({ key: 'ArrowLeft', code: 'ArrowLeft' })
  tr.keydown({ key: 'Shift', code: 'ShiftLeft' })
  assert.equal(mustWaitForRelease('touch', tr.held(), keys), false)
})

test('W and S count by the character typed, or by the physical key when there is none (AZERTY, IMEs)', () => {
  assert.deepStrictEqual(pacerKeysHeld([{ key: 'W', code: 'KeyZ' }], keys), ['grow'], 'AZERTY: the key labelled W')
  assert.deepStrictEqual(pacerKeysHeld([{ key: 'Unidentified', code: 'KeyS' }], keys), ['shrink'])
  assert.deepStrictEqual(pacerKeysHeld([{ key: 'z', code: 'KeyW' }], keys), [], 'a typed z is not W')
  assert.deepStrictEqual(pacerKeysHeld([W, W], keys), ['grow'])
})

const desktop = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', hasTouch: false, finePointer: true, maxTouchPoints: 0, screenW: 1920, screenH: 1080 }

test('device check: desktops pass; phones, tablets and small screens are refused', () => {
  assert.equal(deviceProblem(desktop), null)
  assert.equal(deviceProblem({ ...desktop, hasTouch: true }), null, 'a touch laptop with a mouse or trackpad passes')
  assert.equal(deviceProblem({ ...desktop, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' }), 'mobile')
  assert.equal(deviceProblem({ ...desktop, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }), 'mobile')
  assert.equal(deviceProblem({ ...desktop, uaDataMobile: true }), 'mobile')
  assert.equal(deviceProblem({ ...desktop, hasTouch: true, finePointer: false }), 'mobile', 'touch only')
  assert.equal(deviceProblem({ ...desktop, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', maxTouchPoints: 5, finePointer: false }), 'mobile', 'iPadOS reports a Mac')
  assert.equal(deviceProblem({ ...desktop, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605' }), null, 'a real Mac')
  assert.equal(deviceProblem({ ...desktop, screenW: 799 }), 'small_screen')
  assert.equal(deviceProblem({ ...desktop, screenH: 499 }), 'small_screen')
  assert.equal(deviceProblem({ ...desktop, screenW: 800, screenH: 500 }), null)
})

test('readDeviceEnv reads what deviceProblem needs from a window', () => {
  const w = { navigator: { userAgent: 'UA', maxTouchPoints: 0 }, screen: { width: 1280, height: 800 }, matchMedia: () => ({ matches: true }) }
  assert.deepStrictEqual(readDeviceEnv(w), { userAgent: 'UA', uaDataMobile: false, hasTouch: false, finePointer: true, maxTouchPoints: 0, screenW: 1280, screenH: 800 })
})
