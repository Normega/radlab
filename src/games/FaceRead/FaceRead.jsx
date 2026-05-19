import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import { supabase } from '../../lib/supabase'
import { EMOTIONS } from '../StillWater/constants'
import WheelSVG from '../StillWater/WheelSVG'
import AURenderer from '../shared/AURenderer'
import { EXPRESSION_TABLE, ZONE_NAMES, NEUTRAL_POS, AU_NUMERIC_KEYS } from '../shared/expressionTable'

const TRIAL_COUNT  = 10
const ANIM_MS      = 800   // avatar animate neutral → target
const FEEDBACK_MS  = 1200  // hold feedback before advancing
const INTENSITIES  = [1 / 3, 2 / 3, 1.0]
const MAX_DIST     = 2 * Math.sqrt(2)
const ALL_IDS      = EMOTIONS.map(e => e.id)

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function generateTrial() {
  const emotion = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)]
  const zone    = Math.floor(Math.random() * 3)
  return { emotionId: emotion.id, zone, intensityT: INTENSITIES[zone] }
}

function scoreZone(clickedId, clickedZone, correctId, correctZone) {
  const ce = EMOTIONS.find(e => e.id === correctId)
  const cl = EMOTIONS.find(e => e.id === clickedId)
  if (!ce || !cl) return 0
  const ct  = INTENSITIES[correctZone]
  const clt = INTENSITIES[clickedZone]
  const dv  = cl.valence * clt - ce.valence * ct
  const da  = cl.arousal * clt - ce.arousal * ct
  return Math.round(Math.max(0, 100 * (1 - Math.sqrt(dv * dv + da * da) / MAX_DIST)))
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────

async function startSession(userId) {
  if (!userId) return null
  const { data } = await supabase.from('game_sessions').insert({
    user_id:    userId,
    game_name:  'face_read',
    study_id:   null,
    started_at: new Date().toISOString(),
  }).select('id').single()
  return data?.id ?? null
}

async function saveTrialResult({ sessionId, userId, trialNum, targetEmoId, targetZone, clickedEmoId, clickedZone, score, responseTimeMs }) {
  if (!sessionId) return
  await supabase.from('face_read_trials').insert({
    session_id:        sessionId,
    user_id:           userId,
    trial_number:      trialNum,
    target_sector_id:  targetEmoId,
    target_zone:       targetZone,
    clicked_sector_id: clickedEmoId,
    clicked_zone:      clickedZone,
    trial_score:       score,
    response_time_ms:  responseTimeMs,
  })
}

async function saveSessionComplete({ sessionId, userId, meanScore }) {
  if (sessionId) {
    await supabase.from('game_sessions').update({ ended_at: new Date().toISOString() }).eq('id', sessionId)
    await supabase.from('face_read_performance').insert({
      session_id:       sessionId,
      user_id:          userId,
      mean_score:       meanScore,
      trials_completed: TRIAL_COUNT,
    })
  }
  if (userId) {
    const { data: p } = await supabase.from('profiles')
      .select('face_read_sessions, face_read_best_score, points').eq('id', userId).single()
    const updates = {
      face_read_sessions:  (p?.face_read_sessions  ?? 0) + 1,
      face_read_best_score: Math.max(p?.face_read_best_score ?? 0, meanScore),
    }
    if (p?.points !== undefined) updates.points = (p.points ?? 0) + Math.max(1, Math.round(meanScore / 10))
    await supabase.from('profiles').update(updates).eq('id', userId)
  }
}

// ─── INTRO ────────────────────────────────────────────────────────────────────

function IntroScreen({ onStart }) {
  const demos = [
    { eid: 1, zone: 2 },  // Excited strong
    { eid: 6, zone: 1 },  // Bad moderate
    { eid: 4, zone: 0 },  // Still mild
  ]
  return (
    <div style={{ maxWidth: 380, textAlign: 'center', padding: '0 16px' }}>
      <p style={S.eyebrow}>RADlab · Come, See</p>
      <h1 style={S.introH1}>Read the face.</h1>
      <p style={S.introSub}>
        A face will shift into an expression.<br />
        Match it on the wheel — emotion and intensity.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 24 }}>
        {demos.map(({ eid, zone }) => {
          const em = EMOTIONS.find(e => e.id === eid)
          return (
            <div key={eid} style={{ textAlign: 'center' }}>
              <AURenderer
                size={80}
                position={EXPRESSION_TABLE[em.name]?.[ZONE_NAMES[zone]] ?? NEUTRAL_POS}
                glowColor={em.outer}
              />
              <div style={{ fontFamily: 'DM Sans,sans-serif', fontSize: 12, color: '#abadb0', marginTop: 4 }}>{em.name}</div>
            </div>
          )
        })}
      </div>

      <div style={S.introCard}>
        {[
          { n: 1, title: 'Watch the face', body: 'It animates from neutral to an emotion over about a second.' },
          { n: 2, title: 'Pick the match', body: 'Tap the wheel sector — ring position sets intensity (inner = mild, outer = strong).' },
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

// ─── TRIAL SCREEN ─────────────────────────────────────────────────────────────

function TrialScreen({ trialNum, target, animProgress, canClick, feedbackData, score, onZoneClick }) {
  const [hov, setHov] = useState(null)
  const emotion = EMOTIONS.find(e => e.id === target.emotionId)

  const glow = animProgress >= 1 && canClick && emotion ? emotion.outer : null
  const targetPos = emotion ? (EXPRESSION_TABLE[emotion.name]?.[ZONE_NAMES[target.zone]] ?? NEUTRAL_POS) : NEUTRAL_POS
  const animPos = {
    ...targetPos,
    ...Object.fromEntries(AU_NUMERIC_KEYS.map(k => [k, (targetPos[k] ?? 0) * animProgress])),
  }

  const activeIds = canClick ? ALL_IDS : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', maxWidth: 520 }}>

      {/* Progress pip row */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {Array.from({ length: TRIAL_COUNT }, (_, i) => (
          <div key={i} style={{
            width: i === trialNum - 1 ? 20 : 7,
            height: 7,
            borderRadius: 4,
            background: i < trialNum - 1 ? '#f068a4' : i === trialNum - 1 ? '#f068a4' : '#E8D0E0',
            opacity: i < trialNum - 1 ? 0.42 : 1,
            transition: 'all 0.25s',
          }} />
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={S.eyebrow}>Trial {trialNum} of {TRIAL_COUNT}</p>
        <h2 style={S.ratingQ}>{canClick ? 'Which feeling is this?' : 'Watch…'}</h2>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>

        {/* Avatar panel */}
        <div style={S.faceCard}>
          <AURenderer size={136} position={animPos} glowColor={glow} />
          <div style={{ textAlign: 'center', minHeight: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {feedbackData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 14, color: '#1c1c1e' }}>
                  {EMOTIONS.find(e => e.id === feedbackData.correctSectorId)?.name}
                  {' '}· zone {feedbackData.correctZone + 1}
                </div>
                <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 13, color: score >= 80 ? '#1EA878' : score >= 50 ? '#D88000' : '#e05080', fontWeight: 600 }}>
                  {score} pts
                </div>
              </div>
            ) : (
              <div style={{ color: canClick ? '#C8B0BC' : '#e8d8e4', fontSize: 12, fontStyle: 'italic' }}>
                {canClick ? 'pick the feeling →' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Wheel */}
        <WheelSVG
          activeIds={activeIds}
          selection={null}
          hovered={hov}
          onHover={setHov}
          onZoneClick={onZoneClick}
          onNeutral={() => {}}
          feedbackData={feedbackData}
        />
      </div>
    </div>
  )
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

function SummaryScreen({ trials, meanScore, bestScore, onPlay }) {
  const perfect = trials.filter(t => t.targetEmoId === t.clickedEmoId && t.targetZone === t.clickedZone).length

  return (
    <div style={{ maxWidth: 460, textAlign: 'center', padding: '0 16px', width: '100%' }}>
      <p style={S.eyebrow}>Game over</p>
      <h1 style={S.introH1}>Score: {Math.round(meanScore)}</h1>
      <p style={S.introSub}>
        {perfect}/{TRIAL_COUNT} exact matches &ensp;&middot;&ensp; Personal best: {Math.round(bestScore)}
      </p>

      <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 2px 18px rgba(180,120,160,0.10)', overflow: 'hidden', marginBottom: 20, textAlign: 'left' }}>
        {trials.map((t, i) => {
          const tgt  = EMOTIONS.find(e => e.id === t.targetEmoId)
          const clk  = EMOTIONS.find(e => e.id === t.clickedEmoId)
          const exact = t.targetEmoId === t.clickedEmoId && t.targetZone === t.clickedZone
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: i < trials.length - 1 ? '1px solid #F4ECF2' : 'none' }}>
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#ccc', width: 20, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, fontSize: 13, color: '#444' }}>
                <span style={{ fontWeight: 500 }}>{tgt?.name}</span> z{t.targetZone + 1}
                {!exact && (
                  <span style={{ color: '#bbb', fontSize: 12 }}> &rarr; {clk?.name} z{t.clickedZone + 1}</span>
                )}
              </div>
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 13, fontWeight: 600, width: 36, textAlign: 'right',
                color: t.score >= 80 ? '#1EA878' : t.score >= 50 ? '#D88000' : '#e05080' }}>
                {t.score}
              </div>
              <div style={{ fontSize: 11, color: '#ccc', width: 40, textAlign: 'right' }}>
                {(t.responseTimeMs / 1000).toFixed(1)}s
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...S.btnOutline, flex: 1 }} onClick={onPlay}>Again</button>
        <Link to="/games" style={{ ...S.btnPrimary, flex: 1, textAlign: 'center', textDecoration: 'none' }}>Games &rarr;</Link>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function FaceRead({ session }) {
  const [phase,        setPhase]        = useState('intro')
  const [trialNum,     setTrialNum]     = useState(1)
  const [target,       setTarget]       = useState(null)
  const [animProg,     setAnimProg]     = useState(0)
  const [canClick,     setCanClick]     = useState(false)
  const [feedbackData, setFeedbackData] = useState(null)
  const [lastScore,    setLastScore]    = useState(0)
  const [trialResults, setTrialResults] = useState([])
  const [bestScore,    setBestScore]    = useState(0)

  const animRef         = useRef(null)
  const feedbackRef     = useRef(null)
  const responseTimeRef = useRef(null)
  const sessionIdRef    = useRef(null)
  const trialsRef       = useRef([])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('face_read_best_score').eq('id', userId).single()
      .then(({ data }) => { if (data?.face_read_best_score) setBestScore(data.face_read_best_score) })
  }, [userId])

  function startGame() {
    trialsRef.current = []
    setTrialResults([])
    setTarget(generateTrial())
    setTrialNum(1)
    setAnimProg(0)
    setCanClick(false)
    setFeedbackData(null)
    setLastScore(0)
    setPhase('playing')
    startSession(userId).then(id => { sessionIdRef.current = id })
  }

  // Avatar animation — re-runs each time trialNum changes (or phase enters 'playing')
  useEffect(() => {
    if (phase !== 'playing' || !target) return
    setAnimProg(0)
    setCanClick(false)
    responseTimeRef.current = null
    let t0 = null
    let rafId
    const tick = ts => {
      if (!t0) t0 = ts
      const t      = Math.min(1, (ts - t0) / ANIM_MS)
      const eased  = 1 - Math.pow(1 - t, 3)
      setAnimProg(eased)
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        setCanClick(true)
        responseTimeRef.current = Date.now()
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [phase, trialNum]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleZoneClick = useCallback(({ emotion, zone }) => {
    if (!canClick || feedbackData) return
    const rt    = responseTimeRef.current ? Date.now() - responseTimeRef.current : 0
    const score = scoreZone(emotion.id, zone, target.emotionId, target.zone)

    const result = {
      targetEmoId:   target.emotionId,
      targetZone:    target.zone,
      clickedEmoId:  emotion.id,
      clickedZone:   zone,
      score,
      responseTimeMs: rt,
    }
    trialsRef.current = [...trialsRef.current, result]
    setTrialResults([...trialsRef.current])
    setLastScore(score)
    setFeedbackData({
      correctSectorId: target.emotionId,
      correctZone:     target.zone,
      clickedSectorId: emotion.id,
      clickedZone:     zone,
    })

    saveTrialResult({
      sessionId:    sessionIdRef.current,
      userId,
      trialNum,
      targetEmoId:  target.emotionId,
      targetZone:   target.zone,
      clickedEmoId: emotion.id,
      clickedZone:  zone,
      score,
      responseTimeMs: rt,
    })

    clearTimeout(feedbackRef.current)
    feedbackRef.current = setTimeout(() => {
      if (trialNum < TRIAL_COUNT) {
        setTarget(generateTrial())
        setTrialNum(n => n + 1)
        setFeedbackData(null)
        setLastScore(0)
      } else {
        const all  = trialsRef.current
        const mean = all.reduce((s, t) => s + t.score, 0) / TRIAL_COUNT
        saveSessionComplete({ sessionId: sessionIdRef.current, userId, meanScore: mean })
          .then(() => setBestScore(prev => Math.max(prev, mean)))
        setTrialResults(all)
        setPhase('summary')
      }
    }, FEEDBACK_MS)
  }, [canClick, feedbackData, target, trialNum, userId])

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current)
    clearTimeout(feedbackRef.current)
  }, [])

  const meanScore = trialResults.length > 0
    ? trialResults.reduce((s, t) => s + t.score, 0) / trialResults.length
    : 0

  return (
    <div style={{ background: '#FCF0F5', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', userSelect: 'none' }}>

        {phase === 'intro' && <IntroScreen onStart={startGame} />}

        {phase === 'playing' && target && (
          <TrialScreen
            trialNum={trialNum}
            target={target}
            animProgress={animProg}
            canClick={canClick}
            feedbackData={feedbackData}
            score={lastScore}
            onZoneClick={handleZoneClick}
          />
        )}

        {phase === 'summary' && (
          <SummaryScreen
            trials={trialResults}
            meanScore={meanScore}
            bestScore={Math.max(bestScore, meanScore)}
            onPlay={() => setPhase('intro')}
          />
        )}
      </div>
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  eyebrow:   { fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#abadb0', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 },
  introH1:   { fontFamily: 'DM Serif Display,serif', fontSize: 26, color: '#1c1c1e', fontWeight: 400, margin: '0 0 8px' },
  introSub:  { color: '#888', fontSize: 13, marginBottom: 28, lineHeight: 1.6 },
  introCard: { background: 'white', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', marginBottom: 20, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 },
  ratingQ:   { fontFamily: 'DM Serif Display,serif', fontSize: 20, color: '#1c1c1e', fontWeight: 400 },
  faceCard:  { background: 'white', borderRadius: 18, padding: '12px 10px 10px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 156 },
  btnPrimary: { background: '#f068a4', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontFamily: 'DM Sans,sans-serif', fontSize: 15, fontWeight: 500, cursor: 'pointer', display: 'block', width: '100%' },
  btnOutline: { background: 'white', color: '#f068a4', border: '1.5px solid #f068a4', borderRadius: 12, padding: 11, fontFamily: 'DM Sans,sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
}
