import { useRef } from 'react';
import PercentileGauge from './PercentileGauge';
import RevealAnswer from './RevealAnswer';
import { WORDPROBE_YELLOW } from '../constants';

const CELL_SIZE = 44;
const GRID_GAP  = 4;

function cellStyle(status) {
  const base = {
    width: CELL_SIZE,
    height: CELL_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Space Mono', monospace",
    fontWeight: '700',
    fontSize: '18px',
    borderRadius: '6px',
    textTransform: 'uppercase',
    color: status ? '#fff' : 'var(--tx)',
    border: status ? 'none' : '1.5px solid var(--bd)',
    background:
      status === 'green'  ? 'var(--pk)' :
      status === 'yellow' ? WORDPROBE_YELLOW :
      status === 'gray'   ? 'var(--gy)' :
      'transparent',
  };
  return base;
}

export default function WordProbeBox({ hook, onInteract, disabled }) {
  const { score, percentile, guesses, input, setInput, feedback, showReveal, revealWord, roundSolved, submit, guessCount } = hook;
  const inputRef = useRef(null);

  function handleKey(e) {
    if (e.key === 'Enter') {
      onInteract('wordprobe');
      submit(input);
    }
  }

  function handleChange(e) {
    onInteract('wordprobe');
    const val = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 5).toLowerCase();
    setInput(val);
  }

  const feedbackText =
    feedback === 'invalid_word' ? 'Not a valid word' : '';

  return (
    <div style={{
      background: 'var(--bgc)',
      border: '1px solid var(--bd)',
      borderRadius: '16px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
      position: 'relative',
      minWidth: 0,
    }}>
      {showReveal && <RevealAnswer word={revealWord} solved={roundSolved} />}

      <PercentileGauge value={percentile} label="Word Probe" />

      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: '13px',
        color: 'var(--tx3)',
      }}>
        Score: {score}
      </div>

      {/* centred task content: grid + input row + feedback */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        width: 5 * CELL_SIZE + 4 * GRID_GAP,
        marginTop: 'auto',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}>
        {/* 6×5 grid */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: GRID_GAP,
        }}>
          {Array.from({ length: 6 }, (_, row) => {
            const guess = guesses[row];
            const isCurrent = row === guessCount && !showReveal;
            return (
              <div key={row} style={{ display: 'flex', gap: GRID_GAP }}>
                {Array.from({ length: 5 }, (_, col) => {
                  const scored = guess?.[col];
                  const letter = scored?.letter ?? (isCurrent ? input[col] : '');
                  const status = scored?.status ?? null;
                  return (
                    <div key={col} style={cellStyle(status)}>
                      {letter?.toUpperCase()}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKey}
            disabled={disabled || showReveal || guessCount >= 6}
            placeholder="5-letter word…"
            maxLength={5}
            style={{
              flex: 1,
              padding: '0.6rem 0.9rem',
              border: '1px solid var(--bd)',
              borderRadius: '8px',
              fontFamily: "'Space Mono', monospace",
              fontSize: '16px',
              color: 'var(--tx)',
              background: 'var(--bg)',
              outline: 'none',
              boxSizing: 'border-box',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
          />
          <button
            onClick={() => { onInteract('wordprobe'); submit(input); }}
            disabled={disabled || input.length !== 5 || showReveal}
            style={{
              padding: '0.6rem 1rem',
              background: 'var(--pk)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              cursor: 'pointer',
              opacity: (disabled || input.length !== 5 || showReveal) ? 0.5 : 1,
            }}
          >
            Guess
          </button>
        </div>

        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          color: 'var(--tx2)',
          minHeight: '18px',
        }}>
          {feedbackText}
        </div>
      </div>
    </div>
  );
}
