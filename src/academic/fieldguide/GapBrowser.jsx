import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// Student gap browser + claim flow (WP6 Phases B & C). The planning surface
// and the submission form are one page on purpose: a student shortlists,
// claims, drafts, and submits without losing their place in the board.
//
// Every rule lives server-side (claim_gap / submit_claim / the gap_claims
// guard trigger) — this component only narrates what the database decides.
// The one UX rule that is genuinely client-side: check_doi fires the moment a
// DOI is pasted, because discovering your source is redundant must cost a
// paste, not 150 written words.
const DIFF = {
  green: { colour: '#2e7d32', label: 'green' },
  amber: { colour: '#b8860b', label: 'amber' },
  red:   { colour: '#c0392b', label: 'red' },
}
const SEV = { block: '#c0392b', warn: '#b8860b' }

const fmtDate = d => d
  ? new Date(`${d}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
  : ''
const daysLeft = ts => ts ? Math.max(0, Math.ceil((new Date(ts) - Date.now()) / 86400000)) : null
const wordCount = t => (t ?? '').trim().split(/\s+/).filter(Boolean).length

export default function GapBrowser() {
  const { courseClient } = useOutletContext()
  const [rows, setRows] = useState(null)        // null = loading
  const [notice, setNotice] = useState(null)
  const [diff, setDiff] = useState('all')       // all | green | amber
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(() => new Set())
  const [expanded, setExpanded] = useState(null) // gap_id of the open detail

  const load = useCallback(async () => {
    const { data, error } = await courseClient.rpc('gap_board')
    if (error) { setNotice(error.message); setRows([]); return }
    setRows(data ?? [])
  }, [courseClient])

  useEffect(() => { load() }, [load])

  const needle = q.trim().toLowerCase()

  const lectures = useMemo(() => {
    if (!rows) return []
    const filtered = rows.filter(r => {
      if (diff === 'green' && r.difficulty !== 'green') return false
      if (diff === 'amber' && r.difficulty !== 'amber') return false
      if (!needle) return true
      return (r.ask + ' ' + r.slug + ' ' + (r.page_title ?? '')).toLowerCase().includes(needle)
    })
    const byLecture = new Map()
    for (const r of filtered) {
      if (!byLecture.has(r.lecture_no)) {
        byLecture.set(r.lecture_no, {
          lecture_no: r.lecture_no, meeting_date: r.meeting_date,
          lecture_title: r.lecture_title, items: [],
        })
      }
      byLecture.get(r.lecture_no).items.push(r)
    }
    return [...byLecture.values()].sort((a, b) => a.lecture_no - b.lecture_no)
  }, [rows, diff, needle])

  const totals = useMemo(() => {
    if (!rows) return null
    const claimable = rows.filter(r => r.difficulty !== 'red')
    return {
      gaps: rows.length,
      slotsOpen: claimable.reduce((n, r) => n + r.remaining, 0),
      greenOpen: claimable.filter(r => r.difficulty === 'green').reduce((n, r) => n + r.remaining, 0),
    }
  }, [rows])

  // A page double-mapped to two lectures shows the same gap twice; count each
  // claim once in the strip.
  const mine = useMemo(() => {
    if (!rows) return []
    const seen = new Set()
    return rows.filter(r => {
      if (!r.my_status || seen.has(r.gap_id)) return false
      seen.add(r.gap_id)
      return true
    })
  }, [rows])

  const hunting = needle.length > 0 || diff !== 'all'
  const isOpen = l => hunting || open.has(l.lecture_no)
  const toggle = n => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(n)) next.delete(n); else next.add(n)
    return next
  })

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '32px 20px 80px' }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>
        <p style={S.eyebrow}>Field Guide</p>
        <h1 style={S.title}>Research gaps</h1>
        <p style={S.sub}>
          Every gap below is a place the Field Guide names its own missing evidence. Your assignment
          fills them: claim a gap, find a peer-reviewed source that answers the ask, report what it
          found — and what it <em>cannot</em> tell us. Start with a{' '}
          <strong style={{ color: DIFF.green.colour }}>green</strong> gap
          (due <strong>Oct 7</strong> — claim from <em>any</em> lecture, not just material covered so
          far); ambers unlock once your green is submitted and are due <strong>Nov 11</strong> and{' '}
          <strong>Nov 27</strong>. Claims expire after <strong>14 days</strong> if unsubmitted.{' '}
          <span style={{ color: DIFF.red.colour }}>Red</span> gaps are staff-written — clinical or
          legal content — and shown so the map is complete.
        </p>

        {totals && (
          <p style={{ ...S.sub, fontFamily: MONO, fontSize: 12 }}>
            {totals.gaps} gaps · {totals.slotsOpen} slots open · {totals.greenOpen} green slots open
          </p>
        )}

        {mine.length > 0 && (
          <div style={S.mineStrip}>
            <p style={S.colLabel}>Your claims</p>
            {mine.map(r => (
              <button key={r.gap_id} style={S.mineRow} onClick={() => setExpanded(r.gap_id)}>
                <span style={{ ...S.badge, color: DIFF[r.difficulty].colour, border: `1px solid ${DIFF[r.difficulty].colour}` }}>
                  {r.difficulty}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--tx)' }}>{r.slug}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', marginLeft: 'auto' }}>
                  {r.my_status === 'claimed'
                    ? `draft — ${daysLeft(r.my_expires_at)} days left`
                    : r.my_status}
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={S.controls}>
          {['all', 'green', 'amber'].map(k => (
            <button key={k} onClick={() => setDiff(k)}
                    style={{ ...S.pill, ...(diff === k ? S.pillOn : null) }}>
              {k}
            </button>
          ))}
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search asks, pages…" style={S.search}
          />
        </div>

        {rows === null && <p style={{ ...S.sub, marginTop: 20 }}>Loading…</p>}
        {rows !== null && lectures.length === 0 && (
          <p style={{ ...S.sub, marginTop: 24 }}>Nothing matches that filter.</p>
        )}

        {lectures.map(l => {
          const greens = l.items.filter(r => r.difficulty === 'green').length
          const slots = l.items.filter(r => r.difficulty !== 'red').reduce((n, r) => n + r.remaining, 0)
          return (
            <section key={l.lecture_no}>
              <button style={S.lectureHead} onClick={() => toggle(l.lecture_no)}>
                <span style={{ textAlign: 'left' }}>
                  <span style={S.lectureTitle}>L{l.lecture_no} · {l.lecture_title}</span>
                  <span style={S.metaLine}>
                    {fmtDate(l.meeting_date)} · {l.items.length} gaps · {slots} slots open
                    {greens > 0 ? ` · ${greens} green` : ''}
                  </span>
                </span>
                <span style={S.chev}>{isOpen(l) ? '▾' : '▸'}</span>
              </button>

              {isOpen(l) && l.items.map(r => (
                <GapRow key={`${l.lecture_no}:${r.gap_id}`} row={r}
                        expanded={expanded === r.gap_id}
                        onToggle={() => setExpanded(expanded === r.gap_id ? null : r.gap_id)}
                        courseClient={courseClient} reload={load} />
              ))}
            </section>
          )
        })}

        {notice && <p style={S.notice}>{notice}</p>}
      </div>
    </div>
  )
}

function GapRow({ row: r, expanded, onToggle, courseClient, reload }) {
  const d = DIFF[r.difficulty] ?? DIFF.amber
  const red = r.difficulty === 'red'
  const full = !red && r.remaining === 0 && !r.my_status
  return (
    <article style={{ ...S.gap, opacity: red ? 0.55 : full ? 0.65 : 1 }}>
      <button style={S.gapHead} onClick={onToggle}>
        <div style={S.gapTop}>
          <span style={{ ...S.badge, color: d.colour, border: `1px solid ${d.colour}` }}>{d.label}</span>
          <span style={S.pageName}>{r.page_title ?? r.slug}{r.section ? ` › ${r.section}` : ''}</span>
          <span style={S.capacity}>
            {red ? 'staff only' : full ? 'full' : `${r.remaining} of ${r.capacity} open`}
            {r.my_status ? ` · yours (${r.my_status})` : ''}
          </span>
        </div>
        <p style={S.ask}>{r.ask}</p>
      </button>
      {expanded && (
        <GapDetail row={r} courseClient={courseClient} reload={reload} />
      )}
    </article>
  )
}

function GapDetail({ row: r, courseClient, reload }) {
  const [sources, setSources] = useState(null)
  const [claim, setClaim] = useState(null)       // own gap_claims row when mine
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const red = r.difficulty === 'red'
  const isMine = Boolean(r.my_status)
  const editable = r.my_status === 'claimed'

  useEffect(() => {
    let live = true
    courseClient.rpc('gap_page_sources', { p_gap_id: r.gap_id })
      .then(({ data }) => { if (live) setSources(data ?? []) })
    if (r.my_claim_id) {
      courseClient.from('gap_claims').select('*').eq('id', r.my_claim_id).single()
        .then(({ data }) => { if (live) setClaim(data) })
    }
    return () => { live = false }
  }, [courseClient, r.gap_id, r.my_claim_id])

  const doClaim = async () => {
    setBusy(true); setMsg(null)
    const { data, error } = await courseClient.rpc('claim_gap', { p_gap_id: r.gap_id })
    setBusy(false)
    if (error) return setMsg(error.message)
    if (!data.ok) return setMsg(data.message)
    reload()
  }

  const doRelease = async () => {
    if (!window.confirm('Release this claim? Your draft is kept, but the slot opens to others.')) return
    setBusy(true); setMsg(null)
    const { error } = await courseClient.from('gap_claims')
      .update({ status: 'withdrawn' }).eq('id', r.my_claim_id)
    setBusy(false)
    if (error) return setMsg(error.message)
    reload()
  }

  return (
    <div style={{ padding: '0 14px 14px' }}>
      <p style={{ margin: '0 0 10px' }}>
        <a href={`/academic/fieldguide/wiki/${r.slug}${r.section ? `#${r.section}` : ''}`}
           target="_blank" rel="noopener noreferrer" style={S.link}>
          Read {r.slug}{r.section ? ` › ${r.section}` : ''} in the wiki ↗
        </a>
      </p>

      {/* What the page already cites — visible at the moment of choosing, so
          "bring something the page does not have" is a prompt, not a gotcha. */}
      <p style={S.colLabel}>This page already cites</p>
      {sources === null && <p style={{ ...S.sub, fontSize: 13 }}>Loading…</p>}
      {sources !== null && sources.length === 0 && (
        <p style={{ ...S.sub, fontSize: 13 }}>Nothing yet — you would be its first source.</p>
      )}
      {sources !== null && sources.length > 0 && (
        <ul style={S.srcList}>
          {sources.map((s, i) => <li key={i} style={S.srcItem}>{s.citation}</li>)}
        </ul>
      )}

      {!isMine && !red && r.remaining > 0 && (
        <button style={S.primary} disabled={busy} onClick={doClaim}>
          {busy ? 'Working…' : 'Claim this gap'}
        </button>
      )}
      {!isMine && !red && r.remaining === 0 && (
        <p style={{ ...S.sub, fontSize: 13 }}>Fully claimed — slots reopen if a claim expires.</p>
      )}
      {red && (
        <p style={{ ...S.sub, fontSize: 13 }}>
          Staff-written territory: clinical or legal content is not student work.
        </p>
      )}

      {isMine && claim && editable && (
        <ClaimForm claim={claim} row={r} courseClient={courseClient}
                   reload={reload} onRelease={doRelease} />
      )}
      {isMine && r.my_status === 'submitted' && (
        <p style={{ ...S.sub, fontSize: 13 }}>
          Submitted — awaiting review. It is locked while a reviewer reads it; if it comes back,
          it reopens here with their note.
        </p>
      )}
      {isMine && r.my_status === 'accepted' && (
        <p style={{ ...S.sub, fontSize: 13, color: DIFF.green.colour }}>Accepted ✓</p>
      )}

      {msg && <p style={S.notice}>{msg}</p>}
    </div>
  )
}

function ClaimForm({ claim, row: r, courseClient, reload, onRelease }) {
  const [doi, setDoi] = useState(claim.source_doi ?? '')
  const [url, setUrl] = useState(claim.source_url ?? '')
  const [text, setText] = useState(claim.submitted_text ?? '')
  const [lim, setLim] = useState(claim.limitation ?? '')
  const [doiFindings, setDoiFindings] = useState([])
  const [findings, setFindings] = useState(claim.precheck ?? [])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const doiTimer = useRef(null)

  // The immediate DOI check: debounced against the server the moment the field
  // changes, so redundancy is discovered before the writing starts.
  useEffect(() => {
    clearTimeout(doiTimer.current)
    if (!doi.trim()) { setDoiFindings([]); return }
    doiTimer.current = setTimeout(async () => {
      const { data } = await courseClient.rpc('check_doi', { p_gap_id: r.gap_id, p_doi: doi })
      setDoiFindings(data?.findings ?? [])
    }, 500)
    return () => clearTimeout(doiTimer.current)
  }, [doi, courseClient, r.gap_id])

  const save = async (quiet = false) => {
    setBusy(true); if (!quiet) setMsg(null)
    const { error } = await courseClient.from('gap_claims')
      .update({ source_doi: doi || null, source_url: url || null,
                submitted_text: text || null, limitation: lim || null })
      .eq('id', claim.id)
    setBusy(false)
    if (error) { setMsg(error.message); return false }
    if (!quiet) setMsg('Draft saved.')
    return true
  }

  const submit = async () => {
    setMsg(null)
    if (!(await save(true))) return
    setBusy(true)
    const { data, error } = await courseClient.rpc('submit_claim', { p_claim_id: claim.id })
    setBusy(false)
    if (error) return setMsg(error.message)
    setFindings(data.findings ?? [])
    if (!data.ok) return setMsg(data.message)
    setMsg(null)
    reload()
  }

  const words = wordCount(text)
  const limWords = wordCount(lim)

  return (
    <div style={{ marginTop: 14 }}>
      <p style={S.colLabel}>Your submission · expires in {daysLeft(r.my_expires_at)} days</p>

      <label style={S.fieldLabel}>DOI <span style={S.dim}>(preferred — it is what the checks can verify)</span></label>
      <input value={doi} onChange={e => setDoi(e.target.value)}
             placeholder="10.xxxx/…" style={S.input} />
      {doiFindings.map((f, i) => (
        <p key={i} style={{ ...S.findingLine, color: SEV[f.severity] }}>
          {f.severity === 'block' ? '✕' : '⚠'} {f.detail}
        </p>
      ))}

      <label style={S.fieldLabel}>URL <span style={S.dim}>(only if the source has no DOI)</span></label>
      <input value={url} onChange={e => setUrl(e.target.value)}
             placeholder="https://…" style={S.input} />

      <label style={S.fieldLabel}>
        What the source found <span style={{ ...S.dim, color: words > 0 && (words < 60 || words > 400) ? SEV.warn : 'var(--tx2)' }}>
          — {words} words (60–400, aim ~150)</span>
      </label>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={7} style={S.textarea}
                placeholder="Report what the study found, in your own words, with the numbers that matter. Answer the ask; do not advise." />

      <label style={S.fieldLabel}>
        What this source cannot tell us <span style={{ ...S.dim, color: lim && limWords < 8 ? SEV.warn : 'var(--tx2)' }}>
          — the point of the exercise</span>
      </label>
      <textarea value={lim} onChange={e => setLim(e.target.value)} rows={3} style={S.textarea}
                placeholder="Design limits, sample limits, what question remains open." />

      {findings.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
          {findings.map((f, i) => (
            <li key={i} style={{ ...S.findingCard, borderColor: SEV[f.severity] ?? 'var(--bd)' }}>
              <span style={{ ...S.badge, color: SEV[f.severity], border: `1px solid ${SEV[f.severity]}` }}>
                {f.severity}
              </span>{' '}
              <span style={{ fontSize: 13 }}>{f.detail}</span>
            </li>
          ))}
        </ul>
      )}

      {claim.note && (
        <p style={{ ...S.sub, fontSize: 13, marginTop: 10 }}>
          <strong>Reviewer note:</strong> {claim.note}
        </p>
      )}

      <div style={S.actions}>
        <button style={S.secondary} disabled={busy} onClick={() => save()}>Save draft</button>
        <button style={S.primary} disabled={busy} onClick={submit}>
          {busy ? 'Working…' : 'Submit for review'}
        </button>
        <button style={S.danger} disabled={busy} onClick={onRelease}>Release claim</button>
      </div>

      {msg && <p style={S.notice}>{msg}</p>}
    </div>
  )
}

const S = {
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '2px 0 4px' },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6 },
  dim: { color: 'var(--tx2)', fontWeight: 400, fontSize: 12, textTransform: 'none', letterSpacing: 0 },
  link: { fontSize: 13, color: 'var(--pk)' },
  notice: { color: 'var(--pk)', marginTop: 10, fontFamily: MONO, fontSize: 13 },

  mineStrip: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '10px 14px', margin: '14px 0 4px' },
  mineRow: { width: '100%', display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' },

  controls: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0 6px' },
  pill: { fontFamily: MONO, fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx2)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 },
  pillOn: { borderColor: 'var(--pk)', color: 'var(--pk)' },
  search: { flex: '1 1 200px', minWidth: 160, fontSize: 14, padding: '7px 12px', borderRadius: 20, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)' },

  lectureHead: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '14px 2px 6px', background: 'none', border: 'none', borderBottom: '1px solid var(--bd)', cursor: 'pointer', marginTop: 18 },
  lectureTitle: { display: 'block', fontFamily: SERIF, fontSize: 19, color: 'var(--tx)', textAlign: 'left' },
  metaLine: { display: 'block', fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', marginTop: 2, textAlign: 'left' },
  chev: { color: 'var(--tx2)', fontSize: 13, flexShrink: 0 },

  gap: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, marginTop: 8 },
  gapHead: { width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px', textAlign: 'left' },
  gapTop: { display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' },
  badge: { fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, flexShrink: 0 },
  pageName: { fontFamily: MONO, fontSize: 13, color: 'var(--pk)', overflowWrap: 'anywhere' },
  capacity: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', marginLeft: 'auto', flexShrink: 0 },
  ask: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.55, margin: '7px 0 0' },

  colLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 6px' },
  srcList: { margin: '0 0 12px', paddingLeft: 18 },
  srcItem: { fontSize: 13, color: 'var(--tx2)', lineHeight: 1.55, marginBottom: 3 },

  fieldLabel: { display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '12px 0 4px' },
  input: { width: '100%', fontSize: 14, fontFamily: MONO, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)', boxSizing: 'border-box' },
  textarea: { width: '100%', fontSize: 14, lineHeight: 1.55, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)', boxSizing: 'border-box', resize: 'vertical' },
  findingLine: { fontSize: 13, margin: '5px 0 0', lineHeight: 1.5 },
  findingCard: { border: '1px solid', borderRadius: 8, padding: '7px 10px', marginBottom: 6, color: 'var(--tx)' },

  actions: { display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' },
  primary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: 'none', background: 'var(--pk)', color: '#fff', cursor: 'pointer' },
  secondary: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid var(--bd)', background: 'var(--bgc)', color: 'var(--tx)', cursor: 'pointer' },
  danger: { fontSize: 14, fontWeight: 600, padding: '9px 16px', borderRadius: 24, border: '1px solid rgba(192,57,43,.35)', background: 'none', color: '#c0392b', cursor: 'pointer' },
}
