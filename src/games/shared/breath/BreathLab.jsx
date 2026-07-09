// ── BreathLab ───────────────────────────────────────────────────────────────
// Dev instrumentation page for the shared breath-signal layer (useBreathSignal).
// Pair a Polar H10 (or ?sim=1), calibrate, then watch every derived feature
// live: breath value colored by inhale/exhale phase, breath rate, regularity,
// HR, RR tachogram, RSA amplitude, and belt lag. This page is the ground truth
// for speccing biofeedback games — if a mapping looks good here, it will feel
// good in a game. Writes nothing; no auth.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useBreathSignal } from './useBreathSignal'
import CalibrationScreen from '../../BreathBelt/components/CalibrationScreen'
import BrowserWarning from '../../BreathBelt/components/BrowserWarning'

const AVATAR_PROPS = { skinColor: '#FDBCB4', eyeColor: '#4A90D9', species: 'human' }

const PHASE_COLORS = { inhale: '#3498db', exhale: '#e67e22', pause: '#95a5a6' }
const SCOPE_MS = 15000   // breath scope window
const TACHO_MS = 45000   // RR tachogram window

export default function BreathLab() {
  const location = useLocation()
  const isSimMode = new URLSearchParams(location.search).get('sim') === '1'

  const [autoRecalOn, setAutoRecalOn] = useState(true)
  const breath = useBreathSignal({ isSimMode, autoRecal: autoRecalOn })
  const [act, setAct] = useState('WELCOME') // WELCOME → CONNECT → CALIBRATE → LAB

  useEffect(() => {
    if (act === 'CONNECT' && breath.btState === 'CONNECTED') setAct('CALIBRATE')
  }, [act, breath.btState])

  useEffect(() => {
    if (act === 'CALIBRATE' && breath.calibPhase === 'COMPLETE') setAct('LAB')
  }, [act, breath.calibPhase])

  // Re-run calibration from the lab (e.g. after posture/fit change). Returns to
  // the calibration screen; on completion the COMPLETE→LAB effect brings us back.
  // Real belt: reset to the NONE "ready" screen (clears the old fit) and let the
  // user press Begin — this mirrors the initial flow. We must NOT jump straight
  // to FIXATION: CalibrationScreen's fixation timer isn't safe against React
  // StrictMode's mount-time double-invoke, so mounting directly into FIXATION
  // hangs on the instruction screen. Sim has no real calibration, so it goes
  // straight to the REVIEW panel (which has no such timer).
  const recalibrate = useCallback(() => {
    setAct('CALIBRATE')
    if (isSimMode) breath.acceptSimCalib()
    else breath.resetCalibration()
  }, [isSimMode, breath])

  if (!navigator.bluetooth && !isSimMode) return <BrowserWarning />

  return (
    <div style={S.page}>
      <div style={S.header}>
        <span style={S.brand}>RADlab · Breath Signal Lab</span>
        <span style={S.badge}>DEV{isSimMode ? ' · SIM' : ''}</span>
      </div>

      {act === 'WELCOME' && (
        <Panel>
          <h1 style={S.h1}>Breath Signal Lab</h1>
          <p style={S.body}>
            Live view of everything the shared <code>useBreathSignal</code> hook derives from
            the Polar H10: breath amplitude, inhale/exhale phase, rate, regularity,
            heart rate, RR intervals, and RSA. Use it to prototype biofeedback mappings.
          </p>
          <Btn onClick={() => {
            if (isSimMode) { breath.startSimulation(); breath.acceptSimCalib(); setAct('CALIBRATE') }
            else setAct('CONNECT')
          }}>
            {isSimMode ? 'Start simulation' : 'Start'}
          </Btn>
        </Panel>
      )}

      {act === 'CONNECT' && (
        <Panel>
          <h2 style={S.h2}>Pair the belt</h2>
          <p style={S.body}>
            Put on the Polar H10 — connector centred, electrodes moistened.
            Chrome will ask which device to connect.
          </p>
          {breath.btState === 'ERROR' && <p style={S.err}>Connection failed. Check the belt and try again.</p>}
          <Btn onClick={breath.connect} disabled={breath.btState === 'CONNECTING'}>
            {breath.btState === 'CONNECTING' ? 'Connecting…' : 'Connect to Polar H10'}
          </Btn>
        </Panel>
      )}

      {act === 'CALIBRATE' && (
        <Panel wide>
          <h2 style={S.h2}>Calibration</h2>
          <CalibrationScreen
            calibPhase={breath.calibPhase}
            calibReviewData={breath.calibReviewData}
            avatarProps={AVATAR_PROPS}
            startCalibration={breath.startCalibration}
            beginCalibCollection={breath.beginCalibCollection}
            acceptCalibration={breath.acceptCalibration}
            redoCalibration={breath.redoCalibration}
          />
        </Panel>
      )}

      {act === 'LAB' && (
        <LabView
          breath={breath} isSimMode={isSimMode} onRecalibrate={recalibrate}
          autoRecalOn={autoRecalOn} setAutoRecalOn={setAutoRecalOn}
        />
      )}
    </div>
  )
}

