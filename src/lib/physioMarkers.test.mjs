import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMarkerBus, encodeMarker, MARKERS, CLIP_ONSET, lptTransport } from './physioMarkers.js'

function fakeClock() {
  let t = 0
  return { now: () => t, sleep: async (ms) => { t += ms } }
}
function recorder() {
  const writes = []
  return { writes, transport: { write: async (m) => { writes.push(m) } } }
}

test('BBTK gets two upper-case hex characters, never decimal', () => {
  assert.deepEqual(encodeMarker('bbtk', 31), { kind: 'text', data: '1F' })
  assert.deepEqual(encodeMarker('bbtk', 0), { kind: 'text', data: '00' })
  assert.deepEqual(encodeMarker('bbtk', 255), { kind: 'text', data: 'FF' })
  assert.deepEqual([...encodeMarker('raw_byte', 99).data], [99])
  // Biopac seats get the 4-bit event type, on their own nibble
  assert.deepEqual(encodeMarker('biopac_left', 15), { kind: 'lpt', address: 0xDFF8, value: 7 * 16 })
  assert.deepEqual(encodeMarker('biopac_right', 52), { kind: 'lpt', address: 0xD030, value: 8 })
  assert.equal(encodeMarker('none', 5), null)
})

test('each marker is a pulse: on, hold, clear, and logged with its request and send times', async () => {
  const c = fakeClock(); const r = recorder(); const log = []
  const bus = createMarkerBus({ device: 'bbtk', transport: r.transport, onLog: e => log.push(e), pulseMs: 10, ...c })
  const e = await bus.send(MARKERS.sync, 'sync')
  assert.deepEqual(r.writes.map(w => w.data), ['01', '00'])
  assert.equal(e.sent, true)
  assert.equal(e.requestedAt, 0)
  assert.equal(e.sentAt, 10)
  assert.equal(log.length, 1)
})

test('back-to-back markers are queued as two clean pulses, in order', async () => {
  const c = fakeClock(); const r = recorder(); const log = []
  const bus = createMarkerBus({ device: 'bbtk', transport: r.transport, onLog: e => log.push(e), ...c })
  bus.send(MARKERS.clip_off, 'clip_off')
  await bus.send(MARKERS.rating_shown, 'rating_shown')
  assert.deepEqual(r.writes.map(w => w.data), ['63', '00', '5A', '00'])
  assert.deepEqual(log.map(e => e.code), [99, 90])
})

test('no device: nothing is written, but the marker is still logged as not sent', async () => {
  const log = []
  const bus = createMarkerBus({ device: 'bbtk', transport: null, onLog: e => log.push(e), ...fakeClock() })
  const e = await bus.send(CLIP_ONSET.A1, 'clip_on')
  assert.equal(e.sent, false)
  assert.equal(e.code, 31)
  assert.match(e.error, /no device/)
  assert.equal(log.length, 1)
})

test('a failed write never throws into the task and does not block later markers', async () => {
  const log = []; let n = 0
  const flaky = { write: async () => { if (n++ === 0) throw new Error('port lost') } }
  const bus = createMarkerBus({ device: 'raw_byte', transport: flaky, onLog: e => log.push(e), ...fakeClock() })
  const a = await bus.send(1)
  const b = await bus.send(2)
  assert.equal(a.sent, false)
  assert.equal(a.error, 'port lost')
  assert.equal(b.sent, true)
  assert.equal(log.length, 2)
})

test('the parallel-port helper transport posts address and value, and fails loudly when down', async () => {
  const calls = []
  const t = lptTransport('http://h', async (url, init) => { calls.push([url, JSON.parse(init.body)]); return { ok: true } })
  await t.write(encodeMarker('biopac_right', 52))
  assert.deepEqual(calls, [['http://h/send', { address: 0xD030, value: 8 }]])
  const down = lptTransport('http://h', async () => ({ ok: false, status: 503 }))
  await assert.rejects(down.write(encodeMarker('biopac_right', 1)), /503/)
})

test('every clip has a distinct onset code that collides with no event code', () => {
  const clipCodes = Object.values(CLIP_ONSET)
  assert.equal(new Set(clipCodes).size, clipCodes.length)
  const eventCodes = new Set(Object.values(MARKERS))
  for (const c of clipCodes) assert.ok(!eventCodes.has(c), `clip code ${c} collides`)
})

test('on a Biopac seat every code fits its own four lines, and the event types stay distinct', async () => {
  const { compactCode, MARKERS, CLIP_ONSET } = await import('./physioMarkers.js')
  const all = [...Object.values(MARKERS), ...Object.values(CLIP_ONSET)]
  for (const c of all) {
    assert.ok(compactCode(c) >= 1 && compactCode(c) <= 15, `code ${c}`)
    assert.ok(encodeMarker('biopac_right', c).value <= 15, `right seat, code ${c}`)
    assert.equal(encodeMarker('biopac_left', c).value % 16, 0, `left seat, code ${c}`)
  }
  assert.notEqual(compactCode(MARKERS.clip_off), compactCode(CLIP_ONSET.A1))
  assert.notEqual(compactCode(MARKERS.rating_shown), compactCode(MARKERS.rating_answered))
  assert.equal(compactCode(MARKERS.sync), 1)
})
