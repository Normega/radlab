// /belt-scope: Belt Scope, a live readout of a Polar H10 chest strap for lab
// members trying out how the strap is fitted (lab only, LabOnlyRoute).
//
// No calibration: traces appear as soon as the strap streams. Four lanes on one
// time axis (x, y, z with their slow mean removed, and the combined breath
// signal: band-passed axes projected on their top principal direction), live
// readouts, labels that mark the traces, and a raw recording saved as a local
// .zip whose CSVs use the BreathBelt study's exact layout, so the study's
// analysis code reads them. Nothing is sent to Supabase or any server.
//
// Signal maths: src/games/shared/breath/beltScopeSignal.js (tested headless).
// BLE: src/games/shared/breath/useH10Stream.js. ?sim=1 runs a simulated strap.
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { zipSync, strToU8 } from 'fflate'
import { useH10Stream, PMD_START_ACC } from '../../games/shared/breath/useH10Stream'
import {
  createBeltScopeProcessor, createRawRecorder, createBeltSim, packetSampleTimes,
  buildAccelCsv, buildHrCsv, buildLabelsCsv, sanitizeName, fileStamp,
  BREATH_BAND_HZ, SCOPE_HZ,
} from '../../games/shared/breath/beltScopeSignal.js'

const PAGE_VERSION = '1.0'
const KICKER = 'Lab · Belt Scope'
const WINDOWS_S = [15, 30, 60]
const DRAW_MS = 50          // canvas redraw (setInterval, so it survives tab switches)
const STATS_MS = 500        // readout chips
const NO_DATA_MS = 5000
const MIN_SPAN_MG = 20      // a lane never zooms in past ±20 mg
const QUICK_LABELS = ['Tightened', 'Loosened', 'Moved up', 'Moved down', 'Moved left', 'Moved right', 'Pod re-seated', 'Posture change', 'Talking / moving']

