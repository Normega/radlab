/**
 * PondWatch — Go/No-Go Reaction Time Game
 * RADlab · Regulatory & Affective Dynamics Lab · U of T
 *
 * Paradigm: Simple RT + Go/No-Go
 * Target:   Duck  → respond (spacebar / tap)
 * Non-targets: Heron, Frog, Fish, Ripple → withhold
 *
 * Props:
 *   onSessionComplete(data) — called at end of session with full trial + metrics data
 *                             wire this to your Supabase push function
 *   userId  (string)        — passed through into session data
 *   studyId (string|null)   — passed through into session data
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CFG = {
  TRIAL_COUNT:          60,
  TARGET_RATE:          0.5,
  STIMULUS_DURATION_MS: 800,
  RESPONSE_WINDOW_MS:   1000,  // window starts at stimulus onset; slightly > stimulus duration
  FEEDBACK_DURATION_MS: 650,
  ITI_MIN_MS:           1000,
  ITI_MAX_MS:           3000,
  COUNTDOWN_FROM:       3,
}

const NON_TARGET_TYPES = ['heron', 'frog', 'fish', 'ripple']

const PHASE = {
  INSTRUCTIONS: 'instructions',
  COUNTDOWN:    'countdown',
  ITI:          'iti',
  STIMULUS:     'stimulus',
  FEEDBACK:     'feedback',
  RESULTS:      'results',
}

// ─── TRIAL GENERATION ────────────────────────────────────────────────────────

function generateTrials() {
  const n        = CFG.TRIAL_COUNT
  const nTargets = Math.round(n * CFG.TARGET_RATE)
  const nNonTgt  = n - nTargets
  const trials   = []

  for (let i = 0; i < nTargets; i++) {
    trials.push({ stimulusType: 'duck', isTarget: true })
  }
  for (let i = 0; i < nNonTgt; i++) {
    trials.push({ stimulusType: NON_TARGET_TYPES[i % NON_TARGET_TYPES.length], isTarget: false })
  }

  // Fisher-Yates shuffle
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[trials[i], trials[j]] = [trials[j], trials[i]]
  }

  return trials.map((t, i) => ({ ...t, trialNumber: i + 1 }))
}

// ─── METRICS ─────────────────────────────────────────────────────────────────

// Rational approximation to the probit (inverse normal CDF)
// Abramowitz & Stegun 26.2.17
function probit(p) {
  const pp  = p < 0.5 ? p : 1 - p
  const t   = Math.sqrt(-2 * Math.log(pp))
  const c   = [2.515517, 0.802853, 0.010328]
  const d   = [1.432788, 0.189269, 0.001308]
  const num = c[0] + c[1] * t + c[2] * t * t
  const den = 1   + d[0] * t + d[1] * t * t + d[2] * t * t * t
  return p < 0.5 ? -(t - num / den) : (t - num / den)
}

function computeMetrics(results) {
  const targets    = results.filter(r => r.isTarget)
  const nonTargets = results.filter(r => !r.isTarget)
  const nT         = targets.length
  const nNT        = nonTargets.length

  const hits = targets.filter(r => r.responded)
  const fa   = nonTargets.filter(r => r.responded)
  const cr   = nonTargets.filter(r => !r.responded)

  // Log-linear correction prevents ±Infinity at 0 or 1
  const pHit = (hits.length + 0.5) / (nT  + 1)
  const pFA  = (fa.length   + 0.5) / (nNT + 1)
  const zH   = probit(pHit)
  const zF   = probit(pFA)

  const hitRTs = hits.map(r => r.reactionTime).filter(Boolean).sort((a, b) => a - b)
  const mean   = hitRTs.length ? hitRTs.reduce((s, x) => s + x, 0) / hitRTs.length : null
  const median = hitRTs.length ? hitRTs[Math.floor(hitRTs.length / 2)] : null
  const sd     = hitRTs.length > 1
    ? Math.sqrt(hitRTs.reduce((s, x) => s + (x - mean) ** 2, 0) / (hitRTs.length - 1))
    : null

  return {
    hitRate:           +(hits.length / nT).toFixed(3),
    falseAlarmRate:    +(fa.length   / nNT).toFixed(3),
    dPrime:            +(zH - zF).toFixed(2),
    criterion:         +(-0.5 * (zH + zF)).toFixed(2),
    medianRtMs:        median ? Math.round(median) : null,
    rtSdMs:            sd     ? Math.round(sd)     : null,
    accuracy:          +((hits.length + cr.length) / results.length).toFixed(3),
    hits:              hits.length,
    misses:            targets.length - hits.length,
    falseAlarms:       fa.length,
    correctRejections: cr.length,
    nTrials:           results.length,
  }
}

// ─── SVG STIMULI ─────────────────────────────────────────────────────────────

const Duck = () => (
  <g>
    {/* Body */}
    <ellipse cx="50" cy="62" rx="28" ry="18" fill="#f068a4"/>
    {/* Wing highlight */}
    <ellipse cx="48" cy="64" rx="18" ry="10" fill="#e04090" opacity="0.4"/>
    {/* Head */}
    <circle cx="72" cy="50" r="13" fill="#f068a4"/>
    {/* Bill */}
    <ellipse cx="84" cy="52" rx="7" ry="4" fill="#c04a82"/>
    {/* Eye */}
    <circle cx="76" cy="47" r="2.5" fill="#1c1c1e"/>
    <circle cx="77" cy="46" r="1" fill="white"/>
    {/* Tail */}
    <path d="M22 58 Q14 50 18 44 Q24 54 22 58Z" fill="#e04090"/>
    {/* Neck */}
    <ellipse cx="62" cy="55" rx="8" ry="10" fill="#f068a4"/>
  </g>
)

