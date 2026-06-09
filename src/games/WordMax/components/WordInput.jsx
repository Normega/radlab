import { useRef } from 'react';

// Controlled input: uppercase only, blocks letters not available in the remaining pool.
// All character keypresses are intercepted — do NOT rely on text-transform alone,
// which breaks cursor position on some browsers.
export default function WordInput({ value, onChange, onSubmit, remainingPool, disabled }) {
  const inputRef = useRef(null);

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
      return;
    }

    // Let control keys (Backspace, Delete, arrows, Tab, etc.) through normally.
    if (e.key.length > 1) return;

    e.preventDefault();

    const letter = e.key.toUpperCase();
    if (!/[A-Z]/.test(letter)) return;

    // Compute remaining pool from letters before the cursor (prefix).
    const start = e.target.selectionStart ?? value.length;
    const end   = e.target.selectionEnd   ?? value.length;
    const prefix = value.slice(0, start);
    const pool   = remainingPool(prefix);

    if (!pool[letter] || pool[letter] <= 0) return; // letter not available

    const newValue = value.slice(0, start) + letter + value.slice(end);
    onChange(newValue);

    // Restore cursor position after React re-renders the input.
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(start + 1, start + 1);
    });
  }

  return (
    <div style={S.wrap}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={() => {}} // fully controlled via keydown
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="TYPE YOUR WORD"
        style={S.input}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || value.length === 0}
        style={{ ...S.btn, opacity: disabled || value.length === 0 ? 0.5 : 1 }}
      >
        Submit
      </button>
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex',
    gap: 8,
    width: '100%',
    maxWidth: 480,
  },
  input: {
    flex: 1,
    fontFamily: '"Space Mono", monospace',
    fontSize: 18,
    letterSpacing: '0.12em',
    color: 'var(--tx)',
    background: '#fff',
    border: '1.5px solid var(--bd)',
    borderRadius: 10,
    padding: '10px 14px',
    outline: 'none',
    textTransform: 'uppercase',
  },
  btn: {
    background: 'var(--pk)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 22px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    whiteSpace: 'nowrap',
  },
};
