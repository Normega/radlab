import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Md from './Md'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The Grade-o-matic (20261006_grade_o_matic.sql): short answers graded one response
// at a time from a personal queue. Each part arrives pre-filled with a suggested
// mark and student-facing feedback (class_test_suggestions); the grader approves or
// edits, and ⌘/Ctrl+Enter saves the whole response and moves on. Responses are
// shown by number only, never by name. The suggestion is kept separately from the
// saved grade, so "how often did graders change it" can be read off afterwards
// (the "Everyone" view shows it per grader and question).
const SCORES = [0, 0.5, 1]
const fmt = (v) => (v === 0.5 ? '½' : v == null ? '–' : String(v))
const CHEERS = ['Nice.', 'Clean.', 'On a roll.', 'Ka-chunk.', 'Another one.', 'Smooth.', 'Graded and gleaming.']
const MILESTONES = { 5: 'Five down. The machine hums.', 10: 'Ten! Find a snack.', 20: 'Twenty in a row. Legendary.' }

export default function GradeOMatic({ testId, onExit }) {
  const [data, setData] = useState(null)
  const [scope, setScope] = useState(null)        // 'mine' | 'all'
  const [itemFilter, setItemFilter] = useState('any')
  const [key, setKey] = useState(null)            // `${attempt_id}|${item_id}` being graded
  const [draft, setDraft] = useState({})          // part -> { score, feedback }
  const [saving, setSaving] = useState(false)
  const [streak, setStreak] = useState(0)
  const [toast, setToast] = useState(null)
  const [showGuide, setShowGuide] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc('get_grade_o_matic', { p_test_id: testId })
    if (e) { setError(e.message); return }
    setData(d)
    setScope((s) => s ?? (d.rows.some((r) => r.grader_id === d.me) ? 'mine' : 'all'))
  }, [testId])
  useEffect(() => { load() }, [load])

  const items = useMemo(() => Object.fromEntries((data?.items ?? []).map((it, n) => [it.item_id, { ...it, n: n + 1 }])), [data])
  const graderName = useMemo(() => Object.fromEntries((data?.graders ?? []).map((g) => [g.user_id, g.name])), [data])
  const isDone = useCallback((r) => (items[r.item_id]?.content.parts ?? []).every((p) => r.grade[p.label]?.score != null), [items])

  // Once any grading is assigned, unassigned responses (e.g. a staff member's own
  // trial attempt) are left out of every view.
  const assigned = useMemo(() => (data?.rows ?? []).some((r) => r.grader_id), [data])
  const queue = useMemo(() => (data?.rows ?? []).filter((r) =>
    (scope !== 'mine' || r.grader_id === data.me) && (!assigned || r.grader_id)
    && (itemFilter === 'any' || r.item_id === itemFilter)), [data, scope, itemFilter, assigned])
  const keyOf = (r) => `${r.attempt_id}|${r.item_id}`
  const idx = Math.max(0, queue.findIndex((r) => keyOf(r) === key))
  const row = queue[idx]
  const item = row && items[row.item_id]
  const done = queue.filter(isDone).length

  // land on the first ungraded response whenever the queue changes underneath us
  useEffect(() => {
    if (!queue.length) return
    if (!queue.some((r) => keyOf(r) === key)) setKey(keyOf(queue.find((r) => !isDone(r)) ?? queue[0]))
  }, [queue, key, isDone])

  // a fresh draft per response: the saved grade if there is one, else the suggestion
  useEffect(() => {
    if (!row || !item) return
    setDraft(Object.fromEntries(item.content.parts.map((p) => {
      const g = row.grade[p.label], s = row.suggestion[p.label]
      return [p.label, g ? { score: Number(g.score), feedback: g.feedback ?? '' }
                         : { score: s ? Number(s.score) : null, feedback: s?.feedback ?? '' }]
    })))
  }, [row?.attempt_id, row?.item_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((delta) => {
    if (!queue.length) return
    setKey(keyOf(queue[(idx + delta + queue.length) % queue.length]))
  }, [queue, idx])
  const nextUngraded = useCallback((fromRow) => {
    const start = queue.findIndex((r) => keyOf(r) === keyOf(fromRow))
    for (let k = 1; k <= queue.length; k++) {
      const r = queue[(start + k) % queue.length]
      if (!isDone(r) && keyOf(r) !== keyOf(fromRow)) return r
    }
    return null
  }, [queue, isDone])

  const approve = useCallback(async () => {
    if (!row || !item || saving) return
    const parts = item.content.parts.map((p) => ({ part: p.label, score: draft[p.label]?.score, feedback: draft[p.label]?.feedback ?? '' }))
    if (parts.some((p) => p.score == null)) { setToast('Every part needs a mark first.'); return }
    setSaving(true)
    const { error: e } = await supabase.rpc('set_class_test_part_grades', { p_attempt_id: row.attempt_id, p_item_id: row.item_id, p_parts: parts })
    setSaving(false)
    if (e) { setToast(`Not saved: ${e.message}`); return }
    const graded = Object.fromEntries(parts.map((p) => [p.part, { score: p.score, feedback: p.feedback, graded_by: data.me, graded_at: new Date().toISOString() }]))
    setData((d) => ({ ...d, rows: d.rows.map((r) => (keyOf(r) === keyOf(row) ? { ...r, grade: graded } : r)) }))
    const s = streak + 1
    setStreak(s)
    setToast(MILESTONES[s] ?? CHEERS[s % CHEERS.length])
    const nxt = nextUngraded(row)
    if (nxt) setKey(keyOf(nxt))
  }, [row, item, draft, saving, data?.me, streak, nextUngraded])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); approve(); return }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      if (e.key === 'j' || e.key === 'ArrowRight') go(1)
      else if (e.key === 'k' || e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [approve, go])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t) }, [toast])

  if (error) return <p style={S.hint}>{error} <button style={S.btn} onClick={onExit}>Back</button></p>
  if (!data) return <p style={S.hint}>Warming up the Grade-o-matic…</p>
  if (!data.items.length) return <p style={S.hint}>This test has no short answers. <button style={S.btn} onClick={onExit}>Back</button></p>

  const pct = queue.length ? Math.round((100 * done) / queue.length) : 0
  const gradable = data.rows.filter((r) => !assigned || r.grader_id)
  const allDone = gradable.filter(isDone).length
  const release = async (on) => {
    if (on) {
      const left = gradable.length - allDone
      const msg = left
        ? `${left} of ${gradable.length} responses are not fully graded yet. Students would see those parts with no mark. Release anyway?`
        : 'Release results? Each student who submitted will see their total, their short-answer marks and the feedback.'
      if (!confirm(msg)) return
    } else if (!confirm('Withdraw the results? Students will stop seeing them until you release again.')) return
    const { data: at, error: e } = await supabase.rpc('set_class_test_results_release', { p_test_id: testId, p_release: on })
    if (e) { setToast(`Not changed: ${e.message}`); return }
    setData((d) => ({ ...d, released_at: at }))
    setToast(on ? 'Results released to students.' : 'Results withdrawn.')
  }
  const total = row ? Object.values(draft).reduce((s, d) => s + (d?.score ?? 0), 0) : 0

  return (
    <div>
      <div style={S.top}>
        <button style={S.btn} onClick={onExit}>← Roster</button>
        <h2 style={S.h2}>Grade-o-matic <span aria-hidden>⚙️</span></h2>
        <div style={S.seg}>
          {[['mine', 'My queue'], ['all', 'Everyone']].map(([k, label]) => (
            <button key={k} style={S.segBtn(scope === k)} onClick={() => setScope(k)}>{label}</button>
          ))}
        </div>
        {data.released_at
          ? <button style={S.btn} onClick={() => release(false)} title="Students can see their results">Released ✓ · withdraw</button>
          : <button style={S.btn} onClick={() => release(true)}>Release to students</button>}
        <select style={S.select} value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} aria-label="question">
          <option value="any">All questions</option>
          {data.items.map((it, n) => <option key={it.item_id} value={it.item_id}>Short answer {n + 1}</option>)}
        </select>
      </div>

      <div style={S.progressWrap}>
        <div style={S.progressBar}><div style={S.progressFill(pct)} /></div>
        <span style={S.progressText}>{done}/{queue.length} graded · {pct}%{streak > 1 ? ` · streak ${streak} 🔥` : ''}</span>
      </div>

      {scope === 'all' && <RaterPanel data={data} items={items} graderName={graderName} />}

      {!queue.length ? (
        <p style={S.hint}>Nothing assigned to you here. Switch to "Everyone" to see the whole test.</p>
      ) : (
        <>
          <div style={S.strip}>
            {queue.map((r) => (
              <button key={keyOf(r)} title={`Response #${r.seq} · SA ${items[r.item_id]?.n}`}
                      style={S.chip(keyOf(r) === keyOf(row), isDone(r))} onClick={() => setKey(keyOf(r))}>
                {itemFilter === 'any' && queue.some((q) => q.item_id !== queue[0].item_id) ? `${items[r.item_id]?.n}·` : ''}{r.seq}
              </button>
            ))}
          </div>

          {done === queue.length && (
            <div style={S.party}>🎉 Queue cleared. Every response here has a mark and feedback. Thank you!</div>
          )}

          {row && item && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <div>
                  <p style={S.eyebrow}>Short answer {item.n} · response #{row.seq}{scope === 'all' && row.grader_id ? ` · ${graderName[row.grader_id] ?? 'assigned'}` : ''}</p>
                  <p style={S.meta}>{isDone(row) ? 'Graded. Changes save over the earlier mark.' : 'Not graded yet. The suggestions below are pre-filled; check each one.'}</p>
                </div>
                <div style={S.totalBox}>{fmt(total)}<span style={S.totalOf}>/{item.content.parts.length}</span></div>
              </div>

              <button style={S.linkBtn} onClick={() => setShowGuide((v) => !v)}>{showGuide ? 'Hide' : 'Show'} the scenario</button>
              {showGuide && <div style={S.scenario}><Md text={item.content.stem} style={S.stem} /></div>}

              {item.content.parts.map((p) => {
                const ans = (row.answer?.[p.label] ?? '').trim()
                const sug = row.suggestion[p.label]
                const d = draft[p.label] ?? {}
                const edited = sug && (Number(sug.score) !== d.score || (sug.feedback ?? '') !== (d.feedback ?? ''))
                const guide = item.answer.parts?.find((m) => m.label === p.label)?.model_answer
                return (
                  <div key={p.label} style={S.part}>
                    <p style={S.prompt}><b style={S.label}>{p.label}.</b> {p.prompt}</p>
                    <div style={S.answer}>{ans || <em style={S.meta}>No answer.</em>}</div>
                    <details style={S.guide}><summary style={S.guideSum}>Marking guide</summary><Md text={guide} style={S.guideText} /></details>
                    <div style={S.scoreRow}>
                      {SCORES.map((v) => (
                        <button key={v} style={S.scoreBtn(d.score === v)} aria-pressed={d.score === v}
                                onClick={() => setDraft((x) => ({ ...x, [p.label]: { ...x[p.label], score: v } }))}>{fmt(v)}</button>
                      ))}
                      {sug && <span style={S.sug}>🤖 suggested {fmt(Number(sug.score))}{sug.note ? ` · ${sug.note}` : ''}</span>}
                      {edited && <span style={S.edited}>edited</span>}
                    </div>
                    <textarea style={S.feedback} rows={2} value={d.feedback ?? ''} placeholder="Feedback the student will read"
                              onChange={(e) => setDraft((x) => ({ ...x, [p.label]: { ...x[p.label], feedback: e.target.value } }))} />
                  </div>
                )
              })}

              <div style={S.footer}>
                <button style={S.btn} onClick={() => go(-1)}>← Previous</button>
                <span style={S.keys}>⌘/Ctrl + Enter approves · j / k move</span>
                <button style={S.primary} disabled={saving} onClick={approve}>{saving ? 'Saving…' : 'Approve & next →'}</button>
              </div>
            </div>
          )}
        </>
      )}
      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  )
}

