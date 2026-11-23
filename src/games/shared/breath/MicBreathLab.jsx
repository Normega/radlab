// ── MicBreathLab ────────────────────────────────────────────────────────────
// Dev instrumentation for microphone breath sensing (useMicBreath). The
// question it answers: can an ordinary webcam/laptop/phone mic pick up breathing
// rate well enough to drive a game like Kite?
//
// Shows the live acoustic "activity" trace (dB above the room's noise floor)
// with detected breath bursts, a spectrogram strip, and three rate readouts:
// the mic's burst-based rate, its autocorrelation rate, and a ground truth —
// either Space-bar taps at each in-breath or an on-screen pacer. Everything is
// local: nothing is saved or uploaded; CSV/audio download is for offline tuning.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useMicBreath } from './useMicBreath'
import { MIC_DEFAULTS } from './micBreath'

const WIN_MS = 30000
const COL = { breath: '#3498db', wind: '#16a085', act: '#2c3e50', inhale: '#BA7517', exhale: '#185FA5', single: '#8e44ad', tap: '#e74c3c', tonal: '#bdc3c7' }
const MONO = '"Space Mono", monospace'

const card = { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16 }
const btn = { padding: '8px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)', cursor: 'pointer', fontSize: 14 }
const btnPk = { ...btn, background: 'var(--pk)', color: '#fff', border: 'none' }

function fmt(v, d = 1) { return v == null || !Number.isFinite(v) ? '—' : v.toFixed(d) }
// Median rate over the last six tap-to-tap intervals.
function medianBpm(ts) {
  const last = ts.slice(-7)
  const g = last.slice(1).map((t, i) => t - last[i]).filter(x => x > 1500 && x < 20000).sort((a, b) => a - b)
  return g.length >= 2 ? 60000 / g[Math.floor(g.length / 2)] : null
}

