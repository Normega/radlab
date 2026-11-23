import { useEffect, useMemo, useRef, useState } from 'react'
import RaPanel, { useRaShortcut, RA_STYLES as R } from './RaPanel'
import { createBreWriter } from './breLog'
import {
  MARKER_DEVICES, MARKERS, BIOPAC_HELPER_URL, sessionMarkerBus, openSerialTransport, lptTransport,
} from '../../../lib/physioMarkers'

const DEVICE_KEY = 'bre_marker_device'
function rememberedDevice() {
  try { return localStorage.getItem(DEVICE_KEY) || '' } catch { return '' }
}
function rememberDevice(d) {
  try { localStorage.setItem(DEVICE_KEY, d) } catch { /* storage blocked: the RA picks again next time */ }
}

/**
 * Sensor set-up hold (activity physio/bre_physio_setup; plan §4 step 11, §9, §10).
 *
 * The participant sees one line and waits. The RA opens the panel (Ctrl+Alt+R, then the study's RA
 * PIN), picks the marker device, connects it, sends a test pulse (code 200) to check it lands in
 * AcqKnowledge, and once the recording is running presses Start: that sends sync marker 1, asks for
 * fullscreen and moves on. Every step of this is written to bre_events (step 'physio_setup').
 *
 * The connection lives in sessionMarkerBus(), so the baseline and the main task (later steps, new
 * mounts) send through it. "No marker device" is allowed, on purpose and logged, for a pilot without
 * the box: every marker is then logged as not sent.
 */
export default function BrePhysioSetupStep({ enrollment, scheduleId, supabaseClient, onComplete, demoMode = false, isSimMode = false }) {
  const db = supabaseClient
  const bypass = demoMode || isSimMode
  const studyId = enrollment?.study_id
  const bus = sessionMarkerBus()
  const writer = useMemo(() => bypass ? null : createBreWriter({
    db, userId: enrollment?.profile_id, studyId, scheduleId, step: 'physio_setup', isTest: isSimMode,
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const log = (event, opts) => writer?.event(event, opts)

  const [open, setOpen] = useState(false)
  const [device, setDevice] = useState(() => rememberedDevice() || bus.device)
  const [status, setStatus] = useState(bus.connected ? 'connected' : 'idle')   // idle | connecting | connected | error
  const [statusMsg, setStatusMsg] = useState('')
  const [test, setTest] = useState(null)           // last test pulse entry
  const [recording, setRecording] = useState(false)
  const [starting, setStarting] = useState(false)
  const transportRef = useRef(null)

  useEffect(() => { log('setup_shown') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useRaShortcut(() => setOpen(true))

  const dev = MARKER_DEVICES.find(d => d.value === device)

  async function connect() {
    if (!dev) return
    setStatus('connecting'); setStatusMsg('')
    try {
      await transportRef.current?.close?.()
      let t = null
      if (dev.transport === 'serial') {
        if (!('serial' in navigator)) throw new Error('This browser has no Web Serial. Use Chrome or Edge.')
        const known = await navigator.serial.getPorts()
        const port = known.length === 1 ? known[0] : await navigator.serial.requestPort()
        t = await openSerialTransport(port)
      } else if (dev.transport === 'lpt') {
        const res = await fetch(`${BIOPAC_HELPER_URL}/status`)
        const body = await res.json().catch(() => ({}))
        if (!body?.ok || !body?.dll) throw new Error('The parallel-port helper is not ready (localhost:8765).')
        t = lptTransport()
      }
      transportRef.current = t
      bus.setDevice(device); bus.setTransport(t)
      rememberDevice(device)
      setStatus('connected')
      setStatusMsg(dev.transport === 'none' ? 'No device: markers will be logged as not sent.' : 'Connected.')
      log('device_connected', { detail: { device } })
    } catch (err) {
      bus.setTransport(null)
      setStatus('error'); setStatusMsg(String(err?.message ?? err))
      log('device_error', { detail: { device, error: String(err?.message ?? err) } })
    }
  }

  async function testPulse() {
    const entry = await bus.send(MARKERS.test_pulse, 'test_pulse')
    setTest(entry)
    log('test_pulse', { tMs: entry.requestedAt, marker: entry })
  }

  async function start() {
    if (starting) return
    setStarting(true)
    try { await document.documentElement.requestFullscreen?.() } catch { /* kiosk mode, or refused: carry on */ }
    if (bypass) { onComplete({}); return }
    const entry = await bus.send(MARKERS.sync, 'sync')
    log('sync', { tMs: entry.requestedAt, marker: entry, detail: { recording_confirmed: true } })
    log('setup_done')
    await writer.drain()
    onComplete({})
  }

  const canStart = status === 'connected' && (device === 'none' || recording)

  return (
    <div style={S.wrap}>
      <p style={S.text}>Please let the research assistant know you have finished.</p>
      {bypass && <button style={R.button} onClick={() => setOpen(true)}>Open RA panel (demo)</button>}

      <RaPanel open={open} onClose={() => setOpen(false)} studyId={studyId} db={db} bypass={bypass}
        title="Sensor set-up" onUnlock={() => log('ra_unlock')} onPinFailed={() => log('ra_pin_failed')}>
        <div style={S.panel}>
          <label style={R.note} htmlFor="bre-device">Marker device</label>
          <select id="bre-device" value={device} onChange={e => { setDevice(e.target.value); setStatus('idle'); setTest(null) }} style={S.select}>
            <option value="" disabled>Choose…</option>
            {MARKER_DEVICES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <div style={R.row}>
            <button style={R.button} onClick={connect} disabled={!dev || status === 'connecting'}>
              {status === 'connecting' ? 'Connecting…' : status === 'connected' ? 'Reconnect' : 'Connect'}
            </button>
            {status === 'connected' && device !== 'none' && <button style={R.button} onClick={testPulse}>Send test pulse (200)</button>}
          </div>
          {statusMsg && <p style={status === 'error' ? R.bad : R.ok}>{statusMsg}</p>}
          {test && <p style={test.sent ? R.ok : R.bad}>{test.sent ? 'Test pulse sent. Check that 200 appears in AcqKnowledge.' : `Test pulse not sent: ${test.error}`}</p>}
          {status === 'connected' && device !== 'none' && (
            <label style={{ ...R.note, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={recording} onChange={e => setRecording(e.target.checked)} />
              AcqKnowledge is recording and the test pulse arrived
            </label>
          )}
          <button style={{ ...R.primary, opacity: canStart ? 1 : 0.5 }} onClick={start} disabled={!canStart || starting}>
            Start (sends marker 1)
          </button>
          <p style={R.note}>Study code: <b>{enrollment?.study_code ?? '—'}</b> (name the AcqKnowledge file with it).</p>
        </div>
      </RaPanel>
    </div>
  )
}

const S = {
  wrap:   { minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 24px' },
  text:   { maxWidth: 560, fontSize: 20, color: 'var(--tx)', textAlign: 'center', lineHeight: 1.6, fontFamily: '"DM Sans",system-ui,sans-serif', margin: 0 },
  panel:  { display: 'flex', flexDirection: 'column', gap: 16 },
  select: { padding: '8px 16px', borderRadius: 12, border: '1px solid var(--bd)', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif' },
}
