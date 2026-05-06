import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import { supabase } from '../../lib/supabase'
import { EMOTIONS, INTENSITY_LABELS, computeRating, getCompositeLabel, LABEL_TO_ID,
         CX, CY, INNER_R, d2r } from './constants'
import WheelSVG from './WheelSVG'
import ExpressiveAvatar from './ExpressiveAvatar'
import ContactAvatar from '../FirstContact/components/ContactAvatar'

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
    gain.gain.linearRampToValueAtTime(0.10, t + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.001, t + decaySec)
    osc.start(t); osc.stop(t + decaySec + 0.05)
  } catch (_) {}
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────

async function saveResult({ userId, p1Sel, p2Sel, composite }) {
  const f = x => parseFloat(x.toFixed(4))
  const { error } = await supabase.from('stillwater_responses').insert({
    participant_id:   userId,
    pos_rating:       p1Sel.rating,  pos_x: f(p1Sel.x),      pos_y: f(p1Sel.y),
    neg_rating:       p2Sel.rating,  neg_x: f(p2Sel.x),      neg_y: f(p2Sel.y),
    composite_x:      f(composite.cx),
    composite_y:      f(composite.cy),
    composite_label:  composite.label,
    ambivalence_x:    f(composite.ambX),
    ambivalence_y:    f(composite.ambY),
    ambivalence_mag:  f(composite.ambMag),
  })
  if (error) console.warn('StillWater insert:', error)

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles').select('still_water_sessions, points').eq('id', userId).single()
    const updates = { still_water_sessions: (profile?.still_water_sessions ?? 0) + 1 }
    if (profile?.points !== undefined) updates.points = (profile.points ?? 0) + 5
    await supabase.from('profiles').update(updates).eq('id', userId)
  }
}

// ─── INTRO ────────────────────────────────────────────────────────────────────

