// Shared bits for the room poll (supabase/migrations/20261012_talk_polls.sql).
// The phone page writes through talk_poll_submit(); the deck reads
// talk_poll_results(), which returns one row per person per trial (latest
// answer) with people numbered, never identified.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export const LIVE_POLL = 'socpers'
export const REHEARSAL_POLL = 'socpers-rehearsal'

// ?poll=socpers-rehearsal on the deck URL points everything at the rehearsal poll.
export function pollCodeFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search).get('poll')
    return p && /^[a-z0-9][a-z0-9-]{1,39}$/.test(p) ? p : LIVE_POLL
  } catch { return LIVE_POLL }
}

// Polls results every `ms` while `active`. Returns { rows, status }: rows are []
// before the first read; status is 'loading' until a read returns, then 'ok' or
// 'error' for the latest read. A failed read keeps the last rows it had, so a
// wifi blip doesn't blank a figure that already filled.
export function usePoll(code, active, ms = 2000) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  useEffect(() => {
    if (!active) return
    let alive = true
    const read = async () => {
      let res
      try { res = await supabase.rpc('talk_poll_results', { p_code: code }) } catch (e) { res = { error: e } }
      if (!alive) return
      if (res.error) { setStatus('error'); return }
      setRows(res.data ?? []); setStatus('ok')
    }
    read()
    const id = setInterval(read, ms)
    return () => { alive = false; clearInterval(id) }
  }, [code, active, ms])
  return { rows, status }
}

export function usePollResults(code, active, ms = 2000) {
  return usePoll(code, active, ms).rows
}

// Noticing = answering "faster": both trials sped up.
export function summarize(rows) {
  const byTrial = { 1: [], 2: [] }
  for (const r of rows) byTrial[r.trial]?.push(r)
  const split = t => ({
    noticed: byTrial[t].filter(r => r.pace === 'faster').map(r => r.arousal),
    missed:  byTrial[t].filter(r => r.pace !== 'faster').map(r => r.arousal),
  })
  const people = new Map()
  for (const r of rows) {
    const p = people.get(r.person) ?? {}
    p[r.trial] = r
    people.set(r.person, p)
  }
  const both = [...people.values()].filter(p => p[1] && p[2])
  return {
    n1: byTrial[1].length,
    n2: byTrial[2].length,
    t1: split(1),
    t2: split(2),
    pairs: both.length,
    higherAfter2: both.filter(p => p[2].arousal > p[1].arousal).length,
    sameAfter2: both.filter(p => p[2].arousal === p[1].arousal).length,
  }
}

export const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
