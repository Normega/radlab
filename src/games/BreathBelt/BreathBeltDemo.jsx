// v3 — conference demo: Polar H10 pairing → MLR calibration → straight to 3
// hardcoded "staircase" trials (speed up, slow down, no change) with
// speed-change/confidence/arousal ratings and a reveal graph.
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

// Directional adherence — ported from Study 5's Intero2025_BehaviourLedBreathAnalysis.R
// (direction_correct = sign(observed_dur_change) == sign(delta)):
//   1. Detect breath-onset troughs in the belt signal (exhale trough = start
//      of inhale, same convention as the pacer: bt=0 at phase 0).
//   2. Per-breath durations = diff(trough times), for breaths 1-4.
//   3. observed_dur_change = mean(dur3,dur4) - mean(dur1,dur2), seconds.
//   4. delta = signed cued change, seconds (positive = slower/longer, matching
//      the paper's "Change" column convention).
//   5. direction_correct = sign(observed_dur_change) == sign(delta).
// Runs on the same de-trended beltPts already built for the graph, so what the
// audience sees and what gets scored are the same signal.

// Local-minima (trough) detector — mirrors breathUtils' internal peak logic,
// applied to -value to find troughs instead of peaks.
function findTroughs(pts, minSepMs) {
  const troughs = []
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i].value < pts[i - 1].value && pts[i].value < pts[i + 1].value) {
      if (!troughs.length || pts[i].t - troughs[troughs.length - 1].t > minSepMs) {
        troughs.push(pts[i])
      }
    }
  }
  return troughs
}

// Duration change (seconds) -> a slower/same/faster label. "Same" absorbs
// small noise around zero (breath timing isn't pixel-precise); threshold is a
// demo judgment call, not from the paper (which only classifies delta!=0 trials).
const SAME_THRESHOLD_S = 0.25
function classifyDirection(changeS) {
  if (changeS > SAME_THRESHOLD_S)  return 'slower'   // longer duration = slower breathing
  if (changeS < -SAME_THRESHOLD_S) return 'faster'   // shorter duration = faster breathing
  return 'same'
}

function directionalAdherence(graph, baseMs, conditionMs) {
  const beltPts = graph?.beltPts
  if (!beltPts || beltPts.length < 20) {
    console.debug('[adherence] skipped: too few belt points', { have: beltPts?.length ?? 0, need: 20 })
    return null
  }

  const minSepMs = Math.min(baseMs, conditionMs) * 0.6   // avoid double-counting noise
  const troughs  = findTroughs(beltPts, minSepMs)
  if (troughs.length < 5) {
    console.debug('[adherence] skipped: too few troughs', { found: troughs.length, need: 5, beltPtsSpanMs: beltPts[beltPts.length - 1].t - beltPts[0].t })
    return null   // need 5 troughs to bound 4 breaths
  }

  // Take the last 5 troughs (bounding the 4 most recent breaths) in case of
  // spurious extra detections earlier in the window.
  const t5   = troughs.slice(-5)
  const durS = []
  for (let i = 1; i < t5.length; i++) durS.push((t5[i].t - t5[i - 1].t) / 1000)
  if (durS.length !== 4) return null

  const [d1, d2, d3, d4] = durS
  const observedChange = (d3 + d4) / 2 - (d1 + d2) / 2
  const delta = (conditionMs - baseMs) / 1000   // positive = slower/longer, negative = faster/shorter
  const expectedLabel = delta === 0 ? 'same' : classifyDirection(delta)
  const observedLabel = classifyDirection(observedChange)
  // "Correct" per the paper's convention (sign match) only applies to change
  // trials; on same-pace trials (delta=0) we just check the observed label.
  const correct = delta === 0 ? observedLabel === 'same' : Math.sign(observedChange) === Math.sign(delta)
  return { d1, d2, d3, d4, observedChange, delta, expectedLabel, observedLabel, correct }
}

