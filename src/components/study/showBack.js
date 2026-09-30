// Formatting for ShowBackBlock: a saved intervention_responses.response_text,
// in whichever shape its step type saved it, as readable text.

const BODY_LABELS = { body: 'Body', chest: 'Emotions', head: 'Thoughts', behavior: 'Behaviour' }

// response_text → readable text, by the shapes the renderer saves.
export function formatAnswer(raw) {
  if (raw == null) return null
  let v = raw
  try { v = JSON.parse(raw) } catch { return String(raw).trim() || null }
  if (typeof v === 'string') return v.trim() || null
  if (v == null || typeof v !== 'object') return String(v)
  if (Array.isArray(v.responses)) return v.responses.filter(s => String(s).trim()).join(' · ') || null
  if ('selected' in v) {
    const sel = Array.isArray(v.selected) ? v.selected.join(', ') : v.selected
    return [sel, v.other_text].filter(Boolean).join(': ') || null
  }
  const parts = Object.entries(v)
    .filter(([, x]) => typeof x === 'string' && x.trim())
    .map(([k, x]) => `${BODY_LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')}: ${x.trim()}`)
  return parts.join('\n') || null
}