function download(name, text, type = 'text/csv') {
  const blob = text instanceof Blob ? text : new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export default function MicBreathLab() {
  const mic = useMicBreath()
  const [deviceId, setDeviceId] = useState('')
  const [opts, setOpts] = useState(() => ({ ...MIC_DEFAULTS }))
  const [readout, setReadout] = useState(null)
  const [pacerBpm, setPacerBpm] = useState(0)
  const [taps, setTaps] = useState([])
  const pacerStartRef = useRef(null)
  const traceRef = useRef(null)
  const specRef = useRef(null)
  const pacerRef = useRef(null)

  const running = mic.status === 'running'
  const { getHistory, getBursts, getOptions, getLog, signalRef } = mic

  const updateOpt = (k, v) => {
    setOpts(o => ({ ...o, [k]: v }))
    mic.setOptions({ [k]: v })
  }

  const tap = useCallback(() => setTaps(ts => [...ts, performance.now()]), [])

  useEffect(() => {
    const onKey = e => {
      if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); tap() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tap])

  useEffect(() => { pacerStartRef.current = pacerBpm ? performance.now() : null }, [pacerBpm])

  // Readouts at 4 Hz (React state); drawing at rAF (refs only).
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setReadout(signalRef.current ? { ...signalRef.current } : null), 250)
    return () => clearInterval(id)
  }, [running, signalRef])

  useEffect(() => {
    if (!running) return
    let raf
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const now = performance.now()
      const hist = getHistory(WIN_MS)
      drawTrace(traceRef.current, hist, getBursts(), taps, getOptions(), now)
      drawSpec(specRef.current, hist, now)
      drawPacer(pacerRef.current, pacerBpm, pacerStartRef.current, now, signalRef.current)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [running, getHistory, getBursts, getOptions, signalRef, pacerBpm, taps])

  const tapBpm = medianBpm(taps)
  const truth = pacerBpm || tapBpm
  const r = readout
  const appliedWarn = mic.applied && (mic.applied.noiseSuppression || mic.applied.autoGainControl || mic.applied.echoCancellation)

  const exportCsv = () => {
    const head = 't_ms,breath_db,wind_db,flatness,centroid_hz,breath_act,wind_act,act,in_burst,tonal'
    const rows = getLog().map(r => r.map(v => (typeof v === 'number' ? +v.toFixed(3) : v)).join(','))
    download(`mic-breath-frames-${Date.now()}.csv`, [head, ...rows].join('\n'))
    const ev = ['type,t0_ms,t1_ms,peak_db,centroid_hz,label',
      ...mic.getBursts().map(b => `burst,${b.t0.toFixed(0)},${b.t1.toFixed(0)},${b.peakDb.toFixed(2)},${b.centroid.toFixed(0)},${b.label ?? ''}`),
      ...taps.map(t => `tap,${t.toFixed(0)},,,,`),
      `settings,,,,,"${JSON.stringify({ ...mic.getOptions(), pacerBpm, applied: mic.applied }).replace(/"/g, '""')}"`]
    download(`mic-breath-events-${Date.now()}.csv`, ev.join('\n'))
  }

  const toggleRec = async () => {
    if (mic.recording) {
      const blob = await mic.stopRecording()
      if (blob) download(`mic-breath-${Date.now()}.${blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm'}`, blob)
    } else mic.startRecording()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--tx)', padding: '24px 16px', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Mic breath lab</h1>
          <p style={{ color: 'var(--tx2)', fontSize: 14, margin: '8px 0 0' }}>
            Can an ordinary microphone hear breathing rate? Start the mic, breathe normally, and tap
            <b> Space</b> at the start of each in-breath (or turn on the pacer) to give it a ground truth.
            Nothing is saved or uploaded. Wear headphones if anything else is playing.
          </p>
        </div>

        <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={deviceId} onChange={e => setDeviceId(e.target.value)} style={{ ...btn, maxWidth: 320 }}>
            <option value="">Default microphone</option>
            {mic.devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>)}
          </select>
          {running
            ? <button style={btn} onClick={mic.stop}>Stop mic</button>
            : <button style={btnPk} onClick={() => mic.start(deviceId || undefined)}>{mic.status === 'starting' ? 'Starting…' : 'Start mic'}</button>}
          <button style={btn} onClick={tap}>Tap in-breath (Space)</button>
          <button style={btn} onClick={() => setTaps([])}>Clear taps</button>
          <label style={{ fontSize: 14 }}>Pacer{' '}
            <select value={pacerBpm} onChange={e => setPacerBpm(+e.target.value)} style={btn}>
              {[0, 6, 8, 10, 12, 15, 20].map(b => <option key={b} value={b}>{b ? `${b} bpm` : 'off'}</option>)}
            </select>
          </label>
          <button style={btn} disabled={!running} onClick={toggleRec}>{mic.recording ? 'Stop + save audio' : 'Record audio'}</button>
          <button style={btn} disabled={!readout} onClick={exportCsv}>Download CSV</button>
        </div>

        {mic.error && <div style={{ ...card, background: 'var(--err-bg)', color: 'var(--err-tx)', borderColor: 'var(--err-bd)' }}>{mic.error}</div>}
        {appliedWarn && (
          <div style={{ ...card, background: 'var(--err-bg)', color: 'var(--err-tx)', borderColor: 'var(--err-bd)', fontSize: 14 }}>
            This browser kept voice processing on (noise suppression {String(mic.applied.noiseSuppression)}, AGC {String(mic.applied.autoGainControl)},
            echo cancellation {String(mic.applied.echoCancellation)}). Noise suppression removes breath sounds — try Chrome or Firefox.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <Stat label="Mic rate (bursts)" value={fmt(r?.bpm)} unit="bpm" sub={r ? `${r.mode === 'pairs' ? 'in + out pairs' : 'one burst per breath'}` : ''} big />
          <Stat label="Mic rate (autocorr.)" value={fmt(r?.acfBpm)} unit="bpm" sub={r ? `strength ${fmt(r.acfStrength, 2)}` : ''} />
          <Stat label={pacerBpm ? 'Pacer' : 'Your taps'} value={fmt(truth)} unit="bpm" sub={pacerBpm ? 'follow the circle' : `${taps.length} taps`} />
          <Stat label="Error vs truth" value={r?.bpm && truth ? fmt(r.bpm - truth) : '—'} unit="bpm"
            sub={r?.bpm && truth ? `${fmt(100 * Math.abs(r.bpm - truth) / truth, 0)}%` : ''} />
          <Stat label="Now" value={r ? (r.tonal ? 'voice?' : r.inBurst ? 'airflow' : 'quiet') : '—'} unit=""
            sub={r ? `${fmt(r.act)} dB over floor` : ''} />
        </div>

        <div style={{ ...card, padding: 8 }}>
          <canvas ref={traceRef} width={940} height={220} style={{ width: '100%', height: 220, display: 'block' }} />
          <canvas ref={specRef} width={940} height={110} style={{ width: '100%', height: 110, display: 'block', marginTop: 4 }} />
          <div style={{ fontSize: 12, color: 'var(--tx3)', display: 'flex', gap: 16, flexWrap: 'wrap', padding: '4px 8px' }}>
            <Key c={COL.breath}>breath band</Key><Key c={COL.wind}>wind band</Key>
            <Key c={COL.inhale}>inhale burst</Key><Key c={COL.exhale}>exhale burst</Key><Key c={COL.single}>breath burst</Key>
            <Key c={COL.tap}>your tap</Key><span>spectrogram 0–4 kHz below · last 30 s</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ ...card, display: 'grid', gap: 8, fontSize: 14 }}>
            <b>Tuning</b>
            <Slider label="Burst opens at (dB over floor)" v={opts.onDb} min={1} max={20} step={0.5} on={v => updateOpt('onDb', v)} />
            <Slider label="Burst closes below" v={opts.offDb} min={0.5} max={15} step={0.5} on={v => updateOpt('offDb', v)} />
            <Slider label="Voice gate (flatness)" v={opts.flatnessMin} min={0} max={0.5} step={0.01} on={v => updateOpt('flatnessMin', v)} />
            <Slider label="Breath band low (Hz)" v={opts.breathBandHz[0]} min={50} max={1500} step={50} on={v => updateOpt('breathBandHz', [v, opts.breathBandHz[1]])} />
            <Slider label="Breath band high (Hz)" v={opts.breathBandHz[1]} min={1000} max={8000} step={250} on={v => updateOpt('breathBandHz', [opts.breathBandHz[0], v])} />
            <label>Signal{' '}
              <select value={opts.source} onChange={e => updateOpt('source', e.target.value)} style={btn}>
                <option value="both">both bands</option><option value="breath">breath band only</option><option value="wind">wind band only</option>
              </select>
            </label>
            <label>Bursts per breath{' '}
              <select value={opts.pairing} onChange={e => updateOpt('pairing', e.target.value)} style={btn}>
                <option value="auto">auto</option><option value="single">one (exhale only)</option><option value="pairs">two (in + out)</option>
              </select>
            </label>
          </div>
          <div style={{ ...card, display: 'grid', gap: 8, fontSize: 14, justifyItems: 'center' }}>
            <b style={{ justifySelf: 'start' }}>Pacer</b>
            <canvas ref={pacerRef} width={200} height={200} style={{ width: 160, height: 160 }} />
            <div style={{ color: 'var(--tx3)', fontSize: 12, fontFamily: MONO }}>
              {mic.applied ? `${mic.applied.label || 'mic'} · ${mic.applied.sampleRate ?? '?'} Hz` : 'mic not started'}
            </div>
            {r?.pairing && <div style={{ color: 'var(--tx3)', fontSize: 12, fontFamily: MONO }}>
              pair test: interval ratio {fmt(r.pairing.intervalRatio, 2)} · alternation {fmt(r.pairing.alternation, 2)}
            </div>}
          </div>
        </div>

        <div style={{ ...card, fontSize: 14, color: 'var(--tx2)' }}>
          <b style={{ color: 'var(--tx)' }}>Things to try:</b> webcam mic at normal sitting distance; laptop mic; phone held
          about 20 cm from your face; headset mic below the nose; nose vs mouth breathing; slow (6 bpm) vs normal pace; a quiet
          room vs a fan running. The error card is the number that matters.
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, unit, sub, big }) {
  return (
    <div style={{ ...card, padding: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{label}</div>
      <div style={{ fontSize: big ? 32 : 24, fontFamily: MONO }}>{value}<span style={{ fontSize: 12, color: 'var(--tx3)' }}> {unit}</span></div>
      <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{sub}</div>
    </div>
  )
}
function Key({ c, children }) {
  return <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: c, marginRight: 4 }} />{children}</span>
}
function Slider({ label, v, min, max, step, on }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '1fr 48px', gap: 8, alignItems: 'center' }}>
      <span>{label}<input type="range" min={min} max={max} step={step} value={v} onChange={e => on(+e.target.value)} style={{ width: '100%' }} /></span>
      <span style={{ fontFamily: MONO, fontSize: 12, textAlign: 'right' }}>{v}</span>
    </label>
  )
}

