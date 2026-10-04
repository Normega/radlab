import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSubmitLock } from '../../lib/useSubmitLock'
import { normalizeCourseCode, loungePath } from '../courseRoutes'
import { AcademicShell } from '../AcademicChrome'
import AvatarMenu from '../fieldguide/AvatarMenu'
import Md from './Md'
import { createSaveChain } from './saveChain'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

// A timed class test (20260928_class_tests.sql). The server owns everything that
// matters: the start time, the deadline (base + accommodation + staff
// extensions, live), the shuffle, and the answer keys, which never reach this
// page. The page only displays, saves every answer the moment it is given, and
// keeps its countdown honest by syncing to the server's clock.
//
// Preview mode (staff, from the console) renders the same screens from the
// staff preview RPC with a local clock and saves nothing.
//
// Up to three sections, each shown only if the test has items in it: multiple
// choice (extended-matching cases arrive together, their option list in a fixed
// order), short typed answers (one or two words, marked automatically: 20261001
// migration), and written short answers (parts A-E, graded by staff).
export default function ClassTest({ session, preview = false, testId: testIdProp, onExit }) {
  const { courseCode, slug: slugParam, testId: testIdParam } = useParams()
  const slug = normalizeCourseCode(courseCode ?? slugParam)
  const testId = testIdProp ?? testIdParam

  const [test, setTest] = useState(undefined)      // undefined = loading, null = unavailable
  const [loadError, setLoadError] = useState(null)
  const [answers, setAnswers] = useState({})       // item_id -> {choice} | {text} | {parts}
  const [saveState, setSaveState] = useState({})   // item_id -> 'saving' | 'saved' | 'error'
  const [tab, setTab] = useState('mc')
  const [offsetMs, setOffsetMs] = useState(0)      // server clock minus local clock
  const [now, setNow] = useState(() => Date.now())
  const [code, setCode] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [startError, setStartError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const start = useSubmitLock('start')
  // Keyed to the attempt's submitted state: a staff reopen clears submitted_at,
  // and the lock held by the earlier successful submit must not survive it.
  const finish = useSubmitLock(`submit:${test?.attempt?.submitted_at ?? 'open'}`)
  const pending = useRef({})                       // item_id -> latest unsaved response
  const timers = useRef({})
  const chain = useRef(null)                       // one save at a time per item (saveChain.js)
  if (chain.current === null) chain.current = createSaveChain()

  const adopt = useCallback((data) => {
    if (data?.server_now) setOffsetMs(new Date(data.server_now).getTime() - Date.now())
    setTest(data)
    if (data?.answers) setAnswers(data.answers)
  }, [])

  // ---- load
  const load = useCallback(async () => {
    if (preview) {
      const { data, error } = await supabase.rpc('get_class_test_preview', { p_test_id: testId })
      if (error) { setLoadError(error.message); setTest(null); return }
      const startedAt = new Date()
      setTest({
        ...data, status: 'open', extra_minutes: 0, preview: true,
        sections: [...new Set(data.items.map((i) => i.section))],
        items: data.items.map((i) => ({ item_id: i.item_id, section: i.section, answer: i.answer, ...i.content })),
        attempt: { started_at: startedAt.toISOString(),
                   deadline: new Date(startedAt.getTime() + data.duration_minutes * 60000).toISOString() },
      })
      return
    }
    const { data, error } = await supabase.rpc('get_class_test', { p_test_id: testId })
    if (error) { setLoadError(error.message); setTest(null); return }
    adopt(data)
  }, [adopt, preview, testId])

  useEffect(() => { load() }, [load])

  // ---- clock: tick every second; ping the server every 30 s for extensions / staff submit
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const live = test?.attempt && !test.attempt.submitted_at
  useEffect(() => {
    if (!live || preview) return
    const t = setInterval(async () => {
      const { data } = await supabase.rpc('ping_class_test', { p_test_id: testId })
      if (!data) return
      setOffsetMs(new Date(data.server_now).getTime() - Date.now())
      setTest((prev) => ({ ...prev, attempt: data, ...(data.submitted_at ? { items: null } : {}) }))
    }, 30000)
    return () => clearInterval(t)
  }, [live, preview, testId])

  const deadlineMs = test?.attempt ? new Date(test.attempt.deadline).getTime() : null
  const remainingMs = deadlineMs == null ? null : deadlineMs - (now + offsetMs)

  // ---- saving: MC immediately, short answers debounced; failures retry.
  //
  // save() resolves true once the item's latest answer is on the server, false
  // if it is not. Saves of one item run one at a time, each sending the latest
  // answer: the server keeps the last write, so two overlapping requests (tap B,
  // then C 300 ms later) could commit out of order and grade B while C showed
  // as saved. Submit waits on the result: it used to submit anyway after a
  // failed save, losing that answer while the page said everything was saved.
  const saveOnce = useCallback(async (itemId) => {
    const response = pending.current[itemId]
    if (!response) return true
    if (preview) { delete pending.current[itemId]; setSaveState((s) => ({ ...s, [itemId]: 'saved' })); return true }
    setSaveState((s) => ({ ...s, [itemId]: 'saving' }))
    const { data, error } = await supabase.rpc('save_class_test_answer',
      { p_test_id: testId, p_item_id: itemId, p_response: response })
    if (error) {
      setSaveState((s) => ({ ...s, [itemId]: 'error' }))
      if (/submitted|Time is up/i.test(error.message)) { load(); return false }
      clearTimeout(timers.current[itemId])
      timers.current[itemId] = setTimeout(() => saveRef.current(itemId), 4000)   // network blip: try again
      return false
    }
    if (pending.current[itemId] === response) delete pending.current[itemId]
    setSaveState((s) => ({ ...s, [itemId]: pending.current[itemId] ? 'saving' : 'saved' }))
    setOffsetMs(new Date(data.server_now).getTime() - Date.now())
    setTest((prev) => ({ ...prev, attempt: { ...prev.attempt, deadline: data.deadline } }))
    // Changed again while this request was out: the next save in the chain
    // (queued by that change) sends it.
    return !pending.current[itemId] || pending.current[itemId] === response
  }, [load, preview, testId])

  const save = useCallback((itemId) => chain.current.run(itemId, () => saveOnce(itemId)), [saveOnce])
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save }, [save])

  // Every unsaved answer, saved now. True only if all of them reached the server.
  const saveAll = useCallback(async () => {
    const results = await Promise.all(Object.keys(pending.current).map((id) => save(id)))
    return results.every(Boolean) && Object.keys(pending.current).length === 0
  }, [save])

  const answer = (itemId, response, debounceMs = 0) => {
    setAnswers((a) => ({ ...a, [itemId]: response }))
    pending.current[itemId] = response
    clearTimeout(timers.current[itemId])
    if (debounceMs) timers.current[itemId] = setTimeout(() => save(itemId), debounceMs)
    else save(itemId)
  }

  // warn before leaving with unsaved answers
  useEffect(() => {
    const h = (e) => { if (Object.keys(pending.current).length) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  // ---- time up: submit (the server finalizes anyway; this just ends the page)
  const timeUp = remainingMs != null && remainingMs <= 0 && live
  useEffect(() => {
    if (!timeUp) return
    if (preview) { setTest((p) => ({ ...p, attempt: { ...p.attempt, submitted_at: new Date().toISOString() } })); return }
    finish.submit(async () => {
      // A staff extension can land between the 30 s pings: ask the server for
      // the current deadline first, and carry on if time was added.
      const { data: ping } = await supabase.rpc('ping_class_test', { p_test_id: testId })
      if (ping && !ping.submitted_at && new Date(ping.deadline).getTime() > new Date(ping.server_now).getTime()) {
        setOffsetMs(new Date(ping.server_now).getTime() - Date.now())
        setTest((p) => ({ ...p, attempt: ping }))
        throw new Error('extended')   // releases the lock for the new deadline
      }
      // Time is up either way: save what can be saved, then submit (the server
      // finalizes at the deadline regardless).
      await saveAll()
      const { data, error } = await supabase.rpc('submit_class_test', { p_test_id: testId })
      if (error) throw error
      setTest((p) => ({ ...p, attempt: data, items: null }))
    }).catch((e) => { if (e?.message !== 'extended') load() })
  }, [timeUp]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => test?.items ?? [], [test])
  const isAnswered = (i) => {
    const a = answers[i.item_id]
    if (!a) return false
    if (i.section === 'mc') return typeof a.choice === 'number'
    if (i.section === 'vsa') return Boolean(String(a.text ?? '').trim())
    return Object.values(a.parts ?? {}).some((t) => String(t).trim())
  }
  // the sections this test actually has, in the order students meet them
  const sections = SECTIONS
    .map((s) => ({ ...s, items: items.filter((i) => i.section === s.key) }))
    .filter((s) => s.items.length)
    .map((s) => ({ ...s, done: s.items.filter(isAnswered).length }))

  // ---------------------------------------------------------------- render
  const shell = (children) => preview ? (
    <div style={S.previewFrame}>
      <div style={S.previewBar}>
        <strong>Preview</strong>, nothing is saved.
        <label style={{ marginLeft: 12 }}><input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} /> show answers</label>
        {onExit && <button style={S.linkBtn} onClick={onExit}>Close preview</button>}
      </div>
      <div style={S.wrap}>{children}</div>
    </div>
  ) : (
    <AcademicShell courseCode={slug} homeTo={loungePath(slug)}
                   menu={session ? <AvatarMenu email={session.user.email} courseCode={slug} /> : null}>
      <div style={S.wrap}>{children}</div>
    </AcademicShell>
  )

  if (test === undefined) return shell(<p style={S.sub}>Loading…</p>)
  if (test === null) return shell(<><h1 style={S.title}>This test isn't available.</h1><p style={S.sub}>{loadError}</p></>)

  const minutes = test.duration_minutes + (test.extra_minutes ?? 0)

  // submitted
  if (test.attempt?.submitted_at) {
    return shell(
      <div style={S.center}>
        <p style={S.eyebrow}>{test.title}</p>
        <h1 style={S.title}>Submitted.</h1>
        <p style={S.sub}>
          Your test was {test.attempt.submit_kind === 'auto' ? 'submitted automatically when time ran out' : 'submitted'} at{' '}
          <strong>{fmtTime(test.attempt.submitted_at)}</strong>. Every answer you gave was saved as you went.
          You can close this page.
        </p>
        {!preview && <Link to={loungePath(slug)} style={S.link}>Back to the class →</Link>}
      </div>,
    )
  }

  // not started
  if (!test.attempt) {
    const open = test.status === 'open'
    return shell(
      <div style={S.startCard}>
        <p style={S.eyebrow}>Term test</p>
        <h1 style={S.title}>{test.title}</h1>
        {!open ? (
          <p style={S.sub}>{test.status === 'closed' ? 'This test is closed.' : 'This test is not open yet. Your instructor will open it at the start of the test.'}</p>
        ) : (
          <>
            <ul style={S.facts}>
              <li><strong>{minutes} minutes</strong>{test.extra_minutes ? ` (including your ${test.extra_minutes} extra minutes)` : ''}. The timer starts when you press Start and keeps running if you close the page.</li>
              <li><strong>{test.item_count} questions</strong>{sectionList(test.sections)}. You can move between them and change answers until you submit.</li>
              <li>Every answer saves automatically. At the end of your time the test submits itself.</li>
              <li>One attempt. Closed book.</li>
            </ul>
            <label style={S.agree}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I confirm that my conduct during this test adheres to the Code of Behaviour on Academic Matters. I will not use unauthorized aids or assistance, impersonate another person, or commit plagiarism.</span>
            </label>
            {test.code_required && (
              <input style={S.codeInput} value={code} onChange={(e) => setCode(e.target.value)}
                     placeholder="Access code (on the board)" autoCapitalize="characters" />
            )}
            {startError && <p style={S.error}>{startError}</p>}
            <button style={S.primaryBtn} disabled={!agreed || (test.code_required && !code.trim()) || start.busy}
              onClick={() => start.submit(async () => {
                setStartError(null)
                const { data, error } = await supabase.rpc('start_class_test', { p_test_id: testId, p_code: code })
                if (error) { setStartError(error.message); throw error }
                adopt(data)
              }).catch(() => {})}>
              {start.busy ? 'Starting…' : 'Start the test'}
            </button>
          </>
        )}
        {!preview && <p style={{ marginTop: 18 }}><Link to={loungePath(slug)} style={S.link}>← back to class</Link></p>}
      </div>,
    )
  }

  // in progress
  const unsaved = Object.values(saveState).some((s) => s === 'saving' || s === 'error')
  const errored = Object.values(saveState).some((s) => s === 'error')
  const low = remainingMs != null && remainingMs < 5 * 60000
  const current = sections.find((s) => s.key === tab) ?? sections[0]
  const shown = current?.items ?? []
  const at = sections.indexOf(current)
  const go = (s) => { setTab(s.key); window.scrollTo(0, 0) }
  const missing = sections.some((s) => s.done < s.items.length)

  return shell(
    <>
      <div style={S.bar}>
        <span style={S.barTitle}>{test.title}</span>
        <span style={S.clock(low)} aria-live="polite">{fmtRemaining(remainingMs)}</span>
        <span style={S.saveNote(errored)}>{errored ? 'Not saved: reconnecting…' : unsaved ? 'Saving…' : 'All answers saved'}</span>
      </div>

      <div style={S.tabs}>
        {sections.map((s) => (
          <button key={s.key} style={S.tabBtn(s === current)} onClick={() => setTab(s.key)}>{s.tab} · {s.done}/{s.items.length}</button>
        ))}
      </div>
      {current?.key === 'vsa' && (
        <p style={S.sub}>Type the exact term: one or two words, as the question says. Spelling is not marked. If you half-remember it, write your best attempt.</p>
      )}

      {shown.map((item, idx) => (
        <div key={item.item_id} style={S.card} id={`q-${item.item_id}`}>
          <p style={S.qNo}>{item.section === 'mc' ? `Question ${idx + 1} of ${shown.length}`
            : item.section === 'vsa' ? `Short typed ${idx + 1} of ${shown.length} · 1 mark`
            : `Short answer ${idx + 1} of ${shown.length} · ${item.parts.length} marks`}
            {saveState[item.item_id] === 'saved' && <span style={S.savedTag}> · saved</span>}</p>
          <Md text={item.stem} style={S.stem} />
          {item.section === 'mc' ? (
            <div style={S.optionCol} role="radiogroup">
              {item.options.map((opt, i) => {
                const picked = answers[item.item_id]?.choice === i
                const isKey = showKey && item.answer?.key === i
                return (
                  <button key={i} role="radio" aria-checked={picked} style={S.option(picked, isKey)}
                          onClick={() => answer(item.item_id, { choice: i })}>
                    <span style={S.letter}>{'ABCDEFGHIJ'[i]}</span>{opt}
                  </button>
                )
              })}
            </div>
          ) : item.section === 'vsa' ? (
            <>
              <input style={S.typed} value={answers[item.item_id]?.text ?? ''} maxLength={300}
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                aria-label={`Answer to short typed question ${idx + 1}`} placeholder="Your answer"
                onChange={(e) => answer(item.item_id, { text: e.target.value }, 1200)}
                onBlur={() => { if (pending.current[item.item_id]) { clearTimeout(timers.current[item.item_id]); save(item.item_id) } }} />
              {showKey && <p style={S.model}>Accepted: {(item.answer?.accepted ?? []).join(' · ')}</p>}
            </>
          ) : (
            item.parts.map((p) => {
              const text = answers[item.item_id]?.parts?.[p.label] ?? ''
              const model = showKey ? item.answer?.parts?.find((m) => m.label === p.label)?.model_answer : null
              return (
                <div key={p.label} style={S.part}>
                  <Md text={`**${p.label}.** ${p.prompt}`} style={S.partPrompt} />
                  <textarea style={S.textarea} rows={4} value={text}
                    onChange={(e) => answer(item.item_id,
                      { parts: { ...(answers[item.item_id]?.parts ?? {}), [p.label]: e.target.value } }, 1200)}
                    onBlur={() => { if (pending.current[item.item_id]) { clearTimeout(timers.current[item.item_id]); save(item.item_id) } }} />
                  {model && <Md text={model} style={S.model} />}
                </div>
              )
            })
          )}
        </div>
      ))}

      <div style={S.footer}>
        {at > 0 ? <button style={S.secondaryBtn} onClick={() => go(sections[at - 1])}>← Back to {sections[at - 1].tab.toLowerCase()}</button> : <span />}
        {at < sections.length - 1 && <button style={S.secondaryBtn} onClick={() => go(sections[at + 1])}>Go to {sections[at + 1].tab.toLowerCase()} →</button>}
        <button style={S.primaryBtn} onClick={() => setConfirming(true)}>Submit test</button>
      </div>

      {confirming && (
        <div style={S.overlay} role="dialog" aria-modal="true">
          <div style={S.dialog}>
            <h2 style={S.dialogTitle}>Submit your test?</h2>
            <p style={S.sub}>
              You have answered {sections.map((s, i) => (
                <span key={s.key}>{i === 0 ? '' : i === sections.length - 1 ? ' and ' : ', '}<strong>{s.done} of {s.items.length}</strong> {s.noun}</span>
              ))} questions.
              {missing ? ' Unanswered questions will score zero.' : ''} After you submit you can't change anything.
            </p>
            {submitError && (
              <p role="alert" style={{ margin: '0 0 16px', padding: '8px 16px', borderRadius: 12, fontSize: 14,
                background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
                {submitError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={S.secondaryBtn} onClick={() => { setConfirming(false); setSubmitError(null) }}>Keep working</button>
              <button style={S.primaryBtn} disabled={finish.busy}
                onClick={() => finish.submit(async () => {
                  setSubmitError(null)
                  if (preview) { setTest((p) => ({ ...p, attempt: { ...p.attempt, submitted_at: new Date().toISOString() } })); return }
                  // Never submit over an answer that is not on the server.
                  if (!(await saveAll())) {
                    throw new Error("Some answers haven't saved yet, so the test was not submitted. Check your connection and press Submit again.")
                  }
                  const { data, error } = await supabase.rpc('submit_class_test', { p_test_id: testId })
                  if (error) throw error
                  setConfirming(false)
                  setTest((p) => ({ ...p, attempt: data, items: null }))
                }).catch((e) => setSubmitError(e?.message ?? 'The test could not be submitted. Press Submit again.'))}>
                {finish.busy ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
  )
}

const SECTIONS = [
  { key: 'mc', tab: 'Multiple choice', noun: 'multiple-choice', list: 'multiple choice' },
  { key: 'vsa', tab: 'Short typed', noun: 'short typed', list: 'short typed answers' },
  { key: 'sa', tab: 'Short answer', noun: 'short-answer', list: 'short answer' },
]

// ": multiple choice, then short answer", named from the sections the test has.
function sectionList(present) {
  const names = SECTIONS.filter((s) => present?.includes(s.key)).map((s) => s.list)
  return names.length ? `: ${names.join(', then ')}` : ''
}

function fmtRemaining(ms) {
  if (ms == null) return ''
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')} left`
}
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' })

const S = {
  wrap: { maxWidth: 760, margin: '0 auto', padding: '20px 16px 80px' },
  previewFrame: { background: 'var(--bg)', minHeight: '100vh' },
  previewBar: { position: 'sticky', top: 0, zIndex: 5, background: '#fdf2e5', borderBottom: '1px solid #e8c9a0', padding: '8px 16px', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  center: { textAlign: 'center', padding: '60px 0' },
  startCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14, padding: '24px 22px', marginTop: 20 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pkd)', margin: '0 0 8px' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '0 0 10px', lineHeight: 1.2 },
  sub: { fontSize: 15, color: 'var(--tx2)', lineHeight: 1.55 },
  facts: { fontSize: 15, color: 'var(--tx)', lineHeight: 1.6, paddingLeft: 20, margin: '10px 0 16px' },
  agree: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: 'var(--tx2)', lineHeight: 1.5, margin: '0 0 14px', cursor: 'pointer' },
  codeInput: { display: 'block', width: '100%', maxWidth: 320, padding: '11px 12px', borderRadius: 10, border: '1px solid var(--bds)', fontSize: 16, fontFamily: MONO, marginBottom: 12, boxSizing: 'border-box' },
  error: { color: '#c04a4a', fontSize: 14, margin: '0 0 10px' },
  primaryBtn: { padding: '11px 20px', borderRadius: 10, border: 'none', background: 'var(--pkd)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  secondaryBtn: { padding: '11px 18px', borderRadius: 10, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' },
  linkBtn: { border: 'none', background: 'none', color: 'var(--pkd)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, marginLeft: 'auto' },
  link: { color: 'var(--pkd)', fontSize: 14 },
  bar: { position: 'sticky', top: 0, zIndex: 4, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '10px 14px', margin: '0 0 12px' },
  barTitle: { fontWeight: 600, fontSize: 14.5, color: 'var(--tx)', marginRight: 'auto' },
  clock: (low) => ({ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: low ? '#c04a4a' : 'var(--tx)' }),
  saveNote: (err) => ({ fontFamily: MONO, fontSize: 12, color: err ? '#c04a4a' : '#2e7d32' }),
  tabs: { display: 'flex', gap: 6, margin: '0 0 8px', borderBottom: '1px solid var(--bd)' },
  tabBtn: (active) => ({ padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 12.5, color: active ? 'var(--pkd)' : 'var(--tx3)', borderBottom: active ? '2px solid var(--pk)' : '2px solid transparent', marginBottom: -1 }),
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 14, padding: '16px 18px', margin: '12px 0' },
  qNo: { fontFamily: MONO, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', margin: '0 0 8px' },
  savedTag: { color: '#2e7d32', textTransform: 'none', letterSpacing: 0 },
  stem: { fontSize: 15.5, color: 'var(--tx)', lineHeight: 1.55, marginBottom: 10 },
  optionCol: { display: 'flex', flexDirection: 'column', gap: 8 },
  option: (picked, isKey) => ({
    display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '11px 14px', borderRadius: 10,
    fontSize: 15, lineHeight: 1.45, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--tx)',
    border: `1.5px solid ${picked ? 'var(--pk)' : isKey ? '#2e7d32' : 'var(--bds)'}`,
    background: picked ? 'color-mix(in srgb, var(--pk) 10%, transparent)' : isKey ? '#2e7d3211' : 'transparent',
  }),
  letter: { fontFamily: MONO, fontWeight: 700, color: 'var(--tx3)', minWidth: 16 },
  part: { margin: '14px 0 0', paddingTop: 10, borderTop: '1px dashed var(--bd)' },
  partPrompt: { fontSize: 15, color: 'var(--tx)', lineHeight: 1.5 },
  typed: { width: '100%', maxWidth: 420, boxSizing: 'border-box', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--bds)', fontFamily: 'inherit', fontSize: 16, marginTop: 4 },
  textarea: { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid var(--bds)', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.5, marginTop: 6, resize: 'vertical' },
  model: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.5, background: '#2e7d320d', borderLeft: '3px solid #2e7d32', padding: '8px 12px', borderRadius: '0 8px 8px 0', marginTop: 6 },
  footer: { display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 10 },
  dialog: { background: 'var(--bgc)', borderRadius: 14, padding: '20px 22px', maxWidth: 460, width: '100%' },
  dialogTitle: { fontFamily: SERIF, fontSize: 22, margin: '0 0 8px', color: 'var(--tx)' },
}
