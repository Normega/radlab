export default function SessionComplete({
  convergence,
  sessionNumber,
  preBaselinePeriodMs,
  postBaselinePeriodMs,
  onDone,
  studyMode = false,
}) {
  const hasConvergence = convergence?.faster && convergence?.slower;
  const hasPeriods = preBaselinePeriodMs != null || postBaselinePeriodMs != null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8"
      style={{ background: 'var(--bg)' }}>
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center"
        style={{ border: '1px solid var(--bd)' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <h2 className="mb-1"
          style={{ fontFamily: 'DM Serif Display', fontSize: 24, color: 'var(--tx)' }}>
          Session {sessionNumber} complete
        </h2>
        <p style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body)', marginBottom: 24 }}>
          {studyMode ? 'All data saved.' : 'All data saved. The belt can now be removed.'}
        </p>

        {/* Baseline period summary */}
        {hasPeriods && (
          <div className="rounded-xl p-4 mb-4 text-left"
            style={{ background: 'var(--bg)', border: '1px solid var(--bd)' }}>
            <p style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)',
              color: 'var(--tx3)', margin: '0 0 8px', textTransform: 'uppercase' }}>
              Resting breath period
            </p>
            <PeriodRow label="Pre-session"  ms={preBaselinePeriodMs} />
            <PeriodRow label="Post-session" ms={postBaselinePeriodMs} />
          </div>
        )}

        {/* QUEST convergence summary */}
        {hasConvergence && (
          <div className="rounded-xl p-4 mb-6 text-left"
            style={{ background: 'var(--bgp)', border: '1px solid var(--pkb)' }}>
            <p style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)',
              color: 'var(--tx3)', margin: '0 0 8px', textTransform: 'uppercase' }}>
              Detection thresholds
            </p>
            <ThresholdRow label="Faster" conv={convergence.faster} />
            <ThresholdRow label="Slower" conv={convergence.slower} />
          </div>
        )}

        <button onClick={onDone}
          className="px-6 py-3 rounded-xl font-medium w-full"
          style={{ background: 'var(--pk)', color: '#fff', fontSize: 'var(--fs-body)' }}>
          {studyMode ? 'Continue' : 'Back to dashboard'}
        </button>
      </div>
    </div>
  );
}

function PeriodRow({ label, ms }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>{label}</span>
      <span style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--tx)' }}>
        {ms != null ? `${(ms / 1000).toFixed(2)} s` : <span style={{ color: 'var(--tx3)' }}>—</span>}
      </span>
    </div>
  );
}

function ThresholdRow({ label, conv }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span style={{ color: 'var(--tx2)', fontSize: 'var(--fs-body-sm)' }}>{label}</span>
      <span style={{ fontFamily: 'Space Mono', fontSize: 'var(--fs-mono-sm)', color: 'var(--tx)' }}>
        {conv.meanDeltaSec?.toFixed(2)} s
        <span style={{ color: 'var(--tx3)', marginLeft: 8 }}>±{conv.sd?.toFixed(3)}</span>
      </span>
    </div>
  );
}
