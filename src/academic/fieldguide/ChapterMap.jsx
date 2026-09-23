import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { AcademicEyebrow } from '../AcademicChrome'
import AvatarMenu from './AvatarMenu'
import { useWikiBase, useCoursePaths } from './wiki/useWikiBase'
import { VisitDot } from './wiki/NeighbourGraph'
import { isSourcePage, visitBand } from './wiki/readingGraph'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Which Field Guide chapters belong to which lecture (Norm, 2026-09-09).
//
// The mapping already existed in page_lectures — but a course whose wiki index
// is catalogue-anchored rather than week-anchored (courseFeatures: weekIndex
// false) gives students no way to see it. This page is the other view of the
// same data, and deliberately a separate route rather than a flag flip: the
// catalogue index is how you browse by topic, this is how you plan a week.
// Both are true at once, so both are available.
//
// Every row is a meeting from course_structure, including the midterm and
// reading week — a reading plan that silently omits the weeks with no reading
// is how people miscount what is left.

// Reading order inside a lecture. TIER leads: the foundation pages are the
// ones to study first and the ones the quizzes lean on hardest, and until now
// they sat unmarked among the supporting pages -- for Lecture 1, "What is
// abnormal?" and "Historical traditions" were indistinguishable from twelve
// concepts that hang off them (Norm, 2026-09-10). Type breaks ties within a
// tier, and title within that, so the order is stable between renders.
const TIER_RANK = { overview: 0, foundation: 1, A: 1, B: 2, supporting: 3 }
const tierRank = (t) => TIER_RANK[t] ?? 4
const TYPE_RANK = { overview: 0, concept: 1, disorder: 2, treatment: 3, debate: 4, study: 5 }
const typeRank = (t) => TYPE_RANK[t] ?? 9

// Provenance records, not readings -- the same exclusion the wiki index makes.
const isSource = isSourcePage

const fmtDate = (d) => d
  ? new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  : ''

