import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Field Guide review queue (WP3). Nothing an ingest produces is visible to
// students until it passes through here: api/ingest.js writes page *shells*
// plus `proposed` versions, and only review_proposal() promotes a proposal
// into wiki_pages.content.
//
// All writes go through the review_proposal RPC — wiki_pages deliberately has
// no authenticated write policies, so there is no client-side path that could
// publish without the staff check inside that function.
export default function ReviewQueue() {
  const { courseClient, session, staffEnrollments } = useOutletContext()
  const [courseId, setCourseId] = useState(staffEnrollments[0]?.course_id)
  const [rows, setRows] = useState(null)   // null = loading
  const [shelf, setShelf] = useState([])   // pages that already carry accepted content
  const [counts, setCounts] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [edits, setEdits] = useState({})   // version_id -> edited body
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  const course = staffEnrollments.find(e => e.course_id === courseId)?.courses

  const load = useCallback(async () => {
    if (!courseId) return
    const [{ data: queue }, { data: shelfRows }, { count: pages }] = await Promise.all([
      courseClient.from('review_queue').select('*').eq('course_id', courseId).order('proposed_at'),
      courseClient.from('wiki_page_shelf').select('*').eq('course_id', courseId).order('slug'),
      courseClient.from('wiki_pages').select('id', { count: 'exact', head: true })
        .eq('course_id', courseId),
    ])
    setRows(queue ?? [])
    setShelf(shelfRows ?? [])
    setCounts({
      published: (shelfRows ?? []).filter(p => p.status === 'published').length,
      pages: pages ?? 0,
    })
  }, [courseClient, courseId])

  // Unpublish is deliberately its own action, not a toggle: publishing exposes
  // a page to every enrolled student, unpublishing retracts something they may
  // already have read, and a toggle implies those are symmetric. The reason is
  // mandatory — a page pulled for a typo and one pulled because a student
  // flagged a factual error are indistinguishable three weeks later otherwise.
  const unpublish = async (page) => {
    const reason = window.prompt(
      `Unpublish "${page.slug}"?\n\nIt returns to draft — content and review history are kept, only student visibility is revoked.\n\nWhy are you pulling it? (recorded with your name)`
    )
    if (reason == null) return
    if (!reason.trim()) return setNotice('Unpublish cancelled — a reason is required.')
    const { data, error } = await courseClient.rpc('unpublish_page', {
      p_page_id: page.page_id,
      p_reason: reason,
    })
    if (error) return setNotice(`${page.slug}: ${error.message}`)
    setNotice(`${data.slug} unpublished → draft · "${data.reason}"`)
    load()
  }

  useEffect(() => { load() }, [load])

  const decide = async (row, decision, publish = true) => {
    setBusyId(row.version_id)
    setNotice(null)
    // What the reviewer is actually looking at: their edits if any, else the
    // pre-filled draft (which for a delta is current + addendum, not the raw
    // proposal). Send it whenever it differs from what the model proposed —
    // comparing against `edits` alone would let an un-edited merge fall through
    // to p_content = null, and the RPC would then write the bare delta,
    // reproducing the very fragment the pre-fill exists to prevent.
    const effective = edits[row.version_id] ?? mergeDraft(row)
    const { data, error } = await courseClient.rpc('review_proposal', {
      p_version_id: row.version_id,
      p_decision: decision,
      p_content: decision === 'accept' && effective !== row.proposed_content ? effective : null,
      p_publish: publish,
    })
    setBusyId(null)
    if (error) return setNotice(`${row.slug}: ${error.message}`)

    setNotice(
      data?.decision === 'accepted'
        ? `${data.slug} ${data.status}${data.edited ? ' (with your edits)' : ''} · v${data.current_version} · ${data.links_extracted} link${data.links_extracted === 1 ? '' : 's'} extracted`
        : `${data?.slug ?? row.slug} rejected`
    )
    setOpenId(null)
    load()
  }

  if (rows === null) {
    return <Page course={course} session={session} client={courseClient}><p style={S.sub}>Loading queue…</p></Page>
  }

  return (
    <Page course={course} session={session} client={courseClient}
          staffEnrollments={staffEnrollments} courseId={courseId} setCourseId={setCourseId}>
      <div style={S.statRow}>
        <Stat n={rows.length} label="awaiting review" accent />
        <Stat n={counts?.published ?? 0} label="published" />
        <Stat n={counts?.pages ?? 0} label="pages total" />
      </div>

      {notice && <p style={S.notice}>{notice}</p>}

      {rows.length === 0 && (
        <p style={{ ...S.sub, marginTop: 24 }}>
          Nothing pending. New proposals appear here after an ingest completes.
        </p>
      )}

      {groupByPage(rows).map(group => group.rows.map((row, idxInPage) => {
        const open = openId === row.version_id
        // A page can have several pending proposals — typically a full `new`
        // from one paper and a delta `update` from the next. They arrive ~17
        // rows apart in time order, which is how an update got accepted before
        // its own page had a body. Grouped by page and ordered within it, the
        // dependency is visible instead of remembered.
        const stackSize = group.rows.length
        const blockedBy = row.action === 'update' && !row.current_content
          ? group.rows.find(r => r.action !== 'update' && r.version_id !== row.version_id)
          : null
        // An `update` proposal is a DELTA — the system prompt asks the model
        // for "only the new information to merge, not a full rewrite". Accepting
        // it as-is replaces the whole page with the addendum, which is how
        // dodo-bird-verdict ended up as a bare "Update from Fonagy (2015)"
        // section with no definition above it (2026-07-26). So when there is a
        // body to merge into, the editor starts pre-merged: current content,
        // then the delta. The reviewer edits that down into one page.
        const merged = mergeDraft(row)
        const body = edits[row.version_id] ?? merged
        const dirty = edits[row.version_id] != null && edits[row.version_id] !== merged
        const isDelta = row.action === 'update' && !!row.current_content
        // A reference-mode rewrite of a page that already has a body. Not
        // pre-merged (it is already whole), but the reviewer has to know the
        // current body is about to be overwritten rather than added to.
        const isReplace = row.action === 'replace' && !!row.current_content
        return (
          <div key={row.version_id} style={S.card}>
            <button style={S.cardHead} onClick={() => setOpenId(open ? null : row.version_id)}>
              <span style={{ textAlign: 'left', minWidth: 0 }}>
                <span style={S.slug}>{row.slug}</span>
                <span style={S.metaLine}>
                  {row.type} · {row.proposed_length} chars
                  {row.tier && <> · tier {row.tier}</>}
                  {stackSize > 1 && <> · <b>{idxInPage + 1} of {stackSize} for this page</b></>}
                </span>
              </span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <Badge kind={row.action}>{row.action}</Badge>
                {row.is_first_content && <Badge kind="first">first body</Badge>}
                <span style={S.chev}>{open ? '▾' : '▸'}</span>
              </span>
            </button>

            {/* Rewrite-level flags travel from the taxonomy seed, so they are
                in front of the reviewer at the moment of decision rather than
                in a markdown file nobody opens mid-review. */}
            {row.tier_review_note?.startsWith('REWRITE') && (
              <p style={S.rewriteFlag}>⚠ {row.tier_review_note}</p>
            )}

            {isDelta && (
              <p style={S.mergeFlag}>
                <b>This is an update, not a full page.</b> The model was asked for only the new
                information to merge. The editor below is pre-filled with the current body
                followed by this addendum — edit it into one coherent page before accepting, or
                you will replace the page with the addendum alone.
              </p>
            )}
            {isReplace && (
              <p style={S.mergeFlag}>
                <b>This is a full-page replacement.</b> Accepting it <b>overwrites</b> the current
                body — the two are not combined. Read the left column for anything the rewrite
                dropped, and edit it back in before accepting. The previous body is kept as an
                accepted version, so this is recoverable, but not from this screen.
              </p>
            )}
            {row.action === 'update' && !row.current_content && (
              <p style={S.mergeFlag}>
                <b>Update proposed against a page with no accepted body.</b> Nothing exists to
                merge into, so this addendum would become the entire page.{' '}
                {blockedBy
                  ? <>Review the full <b>{blockedBy.action}</b> proposal for this page first
                      ({blockedBy.proposed_length} chars, listed directly above) — then reopen this
                      one and it will pre-fill as a merge.</>
                  : <>There is no full proposal for this page in the queue, so this needs
                      rewriting into a standalone page before accepting.</>}
              </p>
            )}

            {open && (
              <div style={{ padding: '0 14px 14px' }}>
                <div style={S.split}>
                  <div style={{ minWidth: 0 }}>
                    <p style={S.colLabel}>
                      Current {row.is_first_content && <span style={S.dim}>— none yet</span>}
                    </p>
                    <pre style={S.pre}>
                      {row.current_content ?? '(this page has no accepted body yet)'}
                    </pre>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={S.colLabel}>
                      {isDelta ? 'Merged (current + addendum) — edit before accepting'
                        : isReplace ? 'Proposed replacement — overwrites the current body'
                        : 'Proposed'} {dirty && <span style={{ color: 'var(--pk)' }}>· edited</span>}
                    </p>
                    <textarea
                      style={{ ...S.pre, width: '100%', minHeight: 320, resize: 'vertical' }}
                      value={body}
                      onChange={e => setEdits(p => ({ ...p, [row.version_id]: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={S.actions}>
                  <button style={S.primary} disabled={busyId === row.version_id}
                          onClick={() => decide(row, 'accept', true)}>
                    {busyId === row.version_id ? 'Working…' : 'Accept & publish'}
                  </button>
                  <button style={S.secondary} disabled={busyId === row.version_id}
                          onClick={() => decide(row, 'accept', false)}>
                    Accept as draft
                  </button>
                  <button style={S.danger} disabled={busyId === row.version_id}
                          onClick={() => decide(row, 'reject')}>
                    Reject
                  </button>
                  {dirty && (
                    <button style={S.linkBtn}
                            onClick={() => setEdits(p => { const n = { ...p }; delete n[row.version_id]; return n })}>
                      Revert edits
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      }))}

      {shelf.length > 0 && (
        <>
          <h2 style={S.h2}>Pages</h2>
          <p style={S.sub}>
            Reviewed pages. <b>Published</b> is visible to every enrolled student; <b>draft</b> is
            staff-only. There is no bulk publish — each page is published by the person who
            reviewed it, so <code>reviewed_by</code> means something.
          </p>
          {shelf.map(page => (
            <div key={page.page_id} style={S.card}>
              <div style={{ ...S.cardHead, cursor: 'default' }}>
                <span style={{ textAlign: 'left', minWidth: 0 }}>
                  <span style={S.slug}>{page.slug}</span>
                  <span style={S.metaLine}>
                    {page.type} · v{page.current_version} · {page.body_length} chars ·{' '}
                    {page.outbound_links} out / {page.backlinks} in
                    {page.pending_proposals > 0 && (
                      <> · <b>{page.pending_proposals} proposal(s) still pending</b></>
                    )}
                    {/* Self-declared gaps. A disorder page built from one paper
                        will usually have several — that's the wiki saying what
                        to read next, not a defect. */}
                    {page.gap_count > 0 && (
                      <><br /><span style={{ color: 'var(--pk)' }}>
                        needs: {page.needs.join(', ')}
                      </span></>
                    )}
                    {page.last_unpublish_reason && (
                      <><br /><span style={S.dim}>last pulled: “{page.last_unpublish_reason}”</span></>
                    )}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {/* Rendered, as a student sees it — the check that raw
                      markdown in a textarea can't give you. */}
                  <Link to={`/academic/fieldguide/wiki/${page.slug}`} style={S.link}>View</Link>
                  <Badge kind={page.status === 'published' ? 'update' : 'first'}>{page.status}</Badge>
                  {page.status === 'published' && (
                    <button style={S.danger} onClick={() => unpublish(page)}>Unpublish</button>
                  )}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </Page>
  )
}

// Queue order: proposals for the same page adjacent, and within a page,
// full proposals before deltas — the order they have to be reviewed in. Pages
// themselves keep arrival order, so the queue still reads chronologically.
function groupByPage(rows) {
  const byPage = new Map()
  for (const r of rows) {
    if (!byPage.has(r.page_id)) byPage.set(r.page_id, { page_id: r.page_id, slug: r.slug, rows: [] })
    byPage.get(r.page_id).rows.push(r)
  }
  for (const g of byPage.values()) {
    g.rows.sort((a, b) =>
      (a.action === 'update') - (b.action === 'update') ||
      new Date(a.proposed_at) - new Date(b.proposed_at))
  }
  return [...byPage.values()]
}

// What the editor should open with. For a delta against an existing body,
// that's the two stitched together so "accept without thinking" produces a
// merge rather than a replacement. Everything else opens as proposed.
//
// `replace` deliberately does NOT pre-merge: it is already a complete page
// (reference mode rewrites its target rather than appending to it), so
// stitching it onto the current body is what produced the duplicated
// six-section skeletons this action exists to prevent.
function mergeDraft(row) {
  const proposed = row.proposed_content ?? ''
  if (row.action !== 'update' || !row.current_content) return proposed
  // Drop the addendum's own frontmatter — the page already has one, and two
  // YAML blocks in a single file is invalid.
  const withoutFrontmatter = proposed.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
  return `${row.current_content.trimEnd()}\n\n${withoutFrontmatter.trimStart()}`
}

function Page({ course, session, client, children, staffEnrollments, courseId, setCourseId }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={S.eyebrow}><Link to="/academic/fieldguide" style={S.eyebrowLink}>Field Guide</Link></p>
            <h1 style={S.title}>Review queue</h1>
            {course && <p style={S.sub}>{course.code} · {course.name} ({course.term})</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ ...S.sub, fontSize: 12 }}>{session.user.email}</p>
            <Link to="/academic/fieldguide/wiki" style={S.link}>Wiki</Link>
            <Link to="/academic/fieldguide/ingest" style={{ ...S.link, marginLeft: 10 }}>Ingest portal</Link>
            <button style={{ ...S.linkBtn, marginLeft: 10 }} onClick={() => client.auth.signOut()}>Sign out</button>
          </div>
        </header>

        {staffEnrollments?.length > 1 && (
          <select style={{ ...S.input, marginTop: 12 }} value={courseId} onChange={e => setCourseId(e.target.value)}>
            {staffEnrollments.map(e => (
              <option key={e.course_id} value={e.course_id}>{e.courses?.code} — {e.courses?.name}</option>
            ))}
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

// `update` and `replace` both carry consequences a plain `new` doesn't — one is
// appended, the other overwrites — so both read as accented rather than neutral.
const Badge = ({ kind, children }) => {
  const accent = kind === 'update' || kind === 'replace'
  return (
    <span style={{
      ...S.badge,
      background: accent ? 'rgba(214,51,132,.12)' : 'rgba(0,0,0,.05)',
      color: accent ? 'var(--pk)' : 'var(--tx2)',
    }}>{children}</span>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  dim: { color: 'var(--tx2)', fontWeight: 400 },
  link: { fontSize: 13, color: 'var(--pk)' },
  linkBtn: { fontSize: 13, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  input: { fontSize: 15, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },
  notice: { ...{ fontSize: 14, lineHeight: 1.5 }, color: 'var(--pk)', marginTop: 14, fontFamily: MONO, fontSize: 13 },

  h2: { fontFamily: SERIF, fontSize: 20, color: 'var(--tx)', margin: '30px 0 4px' },

  statRow: { display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  stat: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '12px 18px', display: 'flex', flexDirection: 'column', minWidth: 120 },
  statN: { fontFamily: SERIF, fontSize: 26, lineHeight: 1 },
  statL: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', marginTop: 4 },

  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, marginTop: 10 },
  cardHead: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx)' },
  slug: { display: 'block', fontFamily: MONO, fontSize: 14, color: 'var(--tx)', overflowWrap: 'anywhere' },
  metaLine: { display: 'block', fontSize: 12, color: 'var(--tx2)', marginTop: 2 },
  chev: { color: 'var(--tx2)', fontSize: 13 },
  badge: { fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', padding: '3px 7px', borderRadius: 20 },
  mergeFlag: { margin: '0 14px 12px', padding: '8px 10px', borderRadius: 8, background: 'rgba(214,51,132,.07)', border: '1px solid rgba(214,51,132,.28)', color: 'var(--tx)', fontSize: 13, lineHeight: 1.45 },
  rewriteFlag: { margin: '0 14px 12px', padding: '8px 10px', borderRadius: 8, background: 'rgba(192,57,43,.08)', border: '1px solid rgba(192,57,43,.25)', color: '#c0392b', fontSize: 13, lineHeight: 1.45 },

  split: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 },
  colLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 6px' },
  pre: { fontFamily: MONO, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 8, padding: 12, maxHeight: 420, overflowY: 'auto', color: 'var(--tx)', margin: 0 },

  actions: { display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' },
  primary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  secondary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },
  danger: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid rgba(192,57,43,.35)', background: 'none', color: '#c0392b', cursor: 'pointer' },
}
