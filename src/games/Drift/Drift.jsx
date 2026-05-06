import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import { supabase } from '../../lib/supabase'
import { EMOTIONS } from '../StillWater/constants'
import ContactAvatar from '../FirstContact/components/ContactAvatar'

/* ── SQL (run once in Supabase) ───────────────────────────────────────────────

CREATE TABLE drift_trials (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id            uuid REFERENCES game_sessions(id) ON DELETE CASCADE,
  trial_num             integer NOT NULL,
  target_duration_ms    integer NOT NULL,
  avatar_emotion_id     integer NOT NULL,
  avatar_zone           integer NOT NULL,
  avatar_emotion_name   text    NOT NULL,
  reproduced_duration_ms integer NOT NULL,
  ratio                 numeric(6,4) NOT NULL,
  abs_error_ms          integer NOT NULL,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE drift_performance (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id        uuid REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mean_ratio        numeric(6,4),
  mean_abs_error_ms integer,
  trial_count       integer DEFAULT 6,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drift_sessions integer DEFAULT 0;

──────────────────────────────────────────────────────────────────────────── */

const TARGETS_MS   = [5000, 7000, 9000, 11000, 13000, 15000]
const BREATH_CYCLE = 4000  // ms — independent of interval so there's no timing cue

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildTrials() {
  return shuffle(TARGETS_MS).map(ms => {
    const e = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)]
    return { targetMs: ms, emotionId: e.id, emotionName: e.name, zone: 0 }
  })
}

// ─── AUDIO ────────────────────────────────────────────────────────────────────

let _ctx = null
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

function playTone(freq, decaySec) {
  try {
    const ctx  = getCtx()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    const t = ctx.currentTime
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.12, t + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.001, t + decaySec)
    osc.start(t); osc.stop(t + decaySec + 0.05)
  } catch (_) {}
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────

async function startSession(userId) {
  if (!userId) return null
  const { data } = await supabase.from('game_sessions').insert({
    user_id: userId, game_name: 'drift', study_id: null,
    started_at: new Date().toISOString(),
  }).select('id').single()
  return data?.id ?? null
}

async function saveTrialResult({ sessionId, trialNum, trial, reproducedMs, ratio, absError }) {
  if (!sessionId) return
  await supabase.from('drift_trials').insert({
    session_id:            sessionId,
    trial_num:             trialNum,
    target_duration_ms:    trial.targetMs,
    avatar_emotion_id:     trial.emotionId,
    avatar_zone:           trial.zone,
    avatar_emotion_name:   trial.emotionName,
    reproduced_duration_ms: reproducedMs,
    ratio:                 parseFloat(ratio.toFixed(4)),
    abs_error_ms:          absError,
  })
}

async function saveSessionComplete({ sessionId, userId, meanRatio, meanAbsError }) {
  if (sessionId) {
    await supabase.from('game_sessions').update({ ended_at: new Date().toISOString() }).eq('id', sessionId)
    await supabase.from('drift_performance').insert({
      session_id: sessionId, user_id: userId,
      mean_ratio: parseFloat(meanRatio.toFixed(4)),
      mean_abs_error_ms: Math.round(meanAbsError),
      trial_count: TARGETS_MS.length,
    })
  }
  if (userId) {
    const { data: p } = await supabase.from('profiles').select('drift_sessions, points').eq('id', userId).single()
    const updates = { drift_sessions: (p?.drift_sessions ?? 0) + 1 }
    if (p?.points !== undefined) updates.points = (p.points ?? 0) + 5
    await supabase.from('profiles').update(updates).eq('id', userId)
  }
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function ProgressPips({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 7, height: 7, borderRadius: 4,
          background: i <= current ? '#f068a4' : '#E8D0E0',
          opacity: i < current ? 0.42 : 1,
          transition: 'all 0.25s',
        }} />
      ))}
    </div>
  )
}