// ── The lab itself ──────────────────────────────────────────────────────────

function LabView({ breath, isSimMode, onRecalibrate, autoRecalOn, setAutoRecalOn }) {
  const [stats, setStats] = useState({})
  const [events, setEvents] = useState([])
  const [simPeriodS, setSimPeriodS] = useState(4)
  const [recalToast, setRecalToast] = useState(null)
  const lastRecalCountRef = useRef(0)

  // Chip values at 4 Hz — cheap enough for React state
  useEffect(() => {
    const id = setInterval(() => setStats({ ...breath.signalRef.current }), 250)
    return () => clearInterval(id)
  }, [breath])

  // Transient toast when a background auto-recalibration fires
  useEffect(() => {
    const n = stats.autoRecalCount || 0
    if (n > lastRecalCountRef.current) {
      lastRecalCountRef.current = n
      setRecalToast(`Signal re-anchored to your current posture (fit ${Math.round((stats.qualityEvr || 0) * 100)}%)`)
      const t = setTimeout(() => setRecalToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [stats.autoRecalCount, stats.qualityEvr])

  // Breath-event ticker (last 6 inhale/exhale transitions; ignore recal events)
  useEffect(() => {
    return breath.onBreathEvent(ev => {
      if (ev.type !== 'inhale_start' && ev.type !== 'exhale_start') return
      setEvents(prev => [...prev.slice(-5), ev])
    })
  }, [breath])

  const fmt = (v, digits = 1, suffix = '') =>
    v == null || !isFinite(v) ? '—' : `${v.toFixed(digits)}${suffix}`

  return (
    <>
      {recalToast && <div style={S.recalToast}>↻ {recalToast}</div>}
      {stats.signalDegraded && (
        <div style={S.degradedBanner}>
          ⚠ Signal quality dropped — your posture or the belt fit may have changed, so the
          breath signal no longer lines up with the calibrated axis.
          {autoRecalOn
            ? ' Auto-recalibration is on but couldn’t find a clean axis (often a motion artifact) — re-calibrate if it persists.'
            : ' Re-calibrate to recapture it.'}
          <button onClick={onRecalibrate} style={S.bannerBtn}>Re-calibrate</button>
        </div>
      )}
      <Recorder breath={breath} isSimMode={isSimMode} onRecalibrate={onRecalibrate} />
      <Panel wide>
        <h2 style={S.h2}>Breath signal <span style={{ fontSize: 13, color: 'var(--tx3)' }}>(last {SCOPE_MS / 1000} s, colored by phase)</span></h2>
        <BreathScope breath={breath} />
        <div style={S.chipRow}>
          <Chip label="Phase" value={stats.phase ?? '—'} tone={PHASE_COLORS[stats.phase]} />
          <Chip label="Rate" value={fmt(stats.bpm, 1, ' bpm')} />
          <Chip label="Period" value={fmt(stats.lastPeriodMs != null ? stats.lastPeriodMs / 1000 : null, 2, ' s')} />
          <Chip label="Regularity ±SD" value={fmt(stats.regularitySdMs != null ? stats.regularitySdMs / 1000 : null, 2, ' s')} />
          <Chip label="Belt lag" value={fmt(stats.lagMs, 0, ' ms')} />
          <Chip
            label="Signal fit (EVR)"
            value={stats.qualityEvr == null ? '—' : `${Math.round(stats.qualityEvr * 100)}%`}
            tone={stats.qualityEvr != null && stats.qualityEvr < 0.4 ? '#e74c3c' : undefined}
          />
          <Chip label="Auto-recals" value={String(stats.autoRecalCount ?? 0)} />
        </div>
        <label style={S.toggleRow}>
          <input type="checkbox" checked={autoRecalOn} onChange={e => setAutoRecalOn(e.target.checked)} />
          <span>Background auto-recalibration — re-project onto the current breath axis when posture drifts (no re-breathing needed)</span>
        </label>
        <p style={S.eventLine}>
          {events.map((e, i) => (
            <span key={i} style={{ color: e.type === 'inhale_start' ? PHASE_COLORS.inhale : PHASE_COLORS.exhale }}>
              {e.type === 'inhale_start' ? '▲ in' : '▼ out'}{'  '}
            </span>
          ))}
        </p>
      </Panel>

      <Panel wide>
        <h2 style={S.h2}>Heart <span style={{ fontSize: 13, color: 'var(--tx3)' }}>(RR tachogram, last {TACHO_MS / 1000} s)</span></h2>
        <RRScope breath={breath} />
        <div style={S.chipRow}>
          <Chip label="Heart rate" value={fmt(stats.hr, 0, ' bpm')} />
          <Chip label="RSA (max−min RR)" value={fmt(stats.rsaMs, 0, ' ms')} />
        </div>
        <p style={{ ...S.body, fontSize: 13, color: 'var(--tx3)' }}>
          RSA grows as breathing slows toward ~6 breaths/min — the heart-breath coupling
          signal for coherence-style feedback.
        </p>
      </Panel>

      {isSimMode && (
        <Panel wide>
          <h2 style={S.h2}>Sim controls</h2>
          <label style={{ ...S.body, display: 'flex', alignItems: 'center', gap: 12 }}>
            Breath period: {simPeriodS.toFixed(1)} s ({(60 / simPeriodS).toFixed(1)} bpm)
            <input
              type="range" min="2" max="12" step="0.5" value={simPeriodS}
              onChange={e => {
                const s = Number(e.target.value)
                setSimPeriodS(s)
                breath.setSimPeriodMs(s * 1000)
              }}
              style={{ flex: 1 }}
            />
          </label>
        </Panel>
      )}
    </>
  )
}

// ── Canvas scopes (rAF, read refs directly) ─────────────────────────────────

// Scopes draw on setInterval, not rAF: rAF stops entirely in hidden tabs,
// while an interval keeps ticking (throttled) so the trace survives tab switches.
const DRAW_INTERVAL_MS = 33

function BreathScope({ breath }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)

      const now = Date.now()
      const pts = breath.getRecentBreath(SCOPE_MS)

      // midline
      ctx.strokeStyle = 'rgba(0,0,0,0.07)'
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke()

      if (pts.length > 1) {
        ctx.lineWidth = 2.5
        ctx.lineJoin = 'round'
        let prev = null
        for (const p of pts) {
          const x = w - ((now - p.t) / SCOPE_MS) * w
          const y = h - 8 - p.value * (h - 16)
          if (prev) {
            ctx.strokeStyle = PHASE_COLORS[p.phase] ?? PHASE_COLORS.pause
            ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, y); ctx.stroke()
          }
          prev = { x, y }
        }
        // live dot
        if (prev) {
          ctx.fillStyle = PHASE_COLORS[pts[pts.length - 1].phase] ?? PHASE_COLORS.pause
          ctx.beginPath(); ctx.arc(prev.x, prev.y, 5, 0, Math.PI * 2); ctx.fill()
        }
      }
    }
    const id = setInterval(draw, DRAW_INTERVAL_MS)
    return () => clearInterval(id)
  }, [breath])
  return <canvas ref={canvasRef} width={640} height={180} style={S.scope} />
}

