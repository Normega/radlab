import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Lecture slides for a class (/class/:slug/slides).
//
// The decks themselves are static HTML in public/<deckDir>/ — a self-contained
// slideshow engine (slides.js + slides.css) with one file per lecture. They are
// deliberately NOT React: a deck must open on a lectern machine, survive a dead
// dev server, print to PDF for a handout, and be editable by someone who knows
// HTML and not this codebase. The app's job is only to say which deck belongs
// to which lecture, and to link them from the place the instructor already is.
//
// A lecture with no deck file simply shows no link — a term whose decks are
// half-written degrades to the list of dates it already was.
const DECKS = {
  psy309: { dir: '/psy309', file: (n) => `L${n}.html` },
}

export default function ClassSlides() {
  const { slug } = useParams()
  const deck = DECKS[slug]

  const [cls, setCls] = useState(undefined)   // undefined = loading, null = none
  const [lectures, setLectures] = useState([])
  const [available, setAvailable] = useState(null) // Set of lecture numbers with a deck

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: c } = await supabase.from('classes')
        .select('id, slug, name').eq('slug', slug).maybeSingle()
      if (cancelled) return
      setCls(c ?? null)
      if (!c) return
      const { data: ls } = await supabase.from('lectures')
        .select('id, number, title, lecture_date')
        .eq('class_id', c.id).order('number')
      if (!cancelled) setLectures(ls ?? [])
    })()
    return () => { cancelled = true }
  }, [slug])

  // Which decks actually exist. A HEAD per lecture is cheap and keeps the
  // manifest honest without a second place to update when a deck is written.
  useEffect(() => {
    if (!deck || !lectures.length) return
    let cancelled = false
    Promise.all(lectures.map(l =>
      fetch(`${deck.dir}/${deck.file(l.number)}`, { method: 'HEAD' })
        .then(r => (r.ok ? l.number : null))
        .catch(() => null)
    )).then(found => {
      if (!cancelled) setAvailable(new Set(found.filter(n => n != null)))
    })
    return () => { cancelled = true }
  }, [deck, lectures])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  if (cls === undefined) return <Shell><p style={S.sub}>Loading…</p></Shell>
  if (!cls) return <Shell><p style={S.sub}>No class at /{slug}.</p></Shell>

  return (
    <Shell title={cls.name}>
      <p style={S.sub}>
        Lecture slides. Open one on the projector before class — <kbd style={S.kbd}>f</kbd> for
        fullscreen, <kbd style={S.kbd}>n</kbd> for speaker notes, <kbd style={S.kbd}>o</kbd> to
        jump around, <kbd style={S.kbd}>?</kbd> for the rest. Printing a deck gives you a
        handout with the notes included.
      </p>

      <div style={S.grid}>
        {lectures.map(l => {
          const has = available?.has(l.number)
          const isNext = l.lecture_date >= today
          const href = deck ? `${deck.dir}/${deck.file(l.number)}` : null
          const card = (
            <>
              <span style={S.num}>{String(l.number).padStart(2, '0')}</span>
              <span style={S.cardTitle}>{l.title}</span>
              <span style={S.meta}>
                {l.lecture_date}
                {available && !has && ' · not written yet'}
              </span>
            </>
          )
          return has ? (
            <a key={l.id} href={href} target="_blank" rel="noreferrer"
               style={{ ...S.card, ...(isNext ? S.cardNext : null) }}>{card}</a>
          ) : (
            <span key={l.id} style={{ ...S.card, ...S.cardEmpty }}>{card}</span>
          )
        })}
      </div>

      <p style={{ ...S.sub, marginTop: 26 }}>
        <Link to={`/class/${slug}/console`} style={S.link}>Console</Link>
        {' · '}
        <Link to={`/class/${slug}/remote`} style={S.link}>Remote</Link>
        {' · '}
        <Link to={`/class/${slug}/screen`} style={S.link}>Projector screen</Link>
      </p>
    </Shell>
  )
}

function Shell({ title, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '30px 18px 70px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <p style={S.eyebrow}>Lecture Lounge</p>
        <h1 style={S.h1}>{title ?? 'Slides'}</h1>
        {children}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  h1: { fontFamily: SERIF, fontSize: 30, color: 'var(--tx)', margin: '2px 0 10px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: '74ch' },
  link: { color: 'var(--pk)', textDecoration: 'none' },
  kbd: { fontFamily: MONO, fontSize: 12, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 4, padding: '1px 5px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 12, marginTop: 20 },
  card: { display: 'flex', flexDirection: 'column', gap: 5, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '15px 17px', textDecoration: 'none', position: 'relative' },
  cardNext: { borderColor: 'var(--pk)' },
  cardEmpty: { opacity: 0.5, borderStyle: 'dashed' },
  num: { fontFamily: MONO, fontSize: 11, color: 'var(--tx2)', letterSpacing: 1 },
  cardTitle: { fontFamily: SERIF, fontSize: 18, color: 'var(--tx)', lineHeight: 1.25 },
  meta: { fontFamily: MONO, fontSize: 11, letterSpacing: .5, textTransform: 'uppercase', color: 'var(--tx2)' },
}