// ── Drawing ────────────────────────────────────────────────────────────────
function drawTrace(cv, hist, bursts, taps, o, now) {
  if (!cv) return
  const g = cv.getContext('2d'), W = cv.width, H = cv.height
  g.clearRect(0, 0, W, H)
  const t0 = now - WIN_MS
  const x = t => ((t - t0) / WIN_MS) * W
  const maxDb = Math.max(20, ...hist.map(h => h.act)) * 1.1
  const y = v => H - 8 - (Math.max(0, v) / maxDb) * (H - 16)

  for (const b of bursts) {
    if (b.t1 < t0) continue
    g.fillStyle = (b.label === 'inhale' ? COL.inhale : b.label === 'exhale' ? COL.exhale : COL.single) + '33'
    g.fillRect(x(b.t0), 0, Math.max(2, x(b.t1) - x(b.t0)), H)
  }
  for (const h of hist) if (h.tonal) { g.fillStyle = COL.tonal + '55'; g.fillRect(x(h.t), H - 6, 3, 6) }

  g.setLineDash([4, 4]); g.strokeStyle = '#999'; g.lineWidth = 1
  for (const v of [o.onDb, o.offDb]) { g.beginPath(); g.moveTo(0, y(v)); g.lineTo(W, y(v)); g.stroke() }
  g.setLineDash([])

  const line = (key, color, w) => {
    g.strokeStyle = color; g.lineWidth = w; g.beginPath()
    hist.forEach((h, i) => (i ? g.lineTo(x(h.t), y(h[key])) : g.moveTo(x(h.t), y(h[key]))))
    g.stroke()
  }
  line('breathAct', COL.breath, 1.5)
  line('windAct', COL.wind, 1.5)

  g.strokeStyle = COL.tap; g.lineWidth = 2
  for (const t of taps) if (t > t0) { g.beginPath(); g.moveTo(x(t), 0); g.lineTo(x(t), 16); g.stroke() }

  g.fillStyle = '#888'; g.font = '12px monospace'
  g.fillText(`${maxDb.toFixed(0)} dB over floor`, 4, 14)
}

