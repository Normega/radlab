import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ClassTest from './ClassTest'
import Md from './Md'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// The console's Test tab: run a timed class test (20260928_class_tests.sql).
// One row per roster student (plus any class member who isn't on the roster),
// refreshed every 10 s: account status, extra time, attempt status, start,
// deadline, submitted, answered, last seen. Staff open/close the test with an
// access code, set extra time (it extends a live attempt immediately), extend,
// reopen or force-submit an attempt, preview the whole test, grade the short
// answers blind, review the auto-marked short typed answers, and export one CSV
// for Quercus.
export default function ConsoleTest({ classInfo }) {
  const [tests, setTests] = useState(undefined)
  const [testId, setTestId] = useState(null)
  const [dash, setDash] = useState(null)
  const [error, setError] = useState(null)
  const [view, setView] = useState('roster')      // roster | preview | grading | typed
  const [codeDraft, setCodeDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [offsetMs, setOffsetMs] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    supabase.rpc('list_class_tests', { p_class_id: classInfo.id }).then(({ data, error: e }) => {
      if (e) { setError(e.message); setTests([]); return }
      setTests(data ?? [])
      if (data?.length) setTestId(data[data.length - 1].id)
    })
  }, [classInfo.id])

  const refresh = useCallback(async () => {
    if (!testId) return
    const { data, error: e } = await supabase.rpc('get_class_test_dashboard', { p_test_id: testId })
    if (e) { setError(e.message); return }
    setError(null)
    setDash(data)
    setOffsetMs(new Date(data.server_now).getTime() - Date.now())
    setCodeDraft((c) => c || data.test.access_code || '')
  }, [testId])

  useEffect(() => {
    refresh()
    const t = setInterval(() => { if (!document.hidden) refresh() }, 10000)
    return () => clearInterval(t)
  }, [refresh])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const run = async (fn) => {
    setBusy(true)
    const { error: e } = await fn()
    setBusy(false)
    if (e) { alert(e.message); return }
    refresh()
  }

  const rows = useMemo(() => dash?.rows ?? [], [dash])
  const serverNow = now + offsetMs
  const statusOf = (r) => {
    if (!r.attempt_id) return r.has_account && r.is_member ? 'not started' : 'cannot sign in'
    if (r.submitted_at) return r.submit_kind === 'auto' ? 'time up' : r.submit_kind === 'staff' ? 'ended by staff' : 'submitted'
    return 'writing'
  }
  const counts = rows.filter((r) => r.on_roster).reduce((acc, r) => { const s = statusOf(r); acc[s] = (acc[s] ?? 0) + 1; return acc }, {})

  if (tests === undefined) return <p style={S.hint}>Loading…</p>
  if (!tests.length) return <p style={S.hint}>No tests set up for this class yet.</p>
  if (!dash) return <p style={S.hint}>{error ?? 'Loading the test…'}</p>

  const t = dash.test
  const itemCount = t.item_count
  const vsaCount = t.vsa_count ?? 0
  const saCount = itemCount - t.mc_count - vsaCount

  if (view === 'preview') {
    return <ClassTest preview testId={t.id} onExit={() => setView('roster')} />
  }
  if (view === 'grading') {
    return <Grading testId={t.id} onExit={() => setView('roster')} />
  }
  if (view === 'typed') {
    return <TypedReview testId={t.id} onExit={() => { setView('roster'); refresh() }} />
  }

  return (
    <div>
      {tests.length > 1 && (
        <select style={S.select} value={testId} onChange={(e) => { setTestId(e.target.value); setDash(null) }}>
          {tests.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
        </select>
      )}

      <div style={S.head}>
        <div>
          <h2 style={S.h2}>{t.title}</h2>
          <p style={S.sub}>{[`${t.mc_count} MC`, vsaCount && `${vsaCount} short typed`, saCount && `${saCount} short answer`].filter(Boolean).join(' + ')} · {t.duration_minutes} min + extra time ·
            MC order {t.shuffle_mc ? 'shuffled per student' : 'fixed'}</p>
        </div>
        <span style={S.status(t.status)}>{t.status === 'open' ? 'OPEN' : t.status === 'closed' ? 'CLOSED' : 'NOT OPEN'}</span>
      </div>

      <div style={S.controls}>
        <label style={S.codeLabel}>Access code
          <input style={S.codeInput} value={codeDraft} onChange={(e) => setCodeDraft(e.target.value.toUpperCase())} placeholder="e.g. OWL42" />
        </label>
        {t.status !== 'open' && (
          <button style={S.primaryBtn} disabled={busy} onClick={() => {
            if (!codeDraft.trim() && !confirm('Open with NO access code? Anyone enrolled could start from anywhere.')) return
            run(() => supabase.rpc('set_class_test_status', { p_test_id: t.id, p_status: 'open', p_code: codeDraft }))
          }}>Open the test</button>
        )}
        {t.status === 'open' && (
          <>
            <button style={S.btn} disabled={busy}
              onClick={() => run(() => supabase.rpc('set_class_test_status', { p_test_id: t.id, p_status: 'open', p_code: codeDraft }))}>Update code</button>
            <button style={S.dangerBtn} disabled={busy} onClick={() => {
              if (!confirm('Close the test? No new starts. Anyone already writing keeps their time.')) return
              run(() => supabase.rpc('set_class_test_status', { p_test_id: t.id, p_status: 'closed', p_code: codeDraft }))
            }}>Close to new starts</button>
          </>
        )}
        {t.status === 'closed' && <span style={S.sub}>Reopen with "Open the test" if a late sitting needs it.</span>}
        <span style={{ flex: 1 }} />
        <button style={S.btn} onClick={() => setView('preview')}>Preview the test</button>
        {vsaCount > 0 && <button style={S.btn} onClick={() => setView('typed')}>Review typed answers</button>}
        {saCount > 0 && <button style={S.btn} onClick={() => setView('grading')}>Grade short answers</button>}
        <button style={S.btn} onClick={() => exportCsv(t, rows)}>Export CSV</button>
      </div>

      <p style={S.counts}>
        {['not started', 'writing', 'submitted', 'time up', 'ended by staff', 'cannot sign in']
          .filter((k) => counts[k]).map((k) => <span key={k} style={S.countPill(k)}>{counts[k]} {k}</span>)}
        <span style={S.sub}> · refreshes every 10 s</span>
      </p>
      {error && <p style={S.error}>{error}</p>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>
            {['Student', 'Student #', 'Account', 'Extra min', 'Status', 'Started', 'Deadline', 'Submitted', 'Answered', 'MC', ...(vsaCount ? ['Typed'] : []), 'Last seen', ''].map((h) =>
              <th key={h} style={S.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const st = statusOf(r)
              const left = r.deadline && !r.submitted_at ? new Date(r.deadline).getTime() - serverNow : null
              return (
                <tr key={r.email} style={r.on_roster ? null : S.offRoster}>
                  <td style={S.td}>
                    <div style={S.name}>{r.last_name ? `${r.last_name}, ${r.first_name}` : (r.display_name || '—')}</div>
                    <div style={S.email}>{r.email}{!r.on_roster && ' · not on roster'}</div>
                  </td>
                  <td style={S.tdMono}>{r.student_number ?? ''}</td>
                  <td style={S.td}>{!r.has_account ? <span style={S.warn}>no account</span>
                    : !r.is_member ? <span style={S.warn}>not in class</span>
                    : !r.verified ? <span style={S.warn}>unverified</span> : '✓'}</td>
                  <td style={S.td}><ExtraCell row={r} testId={t.id} onSaved={refresh} /></td>
                  <td style={S.td}><span style={S.pill(st)}>{st}</span>
                    {left != null && <div style={S.left(left)}>{fmtLeft(left)}</div>}</td>
                  <td style={S.tdMono}>{fmtTime(r.started_at)}</td>
                  <td style={S.tdMono}>{fmtTime(r.deadline)}{r.bonus_minutes ? <div style={S.email}>+{r.bonus_minutes} extended</div> : null}</td>
                  <td style={S.tdMono}>{fmtTime(r.submitted_at)}</td>
                  <td style={S.tdMono}>{r.attempt_id ? `${r.answered}/${itemCount}` : ''}</td>
                  <td style={S.tdMono}>{r.attempt_id ? `${r.mc_correct}/${t.mc_count}` : ''}</td>
                  {vsaCount > 0 && <td style={S.tdMono}>{r.attempt_id ? `${r.vsa_correct}/${vsaCount}` : ''}</td>}
                  <td style={S.tdMono}>{r.last_seen_at ? <span style={S.seen(serverNow - new Date(r.last_seen_at).getTime())}>{ago(serverNow - new Date(r.last_seen_at).getTime())}</span> : ''}</td>
                  <td style={S.td}>
                    {r.attempt_id && !r.submitted_at && (
                      <>
                        <button style={S.mini} disabled={busy} onClick={() => run(() => supabase.rpc('adjust_class_test_attempt', { p_attempt_id: r.attempt_id, p_action: 'extend', p_minutes: 10 }))}>+10 min</button>
                        <button style={S.mini} disabled={busy} onClick={() => {
                          if (!confirm(`End ${r.first_name ?? r.email}'s test now? Their saved answers are kept.`)) return
                          run(() => supabase.rpc('adjust_class_test_attempt', { p_attempt_id: r.attempt_id, p_action: 'submit', p_minutes: null }))
                        }}>End</button>
                      </>
                    )}
                    {r.attempt_id && r.submitted_at && (
                      <button style={S.mini} disabled={busy} onClick={() => {
                        const m = prompt(`Reopen ${r.first_name ?? r.email}'s test. How many minutes from now?`, '15')
                        if (!m) return
                        run(() => supabase.rpc('adjust_class_test_attempt', { p_attempt_id: r.attempt_id, p_action: 'reopen', p_minutes: parseInt(m, 10) }))
                      }}>Reopen…</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={S.sub}>Extra time applies the moment you save it, including to a test already in progress.
        "Cannot sign in" means no linked, verified account for that roster email: fix it before the test.</p>
    </div>
  )
}

function ExtraCell({ row, testId, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [mins, setMins] = useState(String(row.extra_minutes ?? 0))
  const [note, setNote] = useState(row.note ?? '')
  if (!editing) {
    return (
      <button style={S.extraBtn} onClick={() => { setMins(String(row.extra_minutes ?? 0)); setNote(row.note ?? ''); setEditing(true) }}
              title={row.note ?? ''}>
        {row.extra_minutes ? `+${row.extra_minutes}` : '—'}{row.note ? ' ✎' : ''}
      </button>
    )
  }
  const save = async () => {
    const { error } = await supabase.rpc('set_class_test_accommodation',
      { p_test_id: testId, p_email: row.email, p_extra: parseInt(mins, 10) || 0, p_note: note })
    if (error) { alert(error.message); return }
    setEditing(false); onSaved()
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
      <input style={S.miniInput} type="number" min="0" value={mins} onChange={(e) => setMins(e.target.value)} aria-label="extra minutes" />
      <input style={S.miniInput} value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (e.g. AA room)" />
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={S.mini} onClick={save}>Save</button>
        <button style={S.mini} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  )
}

// Blind short-answer grading: one question at a time, responses by sequence
// number, the model answer beside each part, 0 / ½ / 1 per part.
function Grading({ testId, onExit }) {
  const [g, setG] = useState(null)
  const [itemIdx, setItemIdx] = useState(0)
  const load = useCallback(() => {
    supabase.rpc('get_class_test_grading', { p_test_id: testId }).then(({ data, error }) => {
      if (error) { alert(error.message); return }
      setG(data)
    })
  }, [testId])
  useEffect(() => { load() }, [load])
  if (!g) return <p style={S.hint}>Loading responses…</p>
  const item = g.items[itemIdx]
  if (!item) return <p style={S.hint}>No short-answer items. <button style={S.btn} onClick={onExit}>Back</button></p>
  const attempts = g.attempts.filter((a) => a.submitted)
  const setScore = async (a, part, score) => {
    const { error } = await supabase.rpc('set_class_test_grade', { p_attempt_id: a.attempt_id, p_item_id: item.item_id, p_part: part, p_score: score })
    if (error) { alert(error.message); return }
    setG((prev) => ({ ...prev, attempts: prev.attempts.map((x) => x.attempt_id !== a.attempt_id ? x
      : { ...x, grades: { ...x.grades, [`${item.item_id}|${part}`]: score } }) }))
  }
  const parts = item.content.parts
  const graded = attempts.filter((a) => parts.every((p) => a.grades[`${item.item_id}|${p.label}`] != null)).length
  return (
    <div>
      <div style={S.controls}>
        <button style={S.btn} onClick={onExit}>← Back to the roster</button>
        {g.items.map((it, i) => (
          <button key={it.item_id} style={i === itemIdx ? S.primaryBtn : S.btn} onClick={() => setItemIdx(i)}>SA {i + 1}</button>
        ))}
        <span style={S.sub}>{graded}/{attempts.length} fully graded · graded blind by response number</span>
      </div>
      <details style={S.card} open>
        <summary style={S.name}>The question and the model answers</summary>
        <Md text={item.content.stem} style={S.stem} />
        {parts.map((p) => (
          <div key={p.label} style={S.part}>
            <Md text={`**${p.label}.** ${p.prompt}`} style={S.stem} />
            <Md text={item.answer.parts.find((m) => m.label === p.label)?.model_answer} style={S.model} />
          </div>
        ))}
      </details>
      {attempts.map((a) => (
        <div key={a.attempt_id} style={S.card}>
          <p style={S.qNo}>Response #{a.seq}</p>
          {parts.map((p) => {
            const text = a.answers?.[item.item_id]?.parts?.[p.label] ?? ''
            const score = a.grades[`${item.item_id}|${p.label}`]
            return (
              <div key={p.label} style={S.gradeRow}>
                <div style={{ flex: 1 }}>
                  <span style={S.partLabel}>{p.label}.</span>{' '}
                  {text.trim() ? <span style={S.response}>{text}</span> : <em style={S.email}>no answer</em>}
                </div>
                <div style={S.scoreBtns}>
                  {[0, 0.5, 1].map((v) => (
                    <button key={v} style={S.scoreBtn(score === v)} onClick={() => setScore(a, p.label, score === v ? null : v)}>{v === 0.5 ? '½' : v}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Short typed answers are marked by the server (class_test_vsa_auto: exact or
// near-miss match against the accepted list). Staff review the DISTINCT answers,
// not 245 rows: each answer's normal form is shown once with how many gave it and
// the verdict. Accept / reject sets an override on every attempt that typed it
// (class_test_grades part 'A', 1 or 0); "auto" clears the override. Rejected
// answers sort first, since that is where a fair answer the list missed hides.
function TypedReview({ testId, onExit }) {
  const [r, setR] = useState(null)
  const [itemIdx, setItemIdx] = useState(0)
  const [busyKey, setBusyKey] = useState(null)
  const load = useCallback(() => {
    supabase.rpc('get_class_test_vsa_review', { p_test_id: testId }).then(({ data, error }) => {
      if (error) { alert(error.message); return }
      setR(data)
    })
  }, [testId])
  useEffect(() => { load() }, [load])
  if (!r) return <p style={S.hint}>Loading typed answers…</p>
  const item = r.items[itemIdx]
  if (!item) return <p style={S.hint}>No short typed items. <button style={S.btn} onClick={onExit}>Back</button></p>

  // group this item's submitted answers by normal form
  const groups = {}
  for (const a of r.attempts.filter((x) => x.submitted)) {
    const ans = a.answers?.[item.item_id]
    const key = ans?.norm ?? ''
    const g = (groups[key] ??= { key, texts: new Set(), attempts: [], auto: ans?.auto ?? false, overrides: new Set() })
    g.attempts.push(a.attempt_id)
    if (ans?.text?.trim()) g.texts.add(ans.text.trim())
    g.overrides.add(ans?.override ?? null)
  }
  const list = Object.values(groups).map((g) => {
    const ov = g.overrides.size === 1 ? [...g.overrides][0] : 'mixed'
    const mark = ov === 'mixed' ? null : ov == null ? (g.auto ? 1 : 0) : Number(ov)
    return { ...g, ov, mark }
  }).sort((a, b) => (a.mark ?? 0) - (b.mark ?? 0) || b.attempts.length - a.attempts.length)
  const nRight = list.filter((g) => g.mark === 1).reduce((s, g) => s + g.attempts.length, 0)
  const nAll = list.reduce((s, g) => s + g.attempts.length, 0)

  const setAll = async (g, score) => {
    setBusyKey(g.key)
    for (const id of g.attempts) {
      const { error } = await supabase.rpc('set_class_test_grade', { p_attempt_id: id, p_item_id: item.item_id, p_part: 'A', p_score: score })
      if (error) { alert(error.message); break }
    }
    setBusyKey(null)
    load()
  }

  return (
    <div>
      <div style={S.controls}>
        <button style={S.btn} onClick={onExit}>← Back to the roster</button>
        {r.items.map((it, i) => (
          <button key={it.item_id} style={i === itemIdx ? S.primaryBtn : S.btn} onClick={() => setItemIdx(i)}>Typed {i + 1}</button>
        ))}
        <span style={S.sub}>{nRight}/{nAll} marked correct · {list.length} distinct answers · blind</span>
      </div>
      <div style={S.card}>
        <Md text={item.stem} style={S.stem} />
        <p style={S.model}>Accepted: {(item.accepted ?? []).join(' · ')}</p>
        <p style={S.sub}>Marked automatically: an exact match after lowercasing and dropping punctuation, or a near miss
          (1 slip for answers of 5–8 letters, 2 for 9 or more, none for 4 or fewer). Accept or reject applies to everyone who typed that answer.</p>
      </div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr>{['Answer', 'Students', 'Auto', 'Mark', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.key}>
                <td style={S.td}>{g.key ? [...g.texts].slice(0, 4).join(' · ') : <em style={S.email}>no answer</em>}
                  {g.texts.size > 4 && <span style={S.email}> +{g.texts.size - 4} spellings</span>}</td>
                <td style={S.tdMono}>{g.attempts.length}</td>
                <td style={S.tdMono}>{g.auto ? '✓' : '✗'}</td>
                <td style={S.tdMono}>{g.mark == null ? 'mixed' : g.mark === 1 ? '✓ correct' : '✗ wrong'}{g.ov !== null && g.ov !== 'mixed' ? ' (set by staff)' : ''}</td>
                <td style={S.td}>
                  {g.key && <>
                    <button style={S.scoreBtn(g.ov === 1)} disabled={busyKey === g.key} onClick={() => setAll(g, 1)}>accept</button>{' '}
                    <button style={S.scoreBtn(g.ov === 0)} disabled={busyKey === g.key} onClick={() => setAll(g, 0)}>reject</button>{' '}
                    {g.ov !== null && <button style={S.mini} disabled={busyKey === g.key} onClick={() => setAll(g, null)}>auto</button>}
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// One CSV for Quercus: identity, time, MC score, typed score (if any), and (after
// grading) the SA totals.
async function exportCsv(t, rows) {
  const { data: g, error } = await supabase.rpc('get_class_test_grading', { p_test_id: t.id })
  if (error) { alert(error.message); return }
  const saItems = g.items.map((i) => i.item_id)
  const byAttempt = Object.fromEntries(g.attempts.map((a) => [a.attempt_id, a.grades]))
  const saScore = (attemptId, itemId) => {
    const grades = byAttempt[attemptId] ?? {}
    const vals = Object.entries(grades).filter(([k]) => k.startsWith(itemId + '|')).map(([, v]) => Number(v))
    return vals.length ? vals.reduce((s, v) => s + v, 0) : ''
  }
  const typed = (t.vsa_count ?? 0) > 0
  const header = ['Last name', 'First name', 'Student number', 'Email', 'Extra minutes', 'Status', 'Started', 'Submitted',
    'MC correct', ...(typed ? ['Typed correct'] : []), ...saItems.map((_, i) => `SA${i + 1}`), 'Total']
  const lines = rows.filter((r) => r.on_roster).map((r) => {
    const sas = saItems.map((id) => (r.attempt_id ? saScore(r.attempt_id, id) : ''))
    const total = r.attempt_id ? Number(r.mc_correct) + Number(typed ? r.vsa_correct ?? 0 : 0)
      + sas.reduce((s, v) => s + (v === '' ? 0 : Number(v)), 0) : ''
    return [r.last_name, r.first_name, r.student_number, r.email, r.extra_minutes,
      r.attempt_id ? (r.submitted_at ? (r.submit_kind ?? 'submitted') : 'writing') : 'not started',
      r.started_at ?? '', r.submitted_at ?? '', r.attempt_id ? r.mc_correct : '',
      ...(typed ? [r.attempt_id ? r.vsa_correct : ''] : []), ...sas, total]
  })
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const blob = new Blob([[header, ...lines].map((l) => l.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${t.title.replace(/\W+/g, '_')}_results.csv`; a.click()
  URL.revokeObjectURL(url)
}

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }) : ''
const fmtLeft = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left` }
const ago = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago` }

const S = {
  hint: { padding: 40, color: 'var(--tx2)', fontSize: 14, textAlign: 'center' },
  error: { color: '#c04a4a', fontSize: 14 },
  select: { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--bds)', marginBottom: 12, fontFamily: MONO, fontSize: 12 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  h2: { fontFamily: SERIF, fontSize: 24, margin: '0 0 4px', color: 'var(--tx)' },
  sub: { fontSize: 13, color: 'var(--tx3)', margin: 0 },
  status: (s) => ({ fontFamily: MONO, fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
    color: s === 'open' ? '#fff' : 'var(--tx2)', background: s === 'open' ? '#2e7d32' : 'var(--bgc)', border: '1px solid var(--bd)' }),
  controls: { display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', margin: '6px 0 12px' },
  codeLabel: { display: 'flex', flexDirection: 'column', gap: 3, fontFamily: MONO, fontSize: 11, color: 'var(--tx3)' },
  codeInput: { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--bds)', fontFamily: MONO, fontSize: 15, width: 140 },
  btn: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' },
  primaryBtn: { padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--pkd)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  dangerBtn: { padding: '8px 12px', borderRadius: 8, border: '1px solid #c04a4a', background: 'var(--bgc)', color: '#c04a4a', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' },
  counts: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 10px' },
  countPill: (k) => ({ fontFamily: MONO, fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'var(--bgc)', border: '1px solid var(--bd)',
    color: k === 'writing' ? '#1f5c8b' : k === 'cannot sign in' ? '#c04a4a' : k === 'submitted' ? '#2e7d32' : 'var(--tx2)' }),
  tableWrap: { overflowX: 'auto', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bgc)', marginBottom: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap', textTransform: 'uppercase' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top' },
  tdMono: { padding: '8px 10px', borderBottom: '1px solid var(--bd)', verticalAlign: 'top', fontFamily: MONO, fontSize: 12.5, whiteSpace: 'nowrap' },
  offRoster: { opacity: 0.6 },
  name: { fontWeight: 600, color: 'var(--tx)' },
  email: { fontSize: 11.5, color: 'var(--tx3)' },
  warn: { color: '#c04a4a', fontSize: 12.5, fontWeight: 600 },
  pill: (st) => ({ fontFamily: MONO, fontSize: 11.5, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap',
    color: st === 'writing' ? '#fff' : st === 'cannot sign in' ? '#c04a4a' : 'var(--tx)',
    background: st === 'writing' ? '#1f5c8b' : st === 'submitted' ? '#2e7d3222' : st === 'time up' ? '#f3e3c3' : 'transparent',
    border: '1px solid var(--bd)' }),
  left: (ms) => ({ fontFamily: MONO, fontSize: 11.5, marginTop: 3, color: ms < 5 * 60000 ? '#c04a4a' : 'var(--tx3)' }),
  seen: (ms) => ({ color: ms < 60000 ? '#2e7d32' : ms < 300000 ? '#b8760f' : '#c04a4a' }),
  extraBtn: { border: '1px dashed var(--bds)', background: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: MONO, fontSize: 12.5, color: 'var(--tx)' },
  mini: { padding: '4px 8px', borderRadius: 6, border: '1px solid var(--bds)', background: 'var(--bgc)', fontSize: 12, cursor: 'pointer', marginRight: 4, marginBottom: 3, fontFamily: 'inherit' },
  miniInput: { padding: '4px 6px', borderRadius: 6, border: '1px solid var(--bds)', fontSize: 12.5, width: '100%', boxSizing: 'border-box' },
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '14px 16px', margin: '10px 0' },
  qNo: { fontFamily: MONO, fontSize: 11.5, textTransform: 'uppercase', color: 'var(--tx3)', margin: '0 0 6px' },
  stem: { fontSize: 14.5, color: 'var(--tx)', lineHeight: 1.5 },
  part: { marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--bd)' },
  model: { fontSize: 13.5, color: 'var(--tx)', lineHeight: 1.5, background: '#2e7d320d', borderLeft: '3px solid #2e7d32', padding: '6px 10px', borderRadius: '0 8px 8px 0', marginTop: 4 },
  gradeRow: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--bd)' },
  partLabel: { fontFamily: MONO, fontWeight: 700 },
  response: { whiteSpace: 'pre-wrap', lineHeight: 1.5 },
  scoreBtns: { display: 'flex', gap: 4 },
  scoreBtn: (on) => ({ minWidth: 34, padding: '5px 8px', borderRadius: 6, border: `1px solid ${on ? '#2e7d32' : 'var(--bds)'}`,
    background: on ? '#2e7d32' : 'var(--bgc)', color: on ? '#fff' : 'var(--tx)', cursor: 'pointer', fontFamily: MONO, fontSize: 13 }),
}
