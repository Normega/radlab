import { useEffect, useRef, useState } from 'react';
import { PROMPT_FADE_CYCLES } from '../constants';

const AMBER = '#BA7517';
const BLUE  = '#185FA5';

function getTextState(phase) {
  if (phase < 0.05) return { text: 'press',   bold: true,  color: AMBER };
  if (phase < 0.50) return { text: 'inhale',  bold: false, color: AMBER };
  if (phase < 0.55) return { text: 'release', bold: true,  color: BLUE  };
  return               { text: 'exhale',  bold: false, color: BLUE  };
}

// ── BreathPrompt ──────────────────────────────────────────────────────────
// Staggered instructional text driven by breath phase.
//
// Props:
//   getPhase    — () => 0.0–1.0 within breath cycle
//   cycleCount  — total cycles completed
//   isReturning — if true, prompts fade out after PROMPT_FADE_CYCLES

export default function BreathPrompt({ getPhase, cycleCount = 0, isReturning = false }) {
  const [display,      setDisplay]      = useState(getTextState(0));
  const [innerOpacity, setInnerOpacity] = useState(1);
  const textKeyRef  = useRef(getTextState(0).text);
  const pendingRef  = useRef(null);
  const rafRef      = useRef(null);

  useEffect(() => {
    function frame() {
      const phase    = getPhase ? getPhase() : 0;
      const newState = getTextState(phase);

      if (newState.text !== textKeyRef.current && !pendingRef.current) {
        textKeyRef.current = newState.text;
        setInnerOpacity(0);
        pendingRef.current = setTimeout(() => {
          setDisplay(newState);
          setInnerOpacity(1);
          pendingRef.current = null;
        }, 150);
      }
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (pendingRef.current) clearTimeout(pendingRef.current);
    };
  }, [getPhase]);

  // Fade out entire prompt for returning players after N cycles
  const outerVisible = !isReturning || cycleCount < PROMPT_FADE_CYCLES;

  return (
    <div style={{
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: outerVisible ? 1 : 0,
      transition: 'opacity 0.8s ease',
    }}>
      <span style={{
        fontFamily: '"DM Serif Display", serif',
        fontSize: 28,
        fontWeight: display.bold ? 700 : 400,
        color: display.color,
        opacity: innerOpacity,
        transition: 'opacity 0.15s ease',
        userSelect: 'none',
      }}>
        {display.text}
      </span>
    </div>
  );
}
