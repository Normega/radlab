import SignalGraph from './SignalGraph'

// ── Model label display names ─────────────────────────────────────────────
const MODEL_NAMES = {
  'mlr-wide':     'MLR wide-band',
  'mlr-tight':    'MLR tight-band',
  'mlr-wide-lp':  'MLR wide + smooth',
  'mlr-tight-lp': 'MLR tight + smooth',
  'pca-wide':     'PCA wide-band',
  'pca-tight':    'PCA tight-band',
}

// ── CalibReviewPanel ───────────────────────────────────────────────────────
//
// Shows calibration quality metrics and a signal graph (pacer vs belt model).
// fitR < 0.4 blocks continuation (same threshold as new codebase).

export default function CalibReviewPanel({
  pacerPts,
  beltPts,
  fitR,
  peakErrorMs,
  modelLabel,
  lagMs,
  onContinue,
  onRedo,
}) {
  const rPct      = Math.round(fitR * 100)
  const rColor    = fitR >= 0.7 ? '#2ecc71' : fitR >= 0.4 ? '#f39c12' : '#e74c3c'
  const lagColor  = Math.abs(lagMs) < 400 ? '#2ecc71' : Math.abs(lagMs) < 800 ? '#f39c12' : '#e74c3c'
  const errColor  = isFinite(peakErrorMs)
    ? peakErrorMs < 400 ? '#2ecc71' : peakErrorMs < 700 ? '#f39c12' : '#e74c3c'
    : 'var(--tx3)'
  const blocked   = fitR < 0.4

  return (
    <div className="flex flex-col items-center gap-5" style={{ maxWidth: 520, width: '100%' }}>
      <h3 style={{ fontFamily: 'DM Serif Display', fontSize: 20, color: 'var(--tx)', margin: 0 }}>
        Calibration review
      </h3>

      {/* Legend */}
      <p style={{ color: 'var(--tx3)', fontSize: 'var(--fs-body-sm)', margin: 0 }}>
        <span style={{ color: '#3498db' }}>●</span> pacer &nbsp;
        <span style={{ color: '#e67e22' }}>●</span> belt model
      </p>

      {/* Signal graph */}
      <SignalGraph
        pacerPts={pacerPts}
        beltPts={beltPts}
        width={460}
        height={110}
      />

      {/* Quality metrics */}
      <div
        className="flex gap-5 flex-wrap justify-center"
        style={{ fontFamily: 'DM Sans', fontSize: 'var(--fs-body-sm)' }}
      >
        <MetricChip label="Fit" value={`${rPct}%`} color={rColor} />
        <MetricChip
          label="Lag"
          value={`${lagMs > 0 ? '+' : ''}${Math.round(lagMs)} ms`}
          color={lagColor}
        />
        <MetricChip
          label="Peak timing"
          value={isFinite(peakErrorMs) ? `${Math.round(peakErrorMs)} ms` : 'N/A'}
          color={errColor}
        />
        <MetricChip
          label="Model"
          value={MODEL_NAMES[modelLabel] ?? modelLabel}
          color="var(--tx2)"
        />
      </div>

      {/* Block message */}
      {blocked && (
        <p style={{ color: '#e74c3c', fontSize: 'var(--fs-body-sm)', margin: 0, textAlign: 'center' }}>
          Signal quality too low — please redo calibration.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onContinue}
          disabled={blocked}
          className="px-5 py-3 rounded-xl font-semibold"
          style={{
            background: blocked ? 'var(--bd)' : 'var(--pk)',
            color:      blocked ? 'var(--tx3)' : '#fff',
            fontSize:   'var(--fs-body)',
            cursor:     blocked ? 'default' : 'pointer',
            border:     'none',
          }}
        >
          ✓ Looks good — continue
        </button>
        <button
          onClick={onRedo}
          style={{
            background:   'transparent',
            border:       '1px solid var(--bds)',
            borderRadius: 12,
            padding:      '12px 20px',
            color:        'var(--tx2)',
            fontSize:     'var(--fs-body)',
            cursor:       'pointer',
          }}
        >
          ↺ Redo calibration
        </button>
      </div>
    </div>
  )
}

function MetricChip({ label, value, color }) {
  return (
    <span style={{ color: 'var(--tx3)' }}>
      {label}:{' '}
      <strong style={{ color }}>{value}</strong>
    </span>
  )
}