function RRScope({ breath }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)

      const now = Date.now()
      const pts = breath.getRecentRR(TACHO_MS)
      if (pts.length > 1) {
        let min = Infinity, max = -Infinity
        for (const p of pts) { if (p.rr < min) min = p.rr; if (p.rr > max) max = p.rr }
        const pad = Math.max((max - min) * 0.15, 10)
        min -= pad; max += pad

        ctx.strokeStyle = '#c0577f'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.beginPath()
        pts.forEach((p, i) => {
          const x = w - ((now - p.t) / TACHO_MS) * w
          const y = h - 8 - ((p.rr - min) / (max - min)) * (h - 16)
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        })
        ctx.stroke()

        // axis labels
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.font = '10px "Space Mono", monospace'
        ctx.fillText(`${Math.round(max)} ms`, 6, 14)
        ctx.fillText(`${Math.round(min)} ms`, 6, h - 6)
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.font = '12px "DM Sans", sans-serif'
        ctx.fillText('Waiting for RR intervals…', 12, h / 2)
      }
    }
    const id = setInterval(draw, DRAW_INTERVAL_MS)
    return () => clearInterval(id)
  }, [breath])
  return <canvas ref={canvasRef} width={640} height={120} style={S.scope} />
}

// ── Recorder ──────────────────────────────────────────────────────────────
// Captures a real session to a JSON file for offline analysis / tuning. Polls
// signalRef at 50 Hz (faithful enough to replay the whole feature + game stack
// deterministically) and logs breath-onset events. The downloaded file is the
// hand-off artifact: a replay harness feeds `samples` straight into the game
// mechanics with no belt and no tab-throttling.
const REC_HZ = 50
const REC_SCHEMA = 2   // v2 adds filtered axes (fx/fy/fz) + live quality (evr/totalVar/degraded)

