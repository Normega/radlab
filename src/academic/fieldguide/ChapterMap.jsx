import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { AcademicEyebrow } from '../AcademicChrome'
import AvatarMenu from './AvatarMenu'
import { useWikiBase, useCoursePaths } from './wiki/useWikiBase'

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
const isSource = (p) => p.type === 'study' ||
  String(p.slug).startsWith('fundamentals-psychological-disorders-module')

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

  // lecture_no -> the chapters for it, in reading order.
  const byLecture = useMemo(() => {
    const byId = new Map((pages ?? []).map(p => [p.id, p]))
    const m = new Map()
    for (const l of links ?? []) {
      const p = byId.get(l.page_id)
      if (!p) continue // unpublished, or a page removed since the mapping ran
      if (isSource(p)) continue // a citation, not a reading
      if (!m.has(l.lecture_no)) m.set(l.lecture_no, [])
      m.get(l.lecture_no).push({ ...p, tier: tiers.get(p.slug) })
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
          read it, or click a lecture title to open that week's slides in a new tab. Quizzes cover the chapters
          for that week, so this is also the quiz study list.
        </p>

        {meetings === null ? (
          <p style={S.sub}>Loading…</p>
        ) : error ? (
          <p style={S.error}>Couldn't load the course map: {error}</p>
        ) : (
          <>
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
                              <a href={`/${courseCode}/L${deck}.html`} target="_blank" rel="noreferrer"
                                 style={S.lectureLink}>
                                {m.title} <span style={S.slidesTag}>slides ↗</span>
                              </a>
                            ) : (
                              <span style={S.lectureTitle}>{m.title}</span>
                            )}
                          </div>
                          {m.detail && <p style={S.detail}>{m.detail}</p>}

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

const S = {
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
