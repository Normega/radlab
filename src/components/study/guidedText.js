// Pacing for GuidedTextBlock, shared with anything that needs to know how long
// a guided_text practice runs (e.g. the class RCT calendar).

const WPS = 2.2            // reading pace, words per second, deliberately slow
const LINGER = 2.5         // extra seconds on every line
const MIN_S = 4
const MAX_S = 16

export function lineSeconds(line) {
  if (line.quiet != null) return line.quiet
  if (line.seconds != null) return line.seconds
  const words = String(line.text ?? '').trim().split(/\s+/).filter(Boolean).length
  return Math.min(MAX_S, Math.max(MIN_S, words / WPS + LINGER))
}

export function practiceSeconds(step) {
  return (step.lines ?? []).reduce((a, l) => a + lineSeconds(l), 0)
}
