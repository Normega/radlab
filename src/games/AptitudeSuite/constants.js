export const SESSION_DURATION_MS = 10 * 60 * 1000;
export const REVEAL_ANSWER_DURATION_MS = 2000;

export const ANAGRAM_MIDPOINT = 5;
export const ANAGRAM_K = 0.55;

export const FLUENCY_MIDPOINT = 7.5;
export const FLUENCY_K = 0.45;

export const WORDPROBE_MIDPOINT = 15;
export const WORDPROBE_K = 0.12;

export const WORDPROBE_YELLOW = '#F5C842';

export function logisticPercentile(score, midpoint, k) {
  if (score <= 0) return 0;
  return Math.min(99, Math.round(99 / (1 + Math.exp(-k * (score - midpoint)))));
}
