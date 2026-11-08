// The live Toggle practice (supabase/migrations/20261108_talk_poll_toggles.sql).
// Phones record taps; talk_poll_toggle_results() returns every tap in the
// current round with people numbered. Everything the deck shows is computed
// here from those taps, so the phone's own summary and the room's agree.
//
// A person's practice: Begin (t = 0) puts them in SENSE. A STORY tap means "I
// notice I'm thinking"; a SENSE tap means "I'm back with the breath". Repeated
// taps of the same mode change nothing. 'end' (or the two minutes running out)
// closes the practice.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export const LIVE_POLL = 'tanenbaum'
export const REHEARSAL_POLL = 'tanenbaum-rehearsal'
export const PRACTICE_S = 120
const PRACTICE_MS = PRACTICE_S * 1000

export const STORY = '#4A90D9'
export const SENSE = '#f068a4'

// ?poll=tanenbaum-rehearsal on the deck URL points everything at the rehearsal poll.
export function pollCodeFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search).get('poll')
    return p && /^[a-z0-9][a-z0-9-]{1,39}$/.test(p) ? p : LIVE_POLL
  } catch { return LIVE_POLL }
}

// One person's taps → segments [{ mode, from, to }] in ms, plus whether they
// finished. `nowMs` is how far into their practice they are now (for someone
// still going); it closes their last open segment.
export function segmentsOf(taps, nowMs) {
  const sorted = [...taps].sort((a, b) => a.t_ms - b.t_ms)
  const segs = []
  let mode = null, from = 0, ended = false, endAt = null
  for (const t of sorted) {
    if (t.mode === 'begin') { if (mode === null) { mode = 'sense'; from = 0 } continue }
    if (t.mode === 'end') { ended = true; endAt = Math.min(t.t_ms, PRACTICE_MS); break }
    if (mode === null) { mode = 'sense'; from = 0 }
    if (t.mode === mode) continue
    if (t.t_ms >= PRACTICE_MS) break
    segs.push({ mode, from, to: t.t_ms })
    mode = t.mode; from = t.t_ms
  }
  if (mode === null) return { segs: [], ended, current: null, at: 0 }
  const close = ended ? endAt : Math.min(nowMs, PRACTICE_MS)
  if (close > from) segs.push({ mode, from, to: close })
  const finished = ended || nowMs >= PRACTICE_MS
  return { segs, ended: finished, current: finished ? null : mode, at: close }
}

// Personal summary: share of time sensing, how often they came back, and the
// time with the breath before each noticed drift.
export function personStats(segs) {
  const total = segs.reduce((s, g) => s + (g.to - g.from), 0)
  const sensed = segs.filter(g => g.mode === 'sense').reduce((s, g) => s + (g.to - g.from), 0)
  let returns = 0, drifts = []
  for (let k = 0; k < segs.length; k++) {
    const g = segs[k], nx = segs[k + 1]
    if (g.mode === 'story' && nx?.mode === 'sense') returns++
    if (g.mode === 'sense' && nx?.mode === 'story') drifts.push(g.to - g.from)
  }
  return { total, sensed, share: total ? sensed / total : null, returns, drifts, noticed: drifts.length }
}

export const median = a => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// The room. rows: [{ person, t_ms, mode, secs_ago }].
export function roomSummary(rows, binS = 5) {
  const byPerson = new Map()
  for (const r of rows) {
    if (!byPerson.has(r.person)) byPerson.set(r.person, [])
    byPerson.get(r.person).push(r)
  }
  const people = []
  for (const taps of byPerson.values()) {
    // How far in are they now: their latest tap's position plus the time since it arrived.
    const last = taps.reduce((a, b) => (b.secs_ago < a.secs_ago ? b : a))
    const nowMs = last.t_ms + Math.max(0, last.secs_ago) * 1000
    const p = segmentsOf(taps, nowMs)
    if (p.segs.length) people.push({ ...p, ...personStats(p.segs) })
  }
  const going = people.filter(p => !p.ended)
  const nBins = Math.ceil(PRACTICE_S / binS)
  const bins = Array.from({ length: nBins }, (_, b) => {
    const t = (b + 0.5) * binS * 1000
    let s = 0, n = 0
    for (const p of people) {
      const g = p.segs.find(x => t >= x.from && t < x.to)
      if (!g) continue
      n++; if (g.mode === 'sense') s++
    }
    return { t: b * binS, n, share: n ? s / n : null }
  })
  const drifts = people.flatMap(p => p.drifts)
  const returns = people.map(p => p.returns)
  return {
    n: people.length,
    going: going.length,
    sensingNow: going.filter(p => p.current === 'sense').length,
    thinkingNow: going.filter(p => p.current === 'story').length,
    done: people.length - going.length,
    bins,
    medianDriftS: drifts.length ? median(drifts) / 1000 : null,
    drifts: drifts.length,
    returnsTotal: returns.reduce((s, v) => s + v, 0),
    medianReturns: median(returns),
    cameBack: people.filter(p => p.returns > 0).length,
    noDrift: people.filter(p => p.noticed === 0).length,
    shares: people.map(p => p.share).filter(v => v != null),
  }
}

// Polls a results RPC every `ms` while `active`; keeps the last good rows on a
// failed read so a wifi blip doesn't blank the figure.
export function useRows(rpc, code, active, ms = 2000) {
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
  }, [rpc, code, active, ms])
  return { rows, status }
}
