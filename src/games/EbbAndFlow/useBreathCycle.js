import { useRef } from 'react';
import { BASELINE_BREATH_DURATION_MS } from './constants';

// ── useBreathCycle ────────────────────────────────────────────────────────
// All timing via useRef — never useState — to avoid stale closure bugs.
// Pattern mirrors PondWatch.jsx.
//
// getPhase() returns 0.0–1.0 within the current breath cycle:
//   0.0 = start of inhale
//   0.5 = start of exhale
//
// startBreath(durationMs) resets the clock for the new breath and returns
// a Promise that resolves when that breath duration has elapsed.

export function useBreathCycle() {
  const cycleStartRef    = useRef(null);
  const cycleDurationRef = useRef(BASELINE_BREATH_DURATION_MS);
  const resolversRef     = useRef([]); // pending resolve callbacks
  const timerRef         = useRef(null);

  function getPhase() {
    if (!cycleStartRef.current) return 0;
    const elapsed = performance.now() - cycleStartRef.current;
    return (elapsed % cycleDurationRef.current) / cycleDurationRef.current;
  }

  // Convert linear phase (0–1) to breath value:
  //   bT = 0 at exhale peak, bT = 1 at inhale peak
  function getBT(phase) {
    return (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
  }

  // Reset the cycle clock and return a Promise that resolves after durationMs.
  // Cancels any previous pending timer.
  function startBreath(durationMs) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    cycleDurationRef.current = durationMs;
    cycleStartRef.current = performance.now();

    return new Promise(resolve => {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        resolve();
      }, durationMs);
    });
  }

  function reset() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    cycleDurationRef.current = BASELINE_BREATH_DURATION_MS;
    cycleStartRef.current = performance.now();
  }

  return { getPhase, getBT, startBreath, reset, cycleDurationRef, cycleStartRef };
}
