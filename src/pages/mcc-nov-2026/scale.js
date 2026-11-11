// The MCC Summit talk's phone questionnaire (supabase/migrations/20261111_talk_poll_scale.sql).
//
// The statements are the 8-statement Sense Foraging Scale chosen after Study 2a
// (sense-foraging-scale repo: study2/decisions_after_2a.md, decisions 2 and 14;
// study2b/materials/sf2b-scale.json, scoring.sf8), in 2b's fixed order with 2b's
// 1-6 agree scale and wording. The Study 2a figures beside them (N = 500,
// osf.io/vt7gn) are from the Handbook's study2aResults.json (generated 2026-11-02):
// `agree` is the % agreeing (4-6) with the statement as worded.
//
// The scale is in development: 2b has not run. The talk says so, and this
// table is a room demo, never research data.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export const LIVE_POLL = 'mcc'
export const REHEARSAL_POLL = 'mcc-rehearsal'
export const FORM = 'sf8-2b'
export const ANCHOR = 'the sounds'   // the Toggle anchor for this talk

// ?poll=mcc-rehearsal on the deck URL points everything at the rehearsal poll.
export function pollCodeFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search).get('poll')
    return p && /^[a-z0-9][a-z0-9-]{1,39}$/.test(p) ? p : LIVE_POLL
  } catch { return LIVE_POLL }
}

// Norm's definition of the two modes, from the Study 2b vignettes' introduction
// (sf2b-vignettes.json, wording of 2 November 2026). Two statements name "the
// sensing mode", so the phone shows this before them.
export const MODES_INTRO = [
  'Our brains can toggle between two modes: a doing mode, which is goal-directed and uses knowledge we already have, and a sensing mode, which explores our sensory world to discover new things.',
  'In the doing mode, we look or listen to accomplish something, like finding our keys, or checking out a body ache or a strange sound outside.',
  'In the sensing mode, we look, listen, smell, taste or feel just out of curiosity, taking in whatever is there. Everyone does both at times, and neither is better.',
]

export const SCALE = [
  { value: 1, label: 'Strongly disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Mildly disagree' },
  { value: 4, label: 'Mildly agree' },
  { value: 5, label: 'Agree' },
  { value: 6, label: 'Strongly agree' },
]

export const ITEMS = [
  { code: 'N4', short: 'Notice light, colours and sounds with interest', text: 'As I go about my day, I notice the light, colours and sounds around me with interest', reversed: false, agree2a: 79.6 },
  { code: 'sf6_36', short: 'Moving into the sensing mode is a struggle', text: 'Moving into the sensing mode is a struggle for me', reversed: true, agree2a: 32.4 },
  { code: 'V10', short: 'Enjoy noticing how my body feels', text: 'I enjoy taking a moment just to notice how my body feels, like my breathing, the soles of my feet, or posture', reversed: false, agree2a: 75.6 },
  { code: 'sf6_27', short: 'Enjoy exploring sights, sounds and textures', text: 'I enjoy exploring the sights, sounds and textures of ordinary moments', reversed: false, agree2a: 87.0 },
  { code: 'sfc_36', short: 'Notice what I had missed, even in chores', text: 'Even in chores I have done many times, I notice sounds, smells or textures I had missed', reversed: false, agree2a: 72.0 },
  { code: 'U4', short: 'Pausing doesn’t change how I react to stress', text: 'Even when I pause to take in what is around me, I react to stress the same way', reversed: true, agree2a: 48.9 },
  { code: 'sfc_x2', short: 'Never the right time for the sensing mode', text: 'It never seems to be the right time to go into the sensing mode', reversed: true, agree2a: 40.6 },
  { code: 'sfc_35', short: 'Take a moment to explore what I see, hear, touch', text: 'During my day, I take a moment to explore what I can see, hear and touch', reversed: false, agree2a: 74.0 },
]

// Study 2a, the 8 (study2aResults.json, forms[form = 8]).
export const REF_2A = { n: 500, mean: 4.10, sd: 0.78, dPractice: 0.67 }

// A person's score: the mean of their answered statements, reversed ones
// recoded (7 - x), when at least 6 of the 8 were answered. Higher = more sensing.
export const MIN_ANSWERED = 6
export function personScore(answers) {
  const vals = ITEMS.map((it, k) => {
    const a = answers?.[k]
    if (a == null) return null
    return it.reversed ? 7 - a : a
  }).filter(v => v != null)
  if (vals.length < MIN_ANSWERED) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

// The room. rows: [{ person, answers: [1-6 | null] x 8 }].
export function scaleSummary(rows) {
  const scores = rows.map(r => personScore(r.answers)).filter(v => v != null)
  const bins = Array.from({ length: 10 }, (_, b) => ({ from: 1 + b * 0.5, n: 0 }))
  for (const s of scores) bins[Math.min(9, Math.floor((s - 1) / 0.5))].n++
  const items = ITEMS.map((it, k) => {
    const given = rows.map(r => r.answers?.[k]).filter(a => a != null)
    const agree = given.length ? (given.filter(a => a >= 4).length / given.length) * 100 : null
    // How far the room sits from 2a toward sensing on this statement: for a
    // reversed statement, agreeing less than 2a is the sensing direction.
    const gap = agree == null ? null : (it.reversed ? it.agree2a - agree : agree - it.agree2a)
    return { ...it, n: given.length, agree, gap }
  })
  const mean = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null
  // The statement the room found hardest: lowest sensing-direction agreement.
  const sensingShare = it => (it.agree == null ? null : it.reversed ? 100 - it.agree : it.agree)
  const scored = items.filter(it => it.agree != null)
  const hardest = scored.length ? scored.reduce((a, b) => (sensingShare(b) < sensingShare(a) ? b : a)) : null
  return { answered: rows.length, n: scores.length, mean, bins, items, hardest }
}

// Polls the results RPC every `ms` while `active`; keeps the last good rows on a
// failed read so a wifi blip doesn't blank the figure.
export function useScaleRows(code, active, ms = 2000) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  useEffect(() => {
    if (!active) return
    let alive = true
    const read = async () => {
      let res
      try { res = await supabase.rpc('talk_poll_scale_results', { p_code: code, p_form: FORM }) } catch (e) { res = { error: e } }
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
