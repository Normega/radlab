// Shared bits for the room poll (supabase/migrations/20261012_talk_polls.sql).
// The phone page writes through talk_poll_submit(); the deck reads
// talk_poll_results(), which returns one row per person per trial (latest
// answer) with people numbered, never identified.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CX, CY, INNER_R, OUTER_R, EMOTIONS, d2r, centerAngle } from '../../games/StillWater/constants'

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
// wifi blip doesn't blank a figure that already filled. `rpc` picks the results
// function: talk_poll_results (trials) or talk_poll_mood_results (mood check-in).
export function usePoll(code, active, ms = 2000, rpc = 'talk_poll_results') {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  useEffect(() => {
    if (!active) return
    let alive = true
    const read = async () => {
      let res
      try { res = await supabase.rpc(rpc, { p_code: code }) } catch (e) { res = { error: e } }
      if (!alive) return
      if (res.error) { setStatus('error'); return }
      setRows(res.data ?? []); setStatus('ok')
    }
    read()
    const id = setInterval(read, ms)
    return () => { alive = false; clearInterval(id) }
  }, [code, active, ms, rpc])
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

// ── Mood check-in (supabase/migrations/20261013_talk_poll_moods.sql) ─────────
// The phone taps StillWater's wheel: an emotion wedge (0-7) and intensity ring
// (0-2), or the neutral centre (both null). Wedges sit at fixed 45° slots, so a
// dot is placed by its wedge's own angle and ring, not by valence/arousal
// (see CircumplexScatter in lecture-lounge/ResultsView.jsx).

// Top of the wheel is Alert, bottom is Still: the vertical axis is arousal.
const UPPER = new Set([0, 1, 7])   // Alert, Excited, Tense
const LOWER = new Set([3, 4, 5])   // Calm, Still, Sad

export function moodBands(rows) {
  const up = rows.filter(r => UPPER.has(r.emotion_id)).length
  const down = rows.filter(r => LOWER.has(r.emotion_id)).length
  return { n: rows.length, up, down, mid: rows.length - up - down }
}

// Seeded by person, so a dot keeps its place across the 2 s re-reads instead of
// hopping each time (re-jittering on every read would shuffle the whole room).
function seeded(seed) {
  let t = (seed * 2654435761) >>> 0
  return () => {
    t = (t + 0x6D2B79F5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export function moodPoint(row) {
  const rnd = seeded(row.person * 31 + (row.emotion_id ?? 8) * 7 + (row.zone ?? 3))
  if (row.emotion_id == null) {
    const r = Math.sqrt(rnd()) * INNER_R * 0.6
    const a = rnd() * Math.PI * 2
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
  }
  const e = EMOTIONS.find(m => m.id === row.emotion_id)
  const zw = (OUTER_R - INNER_R) / 3
  const angle = centerAngle(e) + (rnd() - 0.5) * 30
  const radius = INNER_R + (row.zone + 0.5) * zw + (rnd() - 0.5) * zw * 0.7
  return { x: CX + radius * Math.cos(d2r(angle)), y: CY + radius * Math.sin(d2r(angle)) }
}
