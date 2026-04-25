import { useEffect, useRef } from 'react';

// ── PsiAmpButton ──────────────────────────────────────────────────────────
//
// Props:
//   onPress        — called on pointerdown / spacebar
//   onRelease      — called on pointerup / pointerleave / spacebar release
//   isHeld         — boolean, controlled externally
//   showRing       — boolean: render sync ring (warmup only)
//   syncScore      — 0.0–1.0, drives ring fill + colour
//   disabled       — boolean: completely inert (response screen)

const RING_R = 52; // radius of SVG sync ring
const CIRC   = 2 * Math.PI * RING_R;

function ringColor(score) {
  if (score >= 0.80) return '#1D9E75'; // green
  if (score >= 0.50) return '#F0A500'; // amber
  return '#E05050';                     // red
}

export default function PsiAmpButton({ onPress, onRelease, isHeld, showRing, syncScore = 0, disabled = false }) {
  const btnRef   = useRef(null);
  const spaceRef = useRef(false); // prevent key repeat

  // Pointer events with capture — unified mouse + touch
  function handlePointerDown(e) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onPress?.();
  }
  function handlePointerUp(e) {
    if (disabled) return;
    onRelease?.();
  }
  function handlePointerLeave(e) {
    if (disabled) return;
    if (isHeld) onRelease?.();
  }

  // Spacebar equivalent
  useEffect(() => {
    if (disabled) return;
    function onKeyDown(e) {
      if (e.code === 'Space' && !spaceRef.current) {
        e.preventDefault();
        spaceRef.current = true;
        onPress?.();
      }
    }
    function onKeyUp(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        spaceRef.current = false;
        onRelease?.();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [disabled, onPress, onRelease]);

  const dashOffset = CIRC * (1 - Math.max(0, Math.min(1, syncScore)));
  const color      = ringColor(syncScore);

  return (
    <div style={S.wrap}>
      {/* Sync ring (warmup only) */}
      {showRing && (
        <svg width="120" height="120" style={S.ring}>
          {/* Track */}
          <circle cx="60" cy="60" r={RING_R}
            fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="6" />
          {/* Fill */}
          <circle cx="60" cy="60" r={RING_R}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={CIRC.toFixed(1)}
            strokeDashoffset={dashOffset.toFixed(1)}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
          />
        </svg>
      )}

      {/* Button */}
      <button
        ref={btnRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        disabled={disabled}
        style={{
          ...S.btn,
          background: isHeld
            ? 'var(--pk)'
            : disabled
              ? 'var(--bgp)'
              : 'var(--bgc)',
          color: isHeld ? '#fff' : disabled ? 'var(--tx3)' : 'var(--tx2)',
          boxShadow: isHeld
            ? '0 6px 28px rgba(240,104,164,0.45)'
            : '0 4px 18px rgba(0,0,0,0.10)',
          cursor: disabled ? 'default' : 'pointer',
          transform: isHeld ? 'scale(0.96)' : 'scale(1)',
        }}
        aria-label={isHeld ? 'Inhaling' : 'Hold to inhale'}
      >
        <span style={S.label}>
          {disabled ? '' : isHeld ? 'inhale' : ''}
        </span>
      </button>
    </div>
  );
}

const S = {
  wrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },
  ring: {
    position: 'absolute',
    top: 0, left: 0,
    pointerEvents: 'none',
  },
  btn: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    border: '2px solid var(--pkb)',
    fontFamily: '"Space Mono", monospace',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    transition: 'background 0.12s ease, color 0.12s ease, transform 0.1s ease, box-shadow 0.12s ease',
    outline: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    zIndex: 1,
  },
  label: {
    display: 'block',
    lineHeight: 1,
    pointerEvents: 'none',
  },
};
