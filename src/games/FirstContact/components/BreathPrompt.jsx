import { useEffect, useRef } from 'react';
import { PROMPT_FADE_CYCLES } from '../constants';

const AMBER = '#BA7517';
const BLUE  = '#185FA5';

// ── BreathPrompt ──────────────────────────────────────────────────────────
// Two-column staggered instructional text driven by breath phase.
// Left word (press/release) appears at zone transition.
// Right word (inhale/exhale) appears 500ms later, tracked via RAF timer.
// All DOM updates are imperative via refs — no React state in the hot path.
//
// Props:
//   getPhase    — () => 0.0–1.0 within breath cycle
//   cycleCount  — total cycles completed
//   isReturning — if true, prompts fade out after PROMPT_FADE_CYCLES

export default function BreathPrompt({ getPhase, cycleCount = 0, isReturning = false }) {
  const outerRef          = useRef(null);
  const leftRef           = useRef(null);
  const rightRef          = useRef(null);
  const lastZoneRef       = useRef(null);
  const transitionTimeRef = useRef(null);
  const rightShownRef     = useRef(false);
  const pendingLeftRef    = useRef(null);

  // Outer fade for returning players — only updates when props change
  useEffect(() => {
    if (!outerRef.current) return;
    outerRef.current.style.opacity = (!isReturning || cycleCount < PROMPT_FADE_CYCLES) ? '1' : '0';
  }, [isReturning, cycleCount]);

  useEffect(() => {
    // Initialize: show 'press' immediately, 'inhale' will appear after 500ms
    lastZoneRef.current = 'inhale';
    transitionTimeRef.current = performance.now();
    rightShownRef.current = false;
    pendingLeftRef.current = null;

    if (leftRef.current) {
      leftRef.current.textContent = 'press';
      leftRef.current.style.color = AMBER;
      leftRef.current.style.fontWeight = '700';
      leftRef.current.style.opacity = '1';
    }
    if (rightRef.current) {
      rightRef.current.style.opacity = '0';
    }

    let raf = null;

    function frame() {
      // Apply pending left word update — runs one frame after opacity dips to 0
      if (pendingLeftRef.current !== null) {
        const z = pendingLeftRef.current;
        pendingLeftRef.current = null;
        if (leftRef.current) {
          leftRef.current.textContent = z === 'inhale' ? 'press' : 'release';
          leftRef.current.style.color = z === 'inhale' ? AMBER : BLUE;
          leftRef.current.style.fontWeight = '700';
          leftRef.current.style.opacity = '1';
        }
      }

      const phase = getPhase ? getPhase() : 0;
      const now   = performance.now();
      const zone  = phase < 0.5 ? 'inhale' : 'exhale';

      if (zone !== lastZoneRef.current) {
        lastZoneRef.current = zone;
        transitionTimeRef.current = now;
        rightShownRef.current = false;
        pendingLeftRef.current = zone;

        if (leftRef.current)  leftRef.current.style.opacity  = '0';
        if (rightRef.current) rightRef.current.style.opacity = '0';
      }

      // After 500ms, fade in right direction word
      if (!rightShownRef.current &&
          transitionTimeRef.current !== null &&
          now - transitionTimeRef.current >= 500) {
        rightShownRef.current = true;
        if (rightRef.current) {
          rightRef.current.textContent = lastZoneRef.current === 'inhale' ? 'inhale' : 'exhale';
          rightRef.current.style.color = lastZoneRef.current === 'inhale' ? AMBER : BLUE;
          rightRef.current.style.fontWeight = '400';
          rightRef.current.style.opacity = '1';
        }
      }

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
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        opacity: initVisible ? 1 : 0,
        transition: 'opacity 0.8s ease',
      }}
    >
      <span
        ref={leftRef}
        style={{
          fontFamily: '"DM Serif Display", serif',
          fontSize: 28,
          userSelect: 'none',
          transition: 'opacity 0.15s ease',
          minWidth: 96,
          textAlign: 'right',
          display: 'inline-block',
        }}
      />
      <span
        ref={rightRef}
        style={{
          fontFamily: '"DM Serif Display", serif',
          fontSize: 28,
          userSelect: 'none',
          transition: 'opacity 0.15s ease',
          opacity: 0,
          minWidth: 96,
          textAlign: 'left',
          display: 'inline-block',
        }}
      />
    </div>
  );
}
