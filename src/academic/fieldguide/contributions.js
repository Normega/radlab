// Shared vocabulary for the gap-contribution surfaces (the gap board and the
// student's "Your contributions" page). One copy so the two pages can never
// state a different deadline or colour a tier differently.

export const DIFF = {
  green: { colour: '#2e7d32', label: 'green' },
  amber: { colour: '#b8860b', label: 'amber' },
  red:   { colour: '#c0392b', label: 'red' },
}
export const SEV = { block: '#c0392b', warn: '#b8860b' }

// The three contributions a student owes, in order. The board's intro prose
// and the dashboard's tracker both read these.
export const CONTRIBUTION_SLOTS = [
  { key: 'green',  tier: 'green', label: 'Green',   due: 'Oct 7' },
  { key: 'amber1', tier: 'amber', label: 'Amber 1', due: 'Nov 11' },
  { key: 'amber2', tier: 'amber', label: 'Amber 2', due: 'Nov 27' },
]

// Word targets. The syllabus asks for "roughly 250–500 words" per contribution;
// the form has two boxes, and a student asked (2026-09-29) which one that
// meant. It is both together: the finding box on its own is 60–400 (the
// precheck blocks under 60 and warns over 400 — those numbers live in
// precheck_submission() and must change with it), aiming at ~150, and the
// limitation box carries the rest. Submissions to date had a median of 157 +
// 92 = 263 words, so this describes what students were already doing.
export const WORDS = {
  foundMin: 60, foundMax: 400, foundAim: 150,
  limAim: 100,
  totalMin: 250, totalMax: 500,
}

// expire_claims() appends " · expired YYYY-MM-DD (14-day claim TTL)" to note
// (or writes only that). It is the system's bookkeeping, not a reviewer's
// words, so it is stripped — and a note counts as feedback only when a TA
// decision is recorded.
const SYSTEM_NOTE = /(?:\s*·\s*)?expired \d{4}-\d{2}-\d{2} \(14-day claim TTL\)/g
export const reviewerNote = (claim) => {
  if (!claim?.decided_at) return null
  const n = String(claim.note ?? '').replace(SYSTEM_NOTE, '').trim()
  return n || null
}

// Unsaved work survives a remount, a refresh, or a mis-click, without waiting
// for the student to press Save. Local only, per claim, and cleared the moment
// the server has the text — so it can never be the stale copy that wins.
export const draftKey = (id) => `fg-draft-${id}`
export const readDraft = (id) => {
  try { return JSON.parse(localStorage.getItem(draftKey(id)) ?? 'null') } catch { return null }
}
