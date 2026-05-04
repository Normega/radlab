import { GAME_MODES } from '../constants';

// ── SessionSummary ────────────────────────────────────────────────────────
// End-of-session results screen.
//
// Props:
//   sessionScore      — points earned this session
//   totalScore        — new cumulative total
//   totalTrials       — new cumulative trial count
//   questEstimates    — { faster_high, faster_low, slower_high, slower_low } threshold estimates (linear)
//   questSDs          — same keys, posterior SDs
//   allConverged      — boolean
//   newModeUnlocked   — null | 'listener' | 'empath'
//   gameMode          — current mode key
//   sessionSyncMean   — 0–1
//   onDone            — () => void (back to dashboard / next session)

export default function SessionSummary({
  sessionScore = 0,
  totalScore = 0,
  totalTrials = 0,
  questEstimates = {},
  questSDs = {},
  allConverged = false,
  newModeUnlocked = null,
  gameMode = 'beginner',
  sessionSyncMean = 0,
  onDone,
}) {
  const KEYS = ['faster_high', 'faster_low', 'slower_high', 'slower_low'];
  const KEY_LABELS = {
    faster_high: 'Faster · abrupt',
    faster_low:  'Faster · gradual',
    slower_high: 'Slower · abrupt',
    slower_low:  'Slower · gradual',
  };

  return (
    <div style={S.wrap}>
      <p style={S.eyebrow}>Session complete</p>
      <h1 style={S.title}>
        {sessionScore >= 50 ? 'Sharp sensing.' : sessionScore >= 20 ? 'Nicely done.' : 'Keep practising.'}
      </h1>

      {/* Score summary */}
      <div style={S.scoreRow}>
        <div style={S.scoreBox}>
          <span style={S.scoreNum}>{sessionScore > 0 ? `+${sessionScore}` : sessionScore}</span>
          <span style={S.scoreLabel}>this session</span>
        </div>
        <div style={S.scoreBox}>
          <span style={S.scoreNum}>{totalScore}</span>
          <span style={S.scoreLabel}>total pts</span>
        </div>
        <div style={S.scoreBox}>
          <span style={S.scoreNum}>{totalTrials}</span>
          <span style={S.scoreLabel}>total trials</span>
        </div>
      </div>

      {/* Mode unlock celebration */}
      {newModeUnlocked && (
        <div style={S.unlockBanner}>
          <span style={S.unlockIcon}>🔓</span>
          <div>
            <p style={S.unlockTitle}>{GAME_MODES[newModeUnlocked].label} mode unlocked!</p>
            <p style={S.unlockSub}>
              Animation amplitude drops to {Math.round(GAME_MODES[newModeUnlocked].scaleAmplitude * 100)}%.
              You can select it next session.
            </p>
          </div>
        </div>
      )}

      {/* Threshold estimates */}
      <p style={S.secLabel}>// Detection thresholds</p>
      <div style={S.card}>
        {KEYS.map(key => {
          const est = questEstimates[key];
          const sd  = questSDs[key];
          if (est == null) return null;
          const barPct = Math.min(100, Math.round((est / 0.5) * 100));
          return (
            <div key={key} style={S.threshRow}>
              <span style={S.threshLabel}>{KEY_LABELS[key]}</span>
              <div style={S.threshBar}>
                <div style={{ ...S.threshFill, width: `${barPct}%` }} />
              </div>
              <span style={S.threshVal}>{est != null ? est.toFixed(2) : '—'}</span>
            </div>
          );
        })}
        {allConverged && (
          <p style={S.convergedNote}>✓ All staircases converged — sensitivity profile complete.</p>
        )}
      </div>

      {/* Sync quality */}
      <p style={{ ...S.secLabel, marginTop: 28 }}>// Breath sync</p>
      <div style={S.card}>
        <div style={S.syncRow}>
          <span style={S.syncLabel}>Session sync mean</span>
          <span style={{ ...S.syncVal, color: sessionSyncMean >= 0.80 ? '#1D9E75' : sessionSyncMean >= 0.5 ? '#F0A500' : '#E05050' }}>
            {Math.round(sessionSyncMean * 100)}%
          </span>
        </div>
      </div>

      <button style={S.doneBtn} onClick={onDone}>
        Back to dashboard →
      </button>
    </div>
  );
}

const MONO  = '"Space Mono", monospace';
const SERIF = '"DM Serif Display", Georgia, serif';

const S = {
  wrap:     { maxWidth: 520, margin: '0 auto', padding: '48px 24px' },
  eyebrow:  { fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--pk)', margin: '0 0 8px' },
  title:    { fontFamily: SERIF, fontSize: 'clamp(26px, 5vw, 38px)', color: 'var(--tx)', margin: '0 0 28px', letterSpacing: -0.5 },

  scoreRow:   { display: 'flex', gap: 20, marginBottom: 28, flexWrap: 'wrap' },
  scoreBox:   { display: 'flex', flexDirection: 'column', gap: 2 },
  scoreNum:   { fontFamily: MONO, fontSize: 32, color: 'var(--pk)', lineHeight: 1 },
  scoreLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)' },

  unlockBanner: { display: 'flex', alignItems: 'flex-start', gap: 14, background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 14, padding: '16px 18px', marginBottom: 28 },
  unlockIcon:   { fontSize: 28, lineHeight: 1 },
  unlockTitle:  { fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--pk)', margin: '0 0 4px', letterSpacing: 0 },
  unlockSub:    { fontSize: 13, color: 'var(--tx2)', margin: 0, lineHeight: 1.5 },

  secLabel:   { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 12 },
  card:       { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 20px' },

  threshRow:  { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  threshLabel: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', width: 130, flexShrink: 0 },
  threshBar:  { flex: 1, height: 6, borderRadius: 999, background: 'var(--bgp)', overflow: 'hidden' },
  threshFill: { height: '100%', borderRadius: 999, background: 'var(--pk)' },
  threshVal:  { fontFamily: MONO, fontSize: 12, color: 'var(--tx)', width: 32, textAlign: 'right' },
  convergedNote: { fontFamily: MONO, fontSize: 12, color: '#1D9E75', margin: '8px 0 0', letterSpacing: '0.06em' },

  syncRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  syncLabel: { fontSize: 13, color: 'var(--tx2)' },
  syncVal:   { fontFamily: MONO, fontSize: 16, fontWeight: 700 },

  doneBtn: {
    width: '100%', padding: '14px 0', marginTop: 32,
    background: 'var(--pk)', color: '#fff',
    border: 'none', borderRadius: 14,
    fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
  },
};