export default function ChapterMap() {
  const WIKI_BASE = useWikiBase()
  const paths = useCoursePaths()
  const { courseClient, courseCode, session, isStaff, course: urlCourse } = useOutletContext()
  const courseId = urlCourse?.course_id

  const [meetings, setMeetings] = useState(null)  // null = loading
  const [pages, setPages] = useState([])
  const [links, setLinks] = useState([])
  const [tiers, setTiers] = useState(new Map())   // slug -> catalogue tier
  const [expanded, setExpanded] = useState({})    // lecture_no -> bool
  const [error, setError] = useState(null)
  // The reader's own visit counts, page_id -> visits (page_visits: RLS limits
  // every read to the reader's own rows; staff have no view of anyone else's).
  // null = not tracked (signed out, or the table isn't reachable) and every
  // "My reading" element simply doesn't render.
  const [visits, setVisits] = useState(null)
  const [visitsTick, setVisitsTick] = useState(0)
  const uid = session?.user?.id

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    ;(async () => {
      const [ms, pl, pg, cat] = await Promise.all([
        courseClient.from('course_structure')
          .select('week_no, meeting_date, kind, lecture_no, title, detail')
          .eq('course_id', courseId).order('week_no'),
        courseClient.from('page_lectures')
          .select('lecture_no, page_id').eq('course_id', courseId),
        // Published only: an unpublished page is not a reading, and linking one
        // hands students a 404 for work that is still in the review queue.
        courseClient.from('wiki_pages')
          .select('id, slug, title, type')
          .eq('course_id', courseId).eq('status', 'published'),
        // The catalogue carries the tier; wiki_pages does not.
        courseClient.from('disorders').select('slug, tier').eq('course_id', courseId),
      ])
      if (cancelled) return
      const firstErr = ms.error ?? pl.error ?? pg.error ?? cat.error
      if (firstErr) { setError(firstErr.message); setMeetings([]); return }
      setMeetings(ms.data ?? [])
      setLinks(pl.data ?? [])
      setPages(pg.data ?? [])
      setTiers(new Map((cat.data ?? []).map(d => [d.slug, d.tier])))
    })()
    return () => { cancelled = true }
  }, [courseClient, courseId])

  useEffect(() => {
    if (!courseId || !uid) return
    let cancelled = false
    courseClient.from('page_visits').select('page_id, visits').eq('course_id', courseId)
      .then(({ data, error: e }) => {
        if (cancelled) return
        setVisits(e ? null : new Map((data ?? []).map(r => [r.page_id, r.visits])))
      })
    return () => { cancelled = true }
  }, [courseClient, courseId, uid, visitsTick])

  const clearHistory = async () => {
    if (!window.confirm('Clear your Field Guide reading history for this course? This cannot be undone.')) return
    await courseClient.from('page_visits').delete().eq('course_id', courseId)
    setVisitsTick(t => t + 1)
  }

  // lecture_no -> the chapters for it, in reading order.
  const byLecture = useMemo(() => {
    const byId = new Map((pages ?? []).map(p => [p.id, p]))
    const m = new Map()
    for (const l of links ?? []) {
      const p = byId.get(l.page_id)
      if (!p) continue // unpublished, or a page removed since the mapping ran
      if (isSource(p)) continue // a citation, not a reading
      if (!m.has(l.lecture_no)) m.set(l.lecture_no, [])
      // A course with no catalogue (no `disorders` rows) marks its
      // foundation pages by page TYPE instead, so fall back to that — else
      // they lose the lead position, the tag, and first place in "My
      // reading"'s not-opened list.
      m.get(l.lecture_no).push({ ...p, tier: tiers.get(p.slug) ?? (p.type === 'foundation' ? 'foundation' : undefined) })
    }
    for (const list of m.values()) {
      list.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) ||
                          typeRank(a.type) - typeRank(b.type) ||
                          String(a.title).localeCompare(String(b.title)))
    }
    return m
  }, [links, pages, tiers])

  // Deck filenames count MEETINGS, not lectures: a term with a midterm week
  // has no deck for it, so every deck after that week is one ahead of its
  // lecture number. Deriving the number here from the same meeting list the
  // table renders keeps that quirk in one place instead of hardcoding it.
  // (Note for a future term: a missing deck does not 404 — vercel.json rewrites
  // unmatched paths to the SPA — so if decks ever lag the schedule, probe for
  // them the way ClassSlides does rather than trusting the derivation.)
  const deckNo = useMemo(() => {
    const map = new Map()
    let n = 0
    for (const m of meetings ?? []) {
      if (m.kind !== 'lecture' && m.kind !== 'midterm') continue
      n += 1
      if (m.kind === 'lecture' && m.lecture_no != null) map.set(m.lecture_no, n)
    }
    return map
  }, [meetings])

  const lectureRows = (meetings ?? []).filter(m => m.kind === 'lecture' && m.lecture_no != null)
  const totalChapters = useMemo(
    () => new Set((links ?? []).map(l => l.page_id)).size, [links])
  const allExpanded = lectureRows.length > 0 &&
    lectureRows.every(m => expanded[m.lecture_no])

  const toggleAll = () => {
    const next = !allExpanded
    setExpanded(Object.fromEntries(lectureRows.map(m => [m.lecture_no, next])))
  }

  const today = new Date().toISOString().slice(0, 10)

  // "My reading": the whole-term picture, and the two lists worth acting on —
  // what you keep returning to, and what from lectures already given you have
  // not opened at all. Foundation pages lead the second list for the same
  // reason they lead each lecture: they are the ones the quizzes lean on.
  const reading = useMemo(() => {
    if (!visits) return null
    const seen = new Map()
    const pastUnopened = []
    for (const m of meetings ?? []) {
      if (m.kind !== 'lecture' || m.lecture_no == null) continue
      const past = m.meeting_date && m.meeting_date < today
      for (const p of byLecture.get(m.lecture_no) ?? []) {
        if (seen.has(p.id)) continue
        seen.set(p.id, p)
        if (past && !visits.get(p.id)) pastUnopened.push({ ...p, lecture_no: m.lecture_no })
      }
    }
    pastUnopened.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.lecture_no - b.lecture_no)
    const all = [...seen.values()]
    const opened = all.filter(p => visits.get(p.id))
    const most = [...opened].sort((a, b) => visits.get(b.id) - visits.get(a.id) ||
                                           String(a.title).localeCompare(String(b.title))).slice(0, 5)
    return { total: all.length, opened: opened.length, most, pastUnopened }
  }, [visits, meetings, byLecture, today])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <AcademicEyebrow to={paths.home} />
          {session && (
            <AvatarMenu client={courseClient} fgEmail={session.user.email}
                        courseCode={courseCode} isStaff={isStaff} />
          )}
        </div>

        <h1 style={S.title}>Chapters by lecture</h1>
        <p style={S.sub}>
          What to read, and when. Every chapter listed here is a Field Guide page — click one to
          read it, click a lecture title to open that week's slides, or <strong>PDF</strong> to save a copy — without the lecturer's notes. Quizzes cover the chapters
          for that week, so this is also the quiz study list.
        </p>

        {meetings === null ? (
          <p style={S.sub}>Loading…</p>
        ) : error ? (
          <p style={S.error}>Couldn't load the course map: {error}</p>
        ) : (
          <>
            {reading && reading.total > 0 && (
              <section style={S.reading}>
                <div style={S.readingHead}>
                  <h2 style={S.readingTitle}>My reading</h2>
                  <span style={S.count}>
                    opened {reading.opened} of {reading.total} chapters · only you can see this
                  </span>
                </div>
                <div style={S.meter} aria-hidden="true">
                  <div style={{ ...S.meterFill, width: `${(100 * reading.opened) / reading.total}%` }} />
                </div>
                <div style={S.readingCols}>
                  <div>
                    <p style={S.readingLabel}>Not opened yet, from lectures already given</p>
                    {reading.pastUnopened.length === 0
                      ? <p style={S.muted}>Nothing: every chapter from past lectures has been opened at least once.</p>
                      : (
                        <ul style={S.readingList}>
                          {reading.pastUnopened.slice(0, 6).map(p => (
                            <li key={p.id} style={S.readingItem}>
                              <VisitDot band="none" size={12} />
                              <Link to={`${WIKI_BASE}/${p.slug}`}
                                    style={tierRank(p.tier) <= 1 ? S.chapterLinkCore : S.chapterLink}>{p.title}</Link>
                              <span style={S.typeTag}>L{p.lecture_no}</span>
                            </li>
                          ))}
                          {reading.pastUnopened.length > 6 && (
                            <li style={S.muted}>+{reading.pastUnopened.length - 6} more: open a lecture below to see them all</li>
                          )}
                        </ul>
                      )}
                  </div>
                  <div>
                    <p style={S.readingLabel}>Most opened</p>
                    {reading.most.length === 0
                      ? <p style={S.muted}>Nothing yet. Pages you open will show up here.</p>
                      : (
                        <ul style={S.readingList}>
                          {reading.most.map(p => (
                            <li key={p.id} style={S.readingItem}>
                              <VisitDot band={visitBand(visits.get(p.id))} size={12} />
                              <Link to={`${WIKI_BASE}/${p.slug}`} style={S.chapterLink}>{p.title}</Link>
                              <span style={S.typeTag}>×{visits.get(p.id)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                </div>
                <div style={S.readingFoot}>
                  <span style={S.keyRow}>
                    <span style={S.keyItem}><VisitDot band="none" size={12} /> not opened</span>
                    <span style={S.keyItem}><VisitDot band="some" size={12} /> once or twice</span>
                    <span style={S.keyItem}><VisitDot band="often" size={12} /> 3+ times</span>
                  </span>
                  {reading.opened > 0 && (
                    <button style={S.clearBtn} onClick={clearHistory}>Clear my history</button>
                  )}
                </div>
              </section>
            )}

            <div style={S.toolbar}>
              <span style={S.count}>
                {lectureRows.length} lectures · {totalChapters} chapters
              </span>
              <button style={S.toggleAll} onClick={toggleAll}>
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </div>

            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 92 }}>Week</th>
                    <th style={S.th}>Lecture</th>
                    <th style={{ ...S.th, width: 132 }}>Chapters</th>
                  </tr>
                </thead>
                <tbody>
                  {(meetings ?? []).map((m) => {
                    // Non-teaching weeks are rendered as a single spanning band:
                    // they carry no reading, and giving them empty cells reads as
                    // missing data rather than as a week off.
                    if (m.kind !== 'lecture' || m.lecture_no == null) {
                      return (
                        <tr key={`${m.kind}-${m.week_no}`}>
                          <td style={S.tdWeek}>
                            {m.week_no ? `Wk ${m.week_no}` : ''}
                            <span style={S.date}>{fmtDate(m.meeting_date)}</span>
                          </td>
                          <td colSpan={2} style={S.tdBreak}>
                            <span style={S.breakTitle}>{m.title}</span>
                            {m.detail && <span style={S.breakDetail}> — {m.detail}</span>}
                          </td>
                        </tr>
                      )
                    }

                    const chapters = byLecture.get(m.lecture_no) ?? []
                    const isOpen = !!expanded[m.lecture_no]
                    const deck = deckNo.get(m.lecture_no)
                    const isNext = m.meeting_date && m.meeting_date >= today

                    return (
                      <tr key={`L${m.lecture_no}`} style={isNext ? S.rowNext : undefined}>
                        <td style={S.tdWeek}>
                          Wk {m.week_no}
                          <span style={S.date}>{fmtDate(m.meeting_date)}</span>
                        </td>
                        <td style={S.td}>
                          <div style={S.lectureLine}>
                            <span style={S.lectureNo}>L{m.lecture_no}</span>
                            {deck ? (
                              // New tab, matching the slides index: this is a
                              // reference table, and swallowing it to open a
                              // deck loses the reader's place.
                              <>
                                <a href={`/${courseCode}/L${deck}.html`} target="_blank" rel="noreferrer"
                                   style={S.lectureLink}>
                                  {m.title} <span style={S.slidesTag}>slides ↗</span>
                                </a>
                                {/* ?print=1 opens the deck and goes straight to the
                                    print dialog, where "Save as PDF" is one more
                                    click. No PDFs are stored: these decks change
                                    several times a week and a saved copy would go
                                    stale without saying so. Presenter notes stay
                                    out — print follows the on-screen notes state. */}
                                <a href={`/${courseCode}/L${deck}.html?print=1`}
                                   target="_blank" rel="noreferrer" style={S.pdfTag}
                                   title="Opens the deck and its print dialog — choose Save as PDF">
                                  PDF
                                </a>
                              </>
                            ) : (
                              <span style={S.lectureTitle}>{m.title}</span>
                            )}
                          </div>
                          {m.detail && <p style={S.detail}>{m.detail}</p>}

                          {/* One square per chapter, filled by how often you
                              have opened it: the week's reading at a glance,
                              visible without expanding the row. */}
                          {visits && chapters.length > 0 && (
                            <div style={S.strip}>
                              {chapters.map(p => {
                                const n = visits.get(p.id) ?? 0
                                return (
                                  <Link key={p.id} to={`${WIKI_BASE}/${p.slug}`}
                                        title={`${p.title}: ${n ? `opened ${n === 1 ? 'once' : `${n} times`}` : 'not opened yet'}`}
                                        aria-label={p.title}
                                        style={{ ...S.square, ...SQUARE[visitBand(n)] }} />
                                )
                              })}
                              <span style={S.stripCount}>
                                {chapters.filter(p => visits.get(p.id)).length}/{chapters.length} opened
                              </span>
                            </div>
                          )}

                          {isOpen && (
                            <ul style={S.chapterList}>
                              {/* Foundation entries carry the weight: they lead
                                  the list, sit in full-strength text, and are
                                  labelled. Everything after is the material that
                                  hangs off them — still examinable, so muted
                                  rather than hidden. */}
                              {chapters.map(p => {
                                const core = tierRank(p.tier) <= 1
                                return (
                                <li key={p.id} style={S.chapterItem}>
                                  {visits && <><VisitDot band={visitBand(visits.get(p.id))} size={12} />{' '}</>}
                                  <Link to={`${WIKI_BASE}/${p.slug}`}
                                        style={core ? S.chapterLinkCore : S.chapterLink}>
                                    {p.title}
                                  </Link>
                                  {core
                                    ? <span style={S.foundationTag}>foundation</span>
                                    : p.type && <span style={S.typeTag}>{p.type}</span>}
                                </li>
                              )})}
                              {chapters.length === 0 && (
                                <li style={S.chapterItem}>
                                  <span style={S.muted}>No chapters mapped yet.</span>
                                </li>
                              )}
                            </ul>
                          )}
                        </td>
                        <td style={S.tdCount}>
                          <button
                            style={S.expand}
                            onClick={() => setExpanded(e => ({ ...e, [m.lecture_no]: !isOpen }))}
                            aria-expanded={isOpen}
                          >
                            {chapters.length} {isOpen ? '▴' : '▾'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p style={S.foot}>
              Chapters are listed in reading order — the orienting page first, then the concepts it
              rests on, then the disorders, then treatment.{' '}
              <Link to={paths.sub('wiki')} style={S.link}>Browse the whole Guide by DSM chapter →</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// The same three bands as the graph's dots, drawn as squares.
const SQUARE = {
  none:  { background: 'var(--bg)', border: '1px dashed var(--tx3)' },
  some:  { background: 'color-mix(in srgb, var(--pk) 35%, transparent)', border: '1px solid var(--pk)' },
  often: { background: 'var(--pk)', border: '1px solid var(--pk)' },
}

const S = {
  reading: { marginTop: 22, padding: '16px 18px', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14 },
  readingHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  readingTitle: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', margin: 0, fontWeight: 400 },
  meter: { height: 6, borderRadius: 3, background: 'var(--bd)', margin: '10px 0 14px', overflow: 'hidden' },
  meterFill: { height: '100%', background: 'var(--pk)', borderRadius: 3 },
  readingCols: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '6px 26px' },
  readingLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', margin: '0 0 6px' },
  readingList: { listStyle: 'none', padding: 0, margin: 0 },
  readingItem: { display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 5px', lineHeight: 1.45 },
  readingFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 10 },
  keyItem: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  keyRow: { display: 'flex', gap: 12, flexWrap: 'wrap', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 11, color: 'var(--tx2)' },
  clearBtn: { fontFamily: MONO, fontSize: 11, padding: '4px 10px', borderRadius: 14, border: '1px solid var(--bds)', background: 'transparent', color: 'var(--tx3)', cursor: 'pointer' },
  strip: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3, marginTop: 8 },
  square: { display: 'inline-block', width: 11, height: 11, borderRadius: 2, boxSizing: 'border-box' },
  stripCount: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', marginLeft: 6 },
  title: { fontFamily: SERIF, fontSize: 30, color: 'var(--tx)', margin: '18px 0 8px' },
  sub: { fontSize: 14.5, color: 'var(--tx2)', lineHeight: 1.6, maxWidth: 680 },
  error: { fontSize: 14, color: '#c0392b', marginTop: 16 },
  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, margin: '22px 0 8px', flexWrap: 'wrap',
  },
  count: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', letterSpacing: 0.5 },
  toggleAll: {
    fontFamily: MONO, fontSize: 12, padding: '7px 14px', borderRadius: 18,
    border: '1px solid var(--bds)', background: 'transparent', color: 'var(--tx2)',
    cursor: 'pointer',
  },
  tableWrap: {
    overflowX: 'auto', background: 'var(--bgc)',
    border: '1px solid var(--bd)', borderRadius: 14,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14.5 },
  th: {
    textAlign: 'left', padding: '11px 14px', borderBottom: '1px solid var(--bd)',
    fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    color: 'var(--tx3)', fontWeight: 400, whiteSpace: 'nowrap',
  },
  td: { padding: '13px 14px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top' },
  tdWeek: {
    padding: '13px 14px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top',
    fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', whiteSpace: 'nowrap',
  },
  tdCount: {
    padding: '13px 14px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top',
    textAlign: 'right',
  },
  tdBreak: {
    padding: '13px 14px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top',
    background: 'var(--bg)',
  },
  rowNext: { background: 'var(--bgp)' },
  lectureLine: { display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' },
  lectureNo: { fontFamily: MONO, fontSize: 11.5, color: 'var(--pk)', letterSpacing: 0.5 },
  lectureLink: { fontFamily: SERIF, fontSize: 17.5, color: 'var(--pk)', textDecoration: 'none' },
  slidesTag: { fontFamily: MONO, fontSize: 11, letterSpacing: 0.5, color: 'var(--tx3)', whiteSpace: 'nowrap' },
  pdfTag: { fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.5, color: 'var(--tx2)',
            border: '1px solid var(--bds)', borderRadius: 10, padding: '1px 7px',
            marginLeft: 8, textDecoration: 'none', whiteSpace: 'nowrap' },
  lectureTitle: { fontFamily: SERIF, fontSize: 17.5, color: 'var(--tx)' },
  detail: { fontSize: 13, color: 'var(--tx3)', margin: '5px 0 0', lineHeight: 1.5 },
  breakTitle: { fontFamily: SERIF, fontSize: 16, color: 'var(--tx2)' },
  breakDetail: { fontSize: 13, color: 'var(--tx3)' },
  chapterList: { listStyle: 'none', padding: 0, margin: '12px 0 2px', columnGap: 26, columns: '2 220px' },
  chapterItem: { breakInside: 'avoid', margin: '0 0 6px', lineHeight: 1.45 },
  chapterLink: { color: 'var(--tx2)', textDecoration: 'none', fontSize: 14 },
  chapterLinkCore: { color: 'var(--pk)', textDecoration: 'none', fontSize: 14.5, fontWeight: 600 },
  foundationTag: { fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.5, color: 'var(--pk)', marginLeft: 6 },
  typeTag: { fontFamily: MONO, fontSize: 10.5, color: 'var(--tx3)', marginLeft: 6 },
  muted: { fontSize: 13.5, color: 'var(--tx3)', fontStyle: 'italic' },
  expand: {
    fontFamily: MONO, fontSize: 12.5, padding: '5px 11px', borderRadius: 14,
    border: '1px solid var(--bds)', background: 'transparent', color: 'var(--tx2)',
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  foot: { fontSize: 13.5, color: 'var(--tx3)', lineHeight: 1.6, marginTop: 16 },
  link: { color: 'var(--pk)' },
}
