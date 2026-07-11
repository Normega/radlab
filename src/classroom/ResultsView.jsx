import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import WheelSVG from '../games/StillWater/WheelSVG'
import { CX, CY, INNER_R, OUTER_R, EMOTIONS, d2r, centerAngle } from '../games/StillWater/constants'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const WHEEL_SIZE = 308
const ZW = (OUTER_R - INNER_R) / 3
const noop = () => {}

// WheelSVG draws each emotion's wedge at a fixed angular slot (8 equal
// 45deg segments) — that angle does NOT correspond to the emotion's actual
// (valence, arousal): e.g. Alert's wedge points straight up on the wheel,
// but its stored valence/arousal would plot up-and-to-the-left. Positioning
// dots by literal valence/arousal put them in the wrong wedge relative to
// the background. Using the wedge's own angle+zone geometry instead makes a
// dot land exactly where that response actually tapped.
//
// Jittered because there are only 25 possible mood positions (8 emotions x
// 3 zones, + neutral) — without jitter, identical taps stack on the exact
// same pixel and read as a single dot (effectively looking "averaged")
// instead of showing how many responses landed there.
function jitteredPosition(point) {
  if (point.emotion_id == null) {
    // neutral — small jitter within the centre circle, uniform over the disk
    const r = Math.sqrt(Math.random()) * (INNER_R * 0.55)
    const a = Math.random() * Math.PI * 2
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
  }
  const emotion = EMOTIONS.find((e) => e.id === Number(point.emotion_id))
  if (!emotion) return { x: CX, y: CY }
  const zone = Number(point.zone) || 0
  const baseAngle = centerAngle(emotion)
  const baseRadius = INNER_R + (zone + 0.5) * ZW
  const angle = baseAngle + (Math.random() - 0.5) * 24  // +/-12deg — wedge spans ~42deg
  const radius = baseRadius + (Math.random() - 0.5) * (ZW * 0.7)
  return { x: CX + radius * Math.cos(d2r(angle)), y: CY + radius * Math.sin(d2r(angle)) }
}

// WheelSVG's own labeled octant grid (Alert/Excited/Good/Calm/Still/Sad/
// Bad/Tense), faded, as background context — activeIds={null} is its
// non-interactive static-preview mode (the same prop that turned out to
// disable clicks entirely in MoodTap; here that's exactly what we want).
// The scatter overlay uses the identical viewBox/CX/CY so dots land in the
// correct emotion region rather than a separately-scaled grid.
function CircumplexScatter({ points }) {
  const positioned = useMemo(() => points.map((p) => ({ ...p, ...jitteredPosition(p) })), [points])
  return (
    <div style={{ position: 'relative', width: WHEEL_SIZE, height: WHEEL_SIZE, margin: '0 auto' }}>
      <div style={{ opacity: 0.4 }}>
        <WheelSVG activeIds={null} selection={null} hovered={null} onHover={noop} onZoneClick={noop} onNeutral={noop} />
      </div>
      <svg
        width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox="-12 -5 394 380"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        {/* others first so the self dot always draws on top */}
        {positioned.filter((p) => !p.is_self).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={6} fill="var(--gy)" opacity={0.8} stroke="#fff" strokeWidth={1} />
        ))}
        {positioned.filter((p) => p.is_self).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={9} fill="var(--pk)" stroke="#fff" strokeWidth={2} />
        ))}
      </svg>
    </div>
  )
}

function PacingBar({ counts }) {
  const max = Math.max(1, ...counts)
  return (
    <div style={S.pacingWrap}>
      {counts.map((c, i) => (
        <div key={i} style={S.pacingCol}>
          <div style={{ ...S.pacingFill, height: `${(c / max) * 60}px` }} />
          <span style={S.pacingCount}>{c}</span>
        </div>
      ))}
      <div style={S.pacingLabels}><span>Too slow</span><span>Too fast</span></div>
    </div>
  )
}

// Anonymized results via get_checkin_mood_results RPC — checkin_responses
// itself grants no cross-member read, so this is the only way a student
// sees the aggregate at all (own row flagged, others unlinked from identity).
export default function ResultsView({ checkinId }) {
  const [results, setResults] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_checkin_mood_results', { p_checkin_id: checkinId }).then(({ data }) => {
      if (!cancelled) setResults(Array.isArray(data) ? data : [])
    })
    return () => { cancelled = true }
  }, [checkinId])

  if (results === undefined) return <div style={S.wrap}><p style={S.hint}>Loading results…</p></div>

  const moodPoints = results.filter((r) => r.valence !== null && r.valence !== undefined)
  const pacingCounts = [0, 0, 0, 0, 0]
  results.forEach((r) => { if (r.pacing) pacingCounts[r.pacing - 1]++ })
  const hasPacing = pacingCounts.some((c) => c > 0)

  return (
    <div style={S.wrap}>
      <p style={S.eyebrow}>Results</p>
      <h2 style={S.title}>How the room felt</h2>

      {moodPoints.length > 0 && (
        <div style={S.section}>
          <CircumplexScatter points={moodPoints} />
          <p style={S.legend}><span style={S.legendSelf} /> you &nbsp;&nbsp; <span style={S.legendOther} /> everyone else</p>
        </div>
      )}

      {hasPacing && (
        <div style={S.section}>
          <p style={S.subLabel}>Pacing</p>
          <PacingBar counts={pacingCounts} />
        </div>
      )}

      {!moodPoints.length && !hasPacing && <p style={S.hint}>No results to show for this check-in.</p>}
    </div>
  )
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 20px', maxWidth: 380, margin: '0 auto' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  title: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', marginBottom: 16 },
  hint: { fontSize: 13, color: 'var(--tx3)' },
  section: { marginBottom: 20 },
  legend: { fontSize: 12, color: 'var(--tx3)', marginTop: 8 },
  legendSelf: { display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: 'var(--pk)', marginRight: 4 },
  legendOther: { display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: 'var(--gy)', marginRight: 4, marginLeft: 10 },
  subLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 10 },
  pacingWrap: { display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: 'center', position: 'relative', paddingBottom: 20 },
  pacingCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: 36, height: 70 },
  pacingFill: { width: '100%', background: 'var(--pk)', borderRadius: 4, minHeight: 2 },
  pacingCount: { fontSize: 11, color: 'var(--tx3)', marginTop: 4, fontFamily: MONO },
  pacingLabels: { position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx3)' },
}
