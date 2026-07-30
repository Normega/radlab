import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams, useLocation } from 'react-router-dom'
import { WikiMarkdown } from './wikiMarkdown'
import { WIKI_BASE, splitFrontmatter, extractHeadings } from './wikiText'
import { useWikiCourse } from './useWikiCourse'
import { useWideLayout } from './useWideLayout'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

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

  // Staff editing
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

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
      const [{ data: all }, { data: back }, { data: out }, { data: prov }, { data: cat }] = await Promise.all([
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
      ])
      if (cancelled) return
      setPages(new Map((all ?? []).map(p => [p.slug, p])))
      setBacklinks((back ?? []).map(b => b.source).filter(Boolean)
        .sort((a, b) => a.title.localeCompare(b.title)))
      setOutbound(out ?? [])
      setProvenance(prov ?? null)
      setCatalog(cat ?? null)
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
    })
    setSaving(false)
    if (error) return setSaveNotice(error.message)
    setEditing(false)
    setDraft('')
    setSaveNotice(
      `Saved as v${data.current_version} · ${data.links_extracted} link${data.links_extracted === 1 ? '' : 's'}` +
      ` · ${data.needs?.length ? `still needs: ${data.needs.join(', ')}` : 'no declared gaps'}`
    )
    setReloadKey(k => k + 1)
  }

  const { meta, body } = useMemo(() => splitFrontmatter(page?.content), [page?.content])
  const toc = useMemo(() => extractHeadings(body), [body])

  // Arriving from a [[page#section]] link: the target heading doesn't exist
  // until the body has rendered, so the browser's own hash handling has
  // already given up by then.
  useEffect(() => {
    if (!hash || !page?.content) return
    const el = document.getElementById(hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, page?.content])

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
        {catalog?.dsm_chapter_title && <> · <span style={S.dim}>{catalog.dsm_chapter_title}</span></>}
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
        {catalog?.tier && <> · tier {catalog.tier}</>}
        {catalog?.lecture && <> · lecture {catalog.lecture}</>}
        {' · '}updated {new Date(page.updated_at).toLocaleDateString()}
      </p>
      {page.summary && <p style={S.summary}>{page.summary}</p>}

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
            placeholder="What changed, and why (optional, but it's what version history will show)"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <p style={S.sub}>
            Gaps and links are re-derived on save: removing a <code style={S.code}>&gt; **Needs
            research:**</code> line closes that gap, and adding a wikilink adds a graph edge.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={S.primary} disabled={saving || draft === page.content} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button style={S.secondary} disabled={saving} onClick={() => { setEditing(false); setDraft('') }}>
              Cancel
            </button>
            <span style={S.dim}>
              {draft.length.toLocaleString()} chars
              {draft === page.content && ' · unchanged'}
            </span>
          </div>
        </section>
      )}

      {/* Staff see drafts; the badge is there so nobody reviews a page
          believing students are already reading it. */}
      {page.status !== 'published' && (
        <p style={S.draftBanner}>
          <b>{page.status}</b> — not visible to students.{' '}
          {isStaff && <Link to="/academic/fieldguide/review" style={S.link}>Publish it from the review queue →</Link>}
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
                 style={{ ...S.tocLink, paddingLeft: h.depth === 3 ? 12 : 0, opacity: h.depth === 3 ? 0.8 : 1 }}>
                {h.text}
              </a>
            ))}
          </aside>
        )}

        <article style={{ minWidth: 0 }}>
          {page.content
            ? <WikiMarkdown content={page.content} pages={pages} />
            : <p style={S.sub}>This page is a stub — it exists so links to it resolve, but nothing has been written into it yet.</p>}

          {/* Self-declared gaps. Shown to everyone deliberately: for a student
              this is the assignment list, and a wiki that says what it doesn't
              know teaches something a confident one doesn't. */}
          {page.needs?.length > 0 && (
            <section style={S.needsBox}>
              <h2 style={S.sectionH}>What this page still needs</h2>
              <p style={S.sub}>
                Sections this page declares it can't yet support from its sources:{' '}
                <b>{page.needs.join(', ')}</b>.
              </p>
            </section>
          )}

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

function Shell({ course, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '28px 16px 64px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <p style={S.eyebrow}>Field Guide{course?.code ? ` · ${course.code}` : ''}</p>
        {children}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  crumbs: { fontSize: 13, color: 'var(--tx2)', margin: '10px 0 6px' },
  title: { fontFamily: SERIF, fontSize: 34, color: 'var(--tx)', margin: '4px 0 6px', lineHeight: 1.15 },
  metaLine: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--tx2)' },
  summary: { fontSize: 17, color: 'var(--tx2)', lineHeight: 1.6, margin: '12px 0 0', maxWidth: '62ch' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55 },
  dim: { color: 'var(--tx2)', fontSize: 13 },
  link: { color: 'var(--pk)', textDecoration: 'none' },
  code: { fontFamily: MONO, fontSize: 13 },

  draftBanner: { marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'rgba(214,51,132,.07)', border: '1px solid rgba(214,51,132,.28)', fontSize: 13, color: 'var(--tx)' },

  criteria: { display: 'block', marginTop: 16, padding: '14px 16px', borderRadius: 12, background: 'var(--bgc)', border: '1px solid var(--bd)', textDecoration: 'none' },
  criteriaLabel: { display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--pk)' },
  criteriaText: { display: 'block', fontSize: 15, color: 'var(--tx)', marginTop: 4 },
  criteriaNote: { display: 'block', fontSize: 12, color: 'var(--tx2)', marginTop: 4 },

  layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 28, marginTop: 22, alignItems: 'start' },
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
  secondary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },

  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: { fontSize: 13, padding: '5px 11px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', textDecoration: 'none' },
  chipDim: { color: 'var(--tx2)', fontFamily: MONO, fontSize: 12 },
}
