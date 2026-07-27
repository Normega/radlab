import { useEffect, useState } from 'react'

const QUERY = '(min-width: 860px)'

// Inline styles can't carry a media query, so the two-column reading layout
// (table of contents beside the body, rather than stacked above it) needs the
// breakpoint in JS. Defaults to narrow — the stacked layout is the one that is
// always correct, so an SSR or no-matchMedia environment degrades to it.
export function useWideLayout() {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches
  )

  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return
    // No initial setWide here — the state initializer already read the query,
    // and setting state synchronously in an effect just cascades a render.
    const onChange = e => setWide(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return wide
}
