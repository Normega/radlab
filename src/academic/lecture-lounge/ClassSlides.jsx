import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
// Cross-partition import, deliberately: weekIcons is a pure asset registry
// (a glob over src/assets/week-icons/) with no fieldguide behavior attached.
import { weekIcon } from '../fieldguide/wiki/weekIcons'
import { normalizeCourseCode, loungePath } from '../courseRoutes'

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
  psy309: {
    dir: '/psy309',
    file: (n) => `L${n}.html`,
    // Lecture numbers count the 12 meetings; week icons are keyed by calendar
    // week, which also counts reading week (between lectures 7 and 8).
    iconWeek: (n) => (n <= 7 ? n : n + 1),
  },
  psy240: {
    dir: '/psy240',
    file: (n) => `L${n}.html`,
    // Same shape as psy309: reading week sits between meeting days 7 and 8.
    iconWeek: (n) => (n <= 7 ? n : n + 1),
  },
}

export default function ClassSlides() {
  const { courseCode, slug: slugParam } = useParams()
  const slug = normalizeCourseCode(courseCode ?? slugParam)
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

  // Which decks actually exist — probed rather than listed in a manifest, so
  // writing a deck is the only step needed to publish it.
  //
  // A HEAD (or a bare GET) cannot answer this: vercel.json rewrites every
  // unmatched path to /index.html, so a missing deck returns 200 with the SPA
  // in it and every lecture looks available. Instead we read the first bytes
  // and look for the deck marker. Range keeps it to ~2KB per lecture where the
  // CDN honours it, and a server that ignores Range just sends more.
  //
  // cache: 'no-store' is load-bearing: without it Chrome stored the 206
  // partial under the DECK's own URL, and the next click on that deck — a
  // full navigation meeting a partial cache entry — could fail outright with
  // "can't open page" until a reload or two replaced the entry (Norm,
  // 2026-09-02). The probe must never write to the HTTP cache.
  useEffect(() => {
    if (!deck || !lectures.length) return
    let cancelled = false
    Promise.all(lectures.map(l =>
      fetch(`${deck.dir}/${deck.file(l.number)}`, { headers: { Range: 'bytes=0-2047' }, cache: 'no-store' })
        .then(r => (r.ok ? r.text() : ''))
        .then(t => (t.includes('id="deck"') ? l.number : null))
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
          const icon = deck?.iconWeek ? weekIcon(slug, deck.iconWeek(l.number)) : null
          const card = (
            <>
              <span style={S.cardBody}>
                <span style={S.num}>{String(l.number).padStart(2, '0')}</span>
                <span style={S.cardTitle}>{l.title}</span>
                <span style={S.meta}>
                  {l.lecture_date}
                  {available && !has && ' · not written yet'}
                </span>
              </span>
              {icon && (
                <span style={S.iconCell} aria-hidden="true">
                  <img src={icon} alt="" loading="lazy" style={S.icon} />
                </span>
              )}
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
        <Link to={`${loungePath(slug)}/console`} style={S.link}>Console</Link>
        {' · '}
        <Link to={`${loungePath(slug)}/remote`} style={S.link}>Remote</Link>
        {' · '}
        <Link to={`${loungePath(slug)}/screen`} style={S.link}>Projector screen</Link>
      </p>
    </Shell>
  )
}

function Shell({ title, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 16px 64px' }}>
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
  h1: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '4px 0 8px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: '74ch' },
  link: { color: 'var(--pk)', textDecoration: 'none' },
  kbd: { fontFamily: MONO, fontSize: 12, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '0 4px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 12, marginTop: 20 },
  card: { display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 16, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 16px', textDecoration: 'none', position: 'relative' },
  cardNext: { borderColor: 'var(--pk)' },
  cardEmpty: { opacity: 0.5, borderStyle: 'dashed' },
  num: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', letterSpacing: 1 },
  cardBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 },
  // The cell stretches to the full height of the text column; the absolutely
  // positioned img fills it, so the icon is always as tall as the card content.
  iconCell: { position: 'relative', width: 84, flexShrink: 0, margin: '-5px -7px -5px 0' },
  icon: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', borderRadius: 12 },
  cardTitle: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', lineHeight: 1.25 },
  meta: { fontFamily: MONO, fontSize: 12, letterSpacing: .5, textTransform: 'uppercase', color: 'var(--tx2)' },
}
