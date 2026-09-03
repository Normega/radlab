// Word counting and capping, shared by the two free-text components
// (OpenTextListQuestion's per-row factors and OpenTextQuestion's single
// response). Extracted 2026-09-03 when the plain open-text component was added
// — the rules were already written once for the list and must not drift, or a
// "5-word cap" would mean two different things on two screens.

export function countWords(text) {
  const trimmed = String(text ?? '').trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

// Trims to `maxWords` while the participant types. Uses trimStart (not trim)
// so a trailing space survives — otherwise the cap fights the user mid-word,
// deleting the space they just typed to start the next word.
export function clampWords(text, maxWords) {
  if (maxWords == null) return text
  const words = String(text ?? '').trimStart().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}
