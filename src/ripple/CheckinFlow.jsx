import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAvatarConfig } from '../hooks/useAvatarConfig'
import {
  EMOTIONS, INTENSITY_LABELS, computeRating, getCompositeLabel, LABEL_TO_ID,
} from '../games/StillWater/constants'
import WheelSVG from '../games/StillWater/WheelSVG'
import RippleAvatar from './RippleAvatar'
import Nav from '../components/Nav'
import { supabase as globalSupabase } from '../lib/supabase'

// ── CheckinFlow ───────────────────────────────────────────────────────────────
// Ripple WP3 — two-diagonal circumplex check-in.
// Phases: phase1 (Sad↔Excited) → phase2 (Calm↔Tense) → reveal (RippleAvatar with FACS)
// Saves to ripple_checkins; updates ripples streak + profiles.points (+5).
//
// Props:
//   session     — Supabase session (for userId)
//   context     — 'onboarding' | 'login_prompt' | 'manual'  (default 'manual')
//   onComplete  — optional callback after save; if omitted, navigates to /dashboard
//   showNav     — show the Nav header (false when embedded in WelcomeFlow)

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const intensityFromZone = z => [0.33, 0.67, 1.0][z] ?? 1

async function saveCheckin({ supabase, userId, context, p1Sel, p2Sel, composite }) {
  const pad = n => String(n).padStart(2, '0')
  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const yest = new Date(now)
  yest.setDate(yest.getDate() - 1)
  const yesterday = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`
  const f = x => parseFloat(x.toFixed(4))

  const { error: ciErr } = await supabase.from('ripple_checkins').upsert({
    user_id:         userId,
    local_date:      today,
    context,
    pos_rating:      p1Sel.rating, pos_x: f(p1Sel.x), pos_y: f(p1Sel.y),
    neg_rating:      p2Sel.rating, neg_x: f(p2Sel.x), neg_y: f(p2Sel.y),
    composite_x:     f(composite.cx),
    composite_y:     f(composite.cy),
    composite_label: composite.label,
    ambivalence_x:   f(composite.ambX),
    ambivalence_y:   f(composite.ambY),
    ambivalence_mag: f(composite.ambMag),
  }, { onConflict: 'user_id,local_date' })
  if (ciErr) console.warn('ripple_checkins upsert:', ciErr)

  // Streak update
  const { data: rpl } = await supabase
    .from('ripples').select('streak_current, streak_best, last_checkin_on')
    .eq('user_id', userId).maybeSingle()

  const prev = rpl?.last_checkin_on ?? null
  const newStreak = prev === today    ? (rpl?.streak_current ?? 1)
                  : prev === yesterday ? (rpl?.streak_current ?? 0) + 1
                  : 1
  const newBest = Math.max(rpl?.streak_best ?? 0, newStreak)
  await supabase.from('ripples').update({
    last_checkin_on: today, streak_current: newStreak, streak_best: newBest,
  }).eq('user_id', userId)

  // Points
  const { data: profile } = await supabase.from('profiles').select('points').eq('id', userId).single()
  const newPoints = (profile?.points ?? 0) + 5
  await supabase.from('profiles').update({ points: newPoints }).eq('id', userId)
  return { newStreak, newBest, pointsTotal: newPoints }
}

// ── RatingStep ────────────────────────────────────────────────────────────────

function RatingStep({ phase, activeIds, labels, skinColor, eyeColor, species, hairStyle, hairColor, onConfirm }) {
  const [sel, setSel] = useState(null)
  const [hov, setHov] = useState(null)

  const handleZone = useCallback(({ emotion, zone }) => {
    const { rating, x, y } = computeRating(phase, emotion.id, zone)
    setSel({ emotionId: emotion.id, zone, rating, x, y, neutral: false })
  }, [phase])

  const handleNeutral = useCallback(() =>
    setSel({ emotionId: null, zone: null, rating: 4, x: 0, y: 0, neutral: true }), [])

  const selEmotion = sel?.emotionId != null ? EMOTIONS.find(e => e.id === sel.emotionId) : null
  const faceValence   = selEmotion?.valence ?? 0
  const faceArousal   = selEmotion?.arousal ?? 0
  const faceIntensity = selEmotion && !sel.neutral ? intensityFromZone(sel.zone ?? 0) : 0
  const facePupil     = selEmotion?.pupilTier ?? 1
  const faceGlow      = selEmotion?.outer ?? null

  return (
    <div style={S.stepWrap}>
      {/* Step dots */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[1, 2].map(s => (
          <div key={s} style={{ width: s === phase ? 24 : 8, height: 8, borderRadius: 4, background: s === phase ? '#f068a4' : '#E8D0E0', transition: 'width 0.3s' }} />
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={S.eyebrow}>Step {phase} of 2</p>
        <h2 style={S.ratingQ}>{labels.question}</h2>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        <WheelSVG activeIds={activeIds} selection={sel} hovered={hov}
          onHover={setHov} onZoneClick={handleZone} onNeutral={handleNeutral} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 156 }}>
          <div style={S.faceCard}>
            <RippleAvatar
              skinColor={skinColor} eyeColor={eyeColor} species={species}
              hairStyle={hairStyle} hairColor={hairColor}
              valence={faceValence} arousal={faceArousal}
              intensityT={faceIntensity} pupilTier={facePupil}
              glowColor={faceGlow} size={136}
            />
            <div style={{ textAlign: 'center', minHeight: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {sel ? (<>
                <div style={{ fontFamily: SERIF, fontSize: 14, color: '#1c1c1e' }}>
                  {sel.neutral ? 'neutral' : EMOTIONS.find(e => e.id === sel.emotionId)?.name}
                </div>
                {!sel.neutral && (
                  <div style={{ fontFamily: MONO, fontSize: 11, color: '#abadb0', marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {INTENSITY_LABELS[sel.zone + 1]}
                  </div>
                )}
              </>) : (
                <div style={{ color: '#C8B0BC', fontSize: 12, fontStyle: 'italic', fontFamily: SANS }}>tap the wheel</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scale */}
      <div style={{ width: 308, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: SANS, fontSize: 12, color: '#888', width: 48, textAlign: 'right', flexShrink: 0 }}>{labels.left}</span>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: '#E8D0E0', transform: 'translateY(-50%)', borderRadius: 1 }} />
          {[1, 2, 3, 4, 5, 6, 7].map(d => {
            const isS = (sel && !sel.neutral && sel.rating === d) || (d === 4 && sel?.neutral)
            return <div key={d} style={{ width: isS ? 14 : 8, height: isS ? 14 : 8, borderRadius: '50%', background: isS ? '#f068a4' : '#E8D0E0', border: isS ? '2px solid white' : 'none', boxShadow: isS ? '0 0 0 2px #f068a4' : 'none', position: 'relative', zIndex: 1, transition: 'all 0.15s' }} />
          })}
        </div>
        <span style={{ fontFamily: SANS, fontSize: 12, color: '#888', width: 48, flexShrink: 0 }}>{labels.right}</span>
      </div>

      {sel && (
        <button style={{ ...S.btn, width: 308 }} onClick={() => onConfirm(sel)}>
          {phase === 1 ? 'Next →' : 'See result →'}
        </button>
      )}
    </div>
  )
}

// ── RevealStep ────────────────────────────────────────────────────────────────

function RevealStep({ composite, p1Sel, p2Sel, rippleName, rewardData, skinColor, eyeColor, species, hairStyle, hairColor, saveDone, onContinue }) {
  const [anim, setAnim] = useState(0)
  const animRef = useRef(null)

  useEffect(() => {
    const pause = setTimeout(() => {
      let t0 = null
      const tick = ts => {
        if (!t0) t0 = ts
        const t = Math.min(1, (ts - t0) / 1000)
        setAnim(1 - Math.pow(1 - t, 3))
        if (t < 1) animRef.current = requestAnimationFrame(tick)
      }
      animRef.current = requestAnimationFrame(tick)
    }, 600)
    return () => { clearTimeout(pause); cancelAnimationFrame(animRef.current) }
  }, [])

  const { label, zone, sectorId, cx, cy, mag } = composite
  const em = sectorId >= 0 ? EMOTIONS[sectorId] : null
  const valence    = em ? em.valence * anim : 0
  const arousal    = em ? em.arousal * anim : 0
  const intensityT = em ? intensityFromZone(zone) * anim : 0
  const pupilTier  = em?.pupilTier ?? 1
  const glowColor  = anim > 0.6 && em ? em.outer : null

  const p1EmName = p1Sel?.neutral ? 'neutral' : (EMOTIONS.find(e => e.id === p1Sel?.emotionId)?.name?.toLowerCase() ?? '')
  const p2EmName = p2Sel?.neutral ? 'neutral' : (EMOTIONS.find(e => e.id === p2Sel?.emotionId)?.name?.toLowerCase() ?? '')
  const p1Int = !p1Sel?.neutral && p1Sel?.zone != null ? INTENSITY_LABELS[p1Sel.zone + 1] : null
  const p2Int = !p2Sel?.neutral && p2Sel?.zone != null ? INTENSITY_LABELS[p2Sel.zone + 1] : null

  const heading = anim < 1
    ? 'Reading your mood…'
    : label === 'neutral'
      ? (rippleName ? `${rippleName} is balanced` : 'Feeling balanced')
      : (rippleName ? `${rippleName} feels ${label.toLowerCase()}` : `Feeling ${label.toLowerCase()}`)

  return (
    <div style={S.stepWrap}>
      <div style={{ textAlign: 'center' }}>
        <p style={S.eyebrow}>{rippleName ?? 'Your Ripple'}</p>
        <h2 style={{ fontFamily: SERIF, fontSize: 22, color: '#1c1c1e', fontWeight: 400, margin: 0 }}>{heading}</h2>
        {anim >= 1 && zone >= 0 && label !== 'neutral' && (
          <p style={{ fontFamily: MONO, fontSize: 12, color: '#abadb0', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>
            {INTENSITY_LABELS[zone + 1]}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        <WheelSVG activeIds={null} selection={null} hovered={null}
          onHover={() => {}} onZoneClick={() => {}} onNeutral={() => {}}
          revealData={anim > 0.25 ? { cx, cy, mag, sectorId, zone } : null}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 156 }}>
          <div style={S.faceCard}>
            <RippleAvatar
              skinColor={skinColor} eyeColor={eyeColor} species={species}
              hairStyle={hairStyle} hairColor={hairColor}
              valence={valence} arousal={arousal} intensityT={intensityT} pupilTier={pupilTier}
              glowColor={glowColor} size={136}
            />
          </div>
          {anim >= 1 && (
            <div style={{ background: 'white', borderRadius: 13, padding: '10px 12px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', fontFamily: MONO, fontSize: 12, lineHeight: 2, color: '#abadb0' }}>
              <div><span style={{ color: '#d0b8c8' }}>energy  </span>{p1EmName}{p1Int ? ` · ${p1Int}` : ''}</div>
              <div><span style={{ color: '#d0b8c8' }}>tension </span>{p2EmName}{p2Int ? ` · ${p2Int}` : ''}</div>
              <div style={{ borderTop: '1px solid #f0e8ec', marginTop: 4, paddingTop: 4 }}>
                <span style={{ color: '#d0b8c8' }}>streak  </span>
                {rewardData != null ? `${rewardData.newStreak}d` : '…'}
              </div>
              <div>
                <span style={{ color: '#d0b8c8' }}>points  </span>
                {rewardData != null ? '+5' : '…'}
              </div>
            </div>
          )}
        </div>
      </div>

      {anim >= 1 && (
        <button
          style={{
            ...S.btn, width: 308,
            background:  saveDone ? '#f068a4' : '#E8D0E0',
            boxShadow:   saveDone ? '0 4px 20px rgba(240,104,164,0.30)' : 'none',
            cursor:      saveDone ? 'pointer' : 'default',
            transition:  'background 0.3s, box-shadow 0.3s',
          }}
          onClick={saveDone ? onContinue : undefined}
          disabled={!saveDone}
        >
          Continue →
        </button>
      )}
    </div>
  )
}

// ── CheckinFlow ───────────────────────────────────────────────────────────────

export default function CheckinFlow({ session, context = 'manual', onComplete, showNav = false }) {
  const db      = globalSupabase
  const userId  = session?.user?.id ?? null
  const navigate = useNavigate()

  const [phase,      setPhase]      = useState('phase1')
  const [p1Sel,      setP1Sel]      = useState(null)
  const [p2Sel,      setP2Sel]      = useState(null)
  const [saveDone,   setSaveDone]   = useState(false)
  const [rippleName, setRippleName] = useState(null)
  const [rewardData, setRewardData] = useState(null)

  const { data: avatar } = useAvatarConfig(userId)
  const skinColor = avatar?.skin_color ?? '#FDBCB4'
  const eyeColor  = avatar?.eye_color  ?? '#4A90D9'
  const species   = avatar?.species    ?? 'human'
  const hairStyle = avatar?.hair_style ?? 'none'
  const hairColor = avatar?.hair_color ?? '#784421'

  const composite = useMemo(() => {
    if (!p1Sel || !p2Sel) return null
    const cx = (p1Sel.x + p2Sel.x) / 2
    const cy = (p1Sel.y + p2Sel.y) / 2
    const mag = Math.sqrt(cx * cx + cy * cy)
    const label = getCompositeLabel(cx, cy)
    const sectorId = LABEL_TO_ID[label] ?? -1
    const p1Zone = p1Sel.neutral ? 0 : (p1Sel.zone ?? 0)
    const p2Zone = p2Sel.neutral ? 0 : (p2Sel.zone ?? 0)
    const zone = label === 'neutral' ? 0 : Math.round((p1Zone + p2Zone) / 2)
    const ambX = Math.abs(p1Sel.x - p2Sel.x)
    const ambY = Math.abs(p1Sel.y - p2Sel.y)
    const ambMag = Math.sqrt((p1Sel.x - p2Sel.x) ** 2 + (p1Sel.y - p2Sel.y) ** 2)
    return { cx, cy, mag, label, sectorId, zone, ambX, ambY, ambMag }
  }, [p1Sel, p2Sel])

  useEffect(() => {
    if (!userId) return
    db.from('ripples').select('name').eq('user_id', userId).maybeSingle()
      .then(({ data }) => setRippleName(data?.name ?? null))
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'reveal' || !composite || !userId) return
    setSaveDone(false)
    setRewardData(null)
    saveCheckin({ supabase: db, userId, context, p1Sel, p2Sel, composite })
      .then(reward => { setRewardData(reward); setSaveDone(true) })
      .catch(err => { console.warn('saveCheckin:', err); setSaveDone(true) })
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleContinue() {
    if (onComplete) onComplete()
    else navigate('/dashboard', { replace: true })
  }

  const inner = (
    <div style={{
      minHeight: showNav ? 'calc(100vh - 57px)' : undefined,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', userSelect: 'none',
    }}>
      {phase === 'phase1' && (
        <RatingStep phase={1} activeIds={[1, 5]}
          labels={{ left: 'Sad', right: 'Excited', question: 'How good or energised do you feel?' }}
          skinColor={skinColor} eyeColor={eyeColor} species={species} hairStyle={hairStyle} hairColor={hairColor}
          onConfirm={s => { setP1Sel(s); setPhase('phase2') }} />
      )}
      {phase === 'phase2' && (
        <RatingStep phase={2} activeIds={[3, 7]}
          labels={{ left: 'Calm', right: 'Tense', question: 'How settled or on-edge do you feel?' }}
          skinColor={skinColor} eyeColor={eyeColor} species={species} hairStyle={hairStyle} hairColor={hairColor}
          onConfirm={s => { setP2Sel(s); setPhase('reveal') }} />
      )}
      {phase === 'reveal' && composite && (
        <RevealStep composite={composite} p1Sel={p1Sel} p2Sel={p2Sel}
          rippleName={rippleName} rewardData={rewardData}
          skinColor={skinColor} eyeColor={eyeColor} species={species}
          hairStyle={hairStyle} hairColor={hairColor}
          saveDone={saveDone} onContinue={handleContinue} />
      )}
    </div>
  )

  if (showNav) return (
    <div style={{ background: '#FCF0F5', minHeight: '100vh' }}>
      <Nav session={session} />
      {inner}
    </div>
  )
  return inner
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  stepWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', maxWidth: 520 },
  eyebrow:  { fontFamily: MONO, fontSize: 12, color: '#abadb0', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 6px' },
  ratingQ:  { fontFamily: SERIF, fontSize: 20, color: '#1c1c1e', fontWeight: 400, margin: 0 },
  faceCard: { background: 'white', borderRadius: 18, padding: '12px 10px 10px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  btn:      { background: '#f068a4', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.30)' },
}
