// ── BCAT threshold: when a page's Continue counts ──────────────────────────
//
// Pure and node-testable (pageInput.test.mjs). Review item 10 (2026-11-19): Enter on a focused Continue button
// went straight through, so a participant who pressed Enter (or held it) could skip pages. The space bar is the
// pages' key (the window handler in BcatThreshold.jsx); a click counts only when it is a real pointer click.
//   - a click with detail 0 is one the browser made from the keyboard (Enter or Space on the focused button):
//     ignored. The space bar is handled once, by the window handler.
//   - nothing counts in the first MIN_PAGE_MS after the page appeared, so a double click or a key press meant for
//     the previous page cannot also continue this one.

export const MIN_PAGE_MS = 250

/** @param {{ detail: number, shownAt: number, now: number }} o  detail: the click event's (1 for the space bar) */
export function pageContinueAllowed({ detail, shownAt, now }) {
  if (!(detail > 0)) return false
  return now - shownAt >= MIN_PAGE_MS
}
