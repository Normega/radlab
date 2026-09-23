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

// Unsaved work survives a remount, a refresh, or a mis-click, without waiting
// for the student to press Save. Local only, per claim, and cleared the moment
// the server has the text — so it can never be the stale copy that wins.
export const draftKey = (id) => `fg-draft-${id}`
export const readDraft = (id) => {
  try { return JSON.parse(localStorage.getItem(draftKey(id)) ?? 'null') } catch { return null }
}
