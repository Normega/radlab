import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Student submission review (WP6). Deliberately a separate route and chunk from
// ReviewQueue: that one is the staff *authoring* path (ingest proposals), this
// is the student *contribution* path. Different reviewers — TAs live here and
// should never need the ingest portal — and different failure modes.
//
// Everything shown comes from the submission_review_queue view, which joins a
// claim to its gap and runs the stored precheck. The view is security_invoker,
// so a TA sees exactly what RLS permits and nothing is fetched client-side that
// the database would not already release.
//
// `route` is the whole point of the layout below. A TA's scarce resource is
// attention, not clicks:
//   BLOCKED     — precheck found a hard fault. Needs no reading at all.
//   warnings    — read, but the specific thing to look at is named.
//   light check — a green gap that passed. Confirm the number matches the source.
//   full read   — everything else: does the source actually say this?
// That last question is the only one precheck cannot answer, and it is the job.
const ROUTES = [
  ['BLOCKED',     'Blocked by precheck',  'No reading needed — send back with the findings.', '#c0392b'],
  ['warnings',    'Warnings',             'Read, focusing on what precheck flagged.',         '#b8860b'],
  ['full read',   'Full read',            'Does the source actually say this?',               'var(--pk)'],
  ['light check', 'Light check',          'Green gap, clean precheck — confirm the figure.',  '#2e7d32'],
  ['not checked', 'Not yet prechecked',   'Run precheck before reading.',                     'var(--tx2)'],
]

const SEV = { block: '#c0392b', warn: '#b8860b' }

