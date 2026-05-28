// BaselineReviewScreen — shown after natural breathing baseline completes.
// Plots the detrended belt signal (high-pass filtered) so the RA can verify
// data was captured throughout without slow drift obscuring breathing cycles.

import { highPassValues } from '../breathUtils'

const SAMPLE_MS    = 40
const GRAPH_H      = 160
const GRAPH_W      = 560
const PAD_L        = 40
const PAD_R        = 16
const PAD_T        = 16
const PAD_B        = 28
const INNER_W      = GRAPH_W - PAD_L - PAD_R
const INNER_H      = GRAPH_H - PAD_T - PAD_B

export default function BaselineReviewScreen({ samples = [], periodMs, onContinue }) {
  const durationS   = (samples.length * SAMPLE_MS) / 1000
  const periodS     = periodMs ? (periodMs / 1000).toFixed(1) : '—'
  const meanVal     = samples.length
    ? (samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(3)
    : '—'

  // High-pass filter to remove slow drift (fc = 0.05 Hz), then shift to [0,1] display range
  const hpValues   = samples.length >= 4 ? highPassValues(samples, 0.05, SAMPLE_MS / 1000) : samples
  const hpShifted  = hpValues.map(v => v + 0.5)

  // Downsample to at most 800 points for the polyline
  const pts = downsample(hpShifted, 800)

  const minY = Math.min(...pts)
  const maxY = Math.max(...pts)
  const yRange = Math.max(maxY - minY, 0.01)

  const polyline = pts.map((v, i) => {
    const x = PAD_L + (i / (pts.length - 1)) * INNER_W
    const y = PAD_T + INNER_H - ((v - minY) / yRange) * INNER_H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  // Dead zone detection uses raw samples (near-zero in original space)
  const deadZones = findDeadZones(samples, 0.02, 50)
  const hasDead   = deadZones.length > 0

  // X-axis tick every 5 s
  const xTicks = []
  for (let s = 0; s <= durationS; s += 5) {
    xTicks.push(s)
  }

  return (
    <div style={S.wrap}>
      <h2 style={S.title}>Baseline signal review</h2>
      <p style={S.sub}>
        Verify the belt was capturing data throughout. Signal should show clear breathing cycles.
      </p>

      {hasDead && (
        <div style={S.warn}>
          Signal dropped near zero for {deadZones.map(z =>
            `${(z.startS).toFixed(0)}–${(z.endS).toFixed(0)}s`
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

          {/* Signal line */}
          {pts.length > 1 && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#f068a4"
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

      {/* Stats row */}
      <div style={S.stats}>
        <Stat label="Duration"     value={`${durationS.toFixed(0)}s`} />
        <Stat label="Est. period"  value={`${periodS}s`} />
        <Stat label="Mean signal"  value={String(meanVal)} />
        <Stat label="Samples"      value={String(samples.length)} />
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

function downsample(arr, maxPts) {
  if (arr.length <= maxPts) return arr
  const step = arr.length / maxPts
  return Array.from({ length: maxPts }, (_, i) => arr[Math.round(i * step)])
}

function findDeadZones(samples, threshold, minRun) {
  const zones = []
  let runStart = null
  for (let i = 0; i < samples.length; i++) {
    const dead = samples[i] < threshold
    if (dead && runStart === null) runStart = i
    if (!dead && runStart !== null) {
      if (i - runStart >= minRun) {
        zones.push({ startS: (runStart * SAMPLE_MS) / 1000, endS: (i * SAMPLE_MS) / 1000 })
      }
      runStart = null
    }
  }
  if (runStart !== null && samples.length - runStart >= minRun) {
    zones.push({ startS: (runStart * SAMPLE_MS) / 1000, endS: (samples.length * SAMPLE_MS) / 1000 })
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
