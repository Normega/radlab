import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const SIZE = 240, PAD = 20
const R = (SIZE - PAD * 2) / 2
const CENTER = SIZE / 2

function CircumplexScatter({ points }) {
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <circle cx={CENTER} cy={CENTER} r={R} fill="none" stroke="var(--bd)" strokeWidth={1} />
      <line x1={PAD} y1={CENTER} x2={SIZE - PAD} y2={CENTER} stroke="var(--bd)" strokeWidth={1} />
      <line x1={CENTER} y1={PAD} x2={CENTER} y2={SIZE - PAD} stroke="var(--bd)" strokeWidth={1} />
      {/* others first so the self dot always draws on top */}
      {points.filter((p) => !p.is_self).map((p, i) => (
        <circle key={i} cx={CENTER + Number(p.valence) * R} cy={CENTER - Number(p.arousal) * R} r={4} fill="var(--gy)" opacity={0.55} />
      ))}
      {points.filter((p) => p.is_self).map((p, i) => (
        <circle key={i} cx={CENTER + Number(p.valence) * R} cy={CENTER - Number(p.arousal) * R} r={6} fill="var(--pk)" />
      ))}
    </svg>
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
