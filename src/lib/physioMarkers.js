// Physiology markers from the browser: one byte (1–255) per event, held briefly, then 0.
// Breath Attention and Emotional Recovery plan §9 (WP-G5); the lab's other marker path, Breath
// Belt's, lives in src/games/BreathBelt/hooks/useBeltConnection.js and speaks the same protocols.
//
// Devices (chosen by the RA at the sensor step, remembered on that lab computer):
//   bbtk        Black Box ToolKit USB TTL Module over Web Serial: two upper-case hex characters set
//               the 8 output lines ("1F"), "00" clears. Decimal would land on the wrong lines.
//   raw_byte    a serial box that takes the byte itself (Brain Products TriggerBox, an Arduino
//               converter): write [code], then [0].
//   biopac_lpt  Biopac through the lab's local parallel-port helper (scripts/parallel_server.py,
//               http://localhost:8765, POST /send {address, value}), left or right rig.
//   none        no device: every marker is still logged, with sent = false.
//
// Every marker the task asks for is logged through onLog, whether or not it reached a device, with
// the performance.now() time it was asked for and the time the write finished, so the platform's
// log and the AcqKnowledge file can be cross-checked and a lost marker is visible. A marker never
// throws into the task: a failed write is logged as not sent and the session carries on.
//
// Markers are queued: each one is held for pulseMs and cleared before the next goes out, so two
// events a millisecond apart (a clip ending, its rating appearing) become two clean pulses instead
// of one merged code.

export const MARKER_DEVICES = [
  { value: 'bbtk',        label: 'Black Box ToolKit USB TTL (Web Serial)', transport: 'serial' },
  { value: 'raw_byte',    label: 'Serial trigger box, raw byte (TriggerBox, Arduino)', transport: 'serial' },
  { value: 'biopac_left',  label: 'Biopac, left rig (parallel-port helper)',  transport: 'lpt', address: 0xDFF8, shift: 16 },
  { value: 'biopac_right', label: 'Biopac, right rig (parallel-port helper)', transport: 'lpt', address: 0xD030, shift: 1 },
  { value: 'none',        label: 'No marker device (log only)', transport: 'none' },
]

export const BIOPAC_HELPER_URL = 'http://localhost:8765'

/** The draft code table (plan §9). Task code refers to markers by name, never by number. */
export const MARKERS = Object.freeze({
  sync: 1,
  baseline_on: 2, baseline_off: 3,
  training_on: 10, training_off: 11, training_replay_on: 12, training_replay_off: 13,
  practice_on: 14, practice_off: 15,
  clip_off: 99,
  break_on: 70, break_off: 71,
  recovery_on: 80, recovery_off: 81,
  rating_shown: 90, rating_answered: 91,
  cue_on: 92,
  ra_pause: 250, ra_resume: 251, ra_skip: 252,
  test_pulse: 200,
  task_end: 255,
})

/** Clip onset codes, by REB clip id. */
export const CLIP_ONSET = Object.freeze({
  A1: 31, A3: 33, A4: 34, A7: 37,
  S3: 43, S4: 44, S5: 45, S6: 46, S8: 48,
  N1: 51, N2: 52, N3: 53, N5: 55, N8: 58,
  P1: 61, P2: 62,
})

/** What goes on the wire to set the lines to `code` (0 clears), for one device. */
export function encodeMarker(device, code) {
  const c = Math.max(0, Math.min(255, Math.round(Number(code)))) | 0
  const dev = MARKER_DEVICES.find(d => d.value === device)
  if (!dev || dev.transport === 'none') return null
  if (device === 'bbtk') return { kind: 'text', data: c.toString(16).toUpperCase().padStart(2, '0') }
  if (device === 'raw_byte') return { kind: 'bytes', data: Uint8Array.of(c) }
  return { kind: 'lpt', address: dev.address, value: Math.min(255, c * dev.shift) }
}

/**
 * createMarkerBus({ device, transport, onLog, pulseMs, now, sleep })
 *   transport: { write(encoded) => Promise } or null (nothing connected)
 *   onLog(entry): { code, name, device, requestedAt, sentAt, sent, error, detail }
 * Returns { send(code, name, detail) => Promise<entry>, setTransport, setDevice, device, idle() }.
 */
export function createMarkerBus({
  device = 'none', transport = null, onLog = () => {}, pulseMs = 10,
  now = () => performance.now(), sleep = (ms) => new Promise(r => setTimeout(r, ms)),
} = {}) {
  let dev = device
  let tx = transport
  let chain = Promise.resolve()

  async function pulse(code) {
    const on = encodeMarker(dev, code)
    if (!on || !tx) return { sent: false, error: tx ? null : 'no device connected' }
    try {
      await tx.write(on)
      await sleep(pulseMs)
      await tx.write(encodeMarker(dev, 0))
      return { sent: true, error: null }
    } catch (err) {
      return { sent: false, error: String(err?.message ?? err) }
    }
  }

  function send(code, name = null, detail = null) {
    const requestedAt = now()
    const p = chain.then(async () => {
      const deviceAtSend = dev
      const { sent, error } = await pulse(code)
      const entry = { code, name, device: deviceAtSend, requestedAt, sentAt: sent ? now() : null, sent, error, detail }
      try { onLog(entry) } catch (e) { console.error('marker log failed:', e) }
      return entry
    })
    chain = p.catch(() => {})
    return p
  }

  return {
    send,
    setTransport(t) { tx = t },
    setDevice(d) { dev = d },
    get device() { return dev },
    get connected() { return !!tx && dev !== 'none' },
    idle() { return chain },
  }
}

/** A Web Serial transport for an open port. */
export async function openSerialTransport(port, { baudRate = 115200 } = {}) {
  if (port.readable || port.writable) {
    try { await port.close() } catch { /* not open */ }
  }
  await port.open({ baudRate })
  const writer = port.writable.getWriter()
  const enc = new TextEncoder()
  return {
    async write(m) {
      await writer.write(m.kind === 'text' ? enc.encode(m.data) : m.data)
    },
    async close() {
      try { writer.releaseLock() } catch { /* already released */ }
      try { await port.close() } catch { /* already closed */ }
    },
  }
}

/** A transport for the Biopac parallel-port helper. Throws from write when the helper is down. */
export function lptTransport(baseUrl = BIOPAC_HELPER_URL, fetchImpl = (...a) => fetch(...a)) {
  return {
    async write(m) {
      const res = await fetchImpl(`${baseUrl}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: m.address, value: m.value }),
      })
      if (!res.ok) throw new Error(`parallel helper answered ${res.status}`)
    },
    async close() {},
  }
}

// One bus for the whole session on this page. The sensor step connects it; the baseline and the
// main task (separate steps, so separate mounts) send through the same connection.
let sessionBus = null
export function sessionMarkerBus() {
  if (!sessionBus) sessionBus = createMarkerBus({ pulseMs: 10 })
  return sessionBus
}
