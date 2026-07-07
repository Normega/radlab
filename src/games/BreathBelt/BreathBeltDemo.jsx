// v2 — conference demo: Polar H10 pairing → MLR calibration → 3 paced trials
// with post-trial graphs → 2 hardcoded "staircase" trials (speed up, slow down)
// with speed-change/confidence/arousal ratings and a reveal graph.
// Writes NOTHING: no Supabase, no CSV backup, no triggers (no-op sendTrigger).
// Trial graphs are built from the live breathValue signal sampled against the
// pacer (same SignalGraph as calibration) — so they render with a real belt AND
// in ?sim=1 rehearsal, no dependency on raw-accel collection.
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useBeltConnection } from './hooks/useBeltConnection'
import { useTrialRunner } from './hooks/useTrialRunner'
import CalibrationScreen from './components/CalibrationScreen'
import SignalGraph from './components/SignalGraph'
import BrowserWarning from './components/BrowserWarning'
import AvatarBreathPacer from '../EbbAndFlow/components/AvatarBreathPacer'
import ConfidenceRating from '../shared/ConfidenceRating'
import ArousalRating from '../shared/ArousalRating'
import { pearsonRArrays, computeMLRPredictions, getPacerRadiusForTrial } from './breathUtils'
import { BASE_BREATH_SPEED_S, FASTER_BREATH_SPEED_S, SLOWER_BREATH_SPEED_S } from './constants'

// Directional adherence — the metric behind the study's 88.9% / 91% figures:
// did the belt-measured breath rate move in the cued direction (faster => higher
// rate, slower => lower rate)? Binary per trial, independent of the sync score.
function directionalAdherence(res, dir) {
  const b = res?.btBaselinePeriodMs, c = res?.btConditionPeriodMs
  if (b == null || c == null || b <= 0 || c <= 0) return null
  const baseRate = 60000 / b, condRate = 60000 / c
  const correct = dir === 'faster' ? condRate > baseRate : condRate < baseRate
  return { baseRate, condRate, correct }
}

// Build the trial graph with the EXACT procedure the calibration review uses
// (useBeltConnection: computeMLRPredictions → getPacerRadius → downsample by 5).
// Samples come from rawAccelRowsRef (always populated, never cleared), filtered
// to the breathing window [trialStart, trialEnd] — so filtfilt sees a
// breathing-only window like calibration, not the static fixation lead-in.
// Falls back to the live sample only when there is no belt data (sim rehearsal).
function buildCleanGraph(belt, res, basePeriodMs, changedPeriodMs, liveGraph) {
  const mlr = belt.mlrWeightsRef.current
  if (mlr && res?.trialStartMs != null && res?.trialEndMs != null) {
    const t0 = res.trialStartMs, t1 = res.trialEndMs
    const samples = (belt.rawAccelRowsRef.current || [])
      .map(r => ({ t: r.packetTimestamp + r.sampleIndex * 5, x: r.x, y: r.y, z: r.z }))
      .filter(s => s.t >= t0 && s.t <= t1)
      .sort((a, b) => a.t - b.t)
    if (samples.length > 80) {
      const beltRaw  = computeMLRPredictions(samples, mlr)
      const pacerPts = samples.filter((_, i) => i % 5 === 0)
        .map(s => ({ t: s.t, value: getPacerRadiusForTrial(s.t, t0, basePeriodMs, changedPeriodMs) }))
      const beltAll  = samples.map((s, i) => ({ t: s.t, value: beltRaw[i] }))
      const beltPts  = beltAll.filter((_, i) => i % 5 === 0)
      const r = pearsonRArrays(beltPts.map(p => p.value), pacerPts.map(p => p.value))
      return { pacerPts, beltPts, r }
    }
  }
  return liveGraph
}

// Samples the live belt signal vs the pacer during a trial, then builds the
// pacer/belt point arrays SignalGraph expects. Fallback for sim (no belt).
function useGraphSampler(breathValueRef, getPhase) {
  const samplesRef = useRef([])
  const timerRef   = useRef(null)
  const t0Ref      = useRef(0)
  function begin() {
    samplesRef.current = []
    t0Ref.current = performance.now()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const t     = performance.now() - t0Ref.current
      const phase = getPhase()
      const pacer = (Math.sin(phase * 2 * Math.PI - Math.PI / 2) + 1) / 2  // pacer breath value 0–1
      const belt  = breathValueRef.current ?? 0
      samplesRef.current.push({ t, pacer, belt })
    }, 40)
  }
  function end() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    const s = samplesRef.current
    const pacerPts = s.map(p => ({ t: p.t, value: p.pacer }))
    const beltPts  = s.map(p => ({ t: p.t, value: p.belt }))
    const r = s.length > 5 ? pearsonRArrays(s.map(p => p.belt), s.map(p => p.pacer)) : null
    return { pacerPts, beltPts, r }
  }
  return { begin, end }
}

