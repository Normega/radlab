import { useEffect, useRef } from 'react';
import { PROMPT_FADE_CYCLES } from '../constants';

const AMBER = '#BA7517';
const BLUE  = '#185FA5';

// Phase fractions (relative to 4 000 ms cycle)
const PRESS_APPEAR   = 0.000;
const INHALE_APPEAR  = 0.125;  // +500 ms
const EXPAND_FADE    = 0.4375; // +1 750 ms
const RELEASE_APPEAR = 0.500;
const EXHALE_APPEAR  = 0.625;  // 0.500 + 0.125
const CONTRACT_FADE  = 0.9375; // 0.500 + 0.4375

// ── BreathPrompt ──────────────────────────────────────────────────────────
// Two-column instructional text driven by breath phase fractions.
// All DOM opacity updates are imperative via refs — no React state in the hot path.
//
// Props:
//   getPhase    — () => 0.0–1.0 within breath cycle
//   cycleCount  — total cycles completed
//   isReturning — if true, prompts fade out after PROMPT_FADE_CYCLES

export default function BreathPrompt({ getPhase, cycleCount = 0, isReturning = false }) {
  const outerRef   = useRef(null);
  const pressRef   = useRef(null);
  const inhaleRef  = useRef(null);
  const releaseRef = useRef(null);
  const exhaleRef  = useRef(null);

  // Outer fade for returning players — only re-runs when props change
  useEffect(() => {
    if (!outerRef.current) return;
    outerRef.current.style.opacity = (!isReturning || cycleCount < PROMPT_FADE_CYCLES) ? '1' : '0';
  }, [isReturning, cycleCount]);

  useEffect(() => {
    let raf = null;
    function frame() {
      const phase = getPhase ? getPhase() : 0;
      const pv = phase >= PRESS_APPEAR   && phase < EXPAND_FADE;
      const iv = phase >= INHALE_APPEAR  && phase < EXPAND_FADE;
      const rv = phase >= RELEASE_APPEAR && phase < CONTRACT_FADE;
      const ev = phase >= EXHALE_APPEAR  && phase < CONTRACT_FADE;
      if (pressRef.current)   pressRef.current.style.opacity   = pv ? '1' : '0';
      if (inhaleRef.current)  inhaleRef.current.style.opacity  = iv ? '1' : '0';
      if (releaseRef.current) releaseRef.current.style.opacity = rv ? '1' : '0';
      if (exhaleRef.current)  exhaleRef.current.style.opacity  = ev ? '1' : '0';
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [getPhase]);

  const initVisible = !isReturning || cycleCount < PROMPT_FADE_CYCLES;

  return (
    <div
      ref={outerRef}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 12,
        height: 36,
        opacity: initVisible ? 1 : 0,
        transition: 'opacity 0.8s ease',
      }}
    >
      {/* Left column: press / release — bold 20px, right-aligned */}
      <div style={{ position: 'relative', width: 90, height: 28 }}>
        <span ref={pressRef}   style={S.press}>press</span>
        <span ref={releaseRef} style={S.release}>release</span>
      </div>
      {/* Right column: inhale / exhale — regular 16px, left-aligned */}
      <div style={{ position: 'relative', width: 64, height: 22 }}>
        <span ref={inhaleRef} style={S.inhale}>inhale</span>
        <span ref={exhaleRef} style={S.exhale}>exhale</span>
      </div>
    </div>
  );
}

const BASE = {
  position: 'absolute',
  bottom: 0,
  fontFamily: '"DM Serif Display", serif',
  userSelect: 'none',
  transition: 'opacity 0.15s ease',
  whiteSpace: 'nowrap',
};

const S = {
  press:   { ...BASE, right: 0, fontSize: 20, fontWeight: '700', color: AMBER, opacity: 1  },
  release: { ...BASE, right: 0, fontSize: 20, fontWeight: '700', color: BLUE,  opacity: 0  },
  inhale:  { ...BASE, left:  0, fontSize: 16, fontWeight: '400', color: AMBER, opacity: 0  },
  exhale:  { ...BASE, left:  0, fontSize: 16, fontWeight: '400', color: BLUE,  opacity: 0  },
};
