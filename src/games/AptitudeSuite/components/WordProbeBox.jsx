import { useRef } from 'react';
import PercentileGauge from './PercentileGauge';
import RevealAnswer from './RevealAnswer';
import { WORDPROBE_YELLOW } from '../constants';
import { BOARD_ROWS, letterStates } from '../letterBoard';

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

// The letter board (studies.wordprobe_letter_board; states in ../letterBoard.js).
const KEY_W = 20;
const KEY_GAP = 4;

function keyStyle(status, clickable) {
  return {
    width: KEY_W,
    height: 32,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Space Mono', monospace",
    fontWeight: '700',
    fontSize: '12px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    color: status ? '#fff' : 'var(--tx)',
    border: status ? 'none' : '1px solid var(--bd)',
    background:
      status === 'green'  ? 'var(--pk)' :
      status === 'yellow' ? WORDPROBE_YELLOW :
      status === 'gray'   ? 'var(--gy)' :
      'var(--bg)',
    opacity: status === 'gray' ? 0.55 : 1,
    cursor: clickable ? 'pointer' : 'default',
  };
}

function LetterBoard({ guesses, onLetter, disabled }) {
  const states = letterStates(guesses);
  return (
    <div aria-label="Letters tried on this word" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: KEY_GAP }}>
      {BOARD_ROWS.map(row => (
        <div key={row} style={{ display: 'flex', gap: KEY_GAP }}>
          {row.split('').map(l => {
            const st = states[l] ?? null;
            const label = `${l.toUpperCase()}${st === 'green' ? ', in the word, right place' : st === 'yellow' ? ', in the word, wrong place' : st === 'gray' ? ', not in the word' : ''}`;
            return (
              <button key={l} type="button" aria-label={label} disabled={disabled}
                onMouseDown={e => e.preventDefault()}
                onClick={() => onLetter(l)}
                style={keyStyle(st, !disabled)}>
                {l}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function WordProbeBox({ hook, onInteract, disabled, letterBoard = false }) {
  const { score, percentile, guesses, input, setInput, feedback, showReveal, revealWord, roundSolved, submit, guessCount } = hook;
  const inputRef = useRef(null);
  const inputDisabled = disabled || showReveal || guessCount >= 6;

  // A tap on the board types the letter, as Wordle's keyboard does; the input
  // keeps focus (mousedown is prevented) so Enter still submits.
  function typeLetter(l) {
    onInteract('wordprobe');
    if (input.length < 5) setInput(input + l);
    inputRef.current?.focus();
  }

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

        {letterBoard && <LetterBoard guesses={guesses} onLetter={typeLetter} disabled={inputDisabled} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKey}
            disabled={inputDisabled}
            placeholder="5-letter word…"
            maxLength={5}
            style={{
              width: '100%',
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
              width: '100%',
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
