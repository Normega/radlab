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
  const [counts, setCounts] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [edits, setEdits] = useState({})   // version_id -> edited body
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  const course = staffEnrollments.find(e => e.course_id === courseId)?.courses

  const load = useCallback(async () => {
    if (!courseId) return
    const [{ data: queue }, { count: published }, { count: pages }] = await Promise.all([
      courseClient.from('review_queue').select('*').eq('course_id', courseId).order('proposed_at'),
      courseClient.from('wiki_pages').select('id', { count: 'exact', head: true })
        .eq('course_id', courseId).eq('status', 'published'),
      courseClient.from('wiki_pages').select('id', { count: 'exact', head: true })
        .eq('course_id', courseId),
    ])
    setRows(queue ?? [])
    setCounts({ published: published ?? 0, pages: pages ?? 0 })
  }, [courseClient, courseId])

  useEffect(() => { load() }, [load])

  const decide = async (row, decision, publish = true) => {
    setBusyId(row.version_id)
    setNotice(null)
    const edited = edits[row.version_id]
    const { data, error } = await courseClient.rpc('review_proposal', {
      p_version_id: row.version_id,
      p_decision: decision,
      // Only send content when the reviewer actually changed it; null means
      // "accept exactly what was proposed".
      p_content: decision === 'accept' && edited != null && edited !== row.proposed_content
        ? edited
        : null,
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

      {rows.map(row => {
        const open = openId === row.version_id
        const body = edits[row.version_id] ?? row.proposed_content ?? ''
        const dirty = edits[row.version_id] != null && edits[row.version_id] !== row.proposed_content
        return (
          <div key={row.version_id} style={S.card}>
            <button style={S.cardHead} onClick={() => setOpenId(open ? null : row.version_id)}>
              <span style={{ textAlign: 'left', minWidth: 0 }}>
                <span style={S.slug}>{row.slug}</span>
                <span style={S.metaLine}>
                  {row.type} · {row.proposed_length} chars
                  {row.tier && <> · tier {row.tier}</>}
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
                      Proposed {dirty && <span style={{ color: 'var(--pk)' }}>· edited</span>}
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
      })}
    </Page>
  )
}

function Page({ course, session, client, children, staffEnrollments, courseId, setCourseId }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={S.eyebrow}>Field Guide</p>
            <h1 style={S.title}>Review queue</h1>
            {course && <p style={S.sub}>{course.code} · {course.name} ({course.term})</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ ...S.sub, fontSize: 12 }}>{session.user.email}</p>
            <Link to="/academic/fieldguide/ingest" style={S.link}>Ingest portal</Link>
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

const Badge = ({ kind, children }) => (
  <span style={{
    ...S.badge,
    background: kind === 'update' ? 'rgba(214,51,132,.12)' : kind === 'first' ? 'rgba(0,0,0,.05)' : 'rgba(0,0,0,.05)',
    color: kind === 'update' ? 'var(--pk)' : 'var(--tx2)',
  }}>{children}</span>
)

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  dim: { color: 'var(--tx2)', fontWeight: 400 },
  link: { fontSize: 13, color: 'var(--pk)' },
  linkBtn: { fontSize: 13, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  input: { fontSize: 15, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },
  notice: { ...{ fontSize: 14, lineHeight: 1.5 }, color: 'var(--pk)', marginTop: 14, fontFamily: MONO, fontSize: 13 },

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
  rewriteFlag: { margin: '0 14px 12px', padding: '8px 10px', borderRadius: 8, background: 'rgba(192,57,43,.08)', border: '1px solid rgba(192,57,43,.25)', color: '#c0392b', fontSize: 13, lineHeight: 1.45 },

  split: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 },
  colLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 6px' },
  pre: { fontFamily: MONO, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 8, padding: 12, maxHeight: 420, overflowY: 'auto', color: 'var(--tx)', margin: 0 },

  actions: { display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' },
  primary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  secondary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },
  danger: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid rgba(192,57,43,.35)', background: 'none', color: '#c0392b', cursor: 'pointer' },
}
