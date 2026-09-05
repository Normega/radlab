// ── BreathShapeChart ────────────────────────────────────────────────────────
// Draws breaths as four-vertex shapes. Each breath's four phase durations set
// the distance of a vertex from center — inhale up, top-hold right, exhale
// down, rest left — so the breath's temporal signature reads as a silhouette:
// tall = long in/out, wide = long pauses, lopsided = asymmetric breath.
//
// (This is deliberately vertex-distance, not side-length. A quadrilateral
// whose *sides* are the four durations usually cannot close for real breaths —
// as soon as one phase is longer than the other three combined, e.g. a slow
// exhale with short pauses, no such quadrilateral exists. Vertex distances
// always close, keep every duration readable, and average point-wise.)

import { meanBreath, maxDuration } from './breathShapes'

const AMBER = '#BA7517'
const BLUE  = '#185FA5'
const MONO  = '"Space Mono", monospace'

const AXIS   = 'rgba(80, 65, 80, 0.14)'
const STROKE = 'rgba(80, 65, 80, 0.28)'

function pointsFor(b, s) {
  return `0,${(-b.inh * s).toFixed(1)} ${(b.hold * s).toFixed(1)},0 0,${(b.exh * s).toFixed(1)} ${(-b.rest * s).toFixed(1)},0`
}

export default function BreathShapeChart({ breaths, size = 300 }) {
  const mean = meanBreath(breaths)
  const s = 104 / maxDuration(breaths)

  return (
    <svg viewBox="-150 -150 300 300" width={size} height={size} style={{ maxWidth: '100%', height: 'auto' }}>
      {/* axes */}
      <line x1="0" y1="-122" x2="0" y2="122" stroke={AXIS} strokeWidth="1" />
      <line x1="-122" y1="0" x2="122" y2="0" stroke={AXIS} strokeWidth="1" />
      <text x="0" y="-132" textAnchor="middle" fontFamily={MONO} fontSize="10" fill={AMBER}>in</text>
      <text x="130" y="4" textAnchor="start" fontFamily={MONO} fontSize="10" fill="var(--gy)">hold</text>
      <text x="0" y="140" textAnchor="middle" fontFamily={MONO} fontSize="10" fill={BLUE}>out</text>
      <text x="-130" y="4" textAnchor="end" fontFamily={MONO} fontSize="10" fill="var(--gy)">rest</text>

      {/* every breath, quiet */}
      {breaths.map((b, i) => (
        <polygon key={i} points={pointsFor(b, s)} fill="none" stroke={STROKE} strokeWidth="1.2" strokeLinejoin="round" />
      ))}

      {/* the session average, loud */}
      {breaths.length > 0 && (
        <polygon
          points={pointsFor(mean, s)}
          fill="rgba(240, 104, 164, 0.14)"
          stroke="var(--pk)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

// One small shape, same seconds-per-pixel as its siblings (pass the session's
// shared scale so the row is comparable at a glance). `n` labels it; omit for
// the unlabeled in-session stamps.
export function MiniShape({ breath, maxDur, n, size = 76 }) {
  const s = 38 / maxDur
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg viewBox="-46 -46 92 92" width={size} height={size}>
        <line x1="0" y1="-42" x2="0" y2="42" stroke={AXIS} strokeWidth="1" />
        <line x1="-42" y1="0" x2="42" y2="0" stroke={AXIS} strokeWidth="1" />
        <polygon
          points={pointsFor(breath, s)}
          fill="rgba(240, 104, 164, 0.10)"
          stroke={STROKE}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      {n != null && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--gy)' }}>{n}</span>}
    </div>
  )
}

// An awaiting slot in the in-session stamp row — the axis cross with no shape.
export function EmptyStamp({ size = 40 }) {
  return (
    <svg viewBox="-46 -46 92 92" width={size} height={size}>
      <line x1="0" y1="-42" x2="0" y2="42" stroke={AXIS} strokeWidth="1" />
      <line x1="-42" y1="0" x2="42" y2="0" stroke={AXIS} strokeWidth="1" />
    </svg>
  )
}
