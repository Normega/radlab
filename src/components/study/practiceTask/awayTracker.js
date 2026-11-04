// Time spent away from the page during a practice task, and how many times the
// participant left it (another tab, a minimised window, a locked phone).
//
// Sandy's prototype counts both for the reading task; the breathing practice
// uses the same tracker, so the two arms report away time the same way.
//
// `doc` and `now` are injectable so the counting can be tested without a browser.

export function createAwayTracker({ doc = globalThis.document, now = () => performance.now() } = {}) {
  let hiddenMs = 0
  let since    = doc.hidden ? now() : null
  let count    = 0
  let stopped  = false

  const onChange = () => {
    if (doc.hidden) {
      if (since === null) { since = now(); count++ }
    } else if (since !== null) {
      hiddenMs += now() - since
      since = null
    }
  }
  doc.addEventListener('visibilitychange', onChange)

  return {
    /** Totals so far, without stopping. */
    read() {
      const open = since !== null ? now() - since : 0
      return { hidden_ms: Math.round(hiddenMs + open), left_page_count: count }
    },
    /** Stops listening and returns the totals; later calls return the same totals. */
    stop() {
      if (!stopped) {
        stopped = true
        doc.removeEventListener('visibilitychange', onChange)
        if (since !== null) { hiddenMs += now() - since; since = null }
      }
      return { hidden_ms: Math.round(hiddenMs), left_page_count: count }
    },
  }
}
