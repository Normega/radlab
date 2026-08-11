export const SESSION_DURATION_MS = 8 * 60 * 1000;
export const REVEAL_ANSWER_DURATION_MS = 2000;

export const ANAGRAM_MIDPOINT = 5;
export const ANAGRAM_K = 0.55;

export const FLUENCY_MIDPOINT = 7.5;
export const FLUENCY_K = 0.45;

// Recalibrated 2026-08-11 against the N=20 pilot, alongside the partial-credit change
// in useWordProbe.js. The old curve (midpoint 15, k 0.12) needed ~4-7 solved Wordles for
// the 50th percentile inside a budget shared with two other tasks, so the median
// displayed percentile was 0 against 56 (anagram) and 60 (fluency), deflating the
// overall avg_pct the score feedback is built on.
export const WORDPROBE_MIDPOINT = 10;
export const WORDPROBE_K = 0.20;

export const WORDPROBE_YELLOW = '#F5C842';

export function logisticPercentile(score, midpoint, k) {
  if (score <= 0) return 0;
  return Math.min(99, Math.round(99 / (1 + Math.exp(-k * (score - midpoint)))));
}