const Heron = () => (
  <g>
    {/* Body */}
    <ellipse cx="50" cy="60" rx="14" ry="20" fill="#c8cacc"/>
    {/* Neck (S-curve) */}
    <path d="M50 40 Q44 52 50 60" stroke="#b0b2b4" strokeWidth="10" fill="none" strokeLinecap="round"/>
    {/* Head */}
    <ellipse cx="50" cy="36" rx="8" ry="7" fill="#c8cacc"/>
    {/* Bill */}
    <path d="M50 32 L66 30 L50 34Z" fill="#888a8c"/>
    {/* Eye */}
    <circle cx="54" cy="34" r="2" fill="#1c1c1e"/>
    {/* Plume */}
    <path d="M42 65 Q36 72 34 80" stroke="#b0b2b4" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M40 70 Q32 76 30 84" stroke="#b0b2b4" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* Legs (just visible above waterline) */}
    <line x1="46" y1="78" x2="44" y2="90" stroke="#888a8c" strokeWidth="2.5"/>
    <line x1="54" y1="78" x2="56" y2="90" stroke="#888a8c" strokeWidth="2.5"/>
  </g>
)

const Frog = () => (
  <g>
    {/* Body */}
    <ellipse cx="50" cy="66" rx="24" ry="16" fill="#5a9a5a"/>
    {/* Head */}
    <ellipse cx="50" cy="52" rx="20" ry="16" fill="#5aaa5a"/>
    {/* Eyes (bulging) */}
    <circle cx="38" cy="44" r="8" fill="#6aba6a"/>
    <circle cx="62" cy="44" r="8" fill="#6aba6a"/>
    <circle cx="38" cy="43" r="4" fill="#1c1c1e"/>
    <circle cx="62" cy="43" r="4" fill="#1c1c1e"/>
    <circle cx="39" cy="42" r="1.5" fill="white"/>
    <circle cx="63" cy="42" r="1.5" fill="white"/>
    {/* Mouth */}
    <path d="M36 58 Q50 66 64 58" stroke="#3a7a3a" strokeWidth="2" fill="none"/>
    {/* Front legs */}
    <path d="M30 68 Q22 72 20 78" stroke="#4a8a4a" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <path d="M70 68 Q78 72 80 78" stroke="#4a8a4a" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </g>
)

const Fish = () => (
  <g>
    {/* Just the fin visible above water */}
    {/* Dorsal fin */}
    <path d="M36 55 Q50 30 64 55" fill="#5a82bb" opacity="0.9"/>
    {/* Subtle body curve under surface */}
    <ellipse cx="50" cy="64" rx="26" ry="10" fill="#5a82bb" opacity="0.5"/>
    {/* Tail */}
    <path d="M76 60 L90 50 L90 72 Z" fill="#4a72ab"/>
    {/* Eye */}
    <circle cx="30" cy="60" r="3" fill="#1c1c1e" opacity="0.6"/>
  </g>
)

