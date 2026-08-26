import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams, useLocation } from 'react-router-dom'
import { WikiMarkdown } from './wikiMarkdown'
import { WIKI_BASE, splitFrontmatter, extractHeadings, splitSections } from './wikiText'
import { useWikiCourse } from './useWikiCourse'
import { useWideLayout } from './useWideLayout'
import { TIER_LABEL, TIER_HELP } from './tiers'
import { chapterIcon } from './chapterIcons'
import { weekIcon } from './weekIcons'
import ReportIssue from './ReportIssue'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Same palette as GapBrowser's DIFF map, so a gap reads as the same object in
// the reader and on the board.
const DIFF = {
  green: { colour: '#2e7d32', label: 'green — good first contribution' },
  amber: { colour: '#b8860b', label: 'amber — staff-verified evidence' },
  red:   { colour: '#c0392b', label: 'red — staff only' },
}

// One shared empty set, so "nothing is folded" is referentially stable and
// doesn't re-run the memos that read it.
const EMPTY = new Set()

// One wiki page (WP2). Everything here is a read — the write path is the
// review queue, and wiki_pages has no authenticated write policies at all.
//
// The reader is the same code for students and staff; RLS decides what comes
// back. A student's query matches `members read published pages`, so a draft
// simply isn't in the result set and renders as "not published yet". Nothing
// on this page filters by status defensively, because the place to enforce
// that is the database, and it already does.
export default function WikiPage() {
  const { courseClient, enrollments, isStaff } = useOutletContext()
  const { courseId, course } = useWikiCourse(enrollments)
  const { slug } = useParams()
  const { hash } = useLocation()
  const wide = useWideLayout()

  // Loaded state is stamped with the slug it belongs to, so navigating between
  // pages reads as loading without an effect having to reset it synchronously
  // first — and the previous page's body can never render under the new title.
  const [loaded, setLoaded] = useState({ slug: null, row: null })
  const [pages, setPages] = useState(new Map())
  const [backlinks, setBacklinks] = useState([])
  const [outbound, setOutbound] = useState([])
  const [provenance, setProvenance] = useState(null)
  const [catalog, setCatalog] = useState(null)
  // Which lecture week(s) this page belongs to, from page_lectures joined to
  // the course calendar. The crumb renders only when there is no DSM-chapter
  // crumb — so PSY240 disorder pages look exactly as before, while
  // week-anchored courses (and PSY240's own concept pages) get their calendar
  // context instead.
  const [lectureCrumbs, setLectureCrumbs] = useState([])
  // Open gaps on this page, drawn from page_gaps rather than parsed from the
  // body — the catalogue is the source of truth, and RLS already decides who
  // sees them (members: published pages only; staff: everything).
  const [gaps, setGaps] = useState([])
  // Latest review stamp. Staff-only by RLS — a member's query returns empty
  // and the bar simply doesn't render, same pattern as the staff tiles on the
  // home page.
  const [review, setReview] = useState(null)

  // Staff editing
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null)
  // Correction guards (see 20260810_correction_guards.sql). These two fields
  // stay hidden until the server refuses a save: the tripwire's
  // verified-against-source input appears on a NUMERIC SHIFT refusal, the
  // override checkbox on a STRUCTURE refusal. Guards live server-side; the
  // client only reveals the matching remedy.
  const [verified, setVerified] = useState('')
  const [allowStructure, setAllowStructure] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [publishing, setPublishing] = useState(false)

  // undefined = still loading, null = nothing this reader can see at this slug
  const page = loaded.slug === slug ? loaded.row : undefined

  useEffect(() => {
    if (!courseId || !slug) return
    let cancelled = false

    ;(async () => {
      const { data: row } = await courseClient
        .from('wiki_pages')
        .select('id, slug, type, title, summary, content, status, current_version, updated_at, published_at, needs')
        .eq('course_id', courseId).eq('slug', slug).maybeSingle()
      if (cancelled) return
      setLoaded({ slug, row: row ?? null })
      if (!row) return

      // The link-resolution set is whatever this reader can see, which is the
      // honest basis for colouring a wikilink: a link to a page that exists
      // but is still a draft is, for a student, a link to nothing readable.
      const [{ data: all }, { data: back }, { data: out }, { data: prov }, { data: cat }, { data: gp }, { data: rev }, { data: pls }, { data: cal }] = await Promise.all([
        courseClient.from('wiki_pages').select('slug, title, type, status').eq('course_id', courseId),
        courseClient.from('wiki_links')
          .select('id, source:wiki_pages!wiki_links_source_page_id_fkey!inner(slug, title, type, status)')
          .eq('target_page_id', row.id),
        courseClient.from('wiki_links').select('target_slug, target_page_id').eq('source_page_id', row.id),
        courseClient.from('wiki_page_provenance').select('sources, source_count, has_unverified_source')
          .eq('page_id', row.id).maybeSingle(),
        courseClient.from('disorder_criteria_links')
          .select('criteria_url, dsm_chapter, dsm_chapter_title, tier, lecture')
          .eq('course_id', courseId).eq('slug', slug).maybeSingle(),
        courseClient.from('page_gaps')
          .select('id, kind, section, ask, difficulty, capacity, status')
          .eq('page_id', row.id).eq('status', 'open'),
        courseClient.from('page_reviews')
          .select('version, verdict, reviewed_at')
          .eq('page_id', row.id).order('reviewed_at', { ascending: false }).limit(1).maybeSingle(),
        courseClient.from('page_lectures').select('lecture_no').eq('page_id', row.id),
        courseClient.from('course_structure')
          .select('week_no, lecture_no, title')
          .eq('course_id', courseId).eq('kind', 'lecture'),
      ])
      if (cancelled) return
      setPages(new Map((all ?? []).map(p => [p.slug, p])))
      setBacklinks((back ?? []).map(b => b.source).filter(Boolean)
        .sort((a, b) => a.title.localeCompare(b.title)))
      setOutbound(out ?? [])
      setProvenance(prov ?? null)
      setCatalog(cat ?? null)
      setGaps(gp ?? [])
      setReview(rev ?? null)
      setLectureCrumbs((pls ?? [])
        .map(l => (cal ?? []).find(m => m.lecture_no === l.lecture_no))
        .filter(Boolean)
        .sort((a, b) => a.week_no - b.week_no))
    })()

    return () => { cancelled = true }
    // reloadKey re-runs the whole fetch after a save, so the rendered body,
    // table of contents, gap list and link graph all reflect the edit rather
    // than the client patching its own copy and drifting from the database.
  }, [courseClient, courseId, slug, reloadKey])

  const save = async () => {
    setSaving(true)
    setSaveNotice(null)
    const { data, error } = await courseClient.rpc('edit_page', {
      p_page_id: page.id,
      p_content: draft,
      p_note: note || null,
      p_verified: verified || null,
      p_allow_structure: allowStructure,
    })
    setSaving(false)
    if (error) return setSaveNotice(error.message)
    setEditing(false)
    setDraft('')
    setVerified('')
    setAllowStructure(false)
    setSaveNotice(
      `Saved as v${data.current_version} · ${data.links_extracted} link${data.links_extracted === 1 ? '' : 's'}` +
      ` · ${data.needs?.length ? `still needs: ${data.needs.join(', ')}` : 'no declared gaps'}`
    )
    setReloadKey(k => k + 1)
  }

  // Direct publish (20260826 migration): the write primitive review_proposal
  // cannot provide, for pages that never came through an ingest proposal —
  // which is every fresh-authored PSY309 page. Staff-gated server-side.
  const publishNow = async () => {
    setPublishing(true)
    const { error } = await courseClient.rpc('publish_page', { p_page_id: page.id })
    setPublishing(false)
    if (error) return setSaveNotice(error.message)
    setSaveNotice('Published — this page is now live for readers.')
    setReloadKey(k => k + 1)
  }

  const { meta, body } = useMemo(() => splitFrontmatter(page?.content), [page?.content])
  const toc = useMemo(() => extractHeadings(body), [body])
  const sections = useMemo(() => splitSections(body, toc), [body, toc])
  const headingIds = useMemo(() => new Map(toc.map(h => [h.line, h.id])), [toc])

  // Which `##` section contains each anchor, so a link to a `###` inside a
  // folded section can open the section before scrolling to it.
  const sectionOfAnchor = useMemo(() => {
    const m = new Map()
    for (const s of sections) {
      if (!s.id) continue
      for (const a of s.anchorIds) m.set(a, s.id)
    }
    return m
  }, [sections])

  // Gaps grouped by the `##` section that anchors them. A gap whose section
  // doesn't match any current heading id (renamed heading, or no anchor at
  // all) falls through to the page-level list rather than vanishing — an ask
  // that loses its anchor is still an ask.
  const { gapsBySection, unanchoredGaps } = useMemo(() => {
    const ids = new Set(sections.map(s => s.id).filter(Boolean))
    const by = new Map()
    const loose = []
    for (const g of gaps) {
      if (g.section && ids.has(g.section)) {
        if (!by.has(g.section)) by.set(g.section, [])
        by.get(g.section).push(g)
      } else loose.push(g)
    }
    return { gapsBySection: by, unanchoredGaps: loose }
  }, [gaps, sections])

  // The review stamp (Phase D). One call, three consequences: coverage is
  // recorded, the current version becomes item-eligible (§39.12.8), and the
  // page's accepted changes show as examinable in What's new. The bar states
  // the middle one because it is the consequence with stakes.
  const [stampNote, setStampNote] = useState('')
  const [stamping, setStamping] = useState(false)
  // After a stamp, hand the reader the next unreviewed page in risk order —
  // the reading queue's whole point is that "what next?" is never a decision.
  const [nextUp, setNextUp] = useState(null)
  const stamp = async (verdict) => {
    setStamping(true)
    const { error } = await courseClient.rpc('stamp_page', {
      p_page_id: page.id, p_verdict: verdict, p_note: stampNote || null,
    })
    setStamping(false)
    if (error) return setSaveNotice(error.message)
    setStampNote('')
    setSaveNotice(verdict === 'clear'
      ? `Stamped clear at v${page.current_version} — this version is now item-eligible.`
      : `Stamped needs-work at v${page.current_version}.`)
    setReloadKey(k => k + 1)
    if (courseId) {
      const { data: wl } = await courseClient.rpc('review_worklist', { p_course_id: courseId })
      const nxt = (wl ?? []).find(r => !r.reviewed_current && r.slug !== page.slug)
      setNextUp(nxt ?? false) // false = queue is clear
    }
  }

  // Flag-from-reader (Phase D): a staff observation becomes a page_gaps row,
  // never a prose edit — no flag passes through provenance. The RPC owns the
  // ask_hash convention so a reworded duplicate still dedups.
  const flagGap = async (section, ask, difficulty) => {
    const { error } = await courseClient.rpc('flag_gap', {
      p_page_id: page.id, p_section: section, p_ask: ask, p_difficulty: difficulty,
    })
    if (error) return error.message
    setReloadKey(k => k + 1)
    return null
  }

  // Collapsed by id, not by index: an edit that adds a section shouldn't fold a
  // different one. Empty means everything is open, which is the default — a
  // reference page that starts folded hides the thing it was opened for, and
  // find-in-page can't see text that isn't rendered.
  //
  // Stamped with the slug it belongs to, the same way `loaded` is above, so
  // navigating to another page starts unfolded without an effect having to
  // reset it — and folds never leak from the page they were made on.
  const [folds, setFolds] = useState({ slug: null, ids: EMPTY })
  const collapsed = folds.slug === slug ? folds.ids : EMPTY
  const setCollapsed = useCallback((next) => {
    setFolds(prev => ({
      slug,
      ids: typeof next === 'function' ? next(prev.slug === slug ? prev.ids : EMPTY) : next,
    }))
  }, [slug])

  const collapsible = sections.filter(s => s.id)
  const allCollapsed = collapsible.length > 0 && collapsible.every(s => collapsed.has(s.id))

  const reveal = useCallback((anchor) => {
    const owner = sectionOfAnchor.get(anchor)
    if (owner) setCollapsed(prev => {
      if (!prev.has(owner)) return prev
      const next = new Set(prev)
      next.delete(owner)
      return next
    })
  }, [sectionOfAnchor, setCollapsed])

  // Arriving from a [[page#section]] link: the target heading doesn't exist
  // until the body has rendered, so the browser's own hash handling has already
  // given up by then. Unfolding and scrolling both happen in animation frames
  // rather than in the effect body — the first frame opens the section that owns
  // the anchor, the second scrolls once that render has laid out.
  useEffect(() => {
    if (!hash || !page?.content) return
    const anchor = hash.slice(1)
    let second
    const first = requestAnimationFrame(() => {
      reveal(anchor)
      second = requestAnimationFrame(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
    return () => {
      cancelAnimationFrame(first)
      if (second) cancelAnimationFrame(second)
    }
  }, [hash, page?.content, reveal])

  if (page === undefined) return <Shell course={course}><p style={S.sub}>Loading…</p></Shell>

  if (page === null) {
    return (
      <Shell course={course}>
        <h1 style={S.title}>Not published yet</h1>
        <p style={S.sub}>
          There's no readable page at <code style={S.code}>{slug}</code>. Either it hasn't been
          written yet, or it's still a draft awaiting review.
        </p>
        <p style={{ marginTop: 14 }}><Link to={WIKI_BASE} style={S.link}>← All pages</Link></p>
      </Shell>
    )
  }

  const unresolved = outbound.filter(l => !l.target_page_id)
  const related = relatedSlugs(meta)

  return (
    <Shell course={course}>
      <nav style={S.crumbs}>
        <Link to={WIKI_BASE} style={S.link}>All pages</Link>
        {catalog?.dsm_chapter_title && (
          <> · {chapterIcon(catalog.dsm_chapter) && (
            <img src={chapterIcon(catalog.dsm_chapter)} alt="" aria-hidden="true"
                 width={30} height={30} loading="lazy" style={S.crumbIcon} />
          )}<span style={S.dim}>{catalog.dsm_chapter_title}</span></>
        )}
        {!catalog?.dsm_chapter_title && lectureCrumbs.map(m => (
          <span key={m.week_no}> · {weekIcon(course?.code, m.week_no) && (
            <img src={weekIcon(course?.code, m.week_no)} alt="" aria-hidden="true"
                 width={30} height={30} loading="lazy" style={S.crumbIcon} />
          )}<span style={S.dim}>Week {m.week_no} — {m.title}</span></span>
        ))}
      </nav>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ ...S.title, flex: '1 1 auto' }}>{page.title}</h1>
        {isStaff && !editing && page.content && (
          <button style={S.editBtn} onClick={() => { setDraft(page.content); setNote(''); setEditing(true) }}>
            Edit page
          </button>
        )}
      </div>
      <p style={S.metaLine}>
        {page.type} · v{page.current_version}
        {/* Same wording as the index's legend. The tier is a review-budget
            device, so it describes how full the page is — not whether the
            disorder is examinable. */}
        {catalog?.tier && TIER_LABEL[catalog.tier] && (
          <> · <span title={TIER_HELP[catalog.tier]} style={{ cursor: 'help' }}>{TIER_LABEL[catalog.tier]}</span></>
        )}
        {catalog?.lecture && <> · lecture {catalog.lecture}</>}
        {' · '}updated {new Date(page.updated_at).toLocaleDateString()}
      </p>
      {page.summary && <p style={S.summary}>{page.summary}</p>}

      {/* Frontmatter `prevalence`, surfaced because it's the one headline number
          a reader looks for and it otherwise sat invisible in the source. Shown
          verbatim, including the honest "no figure in this source" cases — a page
          that says the rate is unknown is making a claim worth reading, and
          hiding those would leave only the disorders that happen to be counted.
          The label links to /prevalence, which is what gives all 108 disorder
          pages a route to that concept page without a wikilink in every body. */}
      {meta.prevalence && (
        <p style={S.prevalence}>
          <Link to={`${WIKI_BASE}/prevalence`} style={S.prevalenceLabel}>Prevalence</Link>
          <span style={S.prevalenceText}>{meta.prevalence}</span>
        </p>
      )}

      {saveNotice && <p style={S.saveNotice}>{saveNotice}</p>}

      {/* Staff editing. The only client-reachable write to a page body besides
          review_proposal — wiki_pages has no authenticated write policies, so
          the staff check lives inside edit_page(). The previous body is kept as
          an accepted version by the existing snapshot trigger, which is why
          this can be a plain textarea rather than a guarded ceremony. */}
      {isStaff && editing && (
        <section style={S.editBox}>
          <p style={S.colLabel}>Editing {page.slug} · markdown, frontmatter included</p>
          <textarea
            style={S.editArea}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            spellCheck
          />
          <input
            style={S.noteInput}
            placeholder="What changed, and why (required — it's what the corrections feed shows)"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <p style={S.sub}>
            A correction changes <em>how</em> the page says something — typo, grammar, transcription
            fidelity, structure. If it changes <em>what the page claims</em>, that needs a source:
            ingest it instead. Gaps and links are re-derived on save: removing a{' '}
            <code style={S.code}>&gt; **Needs research:**</code> line closes that gap.
          </p>
          {saveNotice?.includes('NUMERIC SHIFT') && (
            <input
              style={S.noteInput}
              placeholder="Verified against source — say where you checked (e.g. 'Davies ch 12, table 2')"
              value={verified}
              onChange={e => setVerified(e.target.value)}
            />
          )}
          {saveNotice?.includes('STRUCTURE:') && (
            <label style={{ ...S.sub, display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={allowStructure}
                     onChange={e => setAllowStructure(e.target.checked)} />
              Structure change intended — I mean to remove that section or annotation
            </label>
          )}
          {/* Why the save is unavailable, said plainly. A disabled button that
              looks enabled and explains nothing reads as a broken page. */}
          {(() => {
            const blocked = saving ? null
              : draft === page.content ? 'Nothing has changed yet.'
              : !note.trim() ? 'Add a note first — it is what the corrections feed shows.'
              : null
            return (
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button style={blocked ? S.primaryOff : S.primary} disabled={saving || Boolean(blocked)} onClick={save}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button style={S.secondary} disabled={saving} onClick={() => { setEditing(false); setDraft('') }}>
                  Cancel
                </button>
                {blocked
                  ? <span style={S.blockedHint}>{blocked}</span>
                  : <span style={S.dim}>{draft.length.toLocaleString()} chars</span>}
              </div>
            )
          })()}
        </section>
      )}

      {/* The review stamp bar. Reading a page and stamping it are one motion —
          this is what turns Norm's risk-ordered pre-publish read from "make a
          list" into "flag as you go". Members never see it: page_reviews is
          staff-only under RLS, so `review` stays null for them and isStaff
          gates the render anyway. */}
      {isStaff && !editing && (
        <div style={S.stampBar}>
          <span style={S.stampState}>
            {review
              ? review.version < page.current_version
                ? <>stamped <b>{review.verdict}</b> at v{review.version} — <b style={{ color: 'var(--pk)' }}>stale</b>, page is now v{page.current_version}</>
                : <>stamped <b>{review.verdict}</b> at v{review.version} · {new Date(review.reviewed_at).toLocaleDateString()}</>
              : 'not yet reviewed'}
          </span>
          <input
            style={S.stampNote}
            placeholder="Stamp note (optional for clear, say what for needs-work)"
            value={stampNote}
            onChange={e => setStampNote(e.target.value)}
          />
          <button style={S.stampBtn} disabled={stamping} onClick={() => stamp('clear')}>
            {stamping ? '…' : `Stamp clear · v${page.current_version}`}
          </button>
          <button style={S.stampBtnOff} disabled={stamping} onClick={() => stamp('needs_work')}>
            Needs work
          </button>
          {nextUp && (
            <Link to={`${WIKI_BASE}/${nextUp.slug}`} style={S.stampNext}
                  onClick={() => setNextUp(null)}>
              Next unreviewed → {nextUp.title}
            </Link>
          )}
          {nextUp === false && (
            <span style={S.stampState}>the reading queue is clear ✓</span>
          )}
        </div>
      )}

      {/* Staff see drafts; the badge is there so nobody reviews a page
          believing students are already reading it. */}
      {page.status !== 'published' && (
        <p style={S.draftBanner}>
          <b>{page.status}</b> — not visible to students.{' '}
          {isStaff && page.content && (
            <button style={S.publishBtn} disabled={publishing} onClick={publishNow}>
              {publishing ? 'Publishing…' : 'Publish this page'}
            </button>
          )}
        </p>
      )}

      {/* The link-don't-copy path (plan §2.1): the wiki never carries DSM-5-TR
          criteria text, it points at the licensed manual. The proxied host
          only resolves for a signed-in U of T session, which is the point. */}
      {catalog?.criteria_url && (
        <a href={catalog.criteria_url} target="_blank" rel="noreferrer" style={S.criteria}>
          <span style={S.criteriaLabel}>DSM-5-TR criteria</span>
          <span style={S.criteriaText}>
            Read the official criteria for {catalog.dsm_chapter_title} in the DSM Library →
          </span>
          <span style={S.criteriaNote}>Opens via U of T myaccess; sign in with your UTORid.</span>
        </a>
      )}

      <div style={{ ...S.layout, gridTemplateColumns: wide && toc.length > 1 ? '190px minmax(0, 1fr)' : 'minmax(0, 1fr)' }}>
        {toc.length > 1 && (
          <aside style={{ ...S.toc, position: wide ? 'sticky' : 'static' }}>
            <p style={S.tocLabel}>On this page</p>
            {toc.map((h, i) => (
              <a key={`${h.id}-${i}`} href={`#${h.id}`}
                 // Same-page hashes don't re-fire the hash effect when the hash
                 // is unchanged, so the reveal is done here too — otherwise
                 // clicking a folded section twice does nothing the second time.
                 onClick={() => reveal(h.id)}
                 style={{ ...S.tocLink, paddingLeft: h.depth === 3 ? 12 : 0, opacity: h.depth === 3 ? 0.8 : 1 }}>
                {h.text}
              </a>
            ))}
          </aside>
        )}

        <article style={{ minWidth: 0 }}>
          {!page.content && (
            <p style={S.sub}>This page is a stub — it exists so links to it resolve, but nothing has been written into it yet.</p>
          )}

          {/* The preamble — the body's H1 and anything above the first `##` —
              never folds, and sits above the controls so the page still opens
              with its title rather than with a toolbar. */}
          {sections.filter(s => !s.id).map((s, i) => (
            <WikiMarkdown key={`pre-${i}`} content={s.markdown} pages={pages}
                          lineOffset={s.startLine - 1} headingIds={headingIds} />
          ))}

          {/* Sections fold at `##` only. Going deeper would let a reader hide a
              `###` inside an open `##`, which reads as content having gone
              missing rather than as a fold. One section, or none, gets no
              controls — a toggle with nothing to toggle is noise. */}
          {collapsible.length > 1 && (
            <div style={S.foldBar}>
              <button
                type="button"
                style={S.foldBtn}
                onClick={() => setCollapsed(allCollapsed ? EMPTY : new Set(collapsible.map(s => s.id)))}
              >
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </button>
              <span style={S.foldCount}>
                {collapsed.size > 0
                  ? `${collapsed.size} of ${collapsible.length} folded`
                  : `${collapsible.length} sections`}
              </span>
            </div>
          )}

          {collapsible.map(s => {
            const folded = collapsed.has(s.id)
            return (
              <section key={s.id} style={S.foldSection}>
                <h2 id={s.id} style={S.foldHeadingWrap}>
                  <button
                    type="button"
                    onClick={() => setCollapsed(prev => {
                      const next = new Set(prev)
                      if (next.has(s.id)) next.delete(s.id); else next.add(s.id)
                      return next
                    })}
                    aria-expanded={!folded}
                    aria-controls={`section-body-${s.id}`}
                    style={S.foldHeading}
                  >
                    <span aria-hidden="true" style={{ ...S.caret, transform: folded ? 'rotate(-90deg)' : 'none' }}>▾</span>
                    <span>{s.title}</span>
                  </button>
                </h2>
                {/* Folded content is unmounted, not hidden: find-in-page can't
                    see it either way, and unmounting keeps a 20,000-character
                    page from rendering markdown nobody is reading. Everything
                    starts open, so this only costs what the reader chose. */}
                <div id={`section-body-${s.id}`} hidden={folded}>
                  {!folded && (
                    <>
                      <WikiMarkdown content={s.markdown} pages={pages}
                                    lineOffset={s.startLine - 1} headingIds={headingIds} />
                      <GapList gaps={gapsBySection.get(s.id)} section={s.id}
                               isStaff={isStaff} onFlag={flagGap} />
                    </>
                  )}
                </div>
              </section>
            )
          })}

          {/* Page-level gaps: asks with no section anchor, or whose heading was
              renamed out from under them. Shown to everyone deliberately — for
              a student this is the assignment list, and a wiki that says what
              it doesn't know teaches something a confident one doesn't. The
              per-section asks render inline above; this box carries the rest,
              plus the flag control for a page-wide observation. */}
          {(unanchoredGaps.length > 0 || isStaff) && (
            <section style={S.needsBox}>
              <h2 style={S.sectionH}>What this page still needs</h2>
              {gaps.length > 0 && (
                <p style={S.sub}>
                  {gaps.length} open ask{gaps.length === 1 ? '' : 's'} on this page
                  {gapsBySection.size > 0 && ' — most shown inline at their sections'}
                  . <Link to="/academic/fieldguide/gaps" style={S.link}>Claim one on the gap board →</Link>
                </p>
              )}
              <GapList gaps={unanchoredGaps} section={null} isStaff={isStaff} onFlag={flagGap} />
              {gaps.length === 0 && page.needs?.length > 0 && (
                <p style={S.sub}>
                  Sections this page declares it can't yet support from its sources:{' '}
                  <b>{page.needs.join(', ')}</b>.
                </p>
              )}
            </section>
          )}

          {/* Student error detection: report, never edit. Rendered for every
              member; staff triage lands on /academic/fieldguide/reports. */}
          <ReportIssue courseClient={courseClient} pageId={page.id}
                       sections={collapsible.map(s => ({ id: s.id, title: s.title }))} />

          {related.length > 0 && (
            <section style={S.section}>
              <h2 style={S.sectionH}>Related</h2>
              <div style={S.chips}>
                {related.map(s => {
                  const target = pages.get(s)
                  return target
                    ? <Link key={s} to={`${WIKI_BASE}/${s}`} style={S.chip}>{target.title}</Link>
                    : <span key={s} style={{ ...S.chip, ...S.chipDim }} title="No readable page for this slug yet">{s}</span>
                })}
              </div>
            </section>
          )}

          <section style={S.section}>
            <h2 style={S.sectionH}>Referenced by</h2>
            {backlinks.length === 0
              ? <p style={S.sub}>No other page links here yet.</p>
              : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {backlinks.map(b => (
                    <li key={b.slug} style={{ margin: '0 0 6px' }}>
                      <Link to={`${WIKI_BASE}/${b.slug}`} style={S.link}>{b.title}</Link>
                      <span style={S.dim}> · {b.type}{b.status !== 'published' && ' · draft'}</span>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          {/* Licence-facing attribution, derived from the ingest record rather
              than from the model's frontmatter — for CC BY-NC-SA sources this
              is a condition, not a courtesy (20260727_source_attribution.sql). */}
          {provenance?.sources?.length > 0 && (
            <section style={S.section}>
              <h2 style={S.sectionH}>Built from</h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {provenance.sources.map(s => (
                  <li key={s} style={{ ...S.sub, margin: '0 0 6px' }}>{s}</li>
                ))}
              </ul>
              {isStaff && provenance.has_unverified_source && (
                <p style={{ ...S.sub, color: 'var(--pk)', marginTop: 8 }}>
                  One source is recorded as UNVERIFIED — it fell back to a filename and wants a real citation.
                </p>
              )}
            </section>
          )}

          {isStaff && unresolved.length > 0 && (
            <section style={S.section}>
              <h2 style={S.sectionH}>Unresolved links</h2>
              <p style={S.sub}>
                This page links to {unresolved.length} slug{unresolved.length === 1 ? '' : 's'} with no
                page: {unresolved.map(l => l.target_slug).join(', ')}.
              </p>
            </section>
          )}
        </article>
      </div>

      <p style={S.licenseFoot}>
        This guide is free and open under{' '}
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" style={S.link}
           target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>
        {' '}· this page's sources are credited in its Sources and attribution section.
      </p>
    </Shell>
  )
}

// Slug lists the ingest prompt puts in frontmatter. These are NOT in
// wiki_links: sync_wiki_links() only reads the body, so a page related only
// through frontmatter contributes no edge and shows no backlink. Rendering
// them here makes the relation navigable; whether the graph should carry them
// too is a database question, not a reader one, so this deliberately doesn't
// pretend they're links. Values that don't look like slugs (prose that landed
// in a list field) are dropped rather than shown as dead chips.
const RELATED_KEYS = [
  'related_disorders', 'related_concepts', 'key_studies',
  'disorders_touched', 'concepts_touched', 'target_disorders',
]

function relatedSlugs(meta) {
  const out = []
  for (const key of RELATED_KEYS) {
    for (const v of meta[key] ?? []) {
      if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && !out.includes(v)) out.push(v)
    }
  }
  return out
}

// The inline gap list (Phase D). Renders under a section's prose: each open
// ask as a coloured row, plus the staff flag control. For a non-staff reader
// a gapless section renders nothing at all — most sections are fine, and
// saying so everywhere would drown the ones that aren't. Staff always get
// the flag control: the whole point of flag-from-reader is that the
// observation is made where it happens, mid-read.
function GapList({ gaps, section, isStaff, onFlag }) {
  const [open, setOpen] = useState(false)
  const [ask, setAsk] = useState('')
  const [difficulty, setDifficulty] = useState('amber')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const rows = gaps ?? []
  if (rows.length === 0 && !isStaff) return null

  const submit = async () => {
    setBusy(true)
    setErr(null)
    const message = await onFlag(section, ask, difficulty)
    setBusy(false)
    if (message) return setErr(message)
    setAsk('')
    setOpen(false)
  }

  return (
    <div style={G.wrap}>
      {rows.map(g => {
        const d = DIFF[g.difficulty] ?? DIFF.amber
        return (
          <div key={g.id} style={G.row}>
            <span aria-hidden="true" style={{ ...G.dot, background: d.colour }} />
            <span style={{ ...G.rowText, opacity: g.difficulty === 'red' ? 0.65 : 1 }}>
              <span style={{ ...G.diffTag, color: d.colour }}>{d.label}</span>
              {' '}{g.ask}
            </span>
          </div>
        )
      })}
      {isStaff && !open && (
        <button style={G.flagBtn} onClick={() => setOpen(true)}>
          + flag a gap{section ? ' in this section' : ''}
        </button>
      )}
      {isStaff && open && (
        <div style={G.form}>
          <textarea
            style={G.askInput}
            placeholder="What is missing? Written as an ask a student (or future staff) can act on — it lands on the gap board verbatim."
            value={ask}
            onChange={e => setAsk(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select style={G.diffSelect} value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              <option value="green">green — lookup, students can own it (2 claims)</option>
              <option value="amber">amber — needs judgment, staff-verified</option>
              <option value="red">red — staff only</option>
            </select>
            <button style={G.flagGo} disabled={busy || ask.trim().length < 26} onClick={submit}>
              {busy ? '…' : 'Flag it'}
            </button>
            <button style={G.flagCancel} disabled={busy} onClick={() => { setOpen(false); setErr(null) }}>
              Cancel
            </button>
            {ask.trim().length > 0 && ask.trim().length < 26 && (
              <span style={G.hint}>a little more — the ask is the whole brief</span>
            )}
          </div>
          {err && <p style={{ ...G.hint, color: 'var(--pk)' }}>{err}</p>}
        </div>
      )}
    </div>
  )
}

const G = {
  wrap: { margin: '10px 0 4px' },
  row: { display: 'flex', gap: 8, alignItems: 'baseline', padding: '5px 0' },
  dot: { flexShrink: 0, width: 8, height: 8, borderRadius: '50%', position: 'relative', top: -1 },
  rowText: { fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.5 },
  diffTag: { fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase' },
  flagBtn: { marginTop: 4, fontFamily: MONO, fontSize: 11, letterSpacing: 0.5, padding: '3px 10px', borderRadius: 14, border: '1px dashed var(--bd)', background: 'none', color: 'var(--tx2)', cursor: 'pointer' },
  form: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  askInput: { width: '100%', boxSizing: 'border-box', minHeight: 64, resize: 'vertical', fontSize: 13.5, lineHeight: 1.5, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' },
  diffSelect: { fontSize: 13, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' },
  flagGo: { fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 18, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  flagCancel: { fontSize: 13, padding: '6px 12px', borderRadius: 18, border: '1px solid var(--bd)', background: 'none', color: 'var(--tx2)', cursor: 'pointer' },
  hint: { fontSize: 12, color: 'var(--tx2)', fontStyle: 'italic' },
}

function Shell({ course, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '28px 16px 64px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <p style={S.eyebrow}><Link to="/academic/fieldguide" style={S.eyebrowLink}>Field Guide</Link>{course?.code ? ` · ${course.code}` : ''}</p>
        {children}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  crumbIcon: { verticalAlign: 'middle', borderRadius: 8, border: '1px solid var(--bd)', background: '#fff', objectFit: 'contain', marginRight: 5 },
  crumbs: { fontSize: 13, color: 'var(--tx2)', margin: '10px 0 6px' },
  title: { fontFamily: SERIF, fontSize: 34, color: 'var(--tx)', margin: '4px 0 6px', lineHeight: 1.15 },
  metaLine: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--tx2)' },
  summary: { fontSize: 17, color: 'var(--tx2)', lineHeight: 1.6, margin: '12px 0 0', maxWidth: '62ch' },

  prevalence: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', margin: '14px 0 0', padding: '10px 14px', borderRadius: 10, background: 'var(--bgc)', border: '1px solid var(--bd)', maxWidth: '62ch' },
  prevalenceLabel: { flex: '0 0 auto', fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--pk)', textDecoration: 'none' },
  prevalenceText: { flex: '1 1 200px', fontSize: 14, color: 'var(--tx)', lineHeight: 1.5 },

  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55 },
  dim: { color: 'var(--tx2)', fontSize: 13 },
  link: { color: 'var(--pk)', textDecoration: 'none' },
  code: { fontFamily: MONO, fontSize: 13 },

  publishBtn: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 12px', borderRadius: 14, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  licenseFoot: { fontSize: 12, color: 'var(--tx2)', marginTop: 40, borderTop: '1px solid var(--bd)', paddingTop: 12 },
  draftBanner: { marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(214,51,132,.07)', border: '1px solid rgba(214,51,132,.28)', fontSize: 13, color: 'var(--tx)' },

  stampBar: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'var(--bgc)', border: '1px solid var(--bd)' },
  stampState: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', flex: '0 0 auto' },
  stampNote: { flex: '1 1 220px', fontSize: 13, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' },
  stampBtn: { fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 18, border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },
  stampNext: { fontSize: 13, fontWeight: 600, color: 'var(--pk)', textDecoration: 'none', whiteSpace: 'nowrap' },
  stampBtnOff: { fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 18, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx2)', cursor: 'pointer', whiteSpace: 'nowrap' },

  criteria: { display: 'block', marginTop: 16, padding: '14px 16px', borderRadius: 12, background: 'var(--bgc)', border: '1px solid var(--bd)', textDecoration: 'none' },
  criteriaLabel: { display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--pk)' },
  criteriaText: { display: 'block', fontSize: 15, color: 'var(--tx)', marginTop: 4 },
  criteriaNote: { display: 'block', fontSize: 12, color: 'var(--tx2)', marginTop: 4 },

  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 28, marginTop: 22, alignItems: 'start' },
  foldBar: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 4px' },
  foldBtn: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', padding: '5px 12px', borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx2)', cursor: 'pointer' },
  foldCount: { fontFamily: MONO, fontSize: 11, letterSpacing: 0.5, color: 'var(--tx2)' },
  foldSection: { borderTop: '1px solid var(--bd)', marginTop: 18 },
  // The h2 keeps the anchor id and the document outline; the button inside it
  // is what takes the click, so the heading stays a heading to a screen reader.
  foldHeadingWrap: { margin: 0, scrollMarginTop: 20 },
  foldHeading: { display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', textAlign: 'left', padding: '14px 0 6px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: SERIF, fontSize: 23, lineHeight: 1.2, color: 'var(--tx)' },
  caret: { flexShrink: 0, fontSize: 13, color: 'var(--pk)', transition: 'transform .15s ease', display: 'inline-block' },

  toc: { position: 'sticky', top: 16, alignSelf: 'start', borderLeft: '2px solid var(--bd)', paddingLeft: 12 },
  tocLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 6px' },
  tocLink: { display: 'block', fontSize: 13, color: 'var(--tx2)', textDecoration: 'none', padding: '3px 0' },

  section: { marginTop: 30, paddingTop: 18, borderTop: '1px solid var(--bd)' },
  sectionH: { fontFamily: SERIF, fontSize: 18, color: 'var(--tx)', margin: '0 0 8px' },
  needsBox: { marginTop: 30, padding: '14px 16px', borderRadius: 12, background: 'var(--bgc)', border: '1px solid var(--bd)' },

  editBtn: { flexShrink: 0, marginTop: 8, fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },
  editBox: { marginTop: 16, padding: 16, borderRadius: 12, background: 'var(--bgc)', border: '1px solid var(--bd)' },
  colLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 8px' },
  editArea: { width: '100%', boxSizing: 'border-box', minHeight: 420, resize: 'vertical', fontFamily: MONO, fontSize: 12.5, lineHeight: 1.55, padding: 12, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' },
  noteInput: { width: '100%', boxSizing: 'border-box', marginTop: 10, fontSize: 14, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' },
  saveNotice: { marginTop: 12, fontFamily: MONO, fontSize: 13, color: 'var(--pk)', lineHeight: 1.5 },
  primary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  // Disabled twin of `primary`. Buttons carry inline styles here, so `:disabled`
  // in a stylesheet would never reach them — the greyed state has to be a style
  // object the render picks, and `cursor: not-allowed` is what makes it read as
  // deliberate rather than dead.
  primaryOff: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: 'none', background: 'var(--bd)', color: 'var(--tx2)', cursor: 'not-allowed' },
  blockedHint: { fontSize: 13, color: 'var(--tx2)', fontStyle: 'italic' },
  secondary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },

  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { fontSize: 13, padding: '5px 11px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', textDecoration: 'none' },
  chipDim: { color: 'var(--tx2)', fontFamily: MONO, fontSize: 12 },
}
