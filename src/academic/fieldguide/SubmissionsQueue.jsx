import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import AvatarMenu from './AvatarMenu'
import Onboarding from './Onboarding'
import { useCoursePaths } from './wiki/useWikiBase'

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

// An unrecorded verdict reads as unknown, never as agreement.
const VERDICT = {
  agrees:   { label: 'summary matches',  colour: '#2e7d32' },
  diverges: { label: 'summary diverges', colour: '#c0392b' },
  unclear:  { label: 'unclear',          colour: '#b8860b' },
}

export default function SubmissionsQueue() {
  // No staffEnrollments here on purpose: this queue spans courses and takes
  // each decision's course from its own row. See notify() below.
  const { courseClient, session } = useOutletContext()
  const paths = useCoursePaths()
  const { courseCode } = useParams()
  const [tourOpen, setTourOpen] = useState(false)
  const [rows, setRows] = useState(null)      // null = loading
  const [openId, setOpenId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [untold, setUntold] = useState([])
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

  // Decisions the student was never told about — a failed send leaves the
  // decision standing and the student waiting, with nothing on screen to say
  // so. This strip is the only place that surfaces it.
  const loadUntold = useCallback(() => {
    courseClient.from('unnotified_decisions').select('*')
      .then(({ data }) => setUntold(data ?? []))
  }, [courseClient])
  useEffect(() => { loadUntold() }, [loadUntold])

  // Send (or re-send) the decision email for one claim. Returns a suffix for
  // the notice line.
  //
  // The course comes from the ROW, not from the caller's enrollments. This
  // queue is deliberately not course-filtered — it selects the view with no
  // course predicate and lets RLS scope it — so someone staffing PSY240 and
  // PSY309 sees both courses interleaved in one list. The old
  // `staffEnrollments[0]?.course_id` therefore stamped every notification with
  // whichever course happened to sort first, which with course-routed Reply-To
  // could address a PSY309 student's reply to psy240@radlab.zone. A picker
  // would not fix it either: the reviewer would have to keep it in sync with
  // whichever row they were acting on. Both views feeding this now carry
  // course_id (20260831_submission_queue_course_id).
  // Accepting is the trigger for drafting the page section FROM THE SOURCE
  // (api/integrate-claim). It lands as a pending proposal in the review queue,
  // never on the page — and it reports back whether the student's summary
  // actually matches the paper, which is a misreading check a TA would
  // otherwise have to do by reading the paper themselves.
  // The review-time comparison: read the paper, judge the student's summary
  // against it, and keep the drafted section. Nothing is filed and nothing is
  // decided — this exists so the TA sees the comparison BEFORE choosing.
  const compare = useCallback(async (claimId) => {
    setBusyId(claimId); setNotice(null)
    try {
      const rsp = await fetch('/api/integrate-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ claim_id: claimId, file: false }),
      })
      const out = await rsp.json().catch(() => ({}))
      setBusyId(null)
      if (!rsp.ok) return setNotice(out.error ?? `Comparison failed (${rsp.status})`)
      if (!out.ok) return setNotice(out.note ?? 'The source does not cover this gap.')
      load()
    } catch (err) {
      setBusyId(null); setNotice(err.message)
    }
  }, [session, load])

  const draft = useCallback(async (claimId) => {
    try {
      const rsp = await fetch('/api/integrate-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ claim_id: claimId }),
      })
      const out = await rsp.json().catch(() => ({}))
      if (!rsp.ok) return ` · NOT DRAFTED (${out.error ?? rsp.status}) — add it to the page by hand`
      if (!out.ok) return ` · not drafted: ${out.note ?? 'the source does not cover this gap'}`
      const flag = out.divergence === 'diverges'
        ? ' · ⚠ the student’s summary DIVERGES from the paper — read the note'
        : ''
      return ` · drafted into the review queue${flag}`
    } catch (err) {
      return ` · NOT DRAFTED (${err.message})`
    }
  }, [session])

  const notify = useCallback(async (claimId, courseId) => {
    if (!courseId) return ' · EMAIL NOT SENT (row has no course — reload the page)'
    try {
      const rsp = await fetch('/api/claim-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ claim_id: claimId, course_id: courseId }),
      })
      const out = await rsp.json().catch(() => ({}))
      if (rsp.ok && out.sent && out.stamped === false) {
        // Mail delivered but the record did not stick — do NOT invite a resend,
        // that would mail the student a second time.
        return ` · emailed, but NOT RECORDED (${out.warning ?? 'unknown'})`
      }
      return rsp.ok && out.sent
        ? ' · student emailed'
        : ` · EMAIL FAILED (${out.error ?? rsp.status}) — retry from "Not yet told" below`
    } catch (e) {
      return ` · EMAIL FAILED (${e.message}) — retry from "Not yet told" below`
    }
  }, [session])

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
      // Seed the box with the source comparison when it found a divergence.
      // The reviewer has just read a precise account of where the summary
      // departs from the paper; making them retype it is how specific feedback
      // decays into "please revise". Editable and never automatic — it is a
      // starting point, and the TA owns what the student actually receives.
      const seed = row.integration_verdict === 'diverges' && row.integration_note
        ? `Checked against the source you cited:\n\n${row.integration_note}\n\nPlease revise and resubmit.`
        : ''
      note = window.prompt(
        `Send "${row.page_slug}" back to ${row.student}?\n\nWhat should they fix? (shown to the student)`,
        seed
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
    const mail = await notify(row.claim_id, row.course_id)
    const drafted = status === 'accepted' ? await draft(row.claim_id) : ''
    setBusyId(null)
    setNotice((status === 'accepted' ? `Accepted — ${row.page_slug}` : `Sent back — ${row.page_slug}`) + mail + drafted)
    load(); loadUntold()
  }

  const resend = async (row) => {
    setBusyId(row.claim_id); setNotice(null)
    const mail = await notify(row.claim_id, row.course_id)
    setBusyId(null)
    setNotice(`${row.page_slug} → ${row.student_email}${mail}`)
    loadUntold()
  }

  const grouped = ROUTES.map(([key, label, hint, colour]) => ({
    key, label, hint, colour, items: (rows ?? []).filter(r => r.route === key),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <p style={S.eyebrow}><Link to={paths.home} style={S.eyebrowLink}>Field Guide</Link></p>
          {session && (
            <AvatarMenu client={courseClient} fgEmail={session.user.email}
                        courseCode={courseCode} isStaff onTour={() => setTourOpen(true)} />
          )}
        </div>
        {session && (
          <Onboarding client={courseClient} courseCode={courseCode} isStaff
                      tourOpen={tourOpen} onTourClose={() => setTourOpen(false)} />
        )}
        <h1 style={S.title}>Student submissions</h1>
        <p style={S.sub}>
          Mechanical faults are caught before you read anything. What is left is the one question
          precheck cannot answer: <strong>does the source actually say this?</strong>{' '}
          <Link to={paths.sub('review')} style={S.link}>Ingest proposals are reviewed separately →</Link>
        </p>

        {rows === null && <p style={{ ...S.sub, marginTop: 20 }}>Loading…</p>}

        {rows !== null && rows.length === 0 && (
          <p style={{ ...S.sub, marginTop: 24 }}>
            Nothing awaiting review. Submissions appear here once a student marks a claimed gap as
            submitted.
          </p>
        )}

        {untold.length > 0 && (
          <section style={S.untoldBox}>
            <h2 style={{ ...S.h2, color: '#c0392b', marginTop: 0 }}>
              Not yet told <span style={S.dim}>· {untold.length}</span>
            </h2>
            <p style={{ ...S.sub, fontSize: 14 }}>
              These decisions are recorded, but the notification email did not send — so the student
              is still waiting. Resend, or tell them directly.
            </p>
            {untold.map(u => (
              <div key={u.claim_id} style={S.untoldRow}>
                <span style={{ fontFamily: MONO, fontSize: 12.5 }}>
                  {u.status === 'accepted' ? 'accepted' : 'sent back'} · {u.page_title ?? u.page_slug}
                </span>
                <span style={S.dim}>{u.student_email}</span>
                <button style={S.resendBtn} disabled={busyId === u.claim_id}
                        onClick={() => resend(u)}>
                  {busyId === u.claim_id ? 'sending…' : 'resend'}
                </button>
              </div>
            ))}
          </section>
        )}

        {grouped.map(g => (
          <section key={g.key}>
            <h2 style={{ ...S.h2, color: g.colour }}>
              {g.label} <span style={S.dim}>· {g.items.length}</span>
            </h2>
            <p style={{ ...S.sub, fontSize: 14 }}>{g.hint}</p>

            {g.items.map(row => {
              const open = openId === row.claim_id
              // Read the stored verdict. This used to regex the note for the word
              // "diverge", so a note that correctly described three contradictions
              // without using that word rendered as "summary matches" — a check
              // that fails towards reassurance is worse than no check.
              const verdict = row.integration_verdict ?? null
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
                                <span style={{ display: 'block', fontSize: 14, marginTop: 3 }}>{f.detail}</span>
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

                      {/* Against the source. The one question precheck cannot answer,
                          answered BEFORE the decision rather than after it: does the
                          summary say what the paper says? The drafted section is what
                          would enter the Guide on accept, shown here so it is judged,
                          not discovered afterwards. */}
                      <div style={S.compareBox}>
                        <div style={S.compareHead}>
                          <p style={{ ...S.colLabel, margin: 0 }}>Against the source</p>
                          {row.integration_status === 'reviewed' && (
                            <span style={{ ...S.verdict,
                              color: VERDICT[verdict]?.colour ?? 'var(--tx2)',
                              borderColor: VERDICT[verdict]?.colour ?? 'var(--bd)' }}>
                              {VERDICT[verdict]?.label ?? 'verdict not recorded'}
                            </span>
                          )}
                          <button style={S.compareBtn}
                                  disabled={busyId === row.claim_id || !row.has_source}
                                  onClick={() => compare(row.claim_id)}>
                            {busyId === row.claim_id ? 'reading the paper…'
                              : row.integration_status === 'reviewed' ? 'Check again' : 'Compare with source'}
                          </button>
                        </div>

                        {!row.has_source && (
                          <p style={{ ...S.sub, fontSize: 13.5, margin: '8px 0 0' }}>
                            No source text was captured for this submission, so it cannot be
                            checked automatically — read the cited paper yourself.
                          </p>
                        )}

                        {row.integration_note && (
                          <p style={{ ...S.sub, fontSize: 14, margin: '10px 0 0',
                                      color: verdict === 'diverges' ? SEV.block : 'var(--tx)' }}>
                            {row.integration_note}
                          </p>
                        )}

                        {row.integration_draft && (
                          <>
                            <p style={{ ...S.colLabel, marginTop: 12 }}>
                              Drafted from the paper — this is what accepting files for review
                            </p>
                            <p style={S.pre}>{row.integration_draft}</p>
                          </>
                        )}
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
  untoldBox: { border: '1px solid #c0392b', borderRadius: 12, padding: '12px 16px', margin: '18px 0' },
  untoldRow: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '5px 0', borderBottom: '1px dotted var(--bd)' },
  resendBtn: { marginLeft: 'auto', fontFamily: MONO, fontSize: 12, padding: '4px 12px', borderRadius: 14, border: '1px solid #c0392b', background: 'none', color: '#c0392b', cursor: 'pointer' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  dim: { color: 'var(--tx2)', fontWeight: 400 },
  link: { fontSize: 14, color: 'var(--pk)' },
  notice: { color: 'var(--pk)', marginTop: 14, fontFamily: MONO, fontSize: 14, lineHeight: 1.5 },

  h2: { fontFamily: SERIF, fontSize: 20, margin: '30px 0 2px' },

  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, marginTop: 10 },
  cardHead: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx)' },
  slug: { display: 'block', fontFamily: MONO, fontSize: 14, color: 'var(--tx)', overflowWrap: 'anywhere' },
  metaLine: { display: 'block', fontSize: 12, color: 'var(--tx2)', marginTop: 2 },
  chev: { color: 'var(--tx2)', fontSize: 14 },
  badge: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 20 },

  compareBox: { marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--bd)' },
  compareHead: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  compareBtn: {
    marginLeft: 'auto', fontFamily: MONO, fontSize: 12, padding: '6px 13px', borderRadius: 16,
    border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer',
  },
  verdict: {
    fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    padding: '3px 9px', borderRadius: 12, border: '1px solid',
  },
  finding: { border: '1px solid', borderRadius: 8, padding: '7px 10px', marginBottom: 6, color: 'var(--tx)' },

  split: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 },
  colLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 6px' },
  pre: { fontFamily: MONO, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 8, padding: 12, maxHeight: 340, overflowY: 'auto', color: 'var(--tx)', margin: 0 },

  actions: { display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' },
  primary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  secondary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },
  danger: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid rgba(192,57,43,.35)', background: 'none', color: '#c0392b', cursor: 'pointer' },
}
