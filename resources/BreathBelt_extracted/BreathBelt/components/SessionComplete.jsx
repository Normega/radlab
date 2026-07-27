// ── SessionComplete ────────────────────────────────────────────────────────
//
// End-of-session screen. Shows convergence summary if Phase 3 ran.
// onDone() navigates back to dashboard.

export default function SessionComplete({ convergence, onDone }) {
  const hasConvergence = convergence?.faster && convergence?.slower;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-8"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="bg-white rounded-2xl p-10 max-w-md w-full text-center"
        style={{ border: '1px solid var(--bd)' }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <h2
          className="mb-3"
          style={{ fontFamily: 'DM Serif Display', fontSize: 24, color: 'var(--tx)' }}
        >
          Session complete
        </h2>
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', marginBottom: 24 }}>
          All data has been saved. The belt can now be removed.
        </p>

        {hasConvergence && (
          <div
            className="rounded-xl p-4 mb-6 text-left"
            style={{ background: 'var(--bgp)', border: '1px solid var(--pkb)' }}
          >
            <p
              className="mb-3"
              style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--tx3)' }}
            >
              QUEST THRESHOLDS
            </p>
            <ThresholdRow
              label="Faster detection"
              meanDeltaSec={convergence.faster.meanDeltaSec}
              sd={convergence.faster.sd}
            />
            <ThresholdRow
              label="Slower detection"
              meanDeltaSec={convergence.slower.meanDeltaSec}
              sd={convergence.slower.sd}
            />
          </div>
        )}

        <button
          onClick={onDone}
          className="px-6 py-3 rounded-xl font-medium w-full"
          style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

function ThresholdRow({ label, meanDeltaSec, sd }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>{label}</span>
      <span style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--tx)' }}>
        {meanDeltaSec.toFixed(2)} s
        <span style={{ color: 'var(--tx3)', marginLeft: 8 }}>±{sd.toFixed(3)}</span>
      </span>
    </div>
  );
}
