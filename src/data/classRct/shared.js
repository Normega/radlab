// Helpers shared by the class RCT's arms.

import { practiceSeconds } from '../../components/study/guidedText'

// Rough time for a step, in seconds. Guided text is exact (its own pacing);
// the rest are generous estimates of reading and typing time.
const stepSeconds = st => {
  switch (st.type) {
    case 'guided_text':     return practiceSeconds(st)
    case 'breath_practice': return 8 + 3 * 10 + (st.natural_seconds ?? 60) + 12 + 15
    case 'prompt_response': return st.required === false ? 20 : 50
    case 'multi_response':  return 10 * (st.count ?? 1)
    case 'quality_explorer': return 60
    case 'trigger_map':     return 90
    case 'body_diagram':    return 120
    case 'word_select':     return 20
    case 'thought_rating':  return 30
    case 'thought_choice':  return 15
    case 'training_response_multi': return 30
    case 'slider':          return 15
    case 'timer':           return (st.duration_seconds ?? 30) + 10
    case 'text':            return 20
    case 'closing':         return 15
    default:                return 10
  }
}
export const moduleMinutes = steps =>
  Math.max(1, Math.round(steps.reduce((a, st) => a + stepSeconds(st), 0) / 60))

// "About 5 minutes" / "About 1 minute" — the one phrasing every lead-in uses.
export const aboutMinutes = steps => {
  const n = moduleMinutes(steps)
  return `About ${n} minute${n === 1 ? '' : 's'}`
}

export const pad = d => String(d).padStart(2, '0')