function IntroScreen({ onStart }) {
  return (
    <div style={{ maxWidth: 380, textAlign: 'center', padding: '0 16px' }}>
      <p style={S.eyebrow}>RADlab · Come, See</p>
      <h1 style={S.h1}>Drift.</h1>
      <p style={S.sub}>
        Time dilates with emotional state.<br />
        This measures how you feel time — right now.
      </p>

      <div style={S.card}>
        {[
          { n: 1, title: 'Watch and listen', body: 'A soft tone marks the start. A face breathes while you wait. A second tone marks the end.' },
          { n: 2, title: 'Reproduce it', body: 'Press once to start. Press again when you feel the same duration has passed. Don\'t count seconds.' },
          { n: 3, title: 'Trust your felt sense', body: 'Your ratio — reproduced ÷ actual — reflects where your nervous system is right now.' },
        ].map(({ n, title, body }) => (
          <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ background: '#F4E0F0', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#f068a4', fontWeight: 700 }}>{n}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1c1e', marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{body}</div>
            </div>
          </div>
        ))}
      </div>

      <button style={S.btnPrimary} onClick={onStart}>Begin →</button>
    </div>
  )
}

function WatchingScreen({ trialIdx, totalTrials, mode, skinColor, eyeColor, species, getPhase }) {
  const avatarCtrl = useRef(null)

  useEffect(() => {
    if (!avatarCtrl.current) return
    if (mode === 'watching') {
      avatarCtrl.current.resumeAnimation()
    } else {
      avatarCtrl.current.resetToNeutral()
    }
  }, [mode])

  const headingText = mode === 'watching' ? 'Listen and feel.' : mode === 'gap' ? 'Now you…' : ''
  const hintText    = mode === 'watching' ? '● listening' : mode === 'gap' ? 'get ready…' : '…'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <ProgressPips current={trialIdx} total={totalTrials} />
      <div style={{ textAlign: 'center' }}>
        <p style={S.eyebrow}>Interval {trialIdx + 1} of {totalTrials}</p>
        <h2 style={S.phase}>{headingText}</h2>
      </div>
      <div style={S.faceCard}>
        <ContactAvatar
          size={160}
          skinColor={skinColor} eyeColor={eyeColor} species={species}
          getPhase={getPhase}
          controlRef={avatarCtrl}
          isFirstContact={false}
        />
      </div>
      <p style={S.hint}>{hintText}</p>
    </div>
  )
}

function ReproduceScreen({ trialIdx, totalTrials, isActive, ringScale, onPress, skinColor, eyeColor, species, getPhase }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <ProgressPips current={trialIdx} total={totalTrials} />
      <div style={{ textAlign: 'center' }}>
        <p style={S.eyebrow}>Interval {trialIdx + 1} of {totalTrials}</p>
        <h2 style={S.phase}>{isActive ? 'Feel the time…' : 'Your turn.'}</h2>
      </div>

      {/* Neutral avatar — ContactAvatar starts paused so it shows at rest */}
      <div style={S.faceCard}>
        <ContactAvatar
          size={160}
          skinColor={skinColor} eyeColor={eyeColor} species={species}
          getPhase={getPhase}
          isFirstContact={false}
        />
      </div>

      {/* Tap button with pulse ring */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
        {isActive && (
          <div style={{
            position: 'absolute', width: 92, height: 92, borderRadius: '50%',
            border: '2px solid #f068a4', opacity: 0.35,
            transform: `scale(${ringScale})`,
            pointerEvents: 'none',
            transition: 'opacity 0.2s',
          }} />
        )}
        <button
          style={{
            width: 74, height: 74, borderRadius: '50%', cursor: 'pointer',
            background: isActive ? '#f068a4' : 'white',
            border: isActive ? 'none' : '2px solid #f068a4',
            color: isActive ? 'white' : '#f068a4',
            fontFamily: 'Space Mono,monospace', fontSize: 13, letterSpacing: '0.04em',
            boxShadow: isActive ? '0 0 0 8px rgba(240,104,164,0.10)' : 'none',
            transition: 'background 0.18s, color 0.18s, box-shadow 0.18s',
            touchAction: 'manipulation',
          }}
          onClick={onPress}
        >
          {isActive ? 'stop' : 'start'}
        </button>
      </div>

      <p style={S.hint}>
        {isActive ? 'press again when the time has passed' : 'press when you\'re ready to begin'}
      </p>
    </div>
  )
}