// Per grader and question: how far along, the mean final mark per part, the mean
// suggestion for the same responses, and how often the grader changed it.
function RaterPanel({ data, items, graderName }) {
  const cells = {}
  for (const r of data.rows) {
    const it = items[r.item_id]; if (!it || !r.grader_id) continue
    const c = (cells[`${r.grader_id}|${r.item_id}`] ??= { g: r.grader_id, n: it.n, total: 0, done: 0, final: [], sug: [], changed: 0, parts: 0 })
    c.total++
    const labels = it.content.parts.map((p) => p.label)
    if (!labels.every((l) => r.grade[l]?.score != null)) continue
    c.done++
    for (const l of labels) {
      const g = Number(r.grade[l].score), s = r.suggestion[l] ? Number(r.suggestion[l].score) : null
      c.final.push(g); if (s != null) { c.sug.push(s); c.parts++; if (s !== g) c.changed++ }
    }
  }
  const mean = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '–')
  const list = Object.values(cells).sort((a, b) => a.n - b.n || (graderName[a.g] ?? '').localeCompare(graderName[b.g] ?? ''))
  if (!list.length) return null
  return (
    <div style={S.panel}>
      <p style={S.eyebrow}>Raters at a glance (mean mark per part, 0–1)</p>
      <table style={S.table}>
        <thead><tr>{['Question', 'Grader', 'Graded', 'Their mean', 'Suggested mean', 'Changed'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{list.map((c) => (
          <tr key={`${c.g}|${c.n}`}>
            <td style={S.td}>SA {c.n}</td><td style={S.td}>{graderName[c.g] ?? '—'}</td>
            <td style={S.td}>{c.done}/{c.total}</td><td style={S.td}>{mean(c.final)}</td><td style={S.td}>{mean(c.sug)}</td>
            <td style={S.td}>{c.parts ? `${Math.round((100 * c.changed) / c.parts)}% of parts` : '–'}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

const S = {
  hint: { padding: 40, color: 'var(--tx2)', fontSize: 14, textAlign: 'center' },
  top: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  h2: { fontFamily: SERIF, fontSize: 28, margin: '0 8px', color: 'var(--tx)' },
  btn: { padding: '8px 16px', borderRadius: 24, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  primary: { padding: '8px 24px', borderRadius: 24, border: 'none', background: 'var(--pkd)', color: 'var(--bgc)', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  linkBtn: { border: 'none', background: 'none', color: 'var(--pkd)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0, marginBottom: 8 },
  seg: { display: 'flex', border: '1px solid var(--bds)', borderRadius: 24, overflow: 'hidden', marginLeft: 'auto' },
  segBtn: (on) => ({ padding: '8px 16px', border: 'none', background: on ? 'var(--pkd)' : 'var(--bgc)', color: on ? 'var(--bgc)' : 'var(--tx)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }),
  select: { padding: '8px 16px', borderRadius: 24, border: '1px solid var(--bds)', background: 'var(--bgc)', fontSize: 14, fontFamily: 'inherit' },
  progressWrap: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 },
  progressBar: { flex: 1, height: 16, borderRadius: 12, background: 'var(--fill)', overflow: 'hidden', border: '1px solid var(--bd)' },
  progressFill: (pct) => ({ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--pk), var(--pkd))', transition: 'width .4s ease' }),
  progressText: { fontFamily: MONO, fontSize: 12, color: 'var(--tx2)', whiteSpace: 'nowrap' },
  strip: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 },
  chip: (cur, ok) => ({ minWidth: 32, padding: '4px 8px', borderRadius: 24, fontFamily: MONO, fontSize: 12, cursor: 'pointer',
    border: `1px solid ${cur ? 'var(--pkd)' : 'var(--bds)'}`, background: ok ? 'var(--pkb)' : 'var(--bgc)',
    color: ok ? 'var(--pkd)' : 'var(--tx2)', fontWeight: cur ? 700 : 400, outline: cur ? '2px solid var(--pk)' : 'none' }),
  party: { padding: 16, borderRadius: 12, background: 'var(--pkb)', color: 'var(--pkd)', fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: 'center' },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24 },
  cardHead: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 8 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pkd)', margin: '0 0 4px' },
  meta: { fontSize: 12, color: 'var(--tx3)', margin: 0 },
  totalBox: { fontFamily: SERIF, fontSize: 36, color: 'var(--tx)', lineHeight: 1 },
  totalOf: { fontSize: 20, color: 'var(--tx3)' },
  scenario: { background: 'var(--bgp)', borderRadius: 12, padding: 16, marginBottom: 8 },
  stem: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.5 },
  part: { borderTop: '1px dashed var(--bd)', padding: '16px 0 8px' },
  prompt: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5, margin: '0 0 8px' },
  label: { fontFamily: MONO, color: 'var(--tx)' },
  answer: { fontSize: 16, color: 'var(--tx)', lineHeight: 1.55, whiteSpace: 'pre-wrap', background: 'var(--bgp)', borderLeft: '4px solid var(--pk)', borderRadius: '0 12px 12px 0', padding: '8px 16px', margin: '0 0 8px' },
  guide: { margin: '0 0 8px' },
  guideSum: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', cursor: 'pointer' },
  guideText: { fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, padding: '4px 0 0 16px' },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  scoreBtn: (on) => ({ minWidth: 48, padding: '8px 16px', borderRadius: 24, fontFamily: MONO, fontSize: 16, fontWeight: 700, cursor: 'pointer',
    border: `2px solid ${on ? 'var(--pkd)' : 'var(--bds)'}`, background: on ? 'var(--pkd)' : 'var(--bgc)', color: on ? 'var(--bgc)' : 'var(--tx)' }),
  sug: { fontSize: 12, color: 'var(--tx3)' },
  edited: { fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--pkd)', border: '1px solid var(--pk)', borderRadius: 12, padding: '0 8px' },
  feedback: { width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 12, border: '1px solid var(--bds)', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, resize: 'vertical' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' },
  keys: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)' },
  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--tx)', color: 'var(--bgc)', padding: '8px 24px', borderRadius: 24, fontSize: 14, fontWeight: 700, zIndex: 20 },
  panel: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: 16, marginBottom: 16, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', color: 'var(--tx3)', textAlign: 'left', padding: 8, borderBottom: '1px solid var(--bd)' },
  td: { padding: 8, borderBottom: '1px solid var(--bd)', fontFamily: MONO, fontSize: 12 },
}