const Ripple = () => (
  <g opacity="0.7">
    <ellipse cx="50" cy="62" rx="8"  ry="4"  fill="none" stroke="#5a9aaa" strokeWidth="2"/>
    <ellipse cx="50" cy="62" rx="18" ry="9"  fill="none" stroke="#5a9aaa" strokeWidth="1.5"/>
    <ellipse cx="50" cy="62" rx="29" ry="14" fill="none" stroke="#5a9aaa" strokeWidth="1"/>
    <ellipse cx="50" cy="62" rx="40" ry="19" fill="none" stroke="#5a9aaa" strokeWidth="0.5"/>
  </g>
)

const StimulusComponents = { duck: Duck, heron: Heron, frog: Frog, fish: Fish, ripple: Ripple }

// ─── POND SCENE ──────────────────────────────────────────────────────────────

const PondScene = ({ stimulusType, showStimulus }) => {
  const Animal = stimulusType ? StimulusComponents[stimulusType] : null

  return (
    <svg
      viewBox="0 0 400 300"
      style={{ width: '100%', maxWidth: 520, display: 'block', borderRadius: 20 }}
    >
      {/* Sky */}
      <rect x="0"   y="0"   width="400" height="160" fill="#e8f0f8"/>
      {/* Distant treeline */}
      <ellipse cx="80"  cy="160" rx="55" ry="30" fill="#a8c898"/>
      <ellipse cx="160" cy="155" rx="45" ry="28" fill="#98b888"/>
      <ellipse cx="300" cy="158" rx="60" ry="32" fill="#a8c898"/>
      <ellipse cx="380" cy="162" rx="40" ry="25" fill="#b8d8a8"/>
      {/* Bank / grass */}
      <ellipse cx="200" cy="172" rx="210" ry="28" fill="#8aaa6a"/>
      <rect x="0" y="168" width="400" height="20" fill="#8aaa6a"/>
      {/* Water */}
      <ellipse cx="200" cy="240" rx="175" ry="75" fill="#a8d0e0"/>
      <rect x="28"  y="220" width="344" height="80" fill="#a8d0e0"/>
      <rect x="0"   y="265" width="400" height="35" fill="#a8d0e0"/>
      {/* Water shimmer lines */}
      <line x1="60"  y1="238" x2="110" y2="238" stroke="white" strokeWidth="1" opacity="0.4"/>
      <line x1="160" y1="248" x2="230" y2="248" stroke="white" strokeWidth="1" opacity="0.3"/>
      <line x1="280" y1="235" x2="340" y2="235" stroke="white" strokeWidth="1" opacity="0.4"/>
      {/* Left reeds */}
      <line x1="48"  y1="300" x2="44"  y2="195" stroke="#7a8a6a" strokeWidth="3"/>
      <line x1="60"  y1="300" x2="58"  y2="200" stroke="#7a8a6a" strokeWidth="2.5"/>
      <line x1="36"  y1="300" x2="32"  y2="210" stroke="#7a8a6a" strokeWidth="2"/>
      <ellipse cx="44"  cy="195" rx="5" ry="12" fill="#6a7a5a" opacity="0.8"/>
      <ellipse cx="58"  cy="200" rx="4" ry="10" fill="#6a7a5a" opacity="0.8"/>
      <ellipse cx="32"  cy="210" rx="4" ry="10" fill="#6a7a5a" opacity="0.7"/>
      {/* Right reeds */}
      <line x1="355" y1="300" x2="358" y2="200" stroke="#7a8a6a" strokeWidth="3"/>
      <line x1="368" y1="300" x2="372" y2="205" stroke="#7a8a6a" strokeWidth="2.5"/>
      <line x1="344" y1="300" x2="346" y2="215" stroke="#7a8a6a" strokeWidth="2"/>
      <ellipse cx="358" cy="200" rx="5" ry="12" fill="#6a7a5a" opacity="0.8"/>
      <ellipse cx="372" cy="205" rx="4" ry="10" fill="#6a7a5a" opacity="0.8"/>
      <ellipse cx="346" cy="215" rx="4" ry="10" fill="#6a7a5a" opacity="0.7"/>
      {/* Lily pads */}
      <ellipse cx="130" cy="258" rx="18" ry="10" fill="#5a9a5a" opacity="0.6"/>
      <ellipse cx="290" cy="265" rx="14" ry="8"  fill="#5a9a5a" opacity="0.5"/>
      {/* Animal in pond (centered, slightly left of center for naturalness) */}
      {showStimulus && Animal && (
        <g transform="translate(150, 195) scale(1.1)">
          <Animal />
        </g>
      )}
      {/* Water surface line over animal feet */}
      <ellipse cx="200" cy="222" rx="175" ry="8" fill="#98c8d8" opacity="0.45"/>
    </svg>
  )
}

