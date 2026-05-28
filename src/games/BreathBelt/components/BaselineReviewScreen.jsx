// BaselineReviewScreen — shown after natural breathing baseline completes.
// Uses the same offline filtfilt MLR algorithm as calibration review.
// No expected signal shown (breathing is unpaced).

import { computeMLRPredictions, estimateBreathPeriodMs } from '../breathUtils'

const GRAPH_H  = 160
const GRAPH_W  = 560
const PAD_L    = 40
const PAD_R    = 16
const PAD_T    = 16
const PAD_B    = 28
const INNER_W  = GRAPH_W - PAD_L - PAD_R
const INNER_H  = GRAPH_H - PAD_T - PAD_B

export default function BaselineReviewScreen({ rawAccelRows = [], mlrWeights, startMs, endMs, onContinue }) {
  // Convert raw accel rows to {t,x,y,z}[] (same interpolation as calibration collection)
  const accelSamples = rawAccelRows
    .filter(r => r.packetTimestamp >= startMs && r.packetTimestamp <= endMs)
    .map(r => ({ t: r.packetTimestamp + r.sampleIndex * 5, x: r.x, y: r.y, z: r.z }))

  // Offline filtfilt MLR prediction — identical pipeline to calibration review
  let beltPts = []
  if (accelSamples.length >= 20 && mlrWeights) {
    const vals = computeMLRPredictions(accelSamples, mlrWeights)
    beltPts = accelSamples.map((s, i) => ({ t: s.t, value: vals[i] }))
  }

  const durationMs = Math.max(endMs - startMs, 1)
  const durationS  = durationMs / 1000

  // Estimate breathing period from the offline signal
  const periodMs = estimateBreathPeriodMs(beltPts)
  const periodS  = periodMs ? (periodMs / 1000).toFixed(1) : '—'

  // Downsample to at most 800 pts for the polyline
  const pts = downsample(beltPts, 800)

  const vals    = pts.map(p => p.value)
  const minY    = Math.min(...vals)
  const maxY    = Math.max(...vals)
  const yRange  = Math.max(maxY - minY, 1e-6)

  const polyline = pts.map((p, i) => {
    const x = PAD_L + ((p.t - startMs) / durationMs) * INNER_W
    const y = PAD_T + INNER_H - ((p.value - minY) / yRange) * INNER_H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  // Dead zone detection: runs where |value| < 0.02 for > 2 s
  const deadZones = findDeadZones(beltPts, 0.02, 50, startMs)
  const hasDead   = deadZones.length > 0

  // X-axis ticks every 5 s
  const xTicks = []
  for (let s = 0; s <= durationS; s += 5) xTicks.push(s)

  return (
    <div style={S.wrap}>
      <h2 style={S.title}>Baseline signal review</h2>
      <p style={S.sub}>
        Verify the belt was capturing data throughout. Signal uses the same offline MLR processing
        as calibration — no expected trace (breathing is unpaced).
      </p>

      {!mlrWeights && (
        <div style={S.warn}>No calibration model — belt was not calibrated before this baseline.</div>
      )}

      {mlrWeights && beltPts.length === 0 && (
        <div style={S.warn}>No accelerometer data found for the baseline window.</div>
      )}

      {hasDead && (
        <div style={S.warn}>
          Signal dropped near zero at {deadZones.map(z =>
            `${z.startS.toFixed(0)}–${z.endS.toFixed(0)}s`
          ).join(', ')}. Belt may have lost contact.
        </div>
      )}

      {/* Graph */}
      <div style={S.graphWrap}>
        <svg
          viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
          style={{ width: '100%', maxWidth: GRAPH_W, display: 'block' }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const y = PAD_T + INNER_H * (1 - frac)
            return (
              <line key={frac}
                x1={PAD_L} x2={PAD_L + INNER_W} y1={y} y2={y}
                stroke="#e5e5e5" strokeWidth={1}
              />
            )
          })}

          {/* Dead zone highlights */}
          {deadZones.map((z, i) => {
            const x1 = PAD_L + (z.startS / durationS) * INNER_W
            const x2 = PAD_L + (z.endS   / durationS) * INNER_W
            return (
              <rect key={i}
                x={x1} y={PAD_T} width={Math.max(x2 - x1, 2)} height={INNER_H}
                fill="rgba(239,68,68,0.12)"
              />
            )
          })}

          {/* Belt signal */}
          {pts.length > 1 && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#e67e22"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}

          {/* X axis */}
          <line
            x1={PAD_L} x2={PAD_L + INNER_W}
            y1={PAD_T + INNER_H} y2={PAD_T + INNER_H}
            stroke="#ccc" strokeWidth={1}
          />

          {/* X tick labels */}
          {xTicks.map(s => {
            const x = PAD_L + (s / durationS) * INNER_W
            return (
              <text key={s} x={x} y={GRAPH_H - 4}
                textAnchor="middle" fontSize={9} fill="#aaa"
                fontFamily="Space Mono, monospace"
              >
                {s}s
              </text>
            )
          })}

          {/* Y axis label */}
          <text
            x={10} y={PAD_T + INNER_H / 2}
            textAnchor="middle" fontSize={9} fill="#aaa"
            fontFamily="Space Mono, monospace"
            transform={`rotate(-90 10 ${PAD_T + INNER_H / 2})`}
          >
            belt
          </text>
        </svg>
      </div>

      {/* Stats */}
      <div style={S.stats}>
        <Stat label="Duration"    value={`${durationS.toFixed(0)}s`} />
        <Stat label="Est. period" value={`${periodS}s`} />
        <Stat label="Samples"     value={String(accelSamples.length)} />
        <Stat label="Model"       value={mlrWeights?.modelLabel ?? '—'} />
      </div>

      <button style={S.btn} onClick={onContinue}>
        {hasDead ? 'Continue anyway →' : 'Signal looks good — Continue →'}
      </button>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontFamily: '"Space Mono",monospace', fontSize: 13, color: 'var(--tx)' }}>{value}</span>
    </div>
  )
}

