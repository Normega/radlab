// ── breathUtils.js ─────────────────────────────────────────────────────────
//
// Pure signal-processing helpers. No React dependencies.
// Used by useTrialRunner (per-trial period) and BaselineScreen (epoch period).

// Estimate mean breath period (ms) from a uniformly-sampled breathValue array.
//
// samples     — breathValue (0–1) readings at uniform intervalMs spacing
// intervalMs  — sampling interval in ms (default 40ms ≈ 25 Hz)
//
// Method: 3-point smoothing → local-maxima peak detection → mean inter-peak interval.
// Returns null when < 2 peaks are found (e.g. short epoch, very slow breathing,
// or poor signal). Callers should store null and treat it as missing rather than 0.
//
// For 2-breath condition windows (~6–10 s total) expect exactly 1–2 inter-peak
// intervals; null is normal at low magnitudes — flag the row, don't drop the trial.

export function estimateBreathPeriodMs(samples, intervalMs = 40) {
  if (!samples || samples.length < 10) return null;

  // 3-point moving average — reduces BT packet jitter without introducing lag
  const smoothed = samples.map((v, i) =>
    i === 0 || i === samples.length - 1
      ? v
      : (samples[i - 1] + v + samples[i + 1]) / 3
  );

  // Local maxima above 0.55 threshold with 1 s refractory period
  const PEAK_THRESHOLD  = 0.55;
  const REFRACTORY_IDX  = Math.ceil(1000 / intervalMs);
  const peaks = [];

  for (let i = 1; i < smoothed.length - 1; i++) {
    if (
      smoothed[i] > smoothed[i - 1] &&
      smoothed[i] > smoothed[i + 1] &&
      smoothed[i] > PEAK_THRESHOLD
    ) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] > REFRACTORY_IDX) {
        peaks.push(i);
      }
    }
  }

  if (peaks.length < 2) return null;

  const intervals = peaks.slice(1).map((p, i) => (p - peaks[i]) * intervalMs);
  return intervals.reduce((a, b) => a + b, 0) / intervals.length;
}

// Safe mean — returns null for empty arrays
export function meanOf(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
