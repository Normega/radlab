import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Field Guide ingest portal (test phase): upload a PDF, trigger ingest in
// either PDF mode, watch job status, inspect the resulting wiki pages.
// The HTTP call to /api/ingest is fire-and-forget — status comes from
// polling ingest_jobs (staff-read RLS), so a long model call never leaves
// the UI hanging on a request.
export default function IngestPortal() {
  const { courseClient, session, staffEnrollments } = useOutletContext()
  const [courseId, setCourseId] = useState(staffEnrollments[0]?.course_id)
  const [file, setFile] = useState(null)
  // Native is the confirmed course default (2026-07-24 four-paper mode test:
  // content parity, but native has no text-layer dependency — see website.md
  // §29a). The toggle stays for cost experiments; extracted refuses scans.
  const [mode, setMode] = useState('native')
  // Reference mode (WP3): fill a NAMED catalogue page from an open reference
  // work, rather than letting the model decide what pages a paper touches.
  // The target picker is the worklist — incomplete catalogue entries, Tier A
  // first — so the sprint order is the UI's default order.
  const [sourceType, setSourceType] = useState('paper')
  const [targetSlug, setTargetSlug] = useState('')
  const [worklist, setWorklist] = useState([])
  // Attribution is a licence condition for the openly-licensed course sources,
  // so it is captured here rather than left to the model to remember.
  const [citation, setCitation] = useState('')
  // Citation assistance. `suggestion` is never written into `citation` on its
  // own — the operator accepts it explicitly. A looked-up citation carries the
  // authority of having been looked up, so one nobody read is worse than one
  // typed badly, and from WP6 the person uploading is a student.
  const [doiInput, setDoiInput] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [looking, setLooking] = useState(false)
  // Set when the PDF was uploaded early to read its DOI, so submit does not
  // upload it twice. Cleared whenever the chosen file changes.
  const [uploadedPath, setUploadedPath] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [jobs, setJobs] = useState([])
  const [openJob, setOpenJob] = useState(null)
  const fileInput = useRef(null)

  const course = staffEnrollments.find(e => e.course_id === courseId)?.courses

  const loadJobs = async () => {
    const { data } = await courseClient
      .from('ingest_jobs')
      .select('id, pdf_path, pdf_mode, status, input_tokens, output_tokens, error, result_json, created_at, completed_at, source_citation')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
    setJobs(data ?? [])
  }

  useEffect(() => { if (courseId) loadJobs() }, [courseId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!courseId) return
    courseClient.from('reference_worklist').select('*').eq('course_id', courseId)
      .then(({ data }) => setWorklist(data ?? []))
  }, [courseClient, courseId])

  // Poll while anything is still running
  useEffect(() => {
    if (!jobs.some(j => j.status === 'uploaded' || j.status === 'processing')) return
    const t = setInterval(loadJobs, 4000)
    return () => clearInterval(t)
  }, [jobs]) // eslint-disable-line react-hooks/exhaustive-deps

  // Distinct citations already used on this course, newest first. The whole
  // fix for the content sprint: fifteen textbook modules share one 180-char
  // citation differing by two words, and retyping it fifteen times is how a
  // licence-required field ends up inconsistent.
  const pastCitations = [...new Set(
    jobs.map(j => j.source_citation).filter(c => c && !c.startsWith('UNVERIFIED')),
  )].slice(0, 12)

  const upload = async () => {
    if (uploadedPath) return uploadedPath
    const safeName = file.name.replace(/[^\w.-]+/g, '_')
    const pdfPath = `${courseId}/${Date.now()}_${safeName}`
    const { error: upErr } = await courseClient.storage
      .from('ingest-pdfs')
      .upload(pdfPath, file, { contentType: 'application/pdf' })
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
    setUploadedPath(pdfPath)
    return pdfPath
  }

  // Uses a pasted DOI when there is one, otherwise reads the PDF's opening
  // pages. Uploading early leaves an orphan object in the bucket if the operator
  // then abandons the form — acceptable, and it is the same path submit would
  // have used, so nothing is uploaded twice.
  const suggestCitation = async () => {
    if (!courseId || (!file && !doiInput.trim())) return
    setLooking(true)
    setNotice(null)
    setSuggestion(null)
    try {
      const body = { course_id: courseId }
      if (doiInput.trim()) body.doi = doiInput.trim()
      else body.pdf_path = await upload()

      const r = await fetch('/api/cite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `Lookup failed (${r.status})`)
      setSuggestion(j)
      if (!j.citation) setNotice(j.note || 'No citation could be determined — type one below.')
    } catch (err) {
      setNotice(err.message)
    } finally {
      setLooking(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!file || !courseId) return
    setBusy(true)
    setNotice(null)
    try {
      const pdfPath = await upload()

      // Fire the ingest; don't await completion — the jobs list polls.
      fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          pdf_path: pdfPath, pdf_mode: mode, course_id: courseId,
          source_type: sourceType,
          target_slug: sourceType === 'reference' ? targetSlug : null,
          source_citation: citation.trim() || null,
        }),
      }).catch(() => {})

      setNotice('Ingest started — the job appears below within a few seconds.')
      setFile(null)
      setUploadedPath(null)
      setSuggestion(null)
      setDoiInput('')
      // Citation is deliberately NOT cleared: consecutive runs from one book
      // differ by a module number, so keeping it turns retyping into editing.
      if (fileInput.current) fileInput.current.value = ''
      setTimeout(loadJobs, 2500)
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={S.eyebrow}><Link to="/academic/fieldguide" style={S.eyebrowLink}>Field Guide</Link></p>
            <h1 style={S.title}>Ingest portal</h1>
            {course && <p style={S.sub}>{course.code} · {course.name} ({course.term})</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ ...S.sub, fontSize: 12 }}>{session.user.email}</p>
            <Link to="/academic/fieldguide/wiki" style={{ fontSize: 13, color: 'var(--pk)' }}>Wiki</Link>
            <Link to="/academic/fieldguide/review" style={{ fontSize: 13, color: 'var(--pk)', marginLeft: 10 }}>Review queue</Link>
            <button style={{ ...S.linkBtn, marginLeft: 10 }} onClick={() => courseClient.auth.signOut()}>Sign out</button>
          </div>
        </header>

        {staffEnrollments.length > 1 && (
          <select style={{ ...S.input, marginTop: 12 }} value={courseId} onChange={e => setCourseId(e.target.value)}>
            {staffEnrollments.map(e => (
              <option key={e.course_id} value={e.course_id}>
                {e.courses?.code} — {e.courses?.name}
              </option>
            ))}
          </select>
        )}

        <form onSubmit={submit} style={S.card}>
          <input ref={fileInput} style={{ fontSize: 14, color: 'var(--tx)' }} type="file" accept="application/pdf,.pdf"
            onChange={e => {
              setFile(e.target.files?.[0] ?? null)
              // A new file invalidates both the early upload and any suggestion
              // read off the old one.
              setUploadedPath(null)
              setSuggestion(null)
            }} />

          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" style={S.secondary} onClick={suggestCitation}
                      disabled={looking || (!file && !doiInput.trim())}>
                {looking ? 'Looking up…' : 'Suggest citation'}
              </button>
              <input style={{ ...S.input, flex: '1 1 220px', minWidth: 0 }} type="text" value={doiInput}
                     onChange={e => setDoiInput(e.target.value)}
                     placeholder="optional: paste a DOI to look up instead of reading the PDF" />
            </div>
            <p style={{ ...S.sub, fontSize: 12, marginTop: 4 }}>
              Reads the DOI off the PDF&rsquo;s first pages and resolves it. Open-licensed
              textbooks usually have no DOI — for those, reuse a previous citation below.
            </p>
          </div>

          {/* A suggestion is never written into the field on its own. Accepting
              is one click, but it has to be a click: attribution is a licence
              condition, and a looked-up citation nobody read is worse than a
              typed one because it looks authoritative. */}
          {suggestion?.citation && (
            <div style={S.suggestBox}>
              <p style={S.colLabel}>
                Suggested — from {suggestion.source}
                {suggestion.doi && <> · DOI <code style={{ fontFamily: MONO }}>{suggestion.doi}</code></>}
              </p>
              <p style={{ ...S.sub, color: 'var(--tx)', margin: '0 0 8px' }}>{suggestion.citation}</p>
              {suggestion.title && (
                <p style={{ ...S.sub, fontSize: 12, margin: '0 0 8px' }}>
                  Resolved title: <b>{suggestion.title}</b> — check this is the document you uploaded.
                </p>
              )}
              {suggestion.note && <p style={{ ...S.sub, fontSize: 12, color: 'var(--pk)' }}>{suggestion.note}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" style={S.primary}
                        onClick={() => { setCitation(suggestion.citation); setSuggestion(null) }}>
                  Use this citation
                </button>
                <button type="button" style={S.linkBtn} onClick={() => setSuggestion(null)}>Dismiss</button>
              </div>
            </div>
          )}

          <div>
            {pastCitations.length > 0 && (
              <select style={{ ...S.input, width: '100%', marginBottom: 6 }} value=""
                      onChange={e => { if (e.target.value) setCitation(e.target.value) }}>
                <option value="">Reuse a citation from a previous run…</option>
                {pastCitations.map(c => (
                  <option key={c} value={c}>{c.length > 110 ? `${c.slice(0, 110)}…` : c}</option>
                ))}
              </select>
            )}
            <input style={{ ...S.input, width: '100%' }} type="text" value={citation}
              onChange={e => setCitation(e.target.value)} required
              placeholder="Citation — e.g. Bridley & Daffin (2023), Fundamentals of Psychological Disorders 3e, Module 4. CC BY-NC-SA 4.0" />
            <p style={{ ...S.sub, fontSize: 12, marginTop: 4 }}>
              Recorded against every page this run produces. Attribution is a licence condition
              for CC-licensed sources, so it is captured here rather than left to the model.
              Kept after submit, so a run of textbook modules only needs the number changed.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...S.sub, fontWeight: 600 }}>Source:</span>
            <label style={{ ...S.sub, cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="radio" name="source_type" checked={sourceType === 'paper'}
                onChange={() => { setSourceType('paper'); setTargetSlug('') }} />
              Paper — a study; the model decides which pages it touches
            </label>
            <label style={{ ...S.sub, cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
              <input type="radio" name="source_type" checked={sourceType === 'reference'}
                onChange={() => setSourceType('reference')} />
              Reference — fill one named catalogue page
            </label>
          </div>

          {sourceType === 'reference' && (
            <div>
              <select style={{ ...S.input, width: '100%' }} value={targetSlug}
                      onChange={e => setTargetSlug(e.target.value)} required>
                <option value="">Choose the page this source should fill…</option>
                {/* Grouped by DSM-5-TR chapter because that is how the sprint
                    runs: one textbook module maps to one chapter. A flat list
                    of 121 is where mis-selections come from. */}
                {groupByChapter(worklist).map(group => (
                  <optgroup key={group.title} label={`${group.title} (${group.rows.length})`}>
                    {group.rows.map(w => (
                      <option key={w.slug} value={w.slug}>
                        {w.tier === 'overview' ? '◆ ' : w.tier === 'A' ? '★ ' : '   '}{w.title}
                        {w.gap_count > 0 ? ` — needs ${w.needs.join(', ')}` : ` — ${w.state}`}
                        {w.reference_runs > 0 ? ` · ${w.reference_runs} prior run(s)` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p style={{ ...S.sub, fontSize: 12, marginTop: 6 }}>
                {worklist.length} catalogue page(s) still incomplete, grouped by DSM-5-TR chapter.
                ◆ chapter overview · ★ Tier A. The run is scored against this page&rsquo;s
                declared gaps.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...S.sub, fontWeight: 600 }}>PDF mode:</span>
            {['native', 'extracted'].map(m => (
              <label key={m} style={{ ...S.sub, cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
                <input type="radio" name="pdf_mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
                {m === 'native' ? 'Native — course default (Claude reads page images)' : 'Extracted (text-only; cheaper, fails on scans)'}
              </label>
            ))}
          </div>
          <button style={{ ...S.primary, opacity: (!file || busy || !citation.trim() || (sourceType === 'reference' && !targetSlug)) ? 0.5 : 1 }} type="submit" disabled={!file || busy || !citation.trim() || (sourceType === 'reference' && !targetSlug)}>
            {busy ? 'Uploading…' : 'Upload & ingest'}
          </button>
          {notice && <p style={{ ...S.sub, color: 'var(--pk)' }}>{notice}</p>}
        </form>

        <h2 style={{ ...S.title, fontSize: 20, marginTop: 32 }}>Jobs</h2>
        {!jobs.length && <p style={S.sub}>No ingest jobs yet.</p>}
        {jobs.map(job => (
          <div key={job.id} style={S.jobCard}>
            <button style={S.jobHeader} onClick={() => setOpenJob(openJob === job.id ? null : job.id)}>
              <span style={{ fontFamily: MONO, fontSize: 12 }}>
                {job.pdf_path.split('/').pop()} · {job.pdf_mode}
              </span>
              <span style={{ ...statusStyle(job.status), fontFamily: MONO, fontSize: 12 }}>
                {job.status}{(job.status === 'processing' || job.status === 'uploaded') && '…'}
              </span>
            </button>
            {openJob === job.id && (
              <div style={{ padding: '0 14px 14px' }}>
                <p style={S.sub}>
                  Started {new Date(job.created_at).toLocaleString()}
                  {job.completed_at && ` · finished ${new Date(job.completed_at).toLocaleString()}`}
                  {job.input_tokens != null && ` · ${job.input_tokens.toLocaleString()} in / ${job.output_tokens?.toLocaleString()} out tokens`}
                </p>
                {job.error && <p style={{ ...S.sub, color: '#c0392b', whiteSpace: 'pre-wrap' }}>{job.error}</p>}
                {job.status === 'failed' && job.result_json?.raw_output && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={S.sub}>Raw model output (debug)</summary>
                    <pre style={S.pre}>{job.result_json.raw_output}</pre>
                  </details>
                )}
                {job.status === 'done' && job.result_json && <ResultView result={job.result_json} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultView({ result }) {
  return (
    <div>
      {result.log_entry && <p style={{ ...S.sub, fontStyle: 'italic', marginTop: 8 }}>{result.log_entry}</p>}
      {result.contradictions?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p style={{ ...S.sub, fontWeight: 600, color: '#c0392b' }}>Contradictions flagged:</p>
          <ul style={{ margin: '4px 0 0 18px' }}>
            {result.contradictions.map((c, i) => <li key={i} style={S.sub}>{c}</li>)}
          </ul>
        </div>
      )}
      <p style={{ ...S.sub, fontWeight: 600, marginTop: 12 }}>
        Pages ({result.pages?.length ?? 0}):
      </p>
      {(result.pages ?? []).map((page, i) => (
        <details key={i} style={{ marginTop: 6 }}>
          <summary style={{ ...S.sub, cursor: 'pointer' }}>
            <span style={{ fontFamily: MONO }}>{page.filename}</span>
            {' '}— {page.type} ({page.action})
          </summary>
          <pre style={S.pre}>{page.content}</pre>
        </details>
      ))}
    </div>
  )
}

function statusStyle(status) {
  if (status === 'done') return { color: '#27ae60' }
  if (status === 'failed') return { color: '#c0392b' }
  return { color: 'var(--pk)' }
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  eyebrowLink: { color: 'inherit', textDecoration: 'none' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: 20, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  input: { fontSize: 15, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },
  primary: { fontSize: 15, fontWeight: 600, padding: '10px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer', alignSelf: 'flex-start' },
  linkBtn: { fontSize: 13, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  secondary: { fontSize: 14, fontWeight: 600, padding: '9px 14px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer', flexShrink: 0 },
  suggestBox: { padding: '12px 14px', borderRadius: 10, background: 'var(--bgc)', border: '1px solid var(--bd)' },
  colLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 6px' },
  jobCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, marginTop: 10 },
  jobHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx)' },
  pre: { fontFamily: MONO, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 8, padding: 12, marginTop: 6, maxHeight: 420, overflowY: 'auto', color: 'var(--tx)' },
}

// Bucket the worklist into <optgroup>s. The view already returns rows in
// chapter order (overview, then Tier A, then B), so grouping preserves it.
function groupByChapter(rows) {
  const out = []
  for (const r of rows) {
    const title = r.chapter_title ?? 'Uncategorised'
    let g = out[out.length - 1]
    if (!g || g.title !== title) { g = { title, rows: [] }; out.push(g) }
    g.rows.push(r)
  }
  return out
}