function FeedbackPanel({ targetMs, reproducedMs, trialIdx, totalTrials, onNext }) {
  const ratio   = reproducedMs / targetMs
  const pctOff  = Math.abs(ratio - 1) * 100
  const maxMs   = 16500

  let label, labelColor
  if      (pctOff < 10) { label = 'Right on.';        labelColor = '#1EA878' }
  else if (pctOff < 25) { label = 'Close.';            labelColor = '#D88000' }
  else if (ratio  > 1)  { label = 'Time stretched.';   labelColor = '#abadb0' }
  else                  { label = 'Time compressed.';  labelColor = '#abadb0' }

  const tPct = (targetMs     / maxMs * 100).toFixed(1)
  const rPct = (reproducedMs / maxMs * 100).toFixed(1)

  const isLast = trialIdx + 1 >= totalTrials

  return (
    <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
      <ProgressPips current={trialIdx} total={totalTrials} />
      <div style={{ marginTop: 18, marginBottom: 18 }}>
        <p style={S.eyebrow}>Result</p>
        <p style={{ fontFamily: 'DM Serif Display,serif', fontSize: 24, color: labelColor, margin: 0 }}>{label}</p>
      </div>

      <div style={{ ...S.card, gap: 0 }}>
        {/* Target row */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 11, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Target</span>
            <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#888' }}>{(targetMs / 1000).toFixed(1)}s</span>
          </div>
          <div style={{ height: 8, background: '#F4ECF2', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${tPct}%`, background: '#D0C0CC', borderRadius: 4 }} />
          </div>
        </div>
        {/* Reproduced row */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 11, color: '#f068a4', textTransform: 'uppercase', letterSpacing: '0.08em' }}>You</span>
            <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#f068a4' }}>{(reproducedMs / 1000).toFixed(1)}s</span>
          </div>
          <div style={{ height: 8, background: '#F4ECF2', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${rPct}%`, background: '#f068a4', borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, fontFamily: 'Space Mono,monospace', fontSize: 13, color: '#abadb0' }}>
          ratio <span style={{ color: '#1c1c1e', fontWeight: 700 }}>{ratio.toFixed(2)}&times;</span>
        </div>
      </div>

      <button style={{ ...S.btnPrimary, marginTop: 8 }} onClick={onNext}>
        {isLast ? 'See results →' : 'Next →'}
      </button>
    </div>
  )
}

function SummaryScreen({ results, onPlay }) {
  const meanRatio   = results.reduce((s, r) => s + r.ratio, 0) / results.length
  const meanErrSec  = results.reduce((s, r) => s + r.absError, 0) / results.length / 1000

  let interp
  if      (Math.abs(meanRatio - 1) < 0.1) interp = 'Your sense of time was accurate today.'
  else if (meanRatio > 1.3)               interp = 'Time felt much longer than it was — a slow, low place.'
  else if (meanRatio > 1)                 interp = 'You stretched time a little — things felt drawn out.'
  else if (meanRatio < 0.7)               interp = 'Time felt much faster — high energy, compressed.'
  else                                    interp = 'You compressed time slightly — things moved faster than they were.'

  return (
    <div style={{ maxWidth: 440, textAlign: 'center', padding: '0 16px', width: '100%' }}>
      <p style={S.eyebrow}>Done</p>
      <h1 style={S.h1}>Mean ratio: {meanRatio.toFixed(2)}&times;</h1>
      <p style={S.sub}>{interp}</p>

      <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 18px rgba(180,120,160,0.10)', overflow: 'hidden', marginBottom: 20, textAlign: 'left' }}>
        {results.map((r, i) => {
          const off   = Math.abs(r.ratio - 1)
          const color = off < 0.1 ? '#1EA878' : off < 0.25 ? '#D88000' : '#abadb0'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < results.length - 1 ? '1px solid #F4ECF2' : 'none' }}>
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#ccc', width: 20, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, fontSize: 13, color: '#666' }}>
                <span style={{ fontWeight: 500 }}>{(r.targetMs / 1000).toFixed(0)}s</span>
                <span style={{ color: '#bbb', fontSize: 12 }}> · {r.emotionName}</span>
              </div>
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#bbb', width: 40, textAlign: 'right' }}>
                {(r.reproducedMs / 1000).toFixed(1)}s
              </div>
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 13, fontWeight: 700, color, width: 40, textAlign: 'right' }}>
                {r.ratio.toFixed(2)}&times;
              </div>
            </div>
          )
        })}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F4ECF2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 11, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mean error</span>
          <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 13, color: '#888' }}>{meanErrSec.toFixed(1)}s</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...S.btnOutline, flex: 1 }} onClick={onPlay}>Again</button>
        <Link to="/games" style={{ ...S.btnPrimary, flex: 1, textAlign: 'center', textDecoration: 'none' }}>Games &rarr;</Link>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function Drift({ session }) {
  const [phase,       setPhase]       = useState('intro')
  const [trials,      setTrials]      = useState([])
  const [trialIdx,    setTrialIdx]    = useState(0)
  const [avatar,      setAvatar]      = useState({ skinColor: '#c8a882', eyeColor: '#5a3e2b', species: 'human' })
  const [repStart,    setRepStart]    = useState(null)
  const [repDuration, setRepDuration] = useState(null)
  const [results,     setResults]     = useState([])
  const [ringScale,   setRingScale]   = useState(1)

  const breathStartRef  = useRef(Date.now())
  const ringRafRef      = useRef(null)
  const readyTimerRef   = useRef(null)
  const watchTimerRef   = useRef(null)
  const gapTimerRef     = useRef(null)
  const sessionIdRef    = useRef(null)
  const resultsRef      = useRef([])
  const keyHandlerRef   = useRef(null)

  const userId = session?.user?.id ?? null
  const trial  = trials[trialIdx] ?? null

  const getPhase = useCallback(
    () => ((Date.now() - breathStartRef.current) % BREATH_CYCLE) / BREATH_CYCLE,
    []
  )

  // Fetch profile avatar
  useEffect(() => {
    if (!userId) return
    supabase.from('avatars').select('skin_color, eye_color, species').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) setAvatar({ skinColor: data.skin_color, eyeColor: data.eye_color, species: data.species })
      })
  }, [userId])

  function startGame() {
    getCtx()  // warm up AudioContext in the click handler (iOS policy)
    const t = buildTrials()
    resultsRef.current = []
    setResults([])
    setTrials(t)
    setTrialIdx(0)
    setRepStart(null)
    setRepDuration(null)
    setPhase('ready')
    startSession(userId).then(id => { sessionIdRef.current = id })
  }

  // Ready: 1 s pause → start tone → begin watching
  useEffect(() => {
    if (phase !== 'ready') return
    readyTimerRef.current = setTimeout(() => {
      breathStartRef.current = Date.now()
      playTone(220, 1.8)
      setPhase('watching')
    }, 1000)
    return () => clearTimeout(readyTimerRef.current)
  }, [phase, trialIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Watching: interval timer — ContactAvatar drives its own breath animation
  useEffect(() => {
    if (phase !== 'watching' || !trial) return

    watchTimerRef.current = setTimeout(() => {
      playTone(370, 1.2)
      setPhase('gap')
    }, trial.targetMs)

    return () => clearTimeout(watchTimerRef.current)
  }, [phase, trialIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Gap: brief pause then open reproduce
  useEffect(() => {
    if (phase !== 'gap') return
    gapTimerRef.current = setTimeout(() => setPhase('reproducing'), 1200)
    return () => clearTimeout(gapTimerRef.current)
  }, [phase])

  // Ring pulse during active reproduction
  useEffect(() => {
    if (phase !== 'reproducing' || !repStart) { setRingScale(1); return }
    let t = 0
    const tick = () => {
      t += 1 / 60
      setRingScale(1 + 0.07 * Math.sin(t * Math.PI * 2 / 3))
      ringRafRef.current = requestAnimationFrame(tick)
    }
    ringRafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(ringRafRef.current)
  }, [phase, repStart])

  function handleReproduce() {
    if (!repStart) {
      setRepStart(Date.now())
    } else {
      const dur      = Date.now() - repStart
      const ratio    = dur / trial.targetMs
      const absError = Math.abs(dur - trial.targetMs)
      const result   = { targetMs: trial.targetMs, reproducedMs: dur, ratio, absError, emotionId: trial.emotionId, emotionName: trial.emotionName, zone: trial.zone }

      resultsRef.current = [...resultsRef.current, result]
      setResults([...resultsRef.current])
      setRepStart(null)
      setRepDuration(dur)
      cancelAnimationFrame(ringRafRef.current)
      setRingScale(1)

      saveTrialResult({ sessionId: sessionIdRef.current, trialNum: trialIdx + 1, trial, reproducedMs: dur, ratio, absError })
      setPhase('feedback')
    }
  }

  function advanceFromFeedback() {
    setRepDuration(null)
    if (trialIdx + 1 < trials.length) {
      setTrialIdx(i => i + 1)
      setPhase('ready')
    } else {
      const all       = resultsRef.current
      const meanRatio = all.reduce((s, r) => s + r.ratio, 0) / all.length
      const meanErr   = all.reduce((s, r) => s + r.absError, 0) / all.length
      saveSessionComplete({ sessionId: sessionIdRef.current, userId, meanRatio, meanAbsError: meanErr })
      setPhase('summary')
    }
  }

  // Keep keyHandlerRef current so the listener never goes stale
  keyHandlerRef.current = (e) => {
    if (e.code !== 'Space') return
    e.preventDefault()
    if (phase === 'intro')       startGame()
    if (phase === 'reproducing') handleReproduce()
    if (phase === 'feedback')    advanceFromFeedback()
  }

  useEffect(() => {
    function onKey(e) { keyHandlerRef.current?.(e) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(ringRafRef.current)
    clearTimeout(readyTimerRef.current)
    clearTimeout(watchTimerRef.current)
    clearTimeout(gapTimerRef.current)
  }, [])

  return (
    <div style={{ background: '#FCF0F5', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', userSelect: 'none' }}>

        {phase === 'intro' && <IntroScreen onStart={startGame} />}

        {(phase === 'ready' || phase === 'watching' || phase === 'gap') && trial && (
          <WatchingScreen
            trialIdx={trialIdx} totalTrials={trials.length}
            mode={phase}
            skinColor={avatar.skinColor} eyeColor={avatar.eyeColor} species={avatar.species}
            getPhase={getPhase}
          />
        )}

        {phase === 'reproducing' && trial && (
          <ReproduceScreen
            trialIdx={trialIdx} totalTrials={trials.length}
            isActive={!!repStart} ringScale={ringScale} onPress={handleReproduce}
            skinColor={avatar.skinColor} eyeColor={avatar.eyeColor} species={avatar.species}
            getPhase={getPhase}
          />
        )}

        {phase === 'feedback' && trial && repDuration != null && (
          <FeedbackPanel
            targetMs={trial.targetMs} reproducedMs={repDuration}
            trialIdx={trialIdx} totalTrials={trials.length}
            onNext={advanceFromFeedback}
          />
        )}

        {phase === 'summary' && results.length > 0 && (
          <SummaryScreen results={results} onPlay={() => setPhase('intro')} />
        )}
      </div>
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  eyebrow:    { fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#abadb0', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 },
  h1:         { fontFamily: 'DM Serif Display,serif', fontSize: 28, color: '#1c1c1e', fontWeight: 400, margin: '0 0 8px' },
  sub:        { color: '#888', fontSize: 13, marginBottom: 28, lineHeight: 1.6 },
  card:       { background: 'white', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', marginBottom: 20, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 },
  phase:      { fontFamily: 'DM Serif Display,serif', fontSize: 22, color: '#1c1c1e', fontWeight: 400, margin: 0 },
  faceCard:   { background: 'white', borderRadius: 20, padding: '18px 16px 14px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hint:       { fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#C8B0BC', letterSpacing: '0.08em', textAlign: 'center', margin: 0 },
  btnPrimary: { background: '#f068a4', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontFamily: 'DM Sans,sans-serif', fontSize: 15, fontWeight: 500, cursor: 'pointer', display: 'block', width: '100%' },
  btnOutline: { background: 'white', color: '#f068a4', border: '1.5px solid #f068a4', borderRadius: 12, padding: 11, fontFamily: 'DM Sans,sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
}