function downsample(pts, maxPts) {
  if (pts.length <= maxPts) return pts
  const step = pts.length / maxPts
  return Array.from({ length: maxPts }, (_, i) => pts[Math.round(i * step)])
}

// Dead zones: runs where |value| < threshold for >= minRun consecutive samples
function findDeadZones(pts, threshold, minRun, startMs) {
  const zones = []
  let runStart = null
  for (let i = 0; i < pts.length; i++) {
    const dead = Math.abs(pts[i].value) < threshold
    if (dead && runStart === null) runStart = i
    if (!dead && runStart !== null) {
      if (i - runStart >= minRun) {
        zones.push({
          startS: (pts[runStart].t - startMs) / 1000,
          endS:   (pts[i].t       - startMs) / 1000,
        })
      }
      runStart = null
    }
  }
  if (runStart !== null && pts.length - runStart >= minRun) {
    zones.push({
      startS: (pts[runStart].t  - startMs) / 1000,
      endS:   (pts[pts.length - 1].t - startMs) / 1000,
    })
  }
  return zones
}

const S = {
  wrap: {
    maxWidth: 620,
    margin: '0 auto',
    padding: '32px 24px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  title: {
    fontFamily: '"DM Serif Display",Georgia,serif',
    fontSize: 22,
    fontWeight: 400,
    color: 'var(--tx)',
    margin: 0,
  },
  sub: {
    fontSize: 14,
    color: 'var(--tx2)',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    margin: 0,
    lineHeight: 1.5,
  },
  warn: {
    fontSize: 13,
    color: '#92400e',
    background: '#fef9c3',
    border: '1px solid #fde68a',
    borderRadius: 8,
    padding: '10px 14px',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    lineHeight: 1.5,
  },
  graphWrap: {
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 10,
    padding: '8px 8px 4px',
    overflow: 'hidden',
  },
  stats: {
    display: 'flex',
    gap: 32,
    justifyContent: 'center',
    background: 'var(--bgc)',
    border: '1px solid var(--bd)',
    borderRadius: 8,
    padding: '12px 20px',
  },
  btn: {
    alignSelf: 'flex-start',
    background: 'var(--pk)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 24px',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
}