// Build the trial graph with the EXACT procedure the calibration review uses
// (useBeltConnection: computeMLRPredictions → getPacerRadius → downsample by 5).
// Samples come from rawAccelRowsRef (always populated, never cleared), filtered
// to the breathing window [trialStart, trialEnd] — so filtfilt sees a
// breathing-only window like calibration, not the static fixation lead-in.
// Falls back to the live sample only when there is no belt data (sim rehearsal).
// Study 5's pipeline (breath_pipeline.R: run_pipeline) filters the ENTIRE
// continuous recording once via filtfilt, then extracts each trial's troughs
// from that already-filtered signal (analyze_respiration). filtfilt has no
// data outside a window to reference, so filtering a short ~18s per-trial
// slice in isolation (the previous approach here) distorts amplitude near
// the window edges — how much depends on where the true breath boundaries
// land relative to the cut, which varies trial to trial (matches the
// "worked once, then failed" symptom). Filtering the whole accumulated
// session once, then slicing the trial window out of the result, gives
// filtfilt full context and removes that edge transient from every trial
// after the first. No downsampling here — SignalGraph thins its own path.
//
// Window padding: the belt signal is a LAGGED reconstruction of breathing
// (mlr.lagMs, typically 50-300ms from calibration), so the belt-measured
// trough for breath 4 can fall after the pacer-timed trialEndMs — clipping
// it out of an exact [trialStart, trialEnd] window and leaving only 4
// troughs where directionalAdherence needs 5. Pad the window by lag + a
// safety margin so the true boundary troughs aren't cut off.
function buildCleanGraph(belt, res, basePeriodMs, changedPeriodMs, liveGraph) {
  const mlr = belt.mlrWeightsRef.current
  if (mlr && res?.trialStartMs != null && res?.trialEndMs != null) {
    const leadPadMs  = 300
    const trailPadMs = Math.max(500, (mlr.lagMs ?? 0) + 300)
    const t0 = res.trialStartMs - leadPadMs, t1 = res.trialEndMs + trailPadMs
    const allSamples = (belt.rawAccelRowsRef.current || [])
      .map(r => ({ t: r.packetTimestamp + r.sampleIndex * 5, x: r.x, y: r.y, z: r.z }))
      .sort((a, b) => a.t - b.t)
    if (allSamples.length > 80) {
      const beltAll = computeMLRPredictions(allSamples, mlr)
      const pacerPts = [], beltPts = []
      for (let i = 0; i < allSamples.length; i++) {
        const t = allSamples[i].t
        if (t < t0 || t > t1) continue
        // Pacer phase stays anchored to the true (unpadded) trial start so
        // the padded fringe samples don't shift the pacer curve.
        pacerPts.push({ t, value: getPacerRadiusForTrial(t, res.trialStartMs, basePeriodMs, changedPeriodMs) })
        beltPts.push({ t, value: beltAll[i] })
      }
      if (beltPts.length > 20 && pacerPts.length > 20) {
        const r = pearsonRArrays(beltPts.map(p => p.value), pacerPts.map(p => p.value))
        return { pacerPts, beltPts, r }
      }
      console.debug('[buildCleanGraph] skipped: too few windowed points', { beltPts: beltPts.length, pacerPts: pacerPts.length, allSamples: allSamples.length })
    } else {
      console.debug('[buildCleanGraph] skipped: too few raw accel samples', { have: allSamples.length, need: 80 })
    }
  } else {
    console.debug('[buildCleanGraph] skipped: no MLR model or trial timestamps', { hasMlr: !!mlr, trialStartMs: res?.trialStartMs, trialEndMs: res?.trialEndMs })
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

// Hardcoded staircase demo trials: speed up, no-change catch trial, slow down.
const STAIRCASE_TRIALS = [
  { dir: 'faster', conditionMs: FASTER_MS, label: 'sped up',        detail: '4s → 3s breaths' },
  { dir: 'same',   conditionMs: BASE_MS,   label: 'stayed the same', detail: '4s breaths, no change' },
  { dir: 'slower', conditionMs: SLOWER_MS, label: 'slowed down',    detail: '4s → 5s breaths' },
]

const AVATAR_PROPS = { skinColor: '#FDBCB4', eyeColor: '#4A90D9', species: 'human' }
const noopTrigger = async () => {}

export default function BreathBeltDemo() {
  const location = useLocation()
  const isSimMode = new URLSearchParams(location.search).get('sim') === '1'

  const belt = useBeltConnection({ isSimMode })
  const [act, setAct] = useState('WELCOME') // WELCOME → CONNECT → CALIBRATE → STAIRCASE → SUMMARY

  const staircaseResultsRef = useRef([])

  // Belt connected → calibrate
  useEffect(() => {
    if (act === 'CONNECT' && belt.btState === 'CONNECTED') setAct('CALIBRATE')
  }, [act, belt.btState])

  // Calibration accepted → straight to detection trials
  useEffect(() => {
    if (act === 'CALIBRATE' && belt.calibPhase === 'COMPLETE') setAct('STAIRCASE')
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
            <li>3 detection trials: does the pace change? Rate what you felt</li>
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

      {act === 'STAIRCASE' && (
        <StaircaseAct
          belt={belt}
          onDone={(results) => { staircaseResultsRef.current = results; setAct('SUMMARY') }}
        />
      )}

      {act === 'SUMMARY' && (
        <SummaryAct staircase={staircaseResultsRef.current} />
      )}
    </div>
  )
}

// ── Act 3: hardcoded staircase trials with ratings + reveal ────────────────

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
    // Keep sampling briefly past trialEndMs so the belt's lagged trailing
    // trough (see buildCleanGraph) isn't clipped from the live-sampler
    // fallback either — mirrors the trailPadMs used on the real-belt path.
    await new Promise(r => setTimeout(r, 500))
    const graph = buildCleanGraph(belt, res, BASE_MS, spec.conditionMs, sampler.end())
    const adherence = directionalAdherence(graph, BASE_MS, spec.conditionMs)
    setLastResult({ graph, adherence })
    setState('RATE')
  }, [runTrial, trialIdx, spec.conditionMs, sampler])

  function submitRatings() {
    const correct = response === spec.dir
    resultsRef.current.push({
      dir: spec.dir, label: spec.label, detail: spec.detail, response, correct, confidence, arousal,
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
            adherence={lastEntry.adherence}
          />
          {lastEntry.adherence && (
            <p style={{ ...D.body, fontSize: 13, color: 'var(--tx3)', maxWidth: 480 }}>
              This directional check — not the sync score above — is the adherence the study scores (88.9% / 91% correct direction, hits vs. misses), whether or not you noticed the change.
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

// ── Act 4: summary ──────────────────────────────────────────────────────────

function SummaryAct({ staircase }) {
  return (
    <Panel wide>
      <h2 style={D.h2}>Demo complete</h2>

      <div style={D.summaryGrid}>
        <div>
          <p style={D.summaryHead}>Change detection</p>
          {staircase.map((r, i) => (
            <p key={i} style={D.summaryLine}>
              Pace {r.label}: said "{r.response}"{' '}
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

const LABEL_TEXT = { slower: 'Slower', same: 'Same', faster: 'Faster' }

function TrialGraphCard({ title, graph, adherence }) {
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
        {adherence && (
          <>
            <Chip label="Expected" value={LABEL_TEXT[adherence.expectedLabel]} />
            <Chip
              label="Observed"
              value={`${LABEL_TEXT[adherence.observedLabel]} ${adherence.correct ? '✓' : '✗'}`}
              tone={adherence.correct ? '#2ecc71' : '#e67e22'}
            />
          </>
        )}
      </div>
      <p style={D.legend}>
        <span style={{ color: '#3498db' }}>— pacer</span>{'   '}
        <span style={{ color: '#e67e22' }}>— your breath</span>
      </p>
      {adherence && (
        <p style={{ ...D.legend, maxWidth: 440 }}>
          Belt-measured breath durations: {adherence.d1.toFixed(2)}s, {adherence.d2.toFixed(2)}s → {adherence.d3.toFixed(2)}s, {adherence.d4.toFixed(2)}s
          {' '}({adherence.observedChange >= 0 ? '+' : ''}{adherence.observedChange.toFixed(2)}s)
        </p>
      )}
    </div>
  )
}

function fmtR(r) {
  return r != null && isFinite(r) ? `${Math.round(r * 100)}%` : '—'
}

function Chip({ label, value, tone }) {
  return (
    <div style={D.chip}>
      <span style={D.chipLabel}>{label}</span>
      <span style={{ ...D.chipValue, ...(tone ? { color: tone } : {}) }}>{value}</span>
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
