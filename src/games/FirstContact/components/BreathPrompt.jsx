import { useEffect, useRef } from 'react';

const AMBER = '#BA7517';
const BLUE  = '#185FA5';

// ── BreathPrompt ──────────────────────────────────────────────────────────
// Single phrase that flashes at each phase transition then fades linearly
// over the first 10% of the half-cycle (~400ms at 4s default).
//
// Prompts are active only when sync < 50% AND at least 1 cycle has completed.
// This is universal — no separate paths for first-time vs returning players.
//
// Props:
//   getPhase   — () => 0.0–1.0 within breath cycle
//   syncLevel  — 0.0–1.0 rolling mean (prompts suppress at ≥ 0.50)
//   cycleCount — total completed cycles this session (prompts wait for cycle 1)

export default function BreathPrompt({ getPhase, syncLevel = 0, cycleCount = 0 }) {
  const divRef   = useRef(null);
  const syncRef  = useRef(syncLevel);
  const cycleRef = useRef(cycleCount);

  useEffect(() => { syncRef.current  = syncLevel;  }, [syncLevel]);
  useEffect(() => { cycleRef.current = cycleCount; }, [cycleCount]);

  useEffect(() => {
    let raf = null;
    function frame() {
      const phase         = getPhase ? getPhase() : 0;
      const promptsActive = syncRef.current < 0.50 && cycleRef.current >= 1;

      if (divRef.current) {
        if (promptsActive) {
          const inExpansion = phase < 0.5;
          const phaseInHalf = inExpansion ? phase : phase - 0.5;
          const opacity     = phaseInHalf < 0.10 ? 1 - (phaseInHalf / 0.10) : 0;
          divRef.current.style.opacity  = opacity.toFixed(3);
          divRef.current.textContent    = inExpansion ? 'Press and Inhale' : 'Release and Exhale';
          divRef.current.style.color    = inExpansion ? AMBER : BLUE;
        } else {
          divRef.current.style.opacity = '0';
        }
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [getPhase]);

  return (
    <div
      ref={divRef}
      style={{
        fontFamily: '"DM Serif Display", serif',
        fontSize: 20,
        textAlign: 'center',
        userSelect: 'none',
        opacity: 0,
        height: 28,
      }}
    />
  );
}