export default function SubmissionsQueue() {
  const { courseClient, session, staffEnrollments } = useOutletContext()
  const [rows, setRows] = useState(null)      // null = loading
  const [openId, setOpenId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await courseClient
      .from('submission_review_queue')
      .select('*')
      .order('submitted_at', { ascending: true })
    if (error) { setNotice(error.message); setRows([]); return }
    setRows(data ?? [])
  }, [courseClient])

  useEffect(() => { load() }, [load])

  const recheck = async (row) => {
    setBusyId(row.claim_id); setNotice(null)
    const { error } = await courseClient.rpc('run_precheck', { p_claim_id: row.claim_id })
    setBusyId(null)
    if (error) return setNotice(error.message)
    load()
  }

  // Accept and send-back both write only to gap_claims.status. Nothing here
  // touches wiki_pages — accepting a submission marks the student's work done;
  // landing the prose on the page is still a review_proposal() step, because a
  // page write must carry provenance and this table does not supply one.
  const decide = async (row, status) => {
    let note = null
    if (status === 'claimed') {
      note = window.prompt(
        `Send "${row.page_slug}" back to ${row.student}?\n\nWhat should they fix? (shown to the student)`
      )
      if (note == null) return
      if (!note.trim()) return setNotice('Send-back cancelled — a reason is required.')
    }
    setBusyId(row.claim_id); setNotice(null)
    const patch = { status, note, resolved_at: status === 'accepted' ? new Date().toISOString() : null }
    const { error } = await courseClient.from('gap_claims').update(patch).eq('id', row.claim_id)
    if (error) { setBusyId(null); return setNotice(error.message) }

    // Tell the student. The decision is already written, so a mail failure
    // must not read as the decision failing — it is reported as its own line.
    // Without this the send-back note reaches nobody: it lands on the gap
    // board, and no student refreshes a board on the off-chance.
    let mail = ''
    try {
      const rsp = await fetch('/api/claim-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          claim_id: row.claim_id,
          course_id: staffEnrollments[0]?.course_id,
        }),
      })
      const out = await rsp.json().catch(() => ({}))
      mail = rsp.ok && out.sent ? ' · student emailed'
           : ` · EMAIL FAILED (${out.error ?? rsp.status}) — tell them directly`
    } catch (e) {
      mail = ` · EMAIL FAILED (${e.message}) — tell them directly`
    }

    setBusyId(null)
    setNotice((status === 'accepted' ? `Accepted — ${row.page_slug}` : `Sent back — ${row.page_slug}`) + mail)
    load()
  }

  const grouped = ROUTES.map(([key, label, hint, colour]) => ({
    key, label, hint, colour, items: (rows ?? []).filter(r => r.route === key),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <p style={S.eyebrow}><Link to="/academic/fieldguide" style={S.eyebrowLink}>Field Guide</Link></p>
        <h1 style={S.title}>Student submissions</h1>
        <p style={S.sub}>
          Mechanical faults are caught before you read anything. What is left is the one question
          precheck cannot answer: <strong>does the source actually say this?</strong>{' '}
          <Link to="/academic/fieldguide/review" style={S.link}>Ingest proposals are reviewed separately →</Link>
        </p>

        {rows === null && <p style={{ ...S.sub, marginTop: 20 }}>Loading…</p>}

        {rows !== null && rows.length === 0 && (
          <p style={{ ...S.sub, marginTop: 24 }}>
            Nothing awaiting review. Submissions appear here once a student marks a claimed gap as
            submitted.
          </p>
        )}

        {grouped.map(g => (
          <section key={g.key}>
            <h2 style={{ ...S.h2, color: g.colour }}>
              {g.label} <span style={S.dim}>· {g.items.length}</span>
            </h2>
            <p style={{ ...S.sub, fontSize: 13 }}>{g.hint}</p>

            {g.items.map(row => {
              const open = openId === row.claim_id
              return (
                <article key={row.claim_id} style={S.card}>
                  <button style={S.cardHead} onClick={() => setOpenId(open ? null : row.claim_id)}>
                    <span style={{ textAlign: 'left', minWidth: 0 }}>
                      <span style={S.slug}>{row.page_slug}{row.section ? ` › ${row.section}` : ''}</span>
                      <span style={S.metaLine}>
                        {row.student} · {row.difficulty}
                        {row.tier ? ` · tier ${row.tier}` : ''}
                        {row.finding_count > 0 ? ` · ${row.finding_count} finding${row.finding_count === 1 ? '' : 's'}` : ''}
                      </span>
                    </span>
                    <span style={S.chev}>{open ? '▾' : '▸'}</span>
                  </button>

                  {open && (
                    <div style={{ padding: '0 14px 14px' }}>
                      {/* Opens the exact section the gap sits in, so the ask can be read in
                          context while judging the submission. New tab on purpose — losing
                          the queue mid-review is how a reviewer loses their place. */}
                      <p style={{ margin: '0 0 12px' }}>
                        <a href={row.review_url} target="_blank" rel="noopener noreferrer" style={S.link}>
                          Open {row.page_slug}{row.section ? ` › ${row.section}` : ''} in the wiki ↗
                        </a>
                      </p>

                      <p style={S.colLabel}>The ask</p>
                      <p style={{ ...S.sub, marginTop: 0 }}>{row.ask}</p>

                      {row.findings?.length > 0 && (
                        <>
                          <p style={{ ...S.colLabel, marginTop: 14 }}>Precheck</p>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {row.findings.map((f, i) => (
                              <li key={i} style={{ ...S.finding, borderColor: SEV[f.severity] ?? 'var(--bd)' }}>
                                <span style={{ ...S.badge, color: SEV[f.severity], border: `1px solid ${SEV[f.severity]}` }}>
                                  {f.severity}
                                </span>{' '}
                                <code style={{ fontFamily: MONO, fontSize: 12 }}>{f.code}</code>
                                <span style={{ display: 'block', fontSize: 13, marginTop: 3 }}>{f.detail}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      <div style={{ ...S.split, marginTop: 14 }}>
                        <div>
                          <p style={S.colLabel}>Submission</p>
                          <p style={S.pre}>{row.submitted_text || '—'}</p>
                        </div>
                        <div>
                          <p style={S.colLabel}>What this source cannot tell us</p>
                          <p style={S.pre}>{row.limitation || '—'}</p>
                        </div>
                      </div>

                      <p style={{ ...S.metaLine, marginTop: 10 }}>
                        {row.source_doi
                          ? <a href={`https://doi.org/${row.source_doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}`}
                               target="_blank" rel="noopener noreferrer" style={S.link}>{row.source_doi} ↗</a>
                          : row.source_url
                            ? <a href={row.source_url} target="_blank" rel="noopener noreferrer" style={S.link}>{row.source_url} ↗</a>
                            : 'no identifier supplied'}
                      </p>

                      <div style={S.actions}>
                        <button style={S.primary} disabled={busyId === row.claim_id}
                                onClick={() => decide(row, 'accepted')}>
                          {busyId === row.claim_id ? 'Working…' : 'Accept'}
                        </button>
                        <button style={S.danger} disabled={busyId === row.claim_id}
                                onClick={() => decide(row, 'claimed')}>
                          Send back
                        </button>
                        <button style={S.secondary} disabled={busyId === row.claim_id}
                                onClick={() => recheck(row)}>
                          Re-run precheck
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        ))}

        {notice && <p style={S.notice}>{notice}</p>}
      </div>
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  dim: { color: 'var(--tx2)', fontWeight: 400 },
  link: { fontSize: 13, color: 'var(--pk)' },
  notice: { color: 'var(--pk)', marginTop: 14, fontFamily: MONO, fontSize: 13, lineHeight: 1.5 },

  h2: { fontFamily: SERIF, fontSize: 20, margin: '30px 0 2px' },

  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, marginTop: 10 },
  cardHead: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx)' },
  slug: { display: 'block', fontFamily: MONO, fontSize: 14, color: 'var(--tx)', overflowWrap: 'anywhere' },
  metaLine: { display: 'block', fontSize: 12, color: 'var(--tx2)', marginTop: 2 },
  chev: { color: 'var(--tx2)', fontSize: 13 },
  badge: { fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 20 },

  finding: { border: '1px solid', borderRadius: 8, padding: '7px 10px', marginBottom: 6, color: 'var(--tx)' },

  split: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 },
  colLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 6px' },
  pre: { fontFamily: MONO, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 8, padding: 12, maxHeight: 340, overflowY: 'auto', color: 'var(--tx)', margin: 0 },

  actions: { display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' },
  primary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  secondary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },
  danger: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid rgba(192,57,43,.35)', background: 'none', color: '#c0392b', cursor: 'pointer' },
}