// ─── FEEDBACK OVERLAY ────────────────────────────────────────────────────────

const feedbackConfig = {
  hit:               { label: 'Duck!',             sub: null,              color: '#1D9E75', bg: 'rgba(29,158,117,0.1)' },
  miss:              { label: 'Missed it!',         sub: 'That was a duck', color: '#BA7517', bg: 'rgba(186,117,23,0.1)'  },
  false_alarm:       { label: 'Not a duck!',        sub: 'Hold next time',  color: '#E24B4A', bg: 'rgba(226,75,74,0.1)'  },
  correct_rejection: { label: '',                   sub: null,              color: '#abadb0', bg: 'transparent'           },
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function PondWatch({ onSessionComplete, userId = null, studyId = null }) {
  const [phase,       setPhase]       = useState(PHASE.INSTRUCTIONS)
  const [countdown,   setCountdown]   = useState(CFG.COUNTDOWN_FROM)
  const [trialIndex,  setTrialIndex]  = useState(0)
  const [currentStim, setCurrentStim] = useState(null)
  const [feedback,    setFeedback]    = useState(null)   // { outcome, reactionTime }
  const [results,     setResults]     = useState(null)

  // Stable refs so timers don't capture stale state
  const trialsRef       = useRef([])
  const resultsRef      = useRef([])        // accumulated trial results
  const phaseRef        = useRef(phase)
  const stimOnsetRef    = useRef(null)
  const respondedRef    = useRef(false)
  const timersRef       = useRef([])
  const startTimeRef    = useRef(null)

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase }, [phase])

  // ─── TIMER HELPERS ───────────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  const after = useCallback((ms, fn) => {
    const id = setTimeout(fn, ms)
    timersRef.current.push(id)
    return id
  }, [])

  // ─── GAME FLOW ───────────────────────────────────────────────────────────

  const startCountdown = useCallback(() => {
    trialsRef.current   = generateTrials()
    resultsRef.current  = []
    startTimeRef.current = new Date().toISOString()
    setCountdown(CFG.COUNTDOWN_FROM)
    setPhase(PHASE.COUNTDOWN)
  }, [])

  const runCountdown = useCallback((n) => {
    if (n <= 0) {
      setPhase(PHASE.ITI)
      setTrialIndex(0)
      return
    }
    setCountdown(n)
    after(1000, () => runCountdown(n - 1))
  }, [after])

  useEffect(() => {
    if (phase === PHASE.COUNTDOWN) runCountdown(CFG.COUNTDOWN_FROM)
  }, [phase]) // eslint-disable-line

  const startITI = useCallback((index) => {
    respondedRef.current = false
    setCurrentStim(null)
    setFeedback(null)
    setPhase(PHASE.ITI)
    const iti = CFG.ITI_MIN_MS + Math.random() * (CFG.ITI_MAX_MS - CFG.ITI_MIN_MS)
    after(iti, () => startStimulus(index))
  }, [after]) // eslint-disable-line

  const startStimulus = useCallback((index) => {
    const trial = trialsRef.current[index]
    respondedRef.current = false
    stimOnsetRef.current = performance.now()
    setCurrentStim(trial)
    setTrialIndex(index)
    setPhase(PHASE.STIMULUS)

    // Close response window
    after(CFG.RESPONSE_WINDOW_MS, () => {
      if (phaseRef.current === PHASE.STIMULUS) {
        recordResponse(index, false, null)
      }
    })
  }, [after]) // eslint-disable-line

  const recordResponse = useCallback((index, responded, rt) => {
    const trial   = trialsRef.current[index]
    const outcome = responded && trial.isTarget    ? 'hit'
                  : !responded && trial.isTarget   ? 'miss'
                  : responded && !trial.isTarget   ? 'false_alarm'
                  : 'correct_rejection'

    const result = {
      trialNumber:  trial.trialNumber,
      stimulusType: trial.stimulusType,
      isTarget:     trial.isTarget,
      responded,
      reactionTime: rt,
      outcome,
    }

    resultsRef.current = [...resultsRef.current, result]
    setFeedback({ outcome, reactionTime: rt })
    setPhase(PHASE.FEEDBACK)

    after(CFG.FEEDBACK_DURATION_MS, () => {
      const nextIndex = index + 1
      if (nextIndex >= trialsRef.current.length) {
        endSession()
      } else {
        startITI(nextIndex)
      }
    })
  }, [after, startITI]) // eslint-disable-line

  const endSession = useCallback(() => {
    const endedAt = new Date().toISOString()
    const metrics = computeMetrics(resultsRef.current)
    const sessionData = {
      gameName:    'pond_watch',
      startedAt:   startTimeRef.current,
      endedAt,
      userId,
      studyId,
      trials:      resultsRef.current,
      metrics,
    }
    setResults(sessionData)
    setPhase(PHASE.RESULTS)
    if (onSessionComplete) onSessionComplete(sessionData)
  }, [onSessionComplete, userId, studyId])

  // ─── RESPONSE HANDLER ────────────────────────────────────────────────────

  const handleResponse = useCallback(() => {
    if (phaseRef.current !== PHASE.STIMULUS) return
    if (respondedRef.current) return
    respondedRef.current = true
    const rt = performance.now() - stimOnsetRef.current
    clearTimers()
    recordResponse(trialIndex, true, Math.round(rt))
  }, [trialIndex, clearTimers, recordResponse])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => { if (e.code === 'Space') { e.preventDefault(); handleResponse() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleResponse])

  // ITI starts when we first reach ITI phase (index 0)
  useEffect(() => {
    if (phase === PHASE.ITI && trialIndex === 0 && resultsRef.current.length === 0) {
      startITI(0)
    }
  }, [phase]) // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers])

  // ─── RENDER ──────────────────────────────────────────────────────────────

  const progress = phase === PHASE.RESULTS ? 1
    : resultsRef.current.length / CFG.TRIAL_COUNT

  return (
    <div style={S.shell}>

      {/* ── INSTRUCTIONS ── */}
      {phase === PHASE.INSTRUCTIONS && (
        <div style={S.screen}>
          <div style={S.card}>
            <p style={S.eyebrow}>Pond Watch</p>
            <h2 style={S.title}>Watch the pond.<br/>React to ducks.</h2>
            <div style={S.ruleRow}>
              <svg width="60" height="60" viewBox="0 0 100 100"><Duck/></svg>
              <div>
                <p style={S.ruleHead}>Duck → respond</p>
                <p style={S.ruleSub}>Press <kbd style={S.kbd}>space</kbd> or tap the button</p>
              </div>
            </div>
            <div style={S.ruleRow}>
              <svg width="60" height="60" viewBox="0 0 100 100"><Heron/></svg>
              <svg width="60" height="60" viewBox="0 0 100 100"><Frog/></svg>
              <div>
                <p style={S.ruleHead}>Anything else → wait</p>
                <p style={S.ruleSub}>Heron, frog, fish, or ripple — stay still</p>
              </div>
            </div>
            <p style={S.meta}>{CFG.TRIAL_COUNT} trials · about 5 minutes</p>
            <button style={S.btnPrimary} onClick={startCountdown}>
              Start watching
            </button>
          </div>
        </div>
      )}

      {/* ── COUNTDOWN ── */}
      {phase === PHASE.COUNTDOWN && (
        <div style={S.screen}>
          <div style={S.countdownWrap}>
            <p style={S.countdownNum}>{countdown}</p>
            <p style={S.countdownSub}>Get ready…</p>
          </div>
        </div>
      )}

      {/* ── GAME PHASES (ITI / STIMULUS / FEEDBACK) ── */}
      {[PHASE.ITI, PHASE.STIMULUS, PHASE.FEEDBACK].includes(phase) && (
        <div style={S.gameWrap}>
          {/* Progress */}
          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${progress * 100}%` }}/>
          </div>
          <div style={S.trialCounter}>
            {resultsRef.current.length} / {CFG.TRIAL_COUNT}
          </div>

          {/* Pond */}
          <div style={S.pondWrap} onClick={handleResponse}>
            <PondScene
              stimulusType={currentStim?.stimulusType ?? null}
              showStimulus={phase === PHASE.STIMULUS}
            />

            {/* Feedback overlay */}
            {phase === PHASE.FEEDBACK && feedback && (() => {
              const cfg = feedbackConfig[feedback.outcome]
              return cfg.label ? (
                <div style={{ ...S.feedbackOverlay, background: cfg.bg }}>
                  <p style={{ ...S.feedbackLabel, color: cfg.color }}>{cfg.label}</p>
                  {feedback.outcome === 'hit' && feedback.reactionTime && (
                    <p style={{ ...S.feedbackRT, color: cfg.color }}>
                      {feedback.reactionTime} ms
                    </p>
                  )}
                  {cfg.sub && <p style={S.feedbackSub}>{cfg.sub}</p>}
                </div>
              ) : null
            })()}
          </div>

          {/* Response button (for mobile / touch) */}
          <button
            style={{
              ...S.responseBtn,
              ...(phase === PHASE.STIMULUS ? S.responseBtnActive : {}),
            }}
            onPointerDown={handleResponse}
          >
            {phase === PHASE.STIMULUS ? 'Tap!' : '·'}
          </button>
        </div>
      )}

      {/* ── RESULTS ── */}
      {phase === PHASE.RESULTS && results && (
        <div style={S.screen}>
          <div style={S.resultsCard}>
            <p style={S.eyebrow}>Session complete</p>
            <h2 style={S.title} >Pond Watch</h2>

            {/* Primary metric */}
            <div style={S.primaryMetric} className="grid grid-cols-3 divide-x">
              <div style={{ padding: '12px 8px', overflow: 'hidden', minWidth: 0 }}>
                <p style={S.metricLabel}>Median RT</p>
                <p style={S.metricBig}>
                  {results.metrics.medianRtMs ?? '—'}
                  <span style={S.metricUnit}>ms</span>
                </p>
              </div>
              <div style={{ padding: '12px 8px', overflow: 'hidden', minWidth: 0 }}>
                <p style={S.metricLabel}>d′</p>
                <p style={S.metricBig}>{results.metrics.dPrime}</p>
              </div>
              <div style={{ padding: '12px 8px', overflow: 'hidden', minWidth: 0 }}>
                <p style={S.metricLabel}>Accuracy</p>
                <p style={S.metricBig}>
                  {Math.round(results.metrics.accuracy * 100)}
                  <span style={S.metricUnit}>%</span>
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <div style={S.breakdownGrid}>
              <Cell label="Hit rate"      val={`${Math.round(results.metrics.hitRate * 100)}%`}        sub={`${results.metrics.hits} / ${results.metrics.hits + results.metrics.misses}`}/>
              <Cell label="False alarms"  val={`${Math.round(results.metrics.falseAlarmRate * 100)}%`} sub={`${results.metrics.falseAlarms} responses`}/>
              <Cell label="Criterion"     val={results.metrics.criterion}                              sub="response bias"/>
              <Cell label="RT variability" val={results.metrics.rtSdMs ? `${results.metrics.rtSdMs} ms` : '—'} sub="std deviation"/>
            </div>

            <div style={S.actions}>
              <button style={S.btnPrimary} onClick={() => {
                setPhase(PHASE.INSTRUCTIONS)
                setResults(null)
                setCurrentStim(null)
                setFeedback(null)
                resultsRef.current = []
              }}>
                Play again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────

const Cell = ({ label, val, sub }) => (
  <div style={S.cell}>
    <p style={S.cellLabel}>{label}</p>
    <p style={S.cellVal}>{val}</p>
    <p style={S.cellSub}>{sub}</p>
  </div>
)

// ─── STYLES ──────────────────────────────────────────────────────────────────

const MONO  = "'Space Mono', 'Courier New', monospace"
const SERIF = "'DM Serif Display', Georgia, serif"
const PK    = '#f068a4'
const PKD   = '#c04a82'
const TX    = '#1c1c1e'
const TX2   = '#6b6c70'
const TX3   = '#a8a9ad'
const BG    = '#FCF0F5'
const BGC   = '#ffffff'
const BGP   = '#FBEAF3'
const BD    = 'rgba(180,100,140,0.15)'

const S = {
  shell: {
    background: BG,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '20px',
  },
  screen: {
    width: '100%',
    maxWidth: 560,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  card: {
    background: BGC,
    border: `1px solid ${BD}`,
    borderRadius: 20,
    padding: '36px 32px',
    width: '100%',
  },
  resultsCard: {
    background: BGC,
    border: `1px solid ${BD}`,
    borderRadius: 20,
    padding: '36px 32px',
    width: '100%',
  },
  eyebrow: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: PK,
    marginBottom: 10,
  },
  title: {
    fontFamily: SERIF,
    fontSize: 36,
    color: TX,
    letterSpacing: -0.5,
    lineHeight: 1.1,
    marginBottom: 28,
  },
  ruleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '14px 0',
    borderBottom: `1px solid ${BD}`,
    marginBottom: 4,
  },
  ruleHead: {
    fontSize: 15,
    fontWeight: 500,
    color: TX,
    marginBottom: 4,
  },
  ruleSub: {
    fontSize: 13,
    color: TX2,
  },
  kbd: {
    background: BGP,
    border: `1px solid ${BD}`,
    borderRadius: 4,
    padding: '1px 7px',
    fontFamily: MONO,
    fontSize: 12,
    color: PKD,
  },
  meta: {
    fontFamily: MONO,
    fontSize: 10,
    color: TX3,
    letterSpacing: 1,
    textAlign: 'center',
    margin: '20px 0 24px',
  },
  btnPrimary: {
    width: '100%',
    padding: '13px 0',
    background: PK,
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
  countdownWrap: {
    textAlign: 'center',
  },
  countdownNum: {
    fontFamily: SERIF,
    fontSize: 120,
    color: PK,
    lineHeight: 1,
  },
  countdownSub: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: TX3,
    marginTop: 12,
  },
  gameWrap: {
    width: '100%',
    maxWidth: 540,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  progressBar: {
    width: '100%',
    height: 4,
    background: BD,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: PK,
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  trialCounter: {
    fontFamily: MONO,
    fontSize: 10,
    color: TX3,
    letterSpacing: 1,
    alignSelf: 'flex-end',
  },
  pondWrap: {
    width: '100%',
    position: 'relative',
    cursor: 'pointer',
    borderRadius: 20,
    overflow: 'hidden',
    border: `1px solid ${BD}`,
    userSelect: 'none',
  },
  feedbackOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    pointerEvents: 'none',
  },
  feedbackLabel: {
    fontFamily: SERIF,
    fontSize: 42,
    letterSpacing: -0.5,
  },
  feedbackRT: {
    fontFamily: MONO,
    fontSize: 16,
    marginTop: 4,
  },
  feedbackSub: {
    fontFamily: MONO,
    fontSize: 11,
    color: TX2,
    marginTop: 6,
    letterSpacing: 1,
  },
  responseBtn: {
    width: '100%',
    padding: '18px 0',
    background: BGC,
    border: `1px solid ${BD}`,
    borderRadius: 14,
    fontSize: 18,
    color: TX3,
    cursor: 'pointer',
    fontFamily: MONO,
    transition: 'all 0.1s',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  responseBtnActive: {
    background: BGP,
    borderColor: PK,
    color: PK,
    fontWeight: 600,
  },
  primaryMetric: {
    borderRadius: 14,
    overflow: 'hidden',
    border: `1px solid ${BD}`,
    marginBottom: 16,
  },
  metricLabel: {
    fontFamily: MONO,
    fontSize: 'clamp(7px, 1.5vw, 8px)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: TX3,
    marginBottom: 4,
  },
  metricBig: {
    fontFamily: MONO,
    fontSize: 'clamp(22px, 5vw, 36px)',
    fontWeight: 700,
    color: TX,
    lineHeight: 1,
  },
  metricUnit: {
    fontSize: 14,
    fontWeight: 400,
    color: TX3,
    marginLeft: 2,
  },
  breakdownGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 24,
  },
  cell: {
    background: BGP,
    borderRadius: 10,
    padding: '12px 14px',
  },
  cellLabel: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TX3,
    marginBottom: 4,
  },
  cellVal: {
    fontFamily: MONO,
    fontSize: 20,
    fontWeight: 700,
    color: TX,
    marginBottom: 2,
  },
  cellSub: {
    fontFamily: MONO,
    fontSize: 9,
    color: TX3,
  },
  actions: {
    display: 'flex',
    gap: 10,
  },
}