function drawSpec(cv, hist, now) {
  if (!cv || !hist.length) return
  const g = cv.getContext('2d'), W = cv.width, H = cv.height
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H)
  const t0 = now - WIN_MS
  const colW = Math.max(1, Math.ceil(W * 50 / WIN_MS))
  const rows = hist[0].spec.length, rowH = H / rows
  for (const h of hist) {
    const xx = ((h.t - t0) / WIN_MS) * W
    for (let k = 0; k < rows; k++) {
      const v = Math.max(0, Math.min(1, (h.spec[k] + 110) / 70))   // -110..-40 dBFS
      g.fillStyle = `hsl(${240 - 240 * v}, 90%, ${8 + 55 * v}%)`
      g.fillRect(xx, H - (k + 1) * rowH, colW, rowH + 0.5)
    }
  }
}

function drawPacer(cv, bpm, startT, now, sig) {
  if (!cv) return
  const g = cv.getContext('2d'), W = cv.width, H = cv.height
  g.clearRect(0, 0, W, H)
  const cx = W / 2, cy = H / 2
  // Mic airflow ring (always, if running)
  const a = sig ? Math.min(1, sig.act / 20) : 0
  g.strokeStyle = COL.breath; g.lineWidth = 4
  g.beginPath(); g.arc(cx, cy, 30 + a * 60, 0, Math.PI * 2); g.stroke()
  if (!bpm || startT == null) return
  const period = 60000 / bpm, ph = ((now - startT) % period) / period
  const inFrac = 0.4
  const fill = ph < inFrac ? ph / inFrac : 1 - (ph - inFrac) / (1 - inFrac)
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * fill)
  g.fillStyle = (ph < inFrac ? COL.inhale : COL.exhale) + '88'
  g.beginPath(); g.arc(cx, cy, 20 + eased * 70, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.textAlign = 'center'
  g.fillText(ph < inFrac ? 'in' : 'out', cx, cy + 6)
}
