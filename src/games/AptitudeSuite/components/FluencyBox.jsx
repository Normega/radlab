import { useRef } from 'react';
import PercentileGauge from './PercentileGauge';

export default function FluencyBox({ hook, onInteract, disabled }) {
  const { score, percentile, categoryLabel, submitted, input, setInput, feedback, submit } = hook;
  const inputRef = useRef(null);

  function handleKey(e) {
    if (e.key === 'Enter') {
      onInteract('fluency');
      submit(input);
      inputRef.current?.focus();
    }
  }

  function handleChange(e) {
    onInteract('fluency');
    setInput(e.target.value);
  }

  function handleSubmit() {
    onInteract('fluency');
    submit(input);
    inputRef.current?.focus();
  }

  const feedbackText =
    feedback === 'valid'     ? '+1' :
    feedback === 'invalid'   ? 'Not recognised' :
    feedback === 'duplicate' ? 'Already listed' : '';

  const feedbackColor =
    feedback === 'valid'     ? 'var(--pk)' :
    feedback === 'duplicate' ? 'var(--tx3)' : 'var(--tx2)';

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
      <PercentileGauge value={percentile} label="Word Storm" />

      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: '13px',
        color: 'var(--tx3)',
      }}>
        Score: {score}
      </div>

      <div style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: '1.5rem',
        color: 'var(--tx)',
      }}>
        {categoryLabel}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
        <input
          ref={inputRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder="Type a word…"
          style={{
            flex: 1,
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
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          style={{
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
      </div>

      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
        color: feedbackColor,
        minHeight: '18px',
      }}>
        {feedbackText}
      </div>

      {submitted.length > 0 && (
        <div style={{
          width: '100%',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          maxHeight: '130px',
          overflowY: 'auto',
          padding: '0.5rem',
          background: 'var(--bgp)',
          borderRadius: '8px',
        }}>
          {submitted.map(w => (
            <span key={w} style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: 'var(--tx)',
              background: 'var(--bgc)',
              border: '1px solid var(--bd)',
              borderRadius: '6px',
              padding: '2px 8px',
            }}>
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
