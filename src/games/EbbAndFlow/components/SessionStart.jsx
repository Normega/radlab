import { GAME_MODES } from '../constants';
import ModeSelector from './ModeSelector';
import GameIntro from '../../shared/GameIntro';

// ── SessionStart ──────────────────────────────────────────────────────────
// Props:
//   totalTrials    — cumulative trials (determines unlock state)
//   totalScore     — cumulative score
//   sessionScore   — points from last session (0 if first)
//   selectedMode   — current mode key
//   onSelectMode   — (key) => void
//   onBegin        — () => void

export default function SessionStart({ totalTrials = 0, totalScore = 0, sessionScore = 0, selectedMode = 'beginner', onSelectMode, onBegin }) {
  const mode = GAME_MODES[selectedMode];

  return (
    <GameIntro
      maxWidth={440}
      title={<>Breathe in.<br />Notice the shift.</>}
      lead={<>Follow your Ripple&rsquo;s breath. When the rhythm changes, tell us what you sensed.<br />The subtler the detection, the more points you earn.</>}
      /* Ebb &amp; Flow is the one game here that carries progress into its own
         intro — the run count and score are what unlock the subtler modes, so
         they belong above the instructions rather than after them. */
      visual={
        <>
          <div style={S.statsRow}>
            <div style={S.stat}>
              <span style={S.statNum}>{totalTrials}</span>
              <span style={S.statLabel}>trials</span>
            </div>
            <div style={S.stat}>
              <span style={S.statNum}>{totalScore}</span>
              <span style={S.statLabel}>total pts</span>
            </div>
            {sessionScore > 0 && (
              <div style={S.stat}>
                <span style={{ ...S.statNum, color: 'var(--pk)' }}>+{sessionScore}</span>
                <span style={S.statLabel}>last session</span>
              </div>
            )}
          </div>

          <ModeSelector
            selectedMode={selectedMode}
            totalTrials={totalTrials}
            onSelect={onSelectMode}
          />
        </>
      }
      steps={[
        { title: 'Follow the rhythm', body: 'Your Ripple will breathe — let your own breath sync up with it.' },
        { title: 'Hold on the inhale', body: 'Hold the attunement button while you breathe in. Release when you breathe out.' },
        { title: 'Say what shifted', body: 'On some trials the pace changes. After each 4-breath sequence, tell us what you noticed — then rate your confidence and how activated you feel.' },
      ]}
      note={
        <>
          <strong>{mode.label} mode</strong> — animation scale {Math.round(mode.scaleAmplitude * 100)}%.
          {selectedMode !== 'empath' && ' Subtler modes unlock as you practice.'}
        </>
      }
      cta="Begin session →"
      onStart={onBegin}
    />
  );
}

const MONO  = '"Space Mono", monospace';
const SERIF = '"DM Serif Display", Georgia, serif';

const S = {
  wrap:       { maxWidth: 520, margin: '0 auto', padding: '48px 24px' },
  eyebrow:    { fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--pk)', margin: '0 0 8px' },
  title:      { fontFamily: SERIF, fontSize: 'clamp(28px, 6vw, 42px)', color: 'var(--tx)', margin: '0 0 12px', letterSpacing: -0.5, lineHeight: 1.15 },
  sub:        { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.6, margin: '0 0 32px' },

  statsRow:   { display: 'flex', gap: 20, marginBottom: 28, flexWrap: 'wrap' },
  stat:       { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  statNum:    { fontFamily: MONO, fontSize: 28, color: 'var(--tx)', lineHeight: 1 },
  statLabel:  { fontFamily: MONO, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)' },

  instructCard: { background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 14, padding: '18px 20px', marginBottom: 28 },
  instructTitle: { fontFamily: MONO, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pk)', margin: '0 0 10px' },
  steps:      { paddingLeft: 18, margin: '0 0 12px', color: 'var(--tx2)', fontSize: 13, lineHeight: 1.7 },
  modeNote:   { fontSize: 12, color: 'var(--tx2)', margin: 0, fontStyle: 'italic' },

  beginBtn: {
    width: '100%', padding: '15px 0',
    background: 'var(--pk)', color: '#fff',
    border: 'none', borderRadius: 14,
    fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.05em',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(240,104,164,0.35)',
  },
};
