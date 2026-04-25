// ── ContinuePrompt ────────────────────────────────────────────────────────
// Shown every CONTINUE_PROMPT_INTERVAL trials.
// Props:
//   trialCount   — total trials completed so far
//   sessionScore — points accumulated this session
//   onContinue   — () => void
//   onStop       — () => void

export default function ContinuePrompt({ trialCount, sessionScore, onContinue, onStop }) {
  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <p style={S.eyebrow}>Check-in</p>
        <h2 style={S.title}>Good work.</h2>
        <p style={S.body}>
          You've completed <strong>{trialCount} trials</strong> and earned{' '}
          <strong style={{ color: 'var(--pk)' }}>{sessionScore} points</strong> this session.
          Want to keep going?
        </p>
        <div style={S.btnRow}>
          <button style={S.continuBtn} onClick={onContinue}>
            Yes, keep going →
          </button>
          <button style={S.stopBtn} onClick={onStop}>
            Take a break
          </button>
        </div>
      </div>
    </div>
  );
}

const MONO  = '"Space Mono", monospace';
const SERIF = '"DM Serif Display", Georgia, serif';

const S = {
  wrap:      { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 24 },
  card:      { background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 20, padding: '36px 32px', maxWidth: 400, width: '100%', textAlign: 'center' },
  eyebrow:   { fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--pk)', margin: '0 0 8px' },
  title:     { fontFamily: SERIF, fontSize: 34, color: 'var(--tx)', margin: '0 0 12px' },
  body:      { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 28px' },
  btnRow:    { display: 'flex', flexDirection: 'column', gap: 10 },
  continuBtn: {
    padding: '13px 0', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(240,104,164,0.3)',
  },
  stopBtn: {
    padding: '13px 0', borderRadius: 12,
    background: 'transparent', color: 'var(--tx2)',
    border: '1px solid var(--bds)',
    fontFamily: MONO, fontSize: 13, cursor: 'pointer',
  },
};
