import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

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
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [jobs, setJobs] = useState([])
  const [openJob, setOpenJob] = useState(null)
  const fileInput = useRef(null)

  const course = staffEnrollments.find(e => e.course_id === courseId)?.courses

  const loadJobs = async () => {
    const { data } = await courseClient
      .from('ingest_jobs')
      .select('id, pdf_path, pdf_mode, status, input_tokens, output_tokens, error, result_json, created_at, completed_at')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
    setJobs(data ?? [])
  }

  useEffect(() => { if (courseId) loadJobs() }, [courseId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while anything is still running
  useEffect(() => {
    if (!jobs.some(j => j.status === 'uploaded' || j.status === 'processing')) return
    const t = setInterval(loadJobs, 4000)
    return () => clearInterval(t)
  }, [jobs]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault()
    if (!file || !courseId) return
    setBusy(true)
    setNotice(null)
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, '_')
      const pdfPath = `${courseId}/${Date.now()}_${safeName}`
      const { error: upErr } = await courseClient.storage
        .from('ingest-pdfs')
        .upload(pdfPath, file, { contentType: 'application/pdf' })
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

      // Fire the ingest; don't await completion — the jobs list polls.
      fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pdf_path: pdfPath, pdf_mode: mode, course_id: courseId }),
      }).catch(() => {})

      setNotice('Ingest started — the job appears below within a few seconds.')
      setFile(null)
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
            <p style={S.eyebrow}>Field Guide</p>
            <h1 style={S.title}>Ingest portal</h1>
            {course && <p style={S.sub}>{course.code} · {course.name} ({course.term})</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ ...S.sub, fontSize: 12 }}>{session.user.email}</p>
            <button style={S.linkBtn} onClick={() => courseClient.auth.signOut()}>Sign out</button>
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
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...S.sub, fontWeight: 600 }}>PDF mode:</span>
            {['native', 'extracted'].map(m => (
              <label key={m} style={{ ...S.sub, cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center' }}>
                <input type="radio" name="pdf_mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
                {m === 'native' ? 'Native — course default (Claude reads page images)' : 'Extracted (text-only; cheaper, fails on scans)'}
              </label>
            ))}
          </div>
          <button style={{ ...S.primary, opacity: !file || busy ? 0.5 : 1 }} type="submit" disabled={!file || busy}>
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
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5 },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: 20, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  input: { fontSize: 15, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },
  primary: { fontSize: 15, fontWeight: 600, padding: '10px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer', alignSelf: 'flex-start' },
  linkBtn: { fontSize: 13, color: 'var(--pk)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  jobCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, marginTop: 10 },
  jobHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx)' },
  pre: { fontFamily: MONO, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: 8, padding: 12, marginTop: 6, maxHeight: 420, overflowY: 'auto', color: 'var(--tx)' },
}
