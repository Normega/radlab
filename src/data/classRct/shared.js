// Helpers shared by the class RCT's arms.

import { practiceSeconds, lineSeconds } from '../../components/study/guidedText'

// Rough time for a step, in seconds. Guided text is exact (its own pacing);
// the rest are generous estimates of reading and typing time.
const stepSeconds = st => {
  switch (st.type) {
    case 'guided_text':     return practiceSeconds(st)
    case 'breath_practice': return 8 + 3 * 10 + (st.natural_seconds ?? 60) + 12 + 15
    case 'prompt_response': return st.required === false ? 20 : st.size === 'single_line' ? 25 : 50
    case 'multi_response':  return 10 * (st.count ?? 1)
    case 'quality_explorer': return 60
    case 'trigger_map':     return 90
    case 'body_diagram':    return 120
    case 'word_select':     return 20
    case 'thought_rating':  return 30
    case 'thought_choice':  return 15
    case 'training_response_multi': return 30
    case 'slider':          return 15
    case 'show_back':       return 15
    case 'timer':           return (st.duration_seconds ?? 30) + 10
    case 'text':            return 20
    case 'closing':         return 15
    default:                return 10
  }
}

// Steps behind a `show_if … equals` are alternatives: only one branch per key is
// ever seen (a choice day's three practices; Graduation's Yes follow-ups). A
// module's length is its unconditional steps plus its longest branch per key.
export const moduleSeconds = steps => {
  const branches = {}   // key → { value → seconds }
  let base = 0
  for (const st of steps) {
    const c = st.show_if
    if (c && c.equals !== undefined) {
      const byVal = (branches[c.key] ??= {})
      byVal[c.equals] = (byVal[c.equals] ?? 0) + stepSeconds(st)
    } else {
      base += stepSeconds(st)
    }
  }
  return base + Object.values(branches).reduce((a, byVal) => a + Math.max(...Object.values(byVal)), 0)
}

export const moduleMinutes = steps => Math.max(1, Math.round(moduleSeconds(steps) / 60))

// "About 5 minutes" / "About 1 minute" — the one phrasing every lead-in uses.
export const aboutMinutes = steps => {
  const n = moduleMinutes(steps)
  return `About ${n} minute${n === 1 ? '' : 's'}`
}

export const pad = d => String(d).padStart(2, '0')

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
  return lines.flatMap((l, i) => {
    if (l.quiet == null) return [l]
    if (keep.has(i)) return [{ ...l, quiet: Math.max(MIN_QUIET, Math.round((l.quiet * room) / keptTotal)) }]
    return l.text ? [asLine(l)] : []
  })
}
