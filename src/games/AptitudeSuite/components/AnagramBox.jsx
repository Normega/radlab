import { useEffect, useRef } from 'react';
import PercentileGauge from './PercentileGauge';

export default function AnagramBox({ hook, onInteract, disabled }) {
  const { score, percentile, scrambled, input, setInput, feedback, init, submit, skip, wordLength } = hook;
  const inputRef = useRef(null);

  useEffect(() => { init(); }, []);

  function handleKey(e) {
    if (e.key === 'Enter') {
      onInteract('anagram');
      const result = submit(input);
      if (result === 'wrong') inputRef.current?.select();
    }
  }

  function handleChange(e) {
    onInteract('anagram');
    setInput(e.target.value);
  }

  function handleSkip() {
    onInteract('anagram');
    skip();
  }

  const feedbackColor = feedback === 'correct' ? 'var(--pk)' : feedback === 'skip' ? 'var(--tx3)' : 'var(--tx2)';
  const feedbackText  = feedback === 'correct' ? 'Correct!' : feedback === 'wrong' ? 'Not quite' : feedback === 'skip' ? 'Skipped (−1)' : '';

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
      minWidth: 0,
    }}>
      <PercentileGauge value={percentile} label="Unscramble" />

      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: '13px',
        color: 'var(--tx3)',
      }}>
        Score: {score} &nbsp;·&nbsp; {wordLength}-letter words
      </div>

      <div style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: '2rem',
        letterSpacing: '0.25em',
        color: 'var(--tx)',
        textTransform: 'uppercase',
        minHeight: '2.5rem',
      }}>
        {scrambled}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
        <input
          ref={inputRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder="Your answer…"
          style={{
            width: '100%',
            padding: '0.6rem 0.9rem',
            border: '1px solid var(--bd)',
            borderRadius: '8px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '16px',
            color: 'var(--tx)',
            background: 'var(--bg)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => { onInteract('anagram'); submit(input); }}
            disabled={disabled || !input.trim()}
            style={{
              flex: 1,
              padding: '0.6rem 1rem',
              background: 'var(--pk)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Submit
          </button>
          <button
            onClick={handleSkip}
            disabled={disabled}
            style={{
              flex: 1,
              padding: '0.6rem 0.75rem',
              background: 'transparent',
              color: 'var(--tx2)',
              border: '1px solid var(--bd)',
              borderRadius: '8px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Skip (&minus;1 point)
          </button>
        </div>
      </div>

      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
        color: feedbackColor,
        minHeight: '18px',
      }}>
        {feedbackText}
      </div>
    </div>
  );
}
