import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { nextPollDelay, PROGRESS_POLL_MIN_MS } from './roomProgress'

// How many have answered a check-in, polled from get_checkin_progress while
// `active` (the popcorn bowl is on screen). Polling, not Realtime, on purpose:
// a per-answer Realtime update would fan out to every phone in the room and
// can pass the plan's message limit in a full lecture (see the migration
// 20261021_checkin_progress.sql). Each phone starts at a random offset so a
// room of phones doesn't ask in lockstep, skips polls while the tab is hidden,
// and slows down while the count isn't changing. A failed poll keeps the last
// count and tries again later; it never shows a made-up number.
export function useCheckinProgress(checkinId, active) {
  const [state, setState] = useState({ checkinId: null, count: null })

  useEffect(() => {
    if (!checkinId || !active) return
    let cancelled = false
    let timer = null
    let delay = PROGRESS_POLL_MIN_MS
    let last = null

    async function poll() {
      if (cancelled) return
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        const { data, error } = await supabase.rpc('get_checkin_progress', { p_checkin_id: checkinId })
        if (cancelled) return
        if (!error && typeof data === 'number') {
          delay = nextPollDelay(delay, data !== last)
          last = data
          setState({ checkinId, count: data })
        } else {
          delay = nextPollDelay(delay, false)
        }
      }
      timer = setTimeout(poll, delay + Math.random() * 1000)
    }

    // First ask soon (the student just answered), but spread over a second.
    timer = setTimeout(poll, Math.random() * 1000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [checkinId, active])

  return state.checkinId === checkinId ? state.count : null
}