function Recorder({ breath, isSimMode, onRecalibrate }) {
  const [recording, setRecording] = useState(false)
  const [count, setCount] = useState(0)
  const [note, setNote] = useState('')          // what the wearer was doing, free text
  const [savedName, setSavedName] = useState(null)
  const recRef = useRef({ samples: [], events: [], startMs: 0 })
  const timerRef = useRef(null)
  const unsubRef = useRef(null)

  const start = () => {
    recRef.current = { samples: [], events: [], startMs: Date.now() }
    setCount(0); setSavedName(null)
    unsubRef.current = breath.onBreathEvent(ev => recRef.current.events.push(ev))
    timerRef.current = setInterval(() => {
      const s = breath.signalRef.current
      const r4 = (v) => v == null ? null : Math.round(v * 1e4) / 1e4
      recRef.current.samples.push({
        t: s.t,
        value: r4(s.value),
        phase: s.phase,
        bpm: s.bpm == null ? null : Math.round(s.bpm * 100) / 100,
        lastPeriodMs: s.lastPeriodMs ?? null,
        regularitySdMs: s.regularitySdMs == null ? null : Math.round(s.regularitySdMs),
        regularityCv: s.regularityCv == null ? null : Math.round(s.regularityCv * 1e3) / 1e3,
        hr: s.hr ?? null,
        rsaMs: s.rsaMs == null ? null : Math.round(s.rsaMs),
        // filtered axes + live signal-quality — for offline EVR analysis / detector tuning
        fx: s.filtered ? r4(s.filtered[0]) : null,
        fy: s.filtered ? r4(s.filtered[1]) : null,
        fz: s.filtered ? r4(s.filtered[2]) : null,
        evr: s.qualityEvr == null ? null : Math.round(s.qualityEvr * 1e3) / 1e3,
        totalVar: s.qualityTotalVar == null ? null : Math.round(s.qualityTotalVar * 1e4) / 1e4,
        degraded: s.signalDegraded,
      })
      setCount(recRef.current.samples.length)
    }, 1000 / REC_HZ)
    setRecording(true)
  }

  const stop = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    setRecording(false)
  }

  const download = () => {
    const rec = recRef.current
    const c = breath.calibReviewData
    const payload = {
      meta: {
        schema: REC_SCHEMA,
        recordedAt: new Date().toISOString(),
        isSimMode,
        note,
        sampleRateHz: REC_HZ,
        durationS: rec.samples.length ? (rec.samples[rec.samples.length - 1].t - rec.samples[0].t) / 1000 : 0,
        calib: c ? { fitR: c.fitR, lagMs: c.lagMs, modelLabel: c.modelLabel, peakErrorMs: c.peakErrorMs } : null,
        // projection weights (direction) so EVR can be recomputed/re-tuned offline
        weights: breath.mlrWeightsRef?.current?.weights ?? null,
        userAgent: navigator.userAgent,
      },
      samples: rec.samples,
      events: rec.events,
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const name = `belt-recording-${stamp}.json`
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
    setSavedName(name)
  }

  const durS = count / REC_HZ
  const hasData = count > 0 && !recording

  return (
    <Panel wide>
      <h2 style={S.h2}>Record a session <span style={{ fontSize: 13, color: 'var(--tx3)' }}>(for offline tuning)</span></h2>
      <input
        type="text" value={note} onChange={e => setNote(e.target.value)}
        placeholder="note — e.g. '1 min natural, then 2 min slow'"
        disabled={recording}
        style={S.noteInput}
      />
      <div style={S.chipRow}>
        <Chip label="State" value={recording ? '● REC' : hasData ? 'stopped' : 'idle'} tone={recording ? '#e74c3c' : undefined} />
        <Chip label="Samples" value={String(count)} />
        <Chip label="Duration" value={`${durS.toFixed(0)} s`} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!recording && <Btn onClick={start}>{hasData ? 'Record again' : 'Start recording'}</Btn>}
        {recording && <Btn onClick={stop}>Stop</Btn>}
        {hasData && <Btn onClick={download}>Download JSON</Btn>}
        {!recording && onRecalibrate && (
          <button onClick={onRecalibrate} style={S.secondaryBtn}>Re-calibrate</button>
        )}
      </div>
      {savedName && (
        <p style={{ ...S.body, fontSize: 13, color: 'var(--tx3)' }}>
          Saved <strong>{savedName}</strong> to your Downloads folder. Hand the file to Claude
          (it can read <code>C:\Users\norma\Downloads\{savedName}</code> directly).
        </p>
      )}
    </Panel>
  )
}

