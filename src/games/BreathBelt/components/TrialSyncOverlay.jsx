import SignalGraph from './SignalGraph'

// ── TrialSyncOverlay ──────────────────────────────────────────────────────
//
// Fixed bottom-left overlay shown after each trial:
//   Phase 2 — SignalGraph + full metrics (researcher QC)
//   Phase 3 — metrics only, NO graph (graph would reveal condition info)
//
// Disappears when the next trial starts (parent sets syncMetrics to null).
// Positioned above the Back button (bottom: 80px).
//
// Props:
//   syncMetrics   — { trialRBaseline, trialRCondition, peakErrorMs, pacerPts, beltPts }
//                   null → renders nothing
//   showGraph     — true for Phase 2, false for Phase 3
//   trialNumber   — displayed as label

const R_GOOD  = 0.70
const R_FAIR  = 0.40
const PE_GOOD = 300   // ms
const PE_FAIR = 600   // ms

function rColor(r)  {
  if (r == null) return '#555'
  return r >= R_GOOD ? '#2ecc71' : r >= R_FAIR ? '#f39c12' : '#e74c3c'
}

function peColor(ms) {
  if (ms == null || !isFinite(ms)) return '#555'
  return ms < PE_GOOD ? '#2ecc71' : ms < PE_FAIR ? '#f39c12' : '#e74c3c'
}

function fmt(val, decimals = 2) {
  return val != null ? val.toFixed(decimals) : '—'
}

function fmtMs(ms) {
  return ms != null && isFinite(ms) ? `${Math.round(ms)} ms` : '—'
}

export default function TrialSyncOverlay({ syncMetrics, showGraph, trialNumber, convergence, visible = true }) {
  // To hide this overlay during participant-facing testing, pass visible={false}
  // from FixedTrialsScreen and StaircaseScreen. It will render nothing but
  // all metrics continue to be computed and saved to Supabase normally.
  if (!syncMetrics || visible === false) return null

  const { trialRBaseline, trialRCondition, peakErrorMs, pacerPts, beltPts } = syncMetrics

  return (
    <div
      style={{
        position:        'fixed',
        bottom:          80,
        left:            16,
        background:      'rgba(13,17,23,0.93)',
        border:          '1px solid #2a2a2a',
        borderRadius:    10,
        padding:         '10px 14px',
        zIndex:          150,
        backdropFilter:  'blur(4px)',
        minWidth:        showGraph ? 296 : 210,
        display:         'flex',
        flexDirection:   'column',
        gap:             8,
      }}
    >
      {/* Header */}
      <span style={{ fontFamily: 'Space Mono', fontSize: '0.68rem', color: '#666' }}>
        Trial {trialNumber} · sync quality
      </span>

      {/* Signal graph — Phase 2 only */}
      {showGraph && pacerPts?.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: -2 }}>
            <span style={{ fontSize: '0.65rem', color: '#3498db' }}>● pacer</span>
            <span style={{ fontSize: '0.65rem', color: '#e67e22' }}>● belt</span>
          </div>
          <SignalGraph
            pacerPts={pacerPts}
            beltPts={beltPts}
            scoreMs={peakErrorMs}
            width={268}
            height={65}
          />
        </>
      )}

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
        <MetricRow
          label="Base R"
          value={fmt(trialRBaseline)}
          color={rColor(trialRBaseline)}
        />
        <MetricRow
          label="Cond R"
          value={fmt(trialRCondition)}
          color={rColor(trialRCondition)}
        />
        <MetricRow
          label="Peak err"
          value={fmtMs(peakErrorMs)}
          color={peColor(peakErrorMs)}
          span
        />
        {convergence && (
          <>
            <MetricRow
              label="↑ faster SD"
              value={convergence.faster.sd.toFixed(3)}
              color={convergence.faster.sd < 0.10 ? '#2ecc71' : convergence.faster.sd < 0.20 ? '#f39c12' : '#e74c3c'}
            />
            <MetricRow
              label="↓ slower SD"
              value={convergence.slower.sd.toFixed(3)}
              color={convergence.slower.sd < 0.10 ? '#2ecc71' : convergence.slower.sd < 0.20 ? '#f39c12' : '#e74c3c'}
            />
          </>
        )}
      </div>
    </div>
  )
}

function MetricRow({ label, value, color, span }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontFamily: 'Space Mono', fontSize: '0.65rem', color: '#555' }}>{label}</span>
      <strong style={{ fontFamily: 'Space Mono', fontSize: '0.65rem', color }}>{value}</strong>
    </div>
  )
}