const BASE_MS   = BASE_BREATH_SPEED_S   * 1000  // 4000
const FASTER_MS = FASTER_BREATH_SPEED_S * 1000  // 3000
const SLOWER_MS = SLOWER_BREATH_SPEED_S * 1000  // 5000

const PACED_TRIALS = 3
// Hardcoded staircase demo trials: one speed up, then one slow down.
const STAIRCASE_TRIALS = [
  { dir: 'faster', conditionMs: FASTER_MS, label: 'sped up',    detail: '4s → 3s breaths' },
  { dir: 'slower', conditionMs: SLOWER_MS, label: 'slowed down', detail: '4s → 5s breaths' },
]

const AVATAR_PROPS = { skinColor: '#FDBCB4', eyeColor: '#4A90D9', species: 'human' }
const noopTrigger = async () => {}

export default function BreathBeltDemo() {
  const location = useLocation()
  const isSimMode = new URLSearchParams(location.search).get('sim') === '1'

  const belt = useBeltConnection({ isSimMode })
  const [act, setAct] = useState('WELCOME') // WELCOME → CONNECT → CALIBRATE → PACED → STAIRCASE → SUMMARY

  const pacedResultsRef     = useRef([])
  const staircaseResultsRef = useRef([])

  // Belt connected → calibrate
  useEffect(() => {
    if (act === 'CONNECT' && belt.btState === 'CONNECTED') setAct('CALIBRATE')
  }, [act, belt.btState])

  // Calibration accepted → paced trials
  useEffect(() => {
    if (act === 'CALIBRATE' && belt.calibPhase === 'COMPLETE') setAct('PACED')
  }, [act, belt.calibPhase])

  if (!navigator.bluetooth && !isSimMode) return <BrowserWarning />

  return (
    <div style={D.page}>
      <div style={D.header}>
        <span style={D.brand}>RADlab · BreathBelt</span>
        <span style={D.badge}>LIVE DEMO{isSimMode ? ' · SIM' : ''}</span>
      </div>

      {act === 'WELCOME' && (
        <Panel>
          <h1 style={D.h1}>Breath Perception, Live</h1>
          <p style={D.body}>
            A Polar H10 chest strap streams accelerometer data to this browser over
            Bluetooth. We fit a per-person breathing model in ~20 seconds, then measure
            how precisely you can synchronize with — and detect changes in — a breathing pacer.
          </p>
          <ol style={D.steps}>
            <li>Pair the belt (Web Bluetooth, no install)</li>
            <li>Calibrate: 4 breaths → fitted signal model</li>
            <li>3 paced breathing trials, with your sync graph after each</li>
            <li>2 detection trials: does the pace change? Rate what you felt</li>
          </ol>
          <Btn onClick={() => {
            if (isSimMode) { belt.startSimulation(); setAct('CALIBRATE'); belt.acceptSimCalib() }
            else setAct('CONNECT')
          }}>
            Start demo
          </Btn>
        </Panel>
      )}

      {act === 'CONNECT' && (
        <Panel>
          <h2 style={D.h2}>Pair the belt</h2>
          <p style={D.body}>
            Put on the Polar H10 — connector centred on the chest, electrodes moistened.
            Chrome will ask which device to connect.
          </p>
          {belt.btState === 'ERROR' && (
            <p style={D.err}>Connection failed. Check the belt and try again.</p>
          )}
          <Btn onClick={belt.connect} disabled={belt.btState === 'CONNECTING'}>
            {belt.btState === 'CONNECTING' ? 'Connecting…' : 'Connect to Polar H10'}
          </Btn>
        </Panel>
      )}

      {act === 'CALIBRATE' && (
        <Panel wide>
          <h2 style={D.h2}>Calibration</h2>
          <CalibrationScreen
            calibPhase={belt.calibPhase}
            calibReviewData={belt.calibReviewData}
            avatarProps={AVATAR_PROPS}
            startCalibration={belt.startCalibration}
            beginCalibCollection={belt.beginCalibCollection}
            acceptCalibration={belt.acceptCalibration}
            redoCalibration={belt.redoCalibration}
          />
        </Panel>
      )}

      {act === 'PACED' && (
        <PacedTrialsAct
          belt={belt}
          onDone={(results) => { pacedResultsRef.current = results; setAct('STAIRCASE') }}
        />
      )}

      {act === 'STAIRCASE' && (
        <StaircaseAct
          belt={belt}
          onDone={(results) => { staircaseResultsRef.current = results; setAct('SUMMARY') }}
        />
      )}

      {act === 'SUMMARY' && (
        <SummaryAct paced={pacedResultsRef.current} staircase={staircaseResultsRef.current} />
      )}
    </div>
  )
}

