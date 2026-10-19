// Helpers shared by the class RCT's arms.

import { lineSeconds } from '../../components/study/guidedText'

// The one length every lead-in states (Norm, 2026-10-18). Lead-ins used to
// compute "About N minutes" from their own steps, but that counted 25 s for a
// written answer (students take about 50) and nothing for the screens around
// the practice, so they said 1 to 4 minutes for check-ins that ran longer: on
// the trial's first two days the whole check-in took a median of 4 to 5 minutes
// in all three arms, and the stress-mindset days that said "About 3 minutes"
// took about 5. Every day now states the measured range, not a per-day guess.
export const SESSION_LENGTH = 'About 4 to 5 minutes'

export const pad = d => String(d).padStart(2, '0')

// The light rule (Norm, 2026-09-30: no more than five minutes a day, the same
// commitment as the Sense Foraging exercises). Every written answer is a single
// line — a sentence is enough — rather than a paragraph box. Optional boxes keep
// their own hint.
const LIGHT_HINT = 'A sentence is enough…'
export const lightStep = st =>
  st.type === 'prompt_response' && st.required !== false && st.size !== 'single_line'
    ? { ...st, size: 'single_line', placeholder: LIGHT_HINT }
    : st

// Apply the light rule to a whole module.
export const lighten = m => ({ ...m, steps: m.steps.map(lightStep) })

// Fit a script to a time cap by trimming its quiet stretches, never its words.
// Keeps the few longest quiet stretches (fewer, longer silences rather than
// many short ones: every quiet stretch ends on a tone, and a few seconds is too
// short to close one's eyes), scales them to the room left after the spoken
// lines, and turns any dropped quiet stretch's words into an ordinary line.
const MIN_QUIET = 12
export function fitLines(lines, capSeconds, wps) {
  const asLine = l => ({ text: l.text })
  // Worst case for talk: every quiet stretch's words become a line.
  const talk = lines.reduce((a, l) => a + (l.quiet == null ? lineSeconds(l, wps) : l.text ? lineSeconds(asLine(l), wps) : 0), 0)
  const room = Math.max(0, capSeconds - talk)
  const quiets = lines.map((l, i) => ({ l, i })).filter(x => x.l.quiet != null).sort((a, b) => b.l.quiet - a.l.quiet)
  const k = Math.min(quiets.length, Math.max(room >= MIN_QUIET ? 1 : 0, Math.floor(room / 20)))
  const kept = quiets.slice(0, k)
  const keep = new Set(kept.map(x => x.i))
  const keptTotal = kept.reduce((a, x) => a + x.l.quiet, 0) || 1
  // Only ever shrink: a script already inside the cap keeps its own pauses.
  const scale = Math.min(1, room / keptTotal)
  return lines.flatMap((l, i) => {
    if (l.quiet == null) return [l]
    if (keep.has(i)) return [{ ...l, quiet: Math.max(MIN_QUIET, Math.round(l.quiet * scale)) }]
    return l.text ? [asLine(l)] : []
  })
}
