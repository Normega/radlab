// Percentile calibration for ColorMax's avg_coverage/avg_precision, which are
// already 0-100 percentage-like values (unlike Aptitude Suite's raw counts) —
// see src/games/AptitudeSuite/constants.js for the raw-count-calibrated version
// of the same logistic curve. Midpoint/k below are provisional (no population
// data yet); recalibrate once real ColorMax session data accumulates.
export const COVERAGE_MIDPOINT  = 50
export const COVERAGE_K         = 0.08
export const PRECISION_MIDPOINT = 50
export const PRECISION_K        = 0.08

export function logisticPercentile(score, midpoint, k) {
  if (score <= 0) return 0
  return Math.min(99, Math.round(99 / (1 + Math.exp(-k * (score - midpoint)))))
}