function IntroScreen({ onStart }) {
  const R = 70, CX2 = 92, CY2 = 92
  const mkPt = ang => ({ x: CX2 + R * Math.cos(d2r(ang)), y: CY2 + R * Math.sin(d2r(ang)) })
  const NE = mkPt(-45), SW = mkPt(135), SE = mkPt(45), NW = mkPt(-135)
  const trim = 10
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

  return (
    <div style={{ maxWidth: 380, textAlign: 'center', padding: '0 16px' }}>
      <p style={S.eyebrow}>RADlab · Come, See</p>
      <h1 style={S.introH1}>How are you arriving?</h1>
      <p style={S.introSub}>
        Two quick questions about how you feel.<br />
        We'll combine your answers into one picture.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <svg viewBox="-12 0 208 184" width="208" height="184">
          <defs>
            <marker id="a1e" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M 0 0 L 8 3 L 0 6 z" fill="#C4A000" /></marker>
            <marker id="a1s" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto"><path d="M 8 0 L 0 3 L 8 6 z" fill="#C4A000" /></marker>
            <marker id="a2e" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M 0 0 L 8 3 L 0 6 z" fill="#804080" /></marker>
            <marker id="a2s" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto"><path d="M 8 0 L 0 3 L 8 6 z" fill="#804080" /></marker>
          </defs>
          <circle cx={CX2} cy={CY2} r={R} fill="none" stroke="#E8D0E0" strokeWidth="1.5" />
          <line x1={lerp(SW, NE, trim / 100).x} y1={lerp(SW, NE, trim / 100).y}
                x2={lerp(NE, SW, trim / 100).x} y2={lerp(NE, SW, trim / 100).y}
            stroke="#C4A000" strokeWidth="2.2" opacity="0.75"
            markerEnd="url(#a1e)" markerStart="url(#a1s)" />
          <line x1={lerp(SE, NW, trim / 100).x} y1={lerp(SE, NW, trim / 100).y}
                x2={lerp(NW, SE, trim / 100).x} y2={lerp(NW, SE, trim / 100).y}
            stroke="#804080" strokeWidth="2.2" opacity="0.75"
            markerEnd="url(#a2e)" markerStart="url(#a2s)" />
          <text x={NE.x + 7}  y={NE.y + 1}  fontSize="12" fill="#C4A000" fontFamily="DM Sans,sans-serif" fontWeight="500">Excited</text>
          <text x={SW.x - 7}  y={SW.y + 12} fontSize="12" fill="#C4A000" fontFamily="DM Sans,sans-serif" fontWeight="500" textAnchor="end">Sad</text>
          <text x={NW.x - 7}  y={NW.y + 1}  fontSize="12" fill="#804080" fontFamily="DM Sans,sans-serif" fontWeight="500" textAnchor="end">Tense</text>
          <text x={SE.x + 7}  y={SE.y + 14} fontSize="12" fill="#804080" fontFamily="DM Sans,sans-serif" fontWeight="500">Calm</text>
          <circle cx={CX2} cy={CY2} r="4.5" fill="#FCF0F5" stroke="#d0b8c8" strokeWidth="1.2" />
        </svg>
      </div>

      <div style={S.introCard}>
        {[
          { n: 1, bg: '#FFF0B8', c: '#D88000', title: 'Sad to Excited', body: 'How good or energised are you feeling?' },
          { n: 2, bg: '#EDE0F4', c: '#804080', title: 'Calm to Tense',  body: 'How settled or on-edge are you feeling?' },
        ].map(({ n, bg, c, title, body }) => (
          <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ background: bg, borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Space Mono,monospace', fontSize: 12, color: c, fontWeight: 700 }}>{n}</div>
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

// ─── RATING SCREEN ────────────────────────────────────────────────────────────

function RatingScreen({ phase, activeIds, labels, onConfirm, skinColor, eyeColor, species, getPhase }) {
  const [sel, setSel] = useState(null)
  const [hov, setHov] = useState(null)
  const avatarCtrl = useRef(null)

  // Start breathing as soon as ContactAvatar has built its SVG
  useEffect(() => {
    if (avatarCtrl.current) avatarCtrl.current.resumeAnimation()
  }, [])

  const handleZone = useCallback(({ emotion, zone }) => {
    const { rating, x, y } = computeRating(phase, emotion.id, zone)
    setSel({ emotionId: emotion.id, zone, rating, x, y, neutral: false })
  }, [phase])

  const handleNeutral = useCallback(() => setSel({ emotionId: null, zone: null, rating: 4, x: 0, y: 0, neutral: true }), [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', maxWidth: 520 }}>
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

        {/* Breathing avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 156 }}>
          <div style={S.faceCard}>
            <ContactAvatar
              size={136}
              skinColor={skinColor} eyeColor={eyeColor} species={species}
              getPhase={getPhase}
              isFirstContact={false} isComplete={true}
              controlRef={avatarCtrl}
            />
            <div style={{ textAlign: 'center', minHeight: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {sel ? (<>
                <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 14, color: '#1c1c1e', fontWeight: 400 }}>
                  {sel.neutral ? 'neutral' : EMOTIONS.find(e => e.id === sel.emotionId)?.name}
                </div>
                {!sel.neutral && (
                  <div style={{ fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#abadb0', marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {INTENSITY_LABELS[sel.zone + 1]}
                  </div>
                )}
              </>) : (
                <div style={{ color: '#C8B0BC', fontSize: 12, fontStyle: 'italic' }}>tap the wheel</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scale */}
      <div style={{ width: 308, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: 'DM Sans,sans-serif', fontSize: 12, color: '#888', width: 48, textAlign: 'right', flexShrink: 0 }}>{labels.left}</span>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: '#E8D0E0', transform: 'translateY(-50%)', borderRadius: 1 }} />
          {[1, 2, 3, 4, 5, 6, 7].map(d => {
            const isS = (sel && !sel.neutral && sel.rating === d) || (d === 4 && sel?.neutral)
            return (
              <div key={d} style={{ width: isS ? 14 : 8, height: isS ? 14 : 8, borderRadius: '50%', background: isS ? '#f068a4' : '#E8D0E0', border: isS ? '2px solid white' : 'none', boxShadow: isS ? '0 0 0 2px #f068a4' : 'none', position: 'relative', zIndex: 1, transition: 'all 0.15s' }} />
            )
          })}
        </div>
        <span style={{ fontFamily: 'DM Sans,sans-serif', fontSize: 12, color: '#888', width: 48, flexShrink: 0 }}>{labels.right}</span>
      </div>

      {sel && (
        <button style={{ ...S.btnPrimary, width: 308 }} onClick={() => onConfirm(sel)}>
          {phase === 1 ? 'Next →' : 'See my result →'}
        </button>
      )}
    </div>
  )
}

// ─── REVEAL SCREEN ────────────────────────────────────────────────────────────

function RevealScreen({ composite, phase1Sel, phase2Sel, animProgress, onReset, skinColor, eyeColor }) {
  const { cx, cy, label, mag, sectorId, zone } = composite
  const p  = animProgress
  const em = sectorId >= 0 ? EMOTIONS[sectorId] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', maxWidth: 360 }}>
      <div style={{ textAlign: 'center' }}>
        <p style={S.eyebrow}>Your result</p>
        <h2 style={S.revealH2}>
          {p < 1 ? 'Reading your mood…' : label === 'neutral' ? 'Feeling balanced' : `Feeling ${label.toLowerCase()}`}
        </h2>
        {p >= 1 && zone >= 0 && (
          <p style={{ fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#abadb0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {INTENSITY_LABELS[zone + 1]}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        <WheelSVG activeIds={null} selection={null} hovered={null}
          onHover={() => {}} onZoneClick={() => {}} onNeutral={() => {}}
          revealData={p > 0.25 ? { cx, cy, mag, sectorId, zone } : null} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 156 }}>
          <div style={S.faceCard}>
            <ExpressiveAvatar size={136} valence={cx * p} arousal={cy * p}
              intensityT={Math.min(1, mag * p)} pupilTier={p > 0.5 ? (em?.pupilTier ?? 1) : 1}
              glowColor={p > 0.75 && em ? em.outer : null}
              skinColor={skinColor} eyeColor={eyeColor} />
          </div>
          {p >= 1 && (
            <div style={S.statsCard}>
              <div><span style={S.statKey}>step 1  </span>{phase1Sel.rating}/7</div>
              <div><span style={S.statKey}>step 2  </span>{phase2Sel.rating}/7</div>
              <div><span style={S.statKey}>valence </span>{cx >= 0 ? '+' : ''}{cx.toFixed(2)}</div>
              <div><span style={S.statKey}>arousal </span>{cy >= 0 ? '+' : ''}{cy.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>

      {p >= 1 && (
        <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 308 }}>
          <button style={{ ...S.btnOutline, flex: 1 }} onClick={onReset}>Again</button>
          <Link to="/games" style={{ ...S.btnPrimary, flex: 1, textAlign: 'center', textDecoration: 'none' }}>Games →</Link>
        </div>
      )}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function StillWater({ session }) {
  const [phase,  setPhase]  = useState('intro')
  const [p1Sel,  setP1Sel]  = useState(null)
  const [p2Sel,  setP2Sel]  = useState(null)
  const [anim,   setAnim]   = useState(0)
  const [avatar, setAvatar] = useState({ skinColor: '#FDBCB4', eyeColor: '#4A90D9', species: 'human' })
  const animRef      = useRef(null)
  const breathStart  = useRef(Date.now())
  const getPhase     = useCallback(() => ((Date.now() - breathStart.current) % 4000) / 4000, [])

  const userId = session?.user?.id ?? null

  // Fetch profile avatar colours
  useEffect(() => {
    if (!userId) return
    supabase.from('avatars').select('skin_color, eye_color, species').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data) setAvatar({
          skinColor: data.skin_color || '#FDBCB4',
          eyeColor:  data.eye_color  || '#4A90D9',
          species:   data.species    || 'human',
        })
      })
  }, [userId])

  // Tones: start of each rating phase, end on reveal
  useEffect(() => {
    if (phase === 'phase1' || phase === 'phase2') playTone(220, 1.5)
    else if (phase === 'reveal')                  playTone(370, 1.2)
  }, [phase])

  const composite = useMemo(() => {
    if (!p1Sel || !p2Sel) return null
    const cx = (p1Sel.x + p2Sel.x) / 2, cy = (p1Sel.y + p2Sel.y) / 2
    const mag = Math.sqrt(cx * cx + cy * cy)
    const label = getCompositeLabel(cx, cy)
    const sectorId = LABEL_TO_ID[label] ?? -1
    const zone = mag < 0.33 ? 0 : mag < 0.67 ? 1 : 2
    const ambX = Math.abs(p1Sel.x - p2Sel.x), ambY = Math.abs(p1Sel.y - p2Sel.y)
    const ambMag = Math.sqrt((p1Sel.x - p2Sel.x) ** 2 + (p1Sel.y - p2Sel.y) ** 2)
    return { cx, cy, mag, label, sectorId, zone, ambX, ambY, ambMag }
  }, [p1Sel, p2Sel])

  // Save on reveal start
  useEffect(() => {
    if (phase !== 'reveal' || !composite || !p1Sel || !p2Sel) return
    saveResult({ userId, p1Sel, p2Sel, composite })
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reveal animation: 0.6s pause → 1s ease-out cubic
  useEffect(() => {
    if (phase !== 'reveal') { setAnim(0); return }
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
  }, [phase])

  const handleReset = useCallback(() => {
    setP1Sel(null); setP2Sel(null); setAnim(0); setPhase('intro')
  }, [])

  return (
    <div style={{ background: '#FCF0F5', minHeight: '100vh' }}>
      <Nav session={session} />
      <div style={{ minHeight: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', userSelect: 'none' }}>
        {phase === 'intro'   && <IntroScreen onStart={() => { getCtx(); setPhase('phase1') }} />}
        {phase === 'phase1'  && (
          <RatingScreen phase={1} activeIds={[1, 5]}
            labels={{ left: 'Sad', right: 'Excited', question: 'How good or energised do you feel?' }}
            onConfirm={s => { setP1Sel(s); setPhase('phase2') }}
            skinColor={avatar.skinColor} eyeColor={avatar.eyeColor} species={avatar.species} getPhase={getPhase} />
        )}
        {phase === 'phase2'  && (
          <RatingScreen phase={2} activeIds={[3, 7]}
            labels={{ left: 'Calm', right: 'Tense', question: 'How settled or on-edge do you feel?' }}
            onConfirm={s => { setP2Sel(s); setPhase('reveal') }}
            skinColor={avatar.skinColor} eyeColor={avatar.eyeColor} species={avatar.species} getPhase={getPhase} />
        )}
        {phase === 'reveal' && composite && (
          <RevealScreen composite={composite} phase1Sel={p1Sel} phase2Sel={p2Sel}
            animProgress={anim} onReset={handleReset}
            skinColor={avatar.skinColor} eyeColor={avatar.eyeColor} />
        )}
      </div>
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const S = {
  eyebrow:  { fontFamily: 'Space Mono,monospace', fontSize: 12, color: '#abadb0', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 },
  introH1:  { fontFamily: 'DM Serif Display,serif', fontSize: 26, color: '#1c1c1e', fontWeight: 400, margin: '0 0 8px' },
  introSub: { color: '#888', fontSize: 13, marginBottom: 28, lineHeight: 1.6 },
  introCard:{ background: 'white', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', marginBottom: 20, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12 },
  ratingQ:  { fontFamily: 'DM Serif Display,serif', fontSize: 20, color: '#1c1c1e', fontWeight: 400 },
  revealH2: { fontFamily: 'DM Serif Display,serif', fontSize: 22, color: '#1c1c1e', fontWeight: 400, marginBottom: 3 },
  faceCard: { background: 'white', borderRadius: 18, padding: '12px 10px 10px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  statsCard:{ background: 'white', borderRadius: 13, padding: '10px 12px', boxShadow: '0 2px 18px rgba(180,120,160,0.10)', fontFamily: 'Space Mono,monospace', fontSize: 12, lineHeight: 2, color: '#abadb0' },
  statKey:  { color: '#d0b8c8' },
  btnPrimary: { background: '#f068a4', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontFamily: 'DM Sans,sans-serif', fontSize: 15, fontWeight: 500, cursor: 'pointer', display: 'block', width: '100%' },
  btnOutline: { background: 'white', color: '#f068a4', border: '1.5px solid #f068a4', borderRadius: 12, padding: 11, fontFamily: 'DM Sans,sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
}