export default function BeltScope() {
  const location = useLocation()
  const isSim = new URLSearchParams(location.search).get('sim') === '1'
  const hasBluetooth = typeof navigator !== 'undefined' && !!navigator.bluetooth

  const [proc] = useState(createBeltScopeProcessor)   // created once, not per render
  const procRef = useRef(proc)
  const recRef = useRef(null)
  const recordingRef = useRef(false)
  const lastSampleAtRef = useRef(0)
  const connectedAtRef = useRef(0)
  const hrRef = useRef(null)
  const devStatsRef = useRef(null)   // device-clock sample rate over the recording
  const frameTypesRef = useRef(new Set())
  const labelsRef = useRef([])

  const [windowS, setWindowS] = useState(30)
  const [stats, setStats] = useState(null)
  const [hr, setHr] = useState(null)
  const [noData, setNoData] = useState(false)
  const [labels, setLabels] = useState([])
  const [labelText, setLabelText] = useState('')
  const [rec, setRec] = useState({ on: false, startMs: null, stopMs: null, samples: 0, saved: true })
  const [name, setName] = useState('')
  const [savedFile, setSavedFile] = useState(null)
  const [simOn, setSimOn] = useState(false)
  const [simSize, setSimSize] = useState(12)
  const [simRate, setSimRate] = useState(12)
  const simRef = useRef(null)
  const [clock, setClock] = useState(() => Date.now())
  const [connectedAt, setConnectedAt] = useState(0)

  useEffect(() => { labelsRef.current = labels }, [labels])

  // ── Incoming data (strap or simulator) ────────────────────────────────────
  const onAccel = useCallback(({ packetTs, devicePacketMicros, frameType, x, y, z }) => {
    lastSampleAtRef.current = packetTs
    frameTypesRef.current.add(frameType)
    const ts = packetSampleTimes(packetTs, x.length)
    const p = procRef.current
    for (let i = 0; i < x.length; i++) p.pushRaw(ts[i], x[i], y[i], z[i])
    if (recordingRef.current && recRef.current) {
      recRef.current.pushPacket(packetTs, devicePacketMicros, x, y, z)
      const d = devStatsRef.current
      if (Number.isFinite(devicePacketMicros)) {
        if (!d.first) d.first = { us: devicePacketMicros, n: recRef.current.sampleCount }
        else d.last = { us: devicePacketMicros, n: recRef.current.sampleCount }
      }
    }
  }, [])

  const onHr = useCallback((row) => {
    hrRef.current = row
    if (recordingRef.current && recRef.current) recRef.current.pushHr(row)
  }, [])

  const h10 = useH10Stream({ onAccel, onHr })
  const connected = simOn || h10.btState === 'CONNECTED'

  useEffect(() => {
    if (h10.btState === 'CONNECTED') { connectedAtRef.current = Date.now(); lastSampleAtRef.current = 0 }
  }, [h10.btState])

  // ── Simulator ─────────────────────────────────────────────────────────────
  const startSim = useCallback(() => {
    simRef.current = createBeltSim({ sizeMg: simSize, rateBpm: simRate, seed: Date.now() % 100000 })
    const t = Date.now()
    connectedAtRef.current = t
    lastSampleAtRef.current = 0
    setConnectedAt(t)
    setSimOn(true)
  }, [simSize, simRate])

  useEffect(() => {
    if (!simOn) return
    const sim = simRef.current
    let nextHr = Date.now() + 1000
    const id = setInterval(() => {
      const now = Date.now()
      for (const pk of sim.packetsUntil(now)) onAccel(pk)
      if (now >= nextHr) { onHr(sim.hrRow(now)); nextHr = now + 1000 }
    }, 100)
    return () => clearInterval(id)
  }, [simOn, onAccel, onHr])

  useEffect(() => { if (simRef.current) simRef.current.size = simSize }, [simSize])
  useEffect(() => { if (simRef.current) simRef.current.rate = simRate }, [simRate])

  // ── Readouts (2×/s) and the no-data check ─────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setClock(now)
      setConnectedAt(connectedAtRef.current)
      setStats(procRef.current.sampleCount ? procRef.current.stats() : null)
      setHr(hrRef.current)
      const since = lastSampleAtRef.current || connectedAtRef.current
      setNoData(connected && since > 0 && now - since > NO_DATA_MS)
      if (recordingRef.current && recRef.current) setRec(r => ({ ...r, samples: recRef.current.sampleCount }))
    }, STATS_MS)
    return () => clearInterval(id)
  }, [connected])

  // ── Labels ────────────────────────────────────────────────────────────────
  const addLabel = useCallback((text) => {
    const t = Date.now()
    const clean = String(text).trim().slice(0, 80)
    if (!clean) return
    setLabels(ls => [...ls, { id: `${t}-${Math.random().toString(36).slice(2, 7)}`, t, text: clean }])
  }, [])
  const deleteLabel = (id) => setLabels(ls => ls.filter(l => l.id !== id))

  // ── Recording ─────────────────────────────────────────────────────────────
  const startRecording = () => {
    if (!rec.saved && rec.samples > 0 && !window.confirm('The last recording has not been saved. Discard it and start a new one?')) return
    recRef.current = createRawRecorder()
    devStatsRef.current = {}
    recordingRef.current = true
    setSavedFile(null)
    setRec({ on: true, startMs: Date.now(), stopMs: null, samples: 0, saved: false })
  }
  const stopRecording = () => {
    recordingRef.current = false
    setRec(r => ({ ...r, on: false, stopMs: Date.now(), samples: recRef.current?.sampleCount ?? 0 }))
  }

  useEffect(() => {
    if (rec.saved || !(rec.samples > 0 || rec.on)) return
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [rec.saved, rec.samples, rec.on])

  const save = () => {
    const r = recRef.current
    if (!r || rec.on) return
    const base = `${sanitizeName(name)}_${fileStamp(rec.startMs)}`
    const during = labelsRef.current.filter(l => l.t >= rec.startMs && l.t <= rec.stopMs)
    const d = devStatsRef.current || {}
    const devHz = d.first && d.last && d.last.us > d.first.us ? (d.last.n - d.first.n) / ((d.last.us - d.first.us) / 1e6) : null
    const meta = {
      page: 'belt-scope', pageVersion: PAGE_VERSION, simulated: isSim && simOn,
      device: isSim ? 'simulated H10' : (h10.deviceName || 'Polar H10'),
      requested: { stream: 'accelerometer', sampleRateHz: 200, rangeG: 8, resolutionBits: 16, pmdStartCommand: PMD_START_ACC.map(b => b.toString(16).padStart(2, '0')).join(' ') },
      observed: {
        frameTypes: [...frameTypesRef.current],
        sampleRateHzDeviceClock: devHz != null ? Number(devHz.toFixed(3)) : null,
        samples: r.sampleCount, hrRows: r.hrCount, labels: during.length,
      },
      recording: { startMs: rec.startMs, stopMs: rec.stopMs, startLocal: new Date(rec.startMs).toString(), durationS: Number(((rec.stopMs - rec.startMs) / 1000).toFixed(1)) },
      files: {
        accel: 'The BreathBelt study layout. x, y, z are mg / 100 (as the study writes them). packet_timestamp is the browser clock (ms) at packet arrival and marks the LAST sample of its packet; device_packet_us is the H10 clock (µs since 2000-01-01) of that last sample. phase belt_scope, trial -1, pacer_radius blank.',
        hr: 'The BreathBelt study layout. rr_intervals_1024 are raw 1/1024 s ticks, ;-separated. contact_status 3 = skin contact.',
        labels: 'timestamp is the same clock as packet_timestamp; elapsed_s is seconds since recording start (recording.startMs). Deleted labels are left out.',
      },
      readout: { band_hz: BREATH_BAND_HZ, filter: 'causal 2nd-order Butterworth high-pass then low-pass', scope_hz: Number(SCOPE_HZ.toFixed(3)), pca_window_s: 20, stats_window_s: 30, size: 'peak amplitude = sqrt(2) * SD of the combined signal' },
    }
    const files = {
      [`${base}_accel.csv`]: strToU8(buildAccelCsv(r)),
      [`${base}_hr.csv`]: strToU8(buildHrCsv(r.hrRows())),
      [`${base}_labels.csv`]: strToU8(buildLabelsCsv(during, rec.startMs)),
      [`${base}_meta.json`]: strToU8(JSON.stringify(meta, null, 2)),
    }
    const blob = new Blob([zipSync(files)], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${base}.zip`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    setSavedFile(`${base}.zip`)
    setRec(x => ({ ...x, saved: true }))
  }

  const recElapsedS = rec.startMs ? ((rec.on ? clock : rec.stopMs) - rec.startMs) / 1000 : 0
  const connectedForS = connectedAt && connected ? (clock - connectedAt) / 1000 : null

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <header style={S.header}>
          <div>
            <div style={S.kicker}>{KICKER}{isSim ? ' · simulated strap' : ''}</div>
            <h1 style={S.h1}>Belt Scope</h1>
            <p style={S.lead}>
              A live view of a Polar H10 chest strap's movement sensor, for trying out how the strap
              is fitted. Nothing is uploaded: recordings save to this computer.
            </p>
          </div>
          <Link to="/dashboard" style={S.back}>← radlab.zone</Link>
        </header>

        {/* ── Connection ───────────────────────────────────────────────── */}
        <section style={S.card}>
          {!isSim && !hasBluetooth ? (
            <p style={S.body}>
              Belt Scope talks to the strap over Web Bluetooth, which only Chrome and Edge on a
              computer support. Open this page in one of those. To look around without a strap,
              add <code>?sim=1</code> to the address.
            </p>
          ) : (
            <div style={S.row}>
              <StatusDot on={connected} />
              <span style={S.status}>
                {isSim
                  ? (simOn ? 'Simulated strap running' : 'Simulated strap (no hardware)')
                  : { IDLE: 'Not connected', CONNECTING: 'Connecting…', CONNECTED: `Connected${h10.deviceName ? ` to ${h10.deviceName}` : ''}`, DISCONNECTED: 'The strap disconnected', ERROR: 'Could not connect' }[h10.btState]}
                {connectedForS != null && <span style={S.muted}> · {fmtClock(connectedForS)}</span>}
              </span>
              <span style={S.spacer} />
              {isSim
                ? !simOn && <Btn onClick={startSim}>Start simulation</Btn>
                : h10.btState === 'CONNECTED'
                  ? <Btn ghost onClick={h10.disconnect}>Disconnect</Btn>
                  : <Btn onClick={h10.connect} disabled={h10.btState === 'CONNECTING'}>{h10.btState === 'DISCONNECTED' || h10.btState === 'ERROR' ? 'Connect again' : 'Connect strap'}</Btn>}
            </div>
          )}
          {!isSim && hasBluetooth && !connected && (
            <p style={S.hint}>Dampen the electrodes, put the strap on, then connect. Chrome lists the strap as “Polar H10 …”.</p>
          )}
          {h10.error && <p style={S.errText}>{h10.error}</p>}
          {isSim && simOn && (
            <div style={S.simRow}>
              <label style={S.simLabel}>
                Breathing size <strong>{simSize} mg</strong>
                <input type="range" min={0} max={30} step={0.5} value={simSize} onChange={e => setSimSize(Number(e.target.value))} />
              </label>
              <label style={S.simLabel}>
                Breathing rate <strong>{simRate}/min</strong>
                <input type="range" min={4} max={30} step={1} value={simRate} onChange={e => setSimRate(Number(e.target.value))} />
              </label>
              <Btn ghost small onClick={() => simRef.current?.shift(20, Date.now())}>Simulate a strap shift</Btn>
              <Btn ghost small onClick={() => simRef.current?.flip()}>Flip the pod</Btn>
            </div>
          )}
        </section>

        {noData && (
          <div style={S.notice}>No data yet. The strap only streams while it's worn and the electrodes are damp.</div>
        )}
        {stats?.upsideDown && (
          <div style={S.warn}>The strap looks upside down. Turn the pod so the logo reads the right way up.</div>
        )}

        {/* ── Traces ───────────────────────────────────────────────────── */}
        <section style={S.card}>
          <div style={S.row}>
            <h2 style={S.h2}>Traces</h2>
            <span style={S.spacer} />
            <span style={S.muted}>Window</span>
            {WINDOWS_S.map(w => (
              <button key={w} type="button" onClick={() => setWindowS(w)} style={{ ...S.seg, ...(windowS === w ? S.segOn : null) }}>{w} s</button>
            ))}
          </div>
          <Scope procRef={procRef} labelsRef={labelsRef} windowS={windowS} />
          <p style={S.hint}>
            x, y and z are the strap's three axes in mg (thousandths of gravity) with their slow
            10 s average taken off, so the breathing wobble shows; the number beside each is that
            average. Breath is the three axes filtered to breathing speeds ({BREATH_BAND_HZ[0]}–{BREATH_BAND_HZ[1]} Hz,
            about half a second behind) and combined along the direction they move most.
          </p>
        </section>

        {/* ── Readouts ─────────────────────────────────────────────────── */}
        <section style={S.card}>
          <h2 style={S.h2}>Readouts <span style={S.muted}>(last 30 s)</span></h2>
          <div style={S.chips}>
            <Chip label="Breathing size" value={fmt(stats?.sizeMg, 1, ' mg')}
              sub={Number.isFinite(stats?.sizeTiltDeg) ? `≈ ${stats.sizeTiltDeg.toFixed(2)}° of tilt` : 'how far each breath moves the strap'} />
            <Chip label="Breathing rate" value={fmt(stats?.rateBpm, 1, ' /min')} sub="breaths per minute" />
            <Chip label="Rhythm" value={fmt(stats?.rhythm, 2)} sub="how regularly the trace repeats (0–1)" />
            <Chip label="Share on the breath axis" value={Number.isFinite(stats?.share) ? `${Math.round(stats.share * 100)}%` : '—'} sub="movement along one direction" />
            <Chip label="Heart rate" value={hr && hr.heartRate > 0 ? `${hr.heartRate} bpm` : '—'}
              sub={hr ? (hr.contactStatus === 2 ? 'no skin contact' : 'from the strap') : 'from the strap'} />
            <Chip label="Strap tilt" value={fmt(stats?.tiltDeg, 0, '°')} sub={stats?.upsideDown ? 'upside down' : 'from upright'} warn={stats?.upsideDown} />
          </div>
          {stats && stats.seconds < 10 && <p style={S.hint}>The breathing readouts need 10 s of signal.</p>}
          <p style={S.hint}>
            Breathing size is the peak of each breath (half of peak to peak). For comparison, in our
            study recordings breathing was picked up well where it was about 15 mg, and missed
            where it was about 7 mg. A steady breath scores about 0.8 on rhythm. The readouts settle once
            30 s of signal are in, and a big movement inflates them until it has passed out of those 30 s.
          </p>
        </section>

        {/* ── Labels ───────────────────────────────────────────────────── */}
        <section style={S.card}>
          <h2 style={S.h2}>Labels</h2>
          <p style={S.hint}>Mark what you changed. Each label draws a line on the traces at that moment.</p>
          <div style={S.wrap}>
            {QUICK_LABELS.map(l => <Btn key={l} ghost small onClick={() => addLabel(l)}>{l}</Btn>)}
          </div>
          <form style={S.row} onSubmit={e => { e.preventDefault(); addLabel(labelText); setLabelText('') }}>
            <input value={labelText} onChange={e => setLabelText(e.target.value)} placeholder="Your own label" style={S.input} aria-label="Your own label" />
            <Btn type="submit" small disabled={!labelText.trim()}>Add</Btn>
          </form>
          {labels.length > 0 && (
            <ol style={S.list}>
              {labels.map(l => {
                const inRec = rec.startMs && l.t >= rec.startMs && (rec.on || l.t <= rec.stopMs)
                return (
                  <li key={l.id} style={S.listRow}>
                    <span style={S.mono}>{connectedAt ? fmtClock((l.t - connectedAt) / 1000) : '—'}</span>
                    <span style={S.labelText}>{l.text}</span>
                    {inRec && <span style={S.tag}>in recording</span>}
                    <span style={S.spacer} />
                    <button type="button" onClick={() => deleteLabel(l.id)} style={S.del} aria-label={`Delete label ${l.text}`}>Delete</button>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* ── Recording ────────────────────────────────────────────────── */}
        <section style={S.card}>
          <h2 style={S.h2}>Recording</h2>
          <label style={S.field}>
            <span style={S.fieldLabel}>Recording name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Norm-test-3" style={{ ...S.input, flex: 'none' }} />
          </label>
          <p style={S.hint}>Use a nickname or test number, not a participant ID.</p>
          <div style={S.row}>
            {!rec.on
              ? <Btn onClick={startRecording} disabled={!connected}>Start recording</Btn>
              : <Btn onClick={stopRecording}>Stop</Btn>}
            <Btn ghost onClick={save} disabled={rec.on || !(rec.samples > 0)}>Save (.zip)</Btn>
            <span style={S.status}>
              {rec.on && <><StatusDot on rec /> Recording </>}
              {rec.startMs ? `${fmtClock(recElapsedS)} · ${rec.samples.toLocaleString()} samples` : 'Not recorded yet'}
            </span>
          </div>
          {savedFile && <p style={S.hint}>Saved <strong>{savedFile}</strong> to your Downloads folder.</p>}
          <p style={S.hint}>
            Save gives one .zip with the accelerometer, heart-rate and label CSVs, in the same layout
            the BreathBelt study writes, so our analysis code reads them, plus a small meta.json.
            Labels made while recording are included.
          </p>
        </section>
      </div>
    </div>
  )
}

// ── The scope: one canvas, four lanes, one time axis ────────────────────────

const LANES = [
  { key: 'dx', name: 'x', staticIdx: 0, color: '--tx' },
  { key: 'dy', name: 'y', staticIdx: 1, color: '--tx2' },
  { key: 'dz', name: 'z', staticIdx: 2, color: '--gy' },
  { key: 'c', name: 'Breath', staticIdx: null, color: '--pkd' },
]
const LANE_H = 104
const AXIS_H = 32
const GUTTER = 88

function niceSpan(v) {
  const s = Math.max(MIN_SPAN_MG, v)
  const p = 10 ** Math.floor(Math.log10(s))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= s) return m * p
  return 10 * p
}

function Scope({ procRef, labelsRef, windowS }) {
  const canvasRef = useRef(null)
  const windowRef = useRef(windowS)
  useEffect(() => { windowRef.current = windowS }, [windowS])

  useEffect(() => {
    let colors = null, colorsAt = 0
    const draw = () => {
      const cv = canvasRef.current
      if (!cv) return
      const dpr = window.devicePixelRatio || 1
      const W = cv.clientWidth, Ht = LANES.length * LANE_H + AXIS_H
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(Ht * dpr)) {
        cv.width = Math.round(W * dpr); cv.height = Math.round(Ht * dpr)
      }
      const now = performance.now()
      if (!colors || now - colorsAt > 2000) {
        const cs = getComputedStyle(cv)
        const v = (n) => cs.getPropertyValue(n).trim()
        colors = { bg: v('--bgc'), bd: v('--bds'), tx: v('--tx'), tx2: v('--tx2'), gy: v('--gy'), pk: v('--pk'), pkd: v('--pkd'), pkb: v('--pkb') }
        colorsAt = now
      }
      const ctx = cv.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, Ht)
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, W, Ht)
      const winMs = windowRef.current * 1000
      const plotW = Math.max(40, W - GUTTER - 8)
      const x0 = GUTTER
      const p = procRef.current
      const h = p.history(winMs)
      const st = p.sampleCount ? p.stats() : null
      const tNow = h.t.length ? h.t[h.t.length - 1] : Date.now()
      const xOf = (t) => x0 + plotW * (1 - (tNow - t) / winMs)
      ctx.font = '12px "DM Sans", system-ui, sans-serif'
      ctx.textBaseline = 'middle'

      LANES.forEach((lane, li) => {
        const top = li * LANE_H, mid = top + LANE_H / 2
        const vals = h[lane.key]
        let mx = 0
        for (const v of vals) if (Math.abs(v) > mx) mx = Math.abs(v)
        const span = niceSpan(mx * 1.1)
        const yOf = (v) => mid - (v / span) * (LANE_H / 2 - 8)
        // lane frame and zero line
        ctx.strokeStyle = colors.bd; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x0, top + LANE_H - 0.5); ctx.lineTo(x0 + plotW, top + LANE_H - 0.5); ctx.stroke()
        ctx.setLineDash([4, 4])
        ctx.beginPath(); ctx.moveTo(x0, mid); ctx.lineTo(x0 + plotW, mid); ctx.stroke()
        ctx.setLineDash([])
        // gutter text: name, static value, scale
        ctx.fillStyle = colors.tx; ctx.font = '600 14px "DM Sans", system-ui, sans-serif'
        ctx.fillText(lane.name, 8, top + 20)
        ctx.font = '12px "DM Sans", system-ui, sans-serif'; ctx.fillStyle = colors.tx2
        if (lane.staticIdx != null && st) {
          const g = st.staticMg[lane.staticIdx]
          ctx.fillText(Number.isFinite(g) ? `${Math.round(g)} mg` : '—', 8, top + 40)
          ctx.fillText('static', 8, top + 56)
        } else if (lane.staticIdx == null) {
          ctx.fillText('combined', 8, top + 40)
        }
        ctx.fillText(`±${span} mg`, 8, top + LANE_H - 16)
        // trace
        if (vals.length > 1) {
          ctx.save()
          ctx.beginPath(); ctx.rect(x0, top, plotW, LANE_H); ctx.clip()
          ctx.strokeStyle = colors[lane.color.slice(2)] || colors.tx
          ctx.lineWidth = lane.key === 'c' ? 2 : 1.5
          ctx.beginPath()
          for (let i = 0; i < vals.length; i++) {
            const X = xOf(h.t[i]), Y = yOf(vals[i])
            if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y)
          }
          ctx.stroke()
          ctx.restore()
        }
      })

      // time axis
      const axTop = LANES.length * LANE_H
      const step = windowRef.current >= 60 ? 10 : 5
      ctx.fillStyle = colors.tx2; ctx.strokeStyle = colors.bd; ctx.textAlign = 'center'
      for (let s = 0; s <= windowRef.current; s += step) {
        const X = x0 + plotW * (1 - s / windowRef.current)
        ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, axTop + 4); ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1
        ctx.fillText(s === 0 ? '0' : `−${s}`, X, axTop + 16)
      }
      ctx.textAlign = 'left'
      ctx.fillText('seconds ago', 8, axTop + 16)

      // label markers, across all lanes
      // tags that would overlap drop to the next row (up to four rows)
      const labs = labelsRef.current
      const rowEnd = [-Infinity, -Infinity, -Infinity, -Infinity]
      for (const l of labs) {
        const age = tNow - l.t
        if (age < -2000 || age > winMs) continue
        const X = Math.min(x0 + plotW, xOf(l.t))
        ctx.strokeStyle = colors.pk; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, axTop); ctx.stroke()
        const tag = l.text.length > 16 ? `${l.text.slice(0, 15)}…` : l.text
        const tw = ctx.measureText(tag).width + 8
        const tx = Math.min(X + 2, x0 + plotW - tw)
        let row = rowEnd.findIndex(end => tx > end + 4)
        if (row < 0) row = rowEnd.length - 1
        rowEnd[row] = tx + tw
        const ty = 2 + row * 18
        ctx.fillStyle = colors.pkb; ctx.fillRect(tx, ty, tw, 16)
        ctx.fillStyle = colors.pkd; ctx.fillText(tag, tx + 4, ty + 8)
      }
      if (!h.t.length) {
        ctx.fillStyle = colors.tx2; ctx.textAlign = 'center'
        ctx.fillText('Waiting for the strap…', x0 + plotW / 2, (LANES.length * LANE_H) / 2)
        ctx.textAlign = 'left'
      }
    }
    draw()
    const id = setInterval(draw, DRAW_MS)
    return () => clearInterval(id)
  }, [procRef, labelsRef])

  return <canvas ref={canvasRef} style={S.canvas} aria-label="Live accelerometer traces" />
}

// ── Small parts ─────────────────────────────────────────────────────────────

const fmt = (v, d = 1, suffix = '') => (Number.isFinite(v) ? `${v.toFixed(d)}${suffix}` : '—')
const fmtClock = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60), r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

function Btn({ children, onClick, disabled, ghost, small, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...(ghost ? S.ghostBtn : S.btn), ...(small ? S.small : null), opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  )
}

function Chip({ label, value, sub, warn }) {
  return (
    <div style={{ ...S.chip, ...(warn ? S.chipWarn : null) }}>
      <span style={S.chipLabel}>{label}</span>
      <span style={S.chipValue}>{value}</span>
      {sub && <span style={S.chipSub}>{sub}</span>}
    </div>
  )
}

function StatusDot({ on, rec }) {
  return <span style={{ ...S.dot, background: rec ? 'var(--err-tx)' : on ? 'var(--pk)' : 'var(--gy)' }} aria-hidden="true" />
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px 64px', fontFamily: '"DM Sans", system-ui, sans-serif' },
  inner: { maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  kicker: { fontFamily: '"Space Mono", monospace', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pkd)' },
  h1: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, fontSize: 28, margin: '8px 0', color: 'var(--tx)' },
  h2: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400, fontSize: 20, margin: 0, color: 'var(--tx)' },
  lead: { fontSize: 16, lineHeight: 1.5, color: 'var(--tx2)', margin: 0, maxWidth: 640 },
  back: { fontSize: 14, color: 'var(--pkd)', textDecoration: 'none', whiteSpace: 'nowrap' },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wrap: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  spacer: { flex: '1 1 auto' },
  body: { fontSize: 16, lineHeight: 1.5, color: 'var(--tx)', margin: 0 },
  hint: { fontSize: 14, lineHeight: 1.5, color: 'var(--tx2)', margin: 0 },
  muted: { fontSize: 14, color: 'var(--tx2)', fontFamily: '"DM Sans", system-ui, sans-serif' },
  status: { fontSize: 14, color: 'var(--tx)', display: 'inline-flex', alignItems: 'center', gap: 8 },
  errText: { fontSize: 14, color: 'var(--err-tx)', margin: 0 },
  btn: { background: 'var(--pkd)', color: 'var(--bgc)', border: 'none', borderRadius: 24, padding: '8px 24px', fontSize: 16, fontWeight: 600, fontFamily: 'inherit' },
  ghostBtn: { background: 'var(--bgc)', color: 'var(--pkd)', border: '1px solid var(--bds)', borderRadius: 24, padding: '8px 24px', fontSize: 16, fontWeight: 600, fontFamily: 'inherit' },
  small: { padding: '4px 16px', fontSize: 14 },
  seg: { background: 'var(--bgc)', color: 'var(--tx2)', border: '1px solid var(--bds)', borderRadius: 24, padding: '4px 16px', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' },
  segOn: { background: 'var(--pkb)', color: 'var(--pkd)', border: '1px solid var(--pk)', fontWeight: 600 },
  canvas: { width: '100%', height: LANES.length * LANE_H + AXIS_H, display: 'block', borderRadius: 12, border: '1px solid var(--bd)' },
  chips: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(144px, 1fr))', gap: 8 },
  chip: { background: 'var(--bgp)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  chipWarn: { background: 'var(--err-bg)', border: '1px solid var(--err-bd)' },
  chipLabel: { fontFamily: '"Space Mono", monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx2)' },
  chipValue: { fontSize: 20, fontWeight: 600, color: 'var(--tx)' },
  chipSub: { fontSize: 12, color: 'var(--tx2)', lineHeight: 1.4 },
  notice: { background: 'var(--pkb)', border: '1px solid var(--pk)', borderRadius: 12, padding: 16, fontSize: 16, color: 'var(--tx)' },
  warn: { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 600, color: 'var(--err-tx)' },
  simRow: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--bd)', paddingTop: 16 },
  simLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--tx2)' },
  input: { flex: '1 1 240px', minWidth: 0, padding: '8px 16px', borderRadius: 12, border: '1px solid var(--bds)', fontSize: 16, fontFamily: 'inherit', background: 'var(--bgc)', color: 'var(--tx)' },
  field: { display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 420 },
  fieldLabel: { fontSize: 14, fontWeight: 600, color: 'var(--tx)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  listRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 12, background: 'var(--bgp)', flexWrap: 'wrap' },
  mono: { fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'var(--tx2)', minWidth: 40 },
  labelText: { fontSize: 14, color: 'var(--tx)' },
  tag: { fontFamily: '"Space Mono", monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--pkd)' },
  del: { background: 'none', border: '1px solid var(--bds)', borderRadius: 24, padding: '0 8px', fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', fontFamily: 'inherit' },
  dot: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%' },
}
