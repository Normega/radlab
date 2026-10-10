// Return the participant to the top when a step or page changes.
//
// Why window.scrollTo was not enough: a running session (SessionEntry,
// StudySessionRunner) renders inside a position:fixed panel with its own scroll
// area, so the window never scrolls and every window.scrollTo(0, 0) did nothing.
// On a phone, where a page is taller than the screen, the participant was left
// at the bottom of the new page, wherever they had tapped Next.
//
// So the scrolling panels mark themselves with `data-scroll-root`, and this
// scrolls the window and each of them. Instant, not smooth: a smooth scroll
// started in the click handler is cancelled on mobile by the browser's scroll
// anchoring as the new page swaps in. Called AFTER the new page has rendered
// (useScrollToTopOn), so there is nothing left to anchor against.
import { useLayoutEffect } from 'react'

export function scrollToTop(doc = globalThis.document, win = globalThis.window) {
  if (!doc) return
  for (const el of doc.querySelectorAll('[data-scroll-root]')) {
    if (el.scrollTop) el.scrollTop = 0
  }
  if (win?.scrollTo) win.scrollTo(0, 0)
  // A Next button that keeps focus can pull the viewport back down to it. Only
  // a button: an input the new page focuses on purpose (autoFocus) must keep it.
  const active = doc.activeElement
  if (active && active.tagName === 'BUTTON' && typeof active.blur === 'function') active.blur()
}

// Scroll to the top whenever `key` changes (a page or step number), after the
// new content has rendered. It also runs on mount, which is harmless: a new
// step or page should start at the top anyway.
export function useScrollToTopOn(key) {
  useLayoutEffect(() => {
    if (key === undefined) return
    scrollToTop()
  }, [key])
}
