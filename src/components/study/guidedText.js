// Pacing for GuidedTextBlock, shared with anything that needs to know how long
// a guided_text practice runs (e.g. the class RCT calendar).

const WPS = 2.2            // default reading pace, words per second: meditative
                           // (a step may set its own `wps`, e.g. 3 for a lesson)
const LINGER = 2.5         // extra seconds on every line
const MIN_S = 4
const MAX_S = 16

export function lineSeconds(line, wps = WPS) {
  if (line.quiet != null) return line.quiet
  if (line.seconds != null) return line.seconds
  const words = String(line.text ?? '').trim().split(/\s+/).filter(Boolean).length
  return Math.min(MAX_S, Math.max(MIN_S, words / wps + LINGER))
}

export function practiceSeconds(step) {
  return (step.lines ?? []).reduce((a, l) => a + lineSeconds(l, step.wps), 0)
}