// ── UI bits ─────────────────────────────────────────────────────────────────

function Panel({ children, wide = false }) {
  return <div style={{ ...S.panel, maxWidth: wide ? 700 : 460 }}>{children}</div>
}

function Btn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...S.btn, opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}>
      {children}
    </button>
  )
}

function Chip({ label, value, tone }) {
  return (
    <div style={S.chip}>
      <span style={S.chipLabel}>{label}</span>
      <span style={{ ...S.chipValue, ...(tone ? { color: tone } : {}) }}>{value}</span>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', background: 'var(--bg, #FCF0F5)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '0 16px 48px', fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  header: {
    width: '100%', maxWidth: 700, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '18px 4px',
  },
  brand: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 18, color: 'var(--tx)' },
  badge: {
    fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em',
    color: 'var(--pkd)', background: 'var(--pkb)', borderRadius: 6, padding: '4px 10px',
  },
  panel: {
    width: '100%', background: '#fff', border: '1px solid var(--bd)',
    borderRadius: 14, padding: '28px 24px', marginTop: 12,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 28, fontWeight: 400, color: 'var(--tx)', margin: 0, textAlign: 'center' },
  h2: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: 0, textAlign: 'center' },
  body: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, textAlign: 'center', margin: 0, maxWidth: 560 },
  err: { fontSize: 13, color: '#e04', margin: 0 },
  btn: {
    background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 12,
    padding: '13px 32px', fontSize: 15, fontWeight: 500,
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  secondaryBtn: {
    background: 'transparent', color: 'var(--tx)', border: '1px solid var(--bd)',
    borderRadius: 12, padding: '13px 24px', fontSize: 15, fontWeight: 500,
    fontFamily: '"DM Sans",system-ui,sans-serif', cursor: 'pointer',
  },
  degradedBanner: {
    width: '100%', maxWidth: 700, marginTop: 12, padding: '14px 18px',
    background: '#fff3e0', border: '1px solid #e67e22', borderRadius: 12,
    color: '#a04a00', fontSize: 14, lineHeight: 1.5,
    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
  },
  recalToast: {
    width: '100%', maxWidth: 700, marginTop: 12, padding: '12px 18px',
    background: '#e6f4ea', border: '1px solid #3aa76d', borderRadius: 12,
    color: '#1c7a4a', fontSize: 14, fontWeight: 500,
  },
  toggleRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: 640,
    fontSize: 13, color: 'var(--tx3)', lineHeight: 1.4, cursor: 'pointer', textAlign: 'left',
  },
  bannerBtn: {
    background: '#e67e22', color: '#fff', border: 'none', borderRadius: 10,
    padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: '"DM Sans",system-ui,sans-serif', whiteSpace: 'nowrap',
  },
  scope: {
    width: '100%', maxWidth: 640, background: 'var(--bgp, #faf5f8)',
    border: '1px solid var(--bd)', borderRadius: 10,
  },
  noteInput: {
    width: '100%', maxWidth: 420, padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--bd)', fontSize: 14, fontFamily: '"DM Sans",system-ui,sans-serif',
    background: 'var(--bgp, #faf5f8)', color: 'var(--tx)',
  },
  chipRow: { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'var(--bgp, #faf5f8)', border: '1px solid var(--bd)', borderRadius: 10,
    padding: '8px 16px', minWidth: 90,
  },
  chipLabel: { fontFamily: '"Space Mono",monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)' },
  chipValue: { fontSize: 17, fontWeight: 600, color: 'var(--tx)', textTransform: 'capitalize' },
  eventLine: { fontFamily: '"Space Mono",monospace', fontSize: 12, margin: 0, minHeight: 16 },
}
