import { COPY } from '../constants';

// ── ContactComplete ───────────────────────────────────────────────────────
// Shown below the avatar when phase = 'COMPLETE'.
//
// Props:
//   syncLevel   — final rolling mean (0.0–1.0)
//   isReturning — true = Deeper Contact mode
//   onContinue  — () => void — navigate forward

export default function ContactComplete({ syncLevel = 0, isReturning = false, onContinue }) {
  const pct  = Math.round(syncLevel * 100);
  const text = isReturning
    ? `${COPY.complete_returning} Sync: ${pct}%`
    : COPY.complete_first;
  const btn  = isReturning ? COPY.btn_done_standalone : COPY.btn_continue_onboarding;

  return (
    <div style={S.wrap}>
      <p style={S.eyebrow}>
        {isReturning ? 'Deeper Contact' : 'First Contact'}
      </p>
      <p style={S.body}>{text}</p>
      <button style={S.btn} onClick={onContinue}>{btn}</button>
    </div>
  );
}

const MONO  = '"Space Mono", monospace';
const SERIF = '"DM Serif Display", serif';

const S = {
  wrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 16, paddingTop: 8,
  },
  eyebrow: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: 'var(--pk)', margin: 0,
  },
  body: {
    fontFamily: SERIF, fontSize: 22, color: 'var(--tx)',
    textAlign: 'center', maxWidth: 320, margin: 0, lineHeight: 1.4,
  },
  btn: {
    padding: '13px 32px', borderRadius: 12,
    background: 'var(--pk)', color: '#fff', border: 'none',
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
  },
};
