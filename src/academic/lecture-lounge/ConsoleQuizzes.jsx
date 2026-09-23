import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The console's Quizzes tab: preview every quiz and test the class has, the
// way a student meets it or as an answer key.
//
// Two sources, both staff-only definer RPCs (20260922 migration):
//   get_quiz_preview    — the live weekly quizzes, opened or not, keys merged
//   get_assessment_bank — pools loaded from the Teaching drive (a term test's
//                         draft pool, quizzes not yet scheduled). Test items
//                         carry keys, so they live in the database only; the
//                         repo is public and never sees them.
//
// "Student view" is a dry run: answering here writes nothing, so previewing a
// live quiz cannot mark the instructor as having started it.
export default function ConsoleQuizzes({ classInfo }) {
  const [data, setData] = useState(undefined)   // undefined = loading, null = error
  const [errorMsg, setErrorMsg] = useState(null)
  const [sel, setSel] = useState(null)          // 'live:<id>' | 'bank:<pool>'
  const [mode, setMode] = useState('student')   // 'student' | 'key'
  const [fileFilter, setFileFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.rpc('get_quiz_preview', { p_class_id: classInfo.id }),
      supabase.rpc('get_assessment_bank', { p_class_id: classInfo.id }),
    ]).then(([live, bank]) => {
      if (cancelled) return
      // .rpc() reports failure in `error`, it does not throw — check both.
      const err = live.error ?? bank.error
      if (err) { setErrorMsg(err.message); setData(null); return }
      setData({ live: live.data ?? [], bank: bank.data ?? [] })
    })
    return () => { cancelled = true }
  }, [classInfo.id])

  const sources = useMemo(() => {
    if (!data) return []
    return [
      ...data.live.map((q) => ({
        key: `live:${q.id}`, group: 'Live in the Lounge', title: q.title,
        chip: liveStatus(q), detail: `${q.completions} completed · ${q.started} started`,
        items: (q.items ?? []).map(fromLive),
      })),
      ...data.bank.map((p) => ({
        key: `bank:${p.pool}`, group: 'Item bank (staff only)', title: p.pool_title,
        chip: { label: 'not served', tone: 'muted' },
        detail: `loaded ${fmtDate(p.loaded_at)}`,
        items: (p.items ?? []).map(fromBank),
      })),
    ]
  }, [data])

  if (data === undefined) return <p style={S.hint}>Loading quizzes…</p>
  if (data === null) return <p style={S.error}>{errorMsg || 'Could not load quizzes.'}</p>
  if (sources.length === 0) return <p style={S.hint}>No quizzes or item pools for this class yet.</p>

  const current = sources.find((s) => s.key === sel) ?? sources[0]
  const files = [...new Set(current.items.map((i) => i.meta.file).filter(Boolean))]
  const shown = current.items.filter((i) => !fileFilter || i.meta.file === fileFilter)
  const counts = countFormats(shown)

  return (
    <div>
      {/* Print key: only the items. Everything chrome-like carries .no-print. */}
      <style>{'@media print { .no-print, nav { display: none !important } }'}</style>
      <div style={S.sourceGrid} className="no-print">
        {['Live in the Lounge', 'Item bank (staff only)'].map((group) => {
          const inGroup = sources.filter((s) => s.group === group)
          if (!inGroup.length) return null
          return (
            <div key={group}>
              <p style={S.groupLabel}>{group}</p>
              {inGroup.map((s) => (
                <button key={s.key} style={S.sourceBtn(s.key === current.key)}
                        onClick={() => { setSel(s.key); setFileFilter('') }}>
                  <span style={S.sourceTitle}>{s.title}</span>
                  <span style={S.chip(s.chip.tone)}>{s.chip.label}</span>
                  <span style={S.sourceDetail}>{s.detail}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <div style={S.toolbar} className="no-print">
        <div style={S.toggle}>
          <button style={S.toggleBtn(mode === 'student')} onClick={() => setMode('student')}>Student view</button>
          <button style={S.toggleBtn(mode === 'key')} onClick={() => setMode('key')}>Answer key</button>
        </div>
        {files.length > 1 && (
          <select style={S.select} value={fileFilter} onChange={(e) => setFileFilter(e.target.value)}>
            <option value="">all parts ({current.items.length})</option>
            {files.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        {mode === 'key' && <button style={S.printBtn} onClick={() => window.print()}>Print key</button>}
      </div>

      <h2 style={S.h2}>{current.title}</h2>
      <p style={S.sub}>
        {counts}{mode === 'student' ? ' · answering here is a dry run and saves nothing' : ''}
      </p>

      {shown.map((item, idx) => (
        <ItemCard key={`${current.key}:${item.id}:${mode}`} item={item} n={idx + 1} total={shown.length} mode={mode} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- items

// Both sources normalized to one shape so the card has one code path.
function fromLive(it) {
  const r = it.reveal ?? {}
  return {
    id: it.id, format: it.format, stem: it.stem, options: it.options ?? null,
    correctIndex: typeof r.correct_index === 'number' ? r.correct_index : null,
    accepted: it.format === 'vsa' ? [r.answer_text].filter(Boolean) : [],
    rationale: r.rationale ?? '', link: r.link ?? '', parts: null,
    meta: { missingKey: !it.reveal },
  }
}

function fromBank(it) {
  return {
    id: it.id, format: it.format, stem: it.stem, options: it.options ?? null,
    correctIndex: typeof it.key === 'number' ? it.key : null,
    accepted: Array.isArray(it.key) ? it.key : [],
    rationale: it.rationale ?? '', link: it.link ?? '', parts: it.parts ?? null,
    meta: {
      file: it.source_file, difficulty: it.difficulty,
      where: it.page ? `${it.page}#${it.section}` : null, fact: it.fact,
    },
  }
}

function ItemCard({ item, n, total, mode }) {
  const [picked, setPicked] = useState(null)
  const [typed, setTyped] = useState('')
  const [shownParts, setShownParts] = useState({})
  const keyMode = mode === 'key'
  const answered = keyMode || picked !== null

  const label = { mc: '', vsa: ' · short answer', sa: ' · written answer (5 marks)' }[item.format] ?? ''

  return (
    <div style={S.card}>
      <p style={S.itemNo}>
        {n} of {total}{label}
        {keyMode && <span style={S.itemId}> · {item.id}{item.meta.difficulty ? ` · ${item.meta.difficulty}` : ''}</span>}
      </p>
      <Md text={item.stem} style={S.stem} />

      {item.options && (
        <div style={S.optionCol}>
          {item.options.map((opt, i) => {
            const isKey = i === item.correctIndex
            const isMine = i === picked
            return (
              <button key={i} style={S.option(answered && isKey, !keyMode && isMine && !isKey)}
                      disabled={answered} onClick={() => setPicked(i)}>
                {opt}
                {answered && isKey && <span style={S.tagOk}> ✓ answer</span>}
                {!keyMode && isMine && !isKey && <span style={S.tagMine}> · picked</span>}
              </button>
            )
          })}
        </div>
      )}

      {item.format === 'vsa' && !keyMode && picked === null && (
        <form style={S.vsaRow} onSubmit={(e) => { e.preventDefault(); if (typed.trim()) setPicked(-1) }}>
          <input style={S.vsaInput} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your answer…" />
          <button type="submit" style={S.primaryBtn} disabled={!typed.trim()}>Answer</button>
        </form>
      )}
      {item.format === 'vsa' && answered && (
        <p style={S.model}>
          {!keyMode && <>Typed: {typed} · </>}
          Accepted: <strong>{item.accepted.join(' · ') || '—'}</strong>
        </p>
      )}

      {item.parts && item.parts.map((p) => (
        <div key={p.label} style={S.part}>
          <Md text={`**${p.label}.** ${p.prompt}`} style={S.partPrompt} />
          {!keyMode && <textarea style={S.textarea} rows={3} placeholder="Students type here on the test" />}
          {(keyMode || shownParts[p.label])
            ? <Md text={p.model_answer} style={S.modelAnswer} />
            : <button style={S.linkBtn} onClick={() => setShownParts((s) => ({ ...s, [p.label]: true }))}>show model answer</button>}
        </div>
      ))}

      {answered && (item.rationale || item.link) && (
        <>
          {item.rationale && <p style={S.rationale}>{item.rationale}</p>}
          {item.link && <Link to={item.link} style={S.link} target="_blank">Field Guide section →</Link>}
        </>
      )}
      {keyMode && item.meta.where && (
        <p style={S.metaLine}>{item.meta.where} · fact: {item.meta.fact}{item.meta.file ? ` · ${item.meta.file}` : ''}</p>
      )}
      {item.meta.missingKey && <p style={S.warn}>No key stored for this item — students will get no reveal.</p>}
    </div>
  )
}

// Just enough markdown for item text: paragraphs, **bold**, and pipe tables
// (the short-answer scenarios carry data tables). Built as React elements,
// never innerHTML.
function Md({ text, style }) {
  const blocks = String(text ?? '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  const out = []
  let rows = []
  const flush = () => {
    if (!rows.length) return
    const [head, ...body] = rows
    out.push(
      <table key={`t${out.length}`} style={S.table}>
        <thead><tr>{head.map((c, i) => <th key={i} style={S.th}>{inline(c)}</th>)}</tr></thead>
        <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, i) => <td key={i} style={S.td}>{inline(c)}</td>)}</tr>)}</tbody>
      </table>,
    )
    rows = []
  }
  for (const b of blocks) {
    // A folded YAML table arrives one row per block; a literal one, one block.
    const lines = b.split('\n').map((l) => l.trim())
    if (lines.every((l) => /^\|.*\|$/.test(l))) {
      for (const l of lines) {
        if (/^\|[\s:|-]+\|$/.test(l)) continue
        rows.push(l.slice(1, -1).split('|').map((c) => c.trim()))
      }
      continue
    }
    flush()
    out.push(<p key={`p${out.length}`} style={{ margin: '0 0 8px' }}>{inline(b)}</p>)
  }
  flush()
  return <div style={style}>{out}</div>
}

function inline(s) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)
}

// ---------------------------------------------------------------- helpers

function liveStatus(q) {
  const now = Date.now()
  if (new Date(q.opens_at).getTime() > now) return { label: `opens ${fmtDate(q.opens_at)}`, tone: 'muted' }
  if (new Date(q.hard_close_at).getTime() < now) return { label: 'closed', tone: 'muted' }
  return { label: `open · closes ${fmtDate(q.hard_close_at)}`, tone: 'live' }
}

function countFormats(items) {
  const c = {}
  for (const i of items) c[i.format] = (c[i.format] ?? 0) + 1
  const names = { mc: 'multiple choice', vsa: 'short typed', sa: 'written answer' }
  return Object.entries(c).map(([f, n]) => `${n} ${names[f] ?? f}`).join(' · ')
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-CA', {
  weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Toronto',
})

const S = {
  hint: { padding: 40, color: 'var(--tx2)', fontSize: 14, textAlign: 'center' },
  error: { padding: 40, color: '#c04a4a', fontSize: 14, textAlign: 'center' },
  sourceGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 },
  groupLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', margin: '0 0 8px' },
  sourceBtn: (active) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%',
    textAlign: 'left', padding: '10px 14px', marginBottom: 8, borderRadius: 10, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--pk)' : 'var(--bd)'}`, background: 'var(--bgc)', fontFamily: 'inherit',
  }),
  sourceTitle: { fontSize: 14, color: 'var(--tx)', fontWeight: 600 },
  sourceDetail: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)' },
  chip: (tone) => ({
    fontFamily: MONO, fontSize: 11, padding: '1px 8px', borderRadius: 8,
    color: tone === 'live' ? '#2e7d32' : 'var(--tx3)',
    border: `1px solid ${tone === 'live' ? '#2e7d3255' : 'var(--bd)'}`,
  }),
  toolbar: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 },
  toggle: { display: 'flex', border: '1px solid var(--bds)', borderRadius: 10, overflow: 'hidden' },
  toggleBtn: (active) => ({
    padding: '8px 14px', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 12,
    background: active ? 'var(--pk)' : 'var(--bgc)', color: active ? '#fff' : 'var(--tx2)',
  }),
  select: { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)', fontFamily: MONO, fontSize: 12 },
  printBtn: { padding: '7px 14px', borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--pkd)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  h2: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', margin: '6px 0 4px' },
  sub: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', margin: '0 0 12px' },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 18px', margin: '12px 0', breakInside: 'avoid' },
  itemNo: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', margin: '0 0 8px' },
  itemId: { textTransform: 'none', letterSpacing: 0 },
  stem: { fontSize: 15, color: 'var(--tx)', lineHeight: 1.5, marginBottom: 10 },
  optionCol: { display: 'flex', flexDirection: 'column', gap: 8 },
  option: (isKey, isWrongPick) => ({
    textAlign: 'left', padding: '10px 14px', borderRadius: 10, fontSize: 14, lineHeight: 1.4, fontFamily: 'inherit',
    border: `1px solid ${isKey ? '#2e7d32' : isWrongPick ? 'var(--pk)' : 'var(--bds)'}`,
    background: isKey ? '#2e7d3211' : 'transparent', color: 'var(--tx)', cursor: 'pointer',
  }),
  tagOk: { fontFamily: MONO, fontSize: 11, color: '#2e7d32' },
  tagMine: { fontFamily: MONO, fontSize: 11, color: 'var(--pk)' },
  vsaRow: { display: 'flex', gap: 8 },
  vsaInput: { flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bds)', fontSize: 14, fontFamily: 'inherit' },
  primaryBtn: { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--pk)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  model: { fontSize: 14, color: 'var(--tx)', margin: '10px 0 0' },
  part: { margin: '14px 0 0', paddingTop: 10, borderTop: '1px dashed var(--bd)' },
  partPrompt: { fontSize: 14.5, color: 'var(--tx)', lineHeight: 1.5 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid var(--bds)', fontFamily: 'inherit', fontSize: 14, margin: '6px 0' },
  modelAnswer: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.5, background: '#2e7d320d', borderLeft: '3px solid #2e7d32', padding: '8px 12px', borderRadius: '0 8px 8px 0', marginTop: 6 },
  linkBtn: { border: 'none', background: 'none', padding: 0, color: 'var(--pk)', fontFamily: MONO, fontSize: 12, cursor: 'pointer' },
  rationale: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55, margin: '12px 0 6px' },
  link: { color: 'var(--pk)', fontSize: 13 },
  metaLine: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', margin: '10px 0 0', wordBreak: 'break-word' },
  warn: { fontSize: 13, color: '#b8760f', marginTop: 8 },
  table: { borderCollapse: 'collapse', margin: '8px 0 10px', fontSize: 13.5 },
  th: { border: '1px solid var(--bd)', padding: '5px 9px', textAlign: 'left', background: 'var(--bg)' },
  td: { border: '1px solid var(--bd)', padding: '5px 9px' },
}
