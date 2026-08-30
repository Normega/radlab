import { useEffect, useState } from 'react'

const MONO = '"Space Mono", "Courier New", monospace'

// Student error detection (2026-08-20). Two report kinds, and the copy is
// honest about what each earns: a verified error report earns a small
// participation credit; a contradiction that staff convert into a gap can be
// claimed and submitted through the normal pipeline, and that submission
// counts toward the required three articles. Students report — they never
// edit — and their own reports (with staff resolutions) render below the
// form, which is the loop that makes reporting feel worth doing.
export default function ReportIssue({ courseClient, pageId, sections }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('error')
  const [section, setSection] = useState('')
  const [body, setBody] = useState('')
  const [citation, setCitation] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [mine, setMine] = useState([])
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!pageId) return
    let live = true
    // Own-rows RLS: a student sees exactly their reports; staff would see
    // all, but staff triage happens on the queue page, not here.
    courseClient.from('page_reports')
      .select('id, kind, section, body, status, resolution, created_at')
      .eq('page_id', pageId).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (live) setMine(data ?? []) })
    return () => { live = false }
  }, [courseClient, pageId, reload])

  const submit = async () => {
    setBusy(true)
    setNotice(null)
    const { error } = await courseClient.rpc('report_page_issue', {
      p_page_id: pageId,
      p_kind: kind,
      p_body: body,
      p_section: section || null,
      p_citation: citation || null,
    })
    setBusy(false)
    if (error) return setNotice(error.message)
    setBody(''); setCitation(''); setOpen(false)
    setNotice('Report filed — staff review these and you will see the resolution here.')
    setReload(k => k + 1)
  }

  return (
    <section style={S.wrap}>
      {!open ? (
        <button style={S.opener} onClick={() => setOpen(true)}>
          Spotted a problem? Report an issue with this page
        </button>
      ) : (
        <div>
          <p style={S.label}>Report an issue</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button style={{ ...S.kindBtn, ...(kind === 'error' ? S.kindOn : null) }}
                    onClick={() => setKind('error')}>
              Something looks wrong
            </button>
            <button style={{ ...S.kindBtn, ...(kind === 'contradiction' ? S.kindOn : null) }}
                    onClick={() => setKind('contradiction')}>
              I have evidence that contradicts this
            </button>
          </div>
          <p style={S.hint}>
            {kind === 'error'
              ? 'A typo, a number that doesn’t match its source, two pages that disagree — no source needed. The first verified report of an error earns participation credit.'
              : 'You’ve read something peer-reviewed that disagrees with what this page says. Give the claim and the source: if staff verify it and open it as a gap, claiming and submitting it counts toward your three required articles.'}
          </p>
          {sections?.length > 0 && (
            <select style={S.select} value={section} onChange={e => setSection(e.target.value)}>
              <option value="">Whole page / not sure which section</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          )}
          <textarea
            style={S.area}
            placeholder={kind === 'error'
              ? 'What looks wrong, and where? Quote the sentence if you can.'
              : 'What does the page claim, and what does your source say instead?'}
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          {kind === 'contradiction' && (
            <input
              style={S.input}
              placeholder="The source (citation or DOI) — required for a contradiction report"
              value={citation}
              onChange={e => setCitation(e.target.value)}
            />
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <button style={busy || body.trim().length < 30 ? S.goOff : S.go}
                    disabled={busy || body.trim().length < 30} onClick={submit}>
              {busy ? 'Filing…' : 'File the report'}
            </button>
            <button style={S.cancel} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
            {body.trim().length > 0 && body.trim().length < 30 && (
              <span style={S.hint}>a little more detail — the report is what staff act on</span>
            )}
          </div>
        </div>
      )}
      {notice && <p style={S.notice}>{notice}</p>}

      {mine.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={S.label}>Your reports on this page</p>
          {mine.map(r => (
            <div key={r.id} style={S.mineRow}>
              <span style={{ ...S.status, color: STATUS_COLOUR[r.status] }}>{r.status}</span>
              <span style={S.mineBody}>
                {r.body.slice(0, 140)}{r.body.length > 140 ? '…' : ''}
                {r.resolution && <em style={S.resolution}> — staff: {r.resolution}</em>}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const STATUS_COLOUR = {
  open: '#b8860b', fixed: '#2e7d32', converted: '#2e7d32', dismissed: 'var(--tx2)',
}

const S = {
  wrap: { marginTop: 26, paddingTop: 16, borderTop: '1px solid var(--bd)' },
  opener: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, padding: '7px 14px', borderRadius: 18, border: '1px dashed var(--bd)', background: 'none', color: 'var(--tx2)', cursor: 'pointer' },
  label: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 8px' },
  kindBtn: { fontSize: 14, padding: '7px 14px', borderRadius: 18, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx2)', cursor: 'pointer' },
  kindOn: { borderColor: 'var(--pk)', color: 'var(--tx)', background: 'rgba(214,51,132,.07)' },
  hint: { fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5, margin: '0 0 8px', maxWidth: '62ch' },
  select: { display: 'block', fontSize: 14, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)', marginBottom: 8, maxWidth: '100%' },
  area: { width: '100%', boxSizing: 'border-box', minHeight: 74, resize: 'vertical', fontSize: 13.5, lineHeight: 1.5, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' },
  input: { width: '100%', boxSizing: 'border-box', marginTop: 8, fontSize: 13.5, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)' },
  go: { fontSize: 13.5, fontWeight: 600, padding: '7px 15px', borderRadius: 18, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  goOff: { fontSize: 13.5, fontWeight: 600, padding: '7px 15px', borderRadius: 18, border: 'none', background: 'var(--bd)', color: 'var(--tx2)', cursor: 'not-allowed' },
  cancel: { fontSize: 13.5, padding: '7px 13px', borderRadius: 18, border: '1px solid var(--bd)', background: 'none', color: 'var(--tx2)', cursor: 'pointer' },
  notice: { marginTop: 10, fontFamily: MONO, fontSize: 12.5, color: 'var(--pk)' },
  mineRow: { display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', borderBottom: '1px dotted var(--bd)' },
  status: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', flexShrink: 0 },
  mineBody: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.45 },
  resolution: { color: 'var(--tx)' },
}
