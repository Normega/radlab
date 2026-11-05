import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import FoggyValleys from './FoggyValleys'
import { VALLEY_ORDER_SLOT, fogFor } from './valleyOrder'

// Foggy Valleys as two session steps, one per valley (Sandy Study 4), so the
// platform's rating steps can sit between them. A game step has no per-step
// config, so the session-builder entry carries the position:
//   foggy_valleys_1 → the first valley, with the instructions
//   foggy_valleys_2 → the second valley
// The fog level comes from the assignment slot `valley_order`
// ('thin_first' | 'thick_first'), drawn and balanced by the server before the
// session starts. With no drawn value the step fails closed: it never picks an
// order itself.
//
// Both steps deal from one picture deck per participant and study (FoggyValleys
// seeds it from the ids). Each step starts after the highest picture number the
// participant already has saved in this study, so no picture is ever shown
// twice, including after a re-entry. If that read fails, the step does not
// start.

async function readDeckStart(db, userId, studyId) {
  const { data, error } = await db.from('foggy_valleys_pictures')
    .select('picture_number')
    .eq('user_id', userId).eq('study_id', studyId)
    .order('picture_number', { ascending: false }).limit(1)
  if (error) { console.warn('foggy valleys: deck position read failed', error); return { start: null, error } }
  return { start: data?.[0]?.picture_number ?? 0, error: null }
}

function FoggyValleysStep({ position, userId, studyId, supabaseClient, assignments, ...rest }) {
  const db = supabaseClient ?? supabase
  const fog = fogFor(position, assignments)
  const [deck, setDeck] = useState({ start: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!fog) return
    let live = true
    readDeckStart(db, userId, studyId)
      .catch(error => ({ start: null, error }))   // a failed read never starts the valley
      .then(next => { if (live) setDeck(next) })
    return () => { live = false }
  }, [fog, db, userId, studyId, attempt])

  if (!fog) {
    console.error(`foggy valleys: no valid drawn value for assignment slot "${VALLEY_ORDER_SLOT}"`, assignments)
    return <div className="fv"><main className="fv-wrap fv-main"><p className="fv-err" role="alert">This part of the session could not start. Please reload the page. If it happens again, contact the research team.</p></main></div>
  }
  if (deck.error) {
    return (
      <div className="fv"><main className="fv-wrap fv-main"><section className="fv-card fv-intro">
        <p className="fv-err" role="alert">This part of the session could not load. Check your connection and try again.</p>
        <div className="fv-actions"><button type="button" className="fv-btn" onClick={() => { setDeck({ start: null, error: null }); setAttempt(n => n + 1) }}>Try again</button></div>
      </section></main></div>
    )
  }
  if (deck.start == null) return null

  return (
    <FoggyValleys
      {...rest}
      studyMode userId={userId} studyId={studyId} supabaseClient={supabaseClient}
      config={{ valleys: [fog], valleyOffset: position - 1, totalValleys: 2, deckStart: deck.start }}
    />
  )
}

export const FoggyValleysFirst  = props => <FoggyValleysStep position={1} {...props} />
export const FoggyValleysSecond = props => <FoggyValleysStep position={2} {...props} />