// ── Act 3: three paced trials, graph after each ────────────────────────────

function PacedTrialsAct({ belt, onDone }) {
  const [trialIdx, setTrialIdx] = useState(0)
  const [state,    setState]    = useState('READY')   // READY | RUNNING | GRAPH
  const [lastGraph, setLastGraph] = useState(null)
  const resultsRef = useRef([])

  const { getPhase, runTrial, controlRef } = useTrialRunner({
    breathValueRef:          belt.breathValueRef,
    sendTrigger:             noopTrigger,
    currentPhaseRef:         belt.currentPhaseRef,
    currentTrialRef:         belt.currentTrialRef,
    getAndClearTrialSamples: belt.getAndClearTrialSamples,
    mlrWeightsRef:           belt.mlrWeightsRef,
  })
  const sampler = useGraphSampler(belt.breathValueRef, getPhase)

  const start = useCallback(async () => {
    setState('RUNNING')
    sampler.begin()
    // 'phase2' label makes useBeltConnection collect raw accel samples, so
    // useTrialRunner returns syncMetrics processed the same (de-trended) way as
    // the calibration graph. Fall back to the live sample only when there's no
    // belt (sim rehearsal).
    const res = await runTrial('phase2', trialIdx + 1, BASE_MS)
    const graph = buildCleanGraph(belt, res, BASE_MS, BASE_MS, sampler.end())
    resultsRef.current.push(graph)
    setLastGraph(graph)
    setState('GRAPH')
  }, [runTrial, trialIdx, sampler])

  function next() {
    if (trialIdx + 1 >= PACED_TRIALS) onDone(resultsRef.current)
    else { setTrialIdx(i => i + 1); setState('READY') }
  }

  return (
    <Panel wide>
      <h2 style={D.h2}>Paced breathing — trial {trialIdx + 1} of {PACED_TRIALS}</h2>

      {state !== 'GRAPH' && (
        <div style={{ width: 240, height: 240, margin: '0 auto' }}>
          <AvatarBreathPacer
            {...AVATAR_PROPS}
            scaleAmplitude={0.25}
            getPhase={getPhase}
            controlRef={controlRef}
            paused={state === 'READY'}
            size={240}
          />
        </div>
      )}

      {state === 'READY' && (
        <>
          <p style={D.body}>Breathe in as the avatar expands, out as it contracts. Four breaths.</p>
          <Btn onClick={start}>Start trial {trialIdx + 1}</Btn>
        </>
      )}

      {state === 'RUNNING' && <p style={D.body}>Follow the avatar's breathing…</p>}

      {state === 'GRAPH' && (
        <>
          <TrialGraphCard
            title={`Trial ${trialIdx + 1} — your breath vs. the pacer`}
            graph={lastGraph}
          />
          <Btn onClick={next}>
            {trialIdx + 1 >= PACED_TRIALS ? 'On to detection trials →' : 'Next trial →'}
          </Btn>
        </>
      )}
    </Panel>
  )
}

// ── Act 4: two hardcoded staircase trials with ratings + reveal ────────────

function StaircaseAct({ belt, onDone }) {
  const [trialIdx, setTrialIdx] = useState(0)
  const [state,    setState]    = useState('READY')   // READY | RUNNING | RATE | REVEAL
  const [response,   setResponse]   = useState(null)
  const [confidence, setConfidence] = useState(null)
  const [arousal,    setArousal]    = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const resultsRef = useRef([])

  const spec = STAIRCASE_TRIALS[trialIdx]

  const { getPhase, runTrial, controlRef } = useTrialRunner({
    breathValueRef:          belt.breathValueRef,
    sendTrigger:             noopTrigger,
    currentPhaseRef:         belt.currentPhaseRef,
    currentTrialRef:         belt.currentTrialRef,
    getAndClearTrialSamples: belt.getAndClearTrialSamples,
    mlrWeightsRef:           belt.mlrWeightsRef,
  })
  const sampler = useGraphSampler(belt.breathValueRef, getPhase)

  const start = useCallback(async () => {
    setState('RUNNING')
    sampler.begin()
    const res = await runTrial('phase3', trialIdx + 1, spec.conditionMs)
    const graph = buildCleanGraph(belt, res, BASE_MS, spec.conditionMs, sampler.end())
    const adherence = directionalAdherence(res, spec.dir)
    setLastResult({ graph, adherence })
    setState('RATE')
  }, [runTrial, trialIdx, spec.conditionMs, spec.dir, sampler])

  function submitRatings() {
    const correct = response === spec.dir
    resultsRef.current.push({
      dir: spec.dir, detail: spec.detail, response, correct, confidence, arousal,
      graph: lastResult?.graph ?? null,
      adherence: lastResult?.adherence ?? null,
    })
    setState('REVEAL')
  }

  function next() {
    setResponse(null); setConfidence(null); setArousal(null); setLastResult(null)
    if (trialIdx + 1 >= STAIRCASE_TRIALS.length) onDone(resultsRef.current)
    else { setTrialIdx(i => i + 1); setState('READY') }
  }

  const canSubmit = response !== null && confidence !== null && arousal !== null
  const lastEntry = resultsRef.current[resultsRef.current.length - 1]

  return (
    <Panel wide>
      <h2 style={D.h2}>Change detection — trial {trialIdx + 1} of {STAIRCASE_TRIALS.length}</h2>

      {(state === 'READY' || state === 'RUNNING') && (
        <div style={{ width: 240, height: 240, margin: '0 auto' }}>
          <AvatarBreathPacer
            {...AVATAR_PROPS}
            scaleAmplitude={0.25}
            getPhase={getPhase}
            controlRef={controlRef}
            paused={state === 'READY'}
            size={240}
          />
        </div>
      )}

      {state === 'READY' && (
        <>
          <p style={D.body}>
            Breathe with the avatar. Partway through, the pace <em>may</em> change.
            Pay attention to what your body notices.
          </p>
          <Btn onClick={start}>Start trial</Btn>
        </>
      )}

      {state === 'RUNNING' && <p style={D.body}>Follow the avatar…</p>}

      {state === 'RATE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
          <div>
            <p style={D.rateLabel}>Did your breathing change speed?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {['slower', 'same', 'faster'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setResponse(opt)}
                  style={{
                    ...D.afcBtn,
                    background: response === opt ? 'var(--pk)' : 'transparent',
                    color:      response === opt ? '#fff' : 'var(--tx)',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={D.rateLabel}>How confident are you?</p>
            <ConfidenceRating value={confidence} onChange={setConfidence} />
          </div>
          <div>
            <p style={D.rateLabel}>How activated do you feel right now?</p>
            <ArousalRating value={arousal} onChange={setArousal} />
          </div>
          <Btn onClick={submitRatings} disabled={!canSubmit}>Reveal</Btn>
        </div>
      )}

      {state === 'REVEAL' && lastEntry && (
        <>
          <p style={{ ...D.body, fontSize: 18 }}>
            The pace <strong>{spec.label}</strong> ({spec.detail}) — you said{' '}
            <strong>{lastEntry.response}</strong>.{' '}
            {lastEntry.correct
              ? <span style={{ color: '#2ecc71', fontWeight: 600 }}>Correct ✓</span>
              : <span style={{ color: '#e67e22', fontWeight: 600 }}>Not this time</span>}
          </p>
          <TrialGraphCard
            title="Where the change happened (breath 3 onward)"
            graph={lastEntry.graph}
          />
          {lastEntry.adherence && (
            <p style={{ ...D.body, fontSize: 15, maxWidth: 520 }}>
              Your breath actually changed:{' '}
              <strong>{lastEntry.adherence.baseRate.toFixed(1)} → {lastEntry.adherence.condRate.toFixed(1)} breaths/min</strong>{' '}
              {lastEntry.adherence.correct
                ? <span style={{ color: '#2ecc71', fontWeight: 600 }}>in the cued direction ✓</span>
                : <span style={{ color: '#e67e22', fontWeight: 600 }}>— direction unclear</span>}
              . This is the adherence the study scores — whether or not you noticed the change.
            </p>
          )}
          <Btn onClick={next}>
            {trialIdx + 1 >= STAIRCASE_TRIALS.length ? 'Finish →' : 'Next trial →'}
          </Btn>
        </>
      )}
    </Panel>
  )
}

// ── Act 5: summary ──────────────────────────────────────────────────────────

function SummaryAct({ paced, staircase }) {
  return (
    <Panel wide>
      <h2 style={D.h2}>Demo complete</h2>

      <div style={D.summaryGrid}>
        <div>
          <p style={D.summaryHead}>Paced trials — sync with pacer</p>
          {paced.map((r, i) => (
            <p key={i} style={D.summaryLine}>
              Trial {i + 1}: sync {fmtR(r?.r)}
            </p>
          ))}
        </div>
        <div>
          <p style={D.summaryHead}>Change detection</p>
          {staircase.map((r, i) => (
            <p key={i} style={D.summaryLine}>
              Pace {r.dir === 'faster' ? 'sped up' : 'slowed down'}: said "{r.response}"{' '}
              {r.correct ? '✓' : '✗'} · confidence {r.confidence}/6 · arousal {r.arousal}/6
            </p>
          ))}
        </div>
      </div>

      <p style={{ ...D.body, marginTop: 8 }}>
        In the full study, the change-detection trials run as an adaptive QUEST+ staircase
        that converges on each person's respiratory change-detection threshold.
        No data was stored during this demo.
      </p>
      <Btn onClick={() => window.location.reload()}>Run it again</Btn>
    </Panel>
  )
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function TrialGraphCard({ title, graph }) {
  if (!graph || (graph.pacerPts?.length ?? 0) < 2) {
    return (
      <p style={{ ...D.body, color: 'var(--tx3)' }}>
        (Building signal graph…)
      </p>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <SignalGraph
        pacerPts={graph.pacerPts}
        beltPts={graph.beltPts}
        width={440}
        height={130}
        label={title}
      />
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Chip label="Sync with pacer" value={fmtR(graph.r)} />
      </div>
      <p style={D.legend}>
        <span style={{ color: '#3498db' }}>— pacer</span>{'   '}
        <span style={{ color: '#e67e22' }}>— your breath</span>
      </p>
    </div>
  )
}

function fmtR(r) {
  return r != null && isFinite(r) ? `${Math.round(r * 100)}%` : '—'
}

function Chip({ label, value }) {
  return (
    <div style={D.chip}>
      <span style={D.chipLabel}>{label}</span>
      <span style={D.chipValue}>{value}</span>
    </div>
  )
}

function Panel({ children, wide = false }) {
  return (
    <div style={{ ...D.panel, maxWidth: wide ? 560 : 460 }}>
      {children}
    </div>
  )
}

function Btn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...D.btn,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

const D = {
  page: {
    minHeight: '100vh', background: 'var(--bg, #FCF0F5)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '0 16px 48px',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  header: {
    width: '100%', maxWidth: 560, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '18px 4px',
  },
  brand: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 18, color: 'var(--tx)' },
  badge: {
    fontFamily: '"Space Mono",monospace', fontSize: 10, letterSpacing: '0.1em',
    color: 'var(--pkd)', background: 'var(--pkb)', borderRadius: 6, padding: '4px 10px',
  },
  panel: {
    width: '100%', background: '#fff', border: '1px solid var(--bd)',
    borderRadius: 14, padding: '32px 28px', marginTop: 8,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
  },
  h1: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 30, fontWeight: 400, color: 'var(--tx)', margin: 0, textAlign: 'center' },
  h2: { fontFamily: '"DM Serif Display",Georgia,serif', fontSize: 22, fontWeight: 400, color: 'var(--tx)', margin: 0, textAlign: 'center' },
  body: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, textAlign: 'center', margin: 0, maxWidth: 440 },
  steps: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.9, margin: 0, paddingLeft: 22, alignSelf: 'center' },
  err: { fontSize: 13, color: '#e04', margin: 0 },
  btn: {
    background: 'var(--pk)', color: '#fff', border: 'none', borderRadius: 12,
    padding: '13px 32px', fontSize: 15, fontWeight: 500,
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  afcBtn: {
    padding: '12px 20px', borderRadius: 12, fontWeight: 500, minWidth: 84,
    border: '1px solid var(--bds, var(--bd))', fontSize: 15, cursor: 'pointer',
    textTransform: 'capitalize', fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  rateLabel: { fontSize: 14, color: 'var(--tx2)', textAlign: 'center', margin: '0 0 10px' },
  chip: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    background: 'var(--bgp, #faf5f8)', border: '1px solid var(--bd)', borderRadius: 10,
    padding: '8px 16px',
  },
  chipLabel: { fontFamily: '"Space Mono",monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tx3)' },
  chipValue: { fontSize: 17, fontWeight: 600, color: 'var(--tx)' },
  legend: { fontFamily: '"Space Mono",monospace', fontSize: 11, color: 'var(--tx3)', margin: 0, whiteSpace: 'pre' },
  summaryGrid: { display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center', width: '100%' },
  summaryHead: { fontFamily: '"Space Mono",monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pkd)', margin: '0 0 8px' },
  summaryLine: { fontSize: 14, color: 'var(--tx)', margin: '0 0 6px', lineHeight: 1.5 },
}
