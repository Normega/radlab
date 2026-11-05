import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useScrollToTopOn } from '../../lib/scrollToTop'
import { getScene, sceneSVG, reviewOverlay } from './scenes'
import { ReviewIcon, ReviewCross } from './ReviewIcons'
import './FoggyValleys.css'

// Foggy Valleys – review of what was missed (game step foggy_valleys_review,
// Sandy Study 4, D7 kept by Norm 2026-11-05). Once, after the task debrief, every
// picture the participant searched in both valleys comes back with the found and
// missed differences and the wrong clicks marked, and the missed ones described.
// Each picture already had the same marks on its own feedback screen; this is
// the whole set at once, after the debrief so it cannot colour those answers.
//
// It reads the participant's own foggy_valleys_pictures rows for this study and
// writes nothing. A failed read shows a retry and never skips ahead, because the
// rating screen after it measures the reaction to this review. The step's
// result carries how many pictures were shown and how long the review stayed
// open, for the session's step outputs.

const fogName = t => t === 'thick' ? 'heavy fog' : 'light mist'

async function readPictures(db, userId, studyId) {
  const { data, error } = await db.from('foggy_valleys_pictures')
    .select('picture_number, valley_number, fog, scene, found, total_differences, fog_cleared, record')
    .eq('user_id', userId).eq('study_id', studyId).eq('fog_cleared', true)
    .order('picture_number', { ascending: true })
  if (error) throw error
  return data ?? []
}

export default function FoggyValleysReview({ userId, studyId, supabaseClient, onSessionComplete, isSimMode = false }) {
  const db = supabaseClient ?? supabase
  const [state, setState] = useState({ pics: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const opened = useRef(null)
  const sent = useRef(false)
  useScrollToTopOn(state.pics ? 'loaded' : 'loading')

  useEffect(() => {
    if (isSimMode) { onSessionComplete?.({ simulated: true }); return }
    let live = true
    readPictures(db, userId, studyId)
      .then(pics => ({ pics, error: null }), error => { console.warn('foggy valleys review: read failed', error); return { pics: null, error } })
      .then(next => { if (live) { opened.current = performance.now(); setState(next) } })
    return () => { live = false }
  }, [db, userId, studyId, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isSimMode) return null
  if (state.error) {
    return (
      <div className="fv"><main className="fv-wrap fv-main"><section className="fv-card fv-intro">
        <p className="fv-err" role="alert">This part of the session could not load. Check your connection and try again.</p>
        <div className="fv-actions"><button type="button" className="fv-btn" onClick={() => { setState({ pics: null, error: null }); setAttempt(n => n + 1) }}>Try again</button></div>
      </section></main></div>
    )
  }
  if (!state.pics) return null

  const pics = state.pics
  const valleys = [...new Set(pics.map(p => p.valley_number))]

  function done() {
    if (sent.current) return
    sent.current = true
    onSessionComplete?.({ pictures_reviewed: pics.length, review_ms: Math.round(performance.now() - opened.current) })
  }

  return (
    <div className="fv"><main className="fv-wrap fv-main">
      <section className="fv-card fv-intro" style={{ marginBottom: 16 }}>
        <p className="fv-eyebrow">Spot the difference in the fog</p>
        <h1>The pictures you searched</h1>
        <div className="fv-prose">
          <p>{pics.length
            ? 'Here are the pictures again, from both valleys, with every difference marked. Take a look at what you found and what you missed, then press Continue at the bottom of the page.'
            : 'No picture cleared before the time ran out, so there is nothing to show here.'}</p>
        </div>
        {pics.length > 0 && (
          <div className="fv-legend">
            <span><ReviewIcon c="#2f9e44" /> found</span><span><ReviewIcon c="#e03131" dash /> not found</span>
            <span><ReviewCross /> click that was not on a difference</span>
          </div>
        )}
      </section>
      {valleys.map(v => {
        const these = pics.filter(p => p.valley_number === v)
        return (
          <section key={v}>
            <h2>Valley {v}: {fogName(these[0].fog)}</h2>
            <div className="fv-rgrid">
              {these.map(p => {
                const sc = getScene(p.scene - 1), foundIds = p.record?.foundIds ?? [], misses = p.record?.misses ?? []
                const missed = sc.diffs.filter(d => !foundIds.includes(d.id))
                return (
                  <article key={p.picture_number} className="fv-rcard">
                    <b>Found {p.found} of {p.total_differences}</b>
                    <div className="pic" dangerouslySetInnerHTML={{ __html: sceneSVG(sc, 'B', reviewOverlay(sc, foundIds, misses)) }} />
                    {missed.length
                      ? <ul>{missed.map(d => <li key={d.id}>{d.text}</li>)}</ul>
                      : <p className="fv-muted" style={{ margin: 0 }}>Every difference found.</p>}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
      <div className="fv-actions" style={{ marginTop: 24 }}><button type="button" className="fv-btn" onClick={done}>Continue</button></div>
    </main></div>
  )
}
