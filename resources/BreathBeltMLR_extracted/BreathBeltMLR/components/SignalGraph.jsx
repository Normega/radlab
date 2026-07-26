// ── SignalGraph.jsx ────────────────────────────────────────────────────────
//
// SVG line chart: blue = pacer reference, amber = belt model prediction.
// Used in CalibReviewPanel, Phase1ReviewPanel (future), and post-trial overlay.
// Belt signal is normalized to graph height; pacer is already 0–1.
// Ported from new components.tsx SignalGraph.

const GRAPH_DS = 8  // display every Nth point

export default function SignalGraph({
  pacerPts,
  beltPts,
  scoreMs,
  width  = 300,
  height = 80,
  label,
}) {
  const hasPacer = pacerPts.length >= 2
  const hasBelt  = beltPts.length  >= 2

  if (!hasPacer && !hasBelt) {
    return (
      <div style={{
        width, height,
        background: '#0d1117', borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#444', fontSize: '0.7rem' }}>No data</span>
      </div>
    )
  }

  const allPts = [...pacerPts, ...beltPts]
  const tMin   = allPts[0].t
  const tMax   = allPts[allPts.length - 1].t
  const tR     = Math.max(tMax - tMin, 1)
  const PAD    = 4

  const bVals = hasBelt ? beltPts.map(p => p.value) : [0, 1]
  const bMin  = Math.min(...bVals)
  const bMax  = Math.max(...bVals)
  const bR    = Math.max(bMax - bMin, 1e-6)

  const toX  = (t) => PAD + ((t - tMin) / tR) * (width - 2*PAD)
  const toYp = (v) => height - PAD - v * (height - 2*PAD)                   // pacer 0–1
  const toYb = (v) => height - PAD - ((v - bMin) / bR) * (height - 2*PAD)  // belt normalized

  const path = (pts, toY, step = GRAPH_DS) =>
    pts
      .filter((_, i) => i % step === 0)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t).toFixed(1)},${toY(p.value).toFixed(1)}`)
      .join(' ')

  const scoreColor = scoreMs === undefined || !isFinite(scoreMs)
    ? '#555'
    : scoreMs < 300 ? '#2ecc71'
    : scoreMs < 600 ? '#f39c12'
    : '#e74c3c'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {label && (
        <span style={{ fontSize: '0.68rem', color: '#666' }}>{label}</span>
      )}
      <svg
        width={width}
        height={height}
        style={{ background: '#0d1117', borderRadius: 4, display: 'block' }}
      >
        {hasBelt  && <path d={path(beltPts,  toYb)} stroke="#e67e22" strokeWidth="1.5" fill="none" opacity="0.9" />}
        {hasPacer && <path d={path(pacerPts, toYp)} stroke="#3498db" strokeWidth="2"   fill="none" opacity="0.9" />}
      </svg>
      {scoreMs !== undefined && (
        <span style={{ fontSize: '0.68rem', color: scoreColor }}>
          {isFinite(scoreMs) ? `${Math.round(scoreMs)} ms` : 'N/A'}
        </span>
      )}
    </div>
  )
}
