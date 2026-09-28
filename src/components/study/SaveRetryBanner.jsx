/**
 * SaveRetryBanner: shown when a participant's answer failed to save.
 *
 * A failed insert must never advance the session (the answer would be lost
 * silently) and must never strand the participant on a dead screen either.
 * This is the one visible way out: say what happened, offer a retry that
 * re-sends the same payload. Pinned to the bottom of the viewport so it is
 * seen even when the step's own UI has already moved past its last screen.
 */
export default function SaveRetryBanner({ message, onRetry, busy = false }) {
  return (
    <div role="alert" style={S.wrap}>
      <p style={S.msg}>
        Your answer could not be saved{message ? ` (${message})` : ''}. Please check your connection and try again.
      </p>
      <button type="button" className="cs-primary-button" disabled={busy} onClick={onRetry}>
        {busy ? 'Saving…' : 'Try again'}
      </button>
    </div>
  )
}

const S = {
  wrap: {
    position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 1000,
    maxWidth: 560, margin: '0 auto',
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '12px 16px', borderRadius: 10,
    background: 'var(--err-bg)', border: '1px solid var(--err-bd)',
    fontFamily: '"DM Sans",system-ui,sans-serif',
  },
  msg: { margin: 0, flex: '1 1 240px', fontSize: 14, color: 'var(--err-tx)' },
}
