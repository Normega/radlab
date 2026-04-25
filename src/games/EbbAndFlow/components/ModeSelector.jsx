import { GAME_MODES } from '../constants';

// ── ModeSelector ──────────────────────────────────────────────────────────
// Props:
//   selectedMode   — 'beginner' | 'listener' | 'empath'
//   totalTrials    — user's cumulative trial count (determines what's unlocked)
//   onSelect       — (modeKey) => void

export default function ModeSelector({ selectedMode, totalTrials = 0, onSelect }) {
  return (
    <div style={S.wrap}>
      <p style={S.label}>Game mode</p>
      <div style={S.row}>
        {Object.entries(GAME_MODES).map(([key, mode]) => {
          const unlocked = totalTrials >= mode.unlockAt;
          const active   = selectedMode === key;
          return (
            <button
              key={key}
              onClick={() => unlocked && onSelect(key)}
              disabled={!unlocked}
              style={{
                ...S.btn,
                ...(active ? S.btnActive : {}),
                ...(unlocked ? {} : S.btnLocked),
              }}
            >
              <span style={S.modeName}>
                {mode.label}
                {active && <span style={S.check}> ✓</span>}
                {!unlocked && <span style={S.lock}> 🔒</span>}
              </span>
              {!unlocked && (
                <span style={S.unlockNote}>
                  Unlock at {mode.unlockAt} trials
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const MONO = '"Space Mono", monospace';

const S = {
  wrap:   { marginBottom: 24 },
  label:  { fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '0 0 10px' },
  row:    { display: 'flex', gap: 10 },
  btn: {
    flex: 1,
    padding: '10px 8px',
    borderRadius: 12,
    border: '1.5px solid var(--bds)',
    background: 'var(--bgc)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    transition: 'all 0.15s',
  },
  btnActive: {
    background: 'var(--bgp)',
    borderColor: 'var(--pk)',
  },
  btnLocked: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  modeName:   { fontSize: 13, fontWeight: 600, color: 'var(--tx)' },
  check:      { color: 'var(--pk)' },
  lock:       { fontSize: 11 },
  unlockNote: { fontFamily: MONO, fontSize: 9, color: 'var(--tx3)', letterSpacing: '0.05em', textAlign: 'center' },
};
