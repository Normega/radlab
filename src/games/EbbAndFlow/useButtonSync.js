import { useRef } from 'react';

// ── useButtonSync ─────────────────────────────────────────────────────────
// Tracks PSI-AMP press/release phases and computes per-breath sync scores.
//
// Sync scoring:
//   Perfect press  = phase 0.0 (start of inhale)
//   Perfect release = phase 0.5 (start of exhale)
//
// Uses pointerdown/pointerup + setPointerCapture for unified mouse/touch.

export function useButtonSync(getPhase) {
  const pressPhaseRef  = useRef(null);   // phase at last press
  const isHeldRef      = useRef(false);  // currently held?
  const lastSyncRef    = useRef(0);      // most recent sync score

  function computeBreathSyncScore(pressPhase, releasePhase) {
    if (pressPhase === null) return 0;
    // Press score: 1.0 at phase 0.0, falls to 0 at phase 0.5
    const pressScore   = 1 - Math.min(pressPhase, 1 - pressPhase) * 2;
    // Release score: 1.0 at phase 0.5, falls to 0 at phase 0.0 and 1.0
    const releaseScore = 1 - Math.abs(releasePhase - 0.5) * 2;
    return Math.max(0, (pressScore + releaseScore) / 2);
  }

  // Call from pointerdown handler
  function onPress() {
    pressPhaseRef.current = getPhase();
    isHeldRef.current = true;
  }

  // Call from pointerup / pointerleave handler
  // Returns { pressPhase, releasePhase, syncScore } or null if no press was recorded
  function onRelease() {
    if (!isHeldRef.current) return null;
    const releasePhase = getPhase();
    const pressPhase   = pressPhaseRef.current;
    isHeldRef.current  = false;
    pressPhaseRef.current = null;

    const syncScore = computeBreathSyncScore(pressPhase, releasePhase);
    lastSyncRef.current = syncScore;
    return { pressPhase, releasePhase, syncScore };
  }

  return {
    onPress,
    onRelease,
    isHeldRef,
    lastSyncRef,
    computeBreathSyncScore,
  };
}
