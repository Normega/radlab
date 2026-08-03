import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { WIKI_BASE } from './wikiText'
import { useWikiCourse } from './useWikiCourse'
import { TIER_LABEL, TIER_HELP } from './tiers'
import { chapterIcon } from './chapterIcons'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Shared empty set, so "nothing is folded" is referentially stable.
const EMPTY = new Set()

// Page types that aren't part of the taxonomy catalogue — what papers and
// (from WP6) students contribute, as opposed to the course scaffold.
const CONTRIB_TYPES = [
  ['study', 'Studies'],
  ['concept', 'Concepts'],
  ['treatment', 'Treatments'],
  ['debate', 'Debates'],
  ['lecture', 'Lectures'],
]

// Field Guide index (WP2). Browse is organised by DSM-5-TR diagnostic class
// because that is the course's content anchor (taxonomy §1) — not by page
// type, which is an implementation detail of how a page got here.
export default function WikiIndex() {
  const { courseClient, session, enrollments, isStaff } = useOutletContext()
  const { courseId, select, courses, course } = useWikiCourse(enrollments)

  const [pages, setPages] = useState(null)      // null = loading
  const [catalog, setCatalog] = useState([])
  const [chapters, setChapters] = useState([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)  // null = not searching
  const [searching, setSearching] = useState(false)
  // Unwritten catalogue rows are the worklist for staff and, for a student,
  // mostly noise until the content sprint lands — so the default differs by
  // role, and either can flip it.
  const [showEmpty, setShowEmpty] = useState(isStaff)

  useEffect(() => {
    if (!courseId) return
    let cancelled = false
    ;(async () => {
      const [{ data: p }, { data: g }, { data: ch }] = await Promise.all([
        courseClient.from('wiki_pages')
          .select('slug, title, type, summary, status, needs')
          .eq('course_id', courseId).order('title'),
        courseClient.from('wiki_gap_report').select('*').eq('course_id', courseId),
        courseClient.from('dsm_chapters').select('number, title, taught').order('number'),
      ])
      if (cancelled) return
      setPages(p ?? [])
      setCatalog(g ?? [])
      setChapters(ch ?? [])
    })()
    return () => { cancelled = true }
  }, [courseClient, courseId])

  // Postgres full-text over title + summary + content (the generated
  // search_vector column). websearch syntax so quoted phrases and -exclusions
  // work the way anyone who has used a search box expects.
  const runSearch = useCallback(async (term) => {
    if (!term.trim()) return setResults(null)
    setSearching(true)
    const { data } = await courseClient.from('wiki_pages')
      .select('slug, title, type, summary, status')
      .eq('course_id', courseId)
      .textSearch('search_vector', term, { type: 'websearch' })
      .limit(40)
    setSearching(false)
    setResults(data ?? [])
  }, [courseClient, courseId])

  useEffect(() => {
    const t = setTimeout(() => runSearch(q), 250)
    return () => clearTimeout(t)
  }, [q, runSearch])

  const bySlug = useMemo(() => new Map((pages ?? []).map(p => [p.slug, p])), [pages])
  const catalogSlugs = useMemo(() => new Set(catalog.map(c => c.slug)), [catalog])

  // Chapters that have something to show. Untaught chapters are omitted
  // entirely rather than shown empty — 2 of 20 aren't in this course.
  const chapterGroups = useMemo(() => {
    const groups = []
    for (const ch of chapters) {
      const rows = catalog
        .filter(c => c.dsm_chapter === ch.number)
        .sort((a, b) => (a.tier === 'overview' ? 0 : 1) - (b.tier === 'overview' ? 0 : 1)
          || a.title.localeCompare(b.title))
      if (!rows.length) continue
      groups.push({ ...ch, rows, readable: rows.filter(r => bySlug.has(r.slug)).length })
    }
    // Foundations carry no DSM chapter; they lead, since they're the framing
    // material the rest of the wiki leans on.
    const foundations = catalog
      .filter(c => c.dsm_chapter == null)
      .sort((a, b) => a.title.localeCompare(b.title))
    if (foundations.length) {
      groups.unshift({
        number: 0, title: 'Foundations', rows: foundations,
        readable: foundations.filter(r => bySlug.has(r.slug)).length,
      })
    }
    return groups
  }, [chapters, catalog, bySlug])

  const contributed = useMemo(
    () => (pages ?? []).filter(p => !catalogSlugs.has(p.slug)),
    [pages, catalogSlugs])

  // Folded chapters, keyed by DSM chapter number rather than by position, so
  // flipping "show unwritten entries" — which changes which groups appear —
  // doesn't fold a different chapter than the one that was clicked.
  const [folded, setFolded] = useState(EMPTY)
  const visibleGroups = useMemo(
    () => chapterGroups.filter(g => showEmpty || g.readable > 0),
    [chapterGroups, showEmpty])
  const allFolded = visibleGroups.length > 0 && visibleGroups.every(g => folded.has(g.number))

  if (pages === null) {
    return <Shell course={course}><p style={S.sub}>Loading…</p></Shell>
  }

  return (
    <Shell course={course} session={session} client={courseClient} isStaff={isStaff}
           courses={courses} courseId={courseId} onSelectCourse={select}>
      <div style={S.statRow}>
        <Stat n={pages.length} label={isStaff ? 'pages you can read' : 'pages'} accent />
        <Stat n={catalog.filter(c => bySlug.has(c.slug)).length + ' / ' + catalog.length} label="catalogue covered" />
        <Stat n={contributed.length} label="contributed pages" />
      </div>

      <input
        style={S.search}
        type="search"
        placeholder="Search the Field Guide…"
        value={q}
        onChange={e => setQ(e.target.value)}
      />

      {results !== null ? (
        <>
          <h2 style={S.h2Loose}>
            {searching ? 'Searching…' : `${results.length} result${results.length === 1 ? '' : 's'}`}
          </h2>
          {results.map(r => (
            <Link key={r.slug} to={`${WIKI_BASE}/${r.slug}`} style={S.resultCard}>
              <span style={S.resultTitle}>{r.title}</span>
              <span style={S.resultMeta}>
                {r.type}{r.status !== 'published' && ' · draft'}
              </span>
              {r.summary && <span style={S.resultSummary}>{r.summary}</span>}
            </Link>
          ))}
          {!searching && results.length === 0 && (
            <p style={S.sub}>Nothing matched. Try fewer words, or a disorder name.</p>
          )}
        </>
      ) : (
        <>
          {pages.length === 0 && (
            <p style={{ ...S.sub, marginTop: 20 }}>
              Nothing is published yet. Pages appear here as they're reviewed.
            </p>
          )}

          {/* A legend, not just the hover text on each card: `title` does
              nothing on a touch device, and this wiki is read on phones. */}
          <p style={S.legend}>
            <b>Central to the course</b> — full page, covering presentation through to open debates.{' '}
            <b>Supporting page</b> — shorter: a description, a link to the official DSM-5-TR criteria,
            and pointers to related disorders. Both are taught; only the page length differs.
          </p>

          <div style={S.controlRow}>
            <label style={S.toggle}>
              <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} />
              Show catalogue entries that aren't written yet
            </label>

            {/* Twenty diagnostic classes is a long scroll to reach the one you
                want. Chapters fold from their own heading; everything starts
                open, because a browse page that opens closed hides what it is
                for and find-in-page can't see an unmounted grid. */}
            {visibleGroups.length > 1 && (
              <div style={S.foldBar}>
                <button
                  type="button"
                  style={S.foldBtn}
                  onClick={() => setFolded(allFolded ? EMPTY : new Set(visibleGroups.map(g => g.number)))}
                >
                  {allFolded ? 'Expand all' : 'Collapse all'}
                </button>
                <span style={S.foldCount}>
                  {folded.size > 0
                    ? `${folded.size} of ${visibleGroups.length} folded`
                    : `${visibleGroups.length} chapters`}
                </span>
              </div>
            )}
          </div>

          {visibleGroups.map(g => {
            const isFolded = folded.has(g.number)
            return (
            <section key={g.number} style={{ marginTop: 16 }}>
              {/* The heading is a full-width band rather than loose text. Two
                  reasons beyond looks: the band's left edge lines up with the
                  card grid and the search box, which loose text with a leading
                  caret never did; and the icons carry a baked-in white
                  background from the source composite, so on the pink ground
                  they read as white squares — inside a white band they
                  disappear, with no tile or transparency needed. */}
              <h2 style={S.h2}>
                <button
                  type="button"
                  onClick={() => setFolded(prev => {
                    const next = new Set(prev)
                    if (next.has(g.number)) next.delete(g.number); else next.add(g.number)
                    return next
                  })}
                  aria-expanded={!isFolded}
                  aria-controls={`chapter-${g.number}`}
                  style={S.band}
                >
                  {/* Decorative: the chapter is named right beside it, so an
                      alt text would only make a screen reader say it twice. */}
                  {chapterIcon(g.number) && (
                    <img src={chapterIcon(g.number)} alt="" aria-hidden="true"
                         width={46} height={46} loading="lazy" style={S.chIcon} />
                  )}
                  {g.number > 0 && <span style={S.chNum}>{g.number}</span>}
                  {/* Title and count share a wrapping row, so a long chapter
                      name breaks before it collides with the count. */}
                  <span style={S.chTitles}>
                    <span style={S.chTitle}>{g.title}</span>
                    <span style={S.chCount}>{g.readable} of {g.rows.length}</span>
                  </span>
                  <span aria-hidden="true" style={{ ...S.caret, transform: isFolded ? 'rotate(-90deg)' : 'none' }}>▾</span>
                </button>
              </h2>
              <div id={`chapter-${g.number}`} hidden={isFolded} style={isFolded ? undefined : S.grid}>
                {!isFolded && g.rows.filter(row => showEmpty || bySlug.has(row.slug)).map(row => {
                  const page = bySlug.get(row.slug)
                  // A catalogue row with no readable page is shown, not
                  // hidden: it is the course outline, so its holes are part of
                  // the map. For a student that is also the contribution list.
                  if (!page) {
                    return (
                      <span key={row.slug} style={{ ...S.card, ...S.cardEmpty }}
                            title={TIER_HELP[row.tier]}>
                        <span style={S.cardTitle}>{row.title}</span>
                        <span style={S.cardMeta}>
                          not written yet{TIER_LABEL[row.tier] ? ` · ${TIER_LABEL[row.tier]}` : ''}
                        </span>
                      </span>
                    )
                  }
                  return (
                    <Link key={row.slug} to={`${WIKI_BASE}/${row.slug}`} style={S.card}
                          title={TIER_HELP[row.tier]}>
                      <span style={S.cardTitle}>{page.title}</span>
                      <span style={S.cardMeta}>
                        {page.status !== 'published' && <b style={{ color: 'var(--pk)' }}>draft · </b>}
                        {page.needs?.length > 0
                          ? `needs ${page.needs.length} section${page.needs.length === 1 ? '' : 's'}`
                          : (TIER_LABEL[row.tier] ?? row.tier)}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
            )
          })}

          {contributed.length > 0 && (
            <section style={{ marginTop: 34 }}>
              <h2 style={S.h2Loose}>Contributed pages</h2>
              <p style={S.sub}>
                Pages built from papers rather than from the course catalogue — studies, concepts,
                treatments and debates that hang off the disorder pages.
              </p>
              {CONTRIB_TYPES.map(([type, label]) => {
                const rows = contributed.filter(p => p.type === type)
                if (!rows.length) return null
                return (
                  <div key={type} style={{ marginTop: 14 }}>
                    <p style={S.typeLabel}>{label}</p>
                    <div style={S.grid}>
                      {rows.map(p => (
                        <Link key={p.slug} to={`${WIKI_BASE}/${p.slug}`} style={S.card}>
                          <span style={S.cardTitle}>{p.title}</span>
                          <span style={S.cardMeta}>
                            {p.status !== 'published' && <b style={{ color: 'var(--pk)' }}>draft</b>}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </>
      )}
    </Shell>
  )
}

function Shell({ course, session, client, isStaff, courses, courseId, onSelectCourse, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '28px 16px 64px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={S.eyebrow}>Field Guide</p>
            <h1 style={S.title}>{course?.name ?? 'Course wiki'}</h1>
            {course && <p style={S.sub}>{course.code} · {course.term}</p>}
          </div>
          {session && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ ...S.sub, fontSize: 12 }}>{session.user.email}</p>
              {isStaff && (
                <>
                  <Link to="/academic/fieldguide/review" style={S.link}>Review queue</Link>
                  {' · '}
                  <Link to="/academic/fieldguide/ingest" style={S.link}>Ingest</Link>
                  {' · '}
                </>
              )}
              <button style={S.linkBtn} onClick={() => client.auth.signOut()}>Sign out</button>
            </div>
          )}
        </header>

        {courses?.length > 1 && (
          <select style={{ ...S.search, marginTop: 12, marginBottom: 0 }} value={courseId}
                  onChange={e => onSelectCourse(e.target.value)}>
            {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.code} — {c.name}</option>)}
          </select>
        )}

        {children}
      </div>
    </div>
  )
}

const Stat = ({ n, label, accent }) => (
  <div style={S.stat}>
    <span style={{ ...S.statN, color: accent ? 'var(--pk)' : 'var(--tx)' }}>{n}</span>
    <span style={S.statL}>{label}</span>
  </div>
)

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  title: { fontFamily: SERIF, fontSize: 30, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55 },
  link: { fontSize: 13, color: 'var(--pk)', textDecoration: 'none' },
  linkBtn: { fontSize: 13, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 },

  statRow: { display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  stat: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '12px 18px', display: 'flex', flexDirection: 'column', minWidth: 130 },
  statN: { fontFamily: SERIF, fontSize: 24, lineHeight: 1 },
  statL: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', marginTop: 4 },

  search: { width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '11px 14px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', margin: '18px 0 4px' },

  h2: { margin: '0 0 10px' },
  // Search-result headings still use loose text; only chapter headings are bands.
  h2Loose: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', margin: '24px 0 10px' },
  chIcon: { flexShrink: 0, borderRadius: 9, objectFit: 'contain' },
  chNum: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '1px 6px' },
  chCount: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)' },
  legend: { fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, margin: '16px 0 0', maxWidth: '78ch' },
  toggle: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--tx2)', marginTop: 10, cursor: 'pointer' },

  controlRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' },
  foldBar: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 },
  foldBtn: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', padding: '5px 12px', borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx2)', cursor: 'pointer' },
  foldCount: { fontFamily: MONO, fontSize: 11, letterSpacing: 0.5, color: 'var(--tx2)' },
  // The h2 keeps the heading semantics; the button inside takes the click, so a
  // screen reader still hears a heading rather than only a control.
  band: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box', background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 12, padding: '7px 14px 7px 7px', textAlign: 'left', cursor: 'pointer', color: 'var(--tx)' },
  chTitles: { display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', minWidth: 0 },
  chTitle: { fontFamily: SERIF, fontSize: 20, lineHeight: 1.15 },
  caret: { flexShrink: 0, fontSize: 13, color: 'var(--pk)', marginLeft: 'auto', paddingLeft: 8, transition: 'transform .15s ease', display: 'inline-block' },
  typeLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 6px' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))', gap: 10 },
  card: { display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '11px 13px', textDecoration: 'none' },
  cardEmpty: { background: 'none', borderStyle: 'dashed' },
  cardTitle: { fontSize: 15, color: 'var(--tx)', lineHeight: 1.3 },
  cardMeta: { fontFamily: MONO, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--tx2)' },

  resultCard: { display: 'flex', flexDirection: 'column', gap: 3, background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, textDecoration: 'none' },
  resultTitle: { fontFamily: SERIF, fontSize: 18, color: 'var(--tx)' },
  resultMeta: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)' },
  resultSummary: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5, marginTop: 2 },
}
