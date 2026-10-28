import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeCourseCode, loungePath } from '../courseRoutes'
import { AcademicShell } from '../AcademicChrome'
import AvatarMenu from '../fieldguide/AvatarMenu'
import Md from './Md'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const LETTERS = 'ABCDEFGHIJ'

// A student walks back through their own class test (get_class_test_review,
// 20261026_class_test_review.sql), one question at a time: multiple choice shows
// their pick against the key with the key's rationale; short typed shows what they
// typed, the accepted answers and the rationale; short answer shows each part's
// response, mark and the grader's comment. The server returns nothing until staff
// release results, and only ever the caller's own attempt.
//
// Items come in the answer key's order with options unshuffled, so a student's
// numbering differs from the order they wrote in: some rationales name options by
// letter, and those letters are the key's.
//
// Staff open it from the console's Test tab with an attempt id (preview), released
// or not, to see exactly what that student will see.
export default function TestReview({ session, testId: testIdProp, attemptId = null, studentLabel, onExit }) {
  const { courseCode, testId: testIdParam } = useParams()
  const slug = normalizeCourseCode(courseCode)
  const testId = testIdProp ?? testIdParam
  const preview = Boolean(attemptId)

  const [r, setR] = useState(undefined)            // undefined = loading, null = error
  const [loadError, setLoadError] = useState(null)
  const [tab, setTab] = useState(null)
  const [missedOnly, setMissedOnly] = useState(false)
  const [idx, setIdx] = useState(0)
  const [openWhy, setOpenWhy] = useState({})        // item_id -> true when a right answer's "why" is opened

  useEffect(() => {
    supabase.rpc('get_class_test_review', { p_test_id: testId, p_attempt_id: attemptId }).then(({ data, error }) => {
      if (error) { setLoadError(error.message); setR(null); return }
      setR(data)
    })
  }, [testId, attemptId])

  const items = useMemo(() => r?.items ?? [], [r])
  const sections = useMemo(() => SECTIONS
    .map((s) => ({ ...s, items: items.filter((i) => i.section === s.key) }))
    .filter((s) => s.items.length), [items])
  const current = sections.find((s) => s.key === tab) ?? sections[0]
  const shown = useMemo(() => (current?.items ?? []).filter((i) => !missedOnly || missed(i)), [current, missedOnly])
  const item = shown[Math.min(idx, shown.length - 1)]
  const at = item ? shown.indexOf(item) : 0

  const go = useCallback((n) => { setIdx(Math.max(0, Math.min(shown.length - 1, n))) }, [shown.length])
  useEffect(() => {
    const h = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'ArrowRight') go(at + 1)
      if (e.key === 'ArrowLeft') go(at - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [at, go])

  const shell = (children) => preview ? (
    <div style={S.previewFrame}>
      <div style={S.previewBar}>
        <span><strong>Staff preview:</strong> {studentLabel ? `${studentLabel}'s` : 'this student\'s'} review, exactly as they will see it.
          {r?.released_at ? ' Results are released.' : ' Students can\'t see it until you release results.'}</span>
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

  if (r === undefined) return shell(<p style={S.sub}>Loading your test…</p>)
  if (r === null) return shell(<><h1 style={S.title}>This review isn't available.</h1><p style={S.sub}>{loadError}</p></>)
  if (!r.available) {
    return shell(
      <div style={S.card}>
        <p style={S.eyebrow}>{r.title}</p>
        <h1 style={S.title}>Not ready yet.</h1>
        <p style={S.sub}>Your test review opens once your instructor releases the results. It shows only your own test.</p>
        <Link to={loungePath(slug)} style={S.link}>← back to class</Link>
      </div>,
    )
  }

  // ---- totals
  const mcItems = items.filter((i) => i.section === 'mc')
  const vsaItems = items.filter((i) => i.section === 'vsa')
  const saParts = items.filter((i) => i.section === 'sa').flatMap((i) => i.parts ?? [])
  const saScore = saParts.reduce((s, p) => s + (p.score == null ? 0 : Number(p.score)), 0)
  const total = r.mc_correct + r.vsa_correct + saScore
  const outOf = mcItems.length + vsaItems.length + saParts.length

  const switchTab = (key) => { setTab(key); setIdx(0); window.scrollTo(0, 0) }
  const nextSection = sections[sections.indexOf(current) + 1]
  const lastHere = at === shown.length - 1
  const toggleMissed = () => { setMissedOnly((m) => !m); setIdx(0) }

  return shell(
    <>
      <div style={S.summary}>
        <p style={S.eyebrow}>{r.title} · your test</p>
        <h1 style={S.title}>{fmt(total)} / {outOf}</h1>
        <p style={S.sub}>
          Multiple choice {r.mc_correct}/{mcItems.length}
          {vsaItems.length ? ` · short typed ${r.vsa_correct}/${vsaItems.length}` : ''}
          {saParts.length ? ` · short answer ${fmt(saScore)}/${saParts.length}` : ''}
        </p>
        <p style={S.note}>Questions are in the answer key's order, so the numbers may not match the order you saw them in.
          The option letters are the key's too.</p>
      </div>

      <div style={S.tabs}>
        {sections.map((s) => {
          const nMissed = s.items.filter(missed).length
          return (
            <button key={s.key} style={S.tabBtn(s === current)} onClick={() => switchTab(s.key)}>
              {s.tab} · {nMissed ? `${nMissed} to review` : 'all right'}
            </button>
          )
        })}
      </div>

      <div style={S.toolbar}>
        <label style={S.toggle}>
          <input type="checkbox" checked={missedOnly} onChange={toggleMissed} />
          Only the ones I missed
        </label>
      </div>

      {!shown.length ? (
        <div style={S.card}><p style={S.sub}>Nothing missed in this section. Nice work.</p></div>
      ) : (
        <>
          <div style={S.strip} role="navigation" aria-label="Questions">
            {shown.map((i, n) => (
              <button key={i.item_id} style={S.chip(i === item, chipState(i))} onClick={() => go(n)}
                      aria-current={i === item ? 'true' : undefined}
                      aria-label={`${current.unit} ${current.items.indexOf(i) + 1}, ${chipState(i) === 'right' ? 'correct' : chipState(i) === 'part' ? 'part marks' : 'missed'}`}>
                {current.items.indexOf(i) + 1}
              </button>
            ))}
          </div>

          <div style={S.card}>
            <p style={S.qNo}>{current.unit} {current.items.indexOf(item) + 1} of {current.items.length}
              {item.section === 'sa' ? ` · ${fmt(partsScore(item))}/${item.parts.length}` : ''}</p>
            <Md text={item.stem} style={S.stem} />
            {item.section === 'mc' && <McReview item={item} why={openWhy[item.item_id]} onWhy={() => setOpenWhy((w) => ({ ...w, [item.item_id]: !w[item.item_id] }))} />}
            {item.section === 'vsa' && <VsaReview item={item} why={openWhy[item.item_id]} onWhy={() => setOpenWhy((w) => ({ ...w, [item.item_id]: !w[item.item_id] }))} />}
            {item.section === 'sa' && <SaReview item={item} />}
          </div>

          <div style={S.footer}>
            <button style={S.secondaryBtn(at === 0)} disabled={at === 0} onClick={() => go(at - 1)}>← Previous</button>
            <span style={S.sub}>{at + 1} of {shown.length}</span>
            {lastHere && nextSection
              ? <button style={S.primaryBtn(false)} onClick={() => switchTab(nextSection.key)}>{nextSection.tab} →</button>
              : <button style={S.primaryBtn(lastHere)} disabled={lastHere} onClick={() => go(at + 1)}>Next →</button>}
          </div>
        </>
      )}

      {!preview && <p style={{ marginTop: 24 }}><Link to={loungePath(slug)} style={S.link}>← back to class</Link></p>}
    </>,
  )
}

function McReview({ item, why, onWhy }) {
  const keyLetter = LETTERS[item.key]
  const answered = typeof item.choice === 'number'
  const verdict = item.credit_all
    ? 'Everyone received credit for this question.'
    : item.correct ? '✓ You got this one.'
    : answered ? `✗ You chose ${LETTERS[item.choice]}. The answer is ${keyLetter}.`
    : `You didn't answer this one. The answer is ${keyLetter}.`
  const showWhy = !item.correct || item.credit_all || why
  return (
    <>
      <div style={S.optionCol}>
        {item.options.map((opt, i) => {
          const isKey = i === item.key
          const picked = i === item.choice
          const wrongPick = picked && !isKey && !item.credit_all
          return (
            <div key={i} style={S.option(isKey, wrongPick)}>
              <span style={S.letter}>{LETTERS[i]}</span>
              <span style={{ flex: 1 }}>{opt}</span>
              {(isKey || picked) && (
                <span style={S.optTag(!wrongPick)}>{isKey && picked ? '✓ your answer' : isKey ? '✓ answer'
                  : wrongPick ? '✗ your answer' : '✓ your answer, credited'}</span>
              )}
            </div>
          )
        })}
      </div>
      <p style={S.verdict(item.correct)}>{verdict}</p>
      {showWhy && item.rationale
        ? <Why title={`Why ${keyLetter} is the best answer`} text={item.rationale} />
        : item.rationale && <button style={S.whyBtn} onClick={onWhy}>Why {keyLetter}?</button>}
      {why && item.correct && !item.credit_all && <button style={S.whyBtn} onClick={onWhy}>Hide</button>}
    </>
  )
}

function VsaReview({ item, why, onWhy }) {
  const typed = (item.text ?? '').trim()
  const showWhy = !item.correct || why
  return (
    <>
      <div style={S.typedRow(item.correct)}>
        <span style={S.label}>Your answer</span>
        <span style={{ flex: 1 }}>{typed || <em>no answer</em>}</span>
        <span style={S.optTag(item.correct)}>{item.correct ? '✓ correct' : '✗ not accepted'}</span>
      </div>
      <p style={S.sub}><span style={S.label}>Accepted</span> {item.accepted.join(' · ')}</p>
      {showWhy && item.rationale
        ? <Why title="Why" text={item.rationale} />
        : item.rationale && <button style={S.whyBtn} onClick={onWhy}>Why?</button>}
      {why && item.correct && <button style={S.whyBtn} onClick={onWhy}>Hide</button>}
    </>
  )
}

function SaReview({ item }) {
  return item.parts.map((p) => (
    <div key={p.label} style={S.part}>
      <Md text={`**${p.label}.** ${p.prompt}`} style={S.partPrompt} />
      <p style={S.label}>Your answer</p>
      <p style={S.response}>{p.answer?.trim() || <em>No answer.</em>}</p>
      <div style={S.comment(p.score != null && Number(p.score) >= 1)}>
        <span style={S.mark}>{fmt(p.score)}/1</span>
        <span style={{ flex: 1 }}>{p.feedback || (p.score == null ? 'Not graded yet.' : 'No comment.')}</span>
      </div>
    </div>
  ))
}

function Why({ title, text }) {
  return (
    <div style={S.why}>
      <p style={S.whyTitle}>{title}</p>
      <Md text={text} style={S.whyText} />
    </div>
  )
}

const SECTIONS = [
  { key: 'mc', tab: 'Multiple choice', unit: 'Question' },
  { key: 'vsa', tab: 'Short typed', unit: 'Short typed' },
  { key: 'sa', tab: 'Short answer', unit: 'Short answer' },
]

const partsScore = (i) => (i.parts ?? []).reduce((s, p) => s + (p.score == null ? 0 : Number(p.score)), 0)
function missed(i) {
  if (i.section === 'sa') return (i.parts ?? []).some((p) => p.score == null || Number(p.score) < 1)
  return !i.correct
}
function chipState(i) {
  if (i.section !== 'sa') return i.correct ? 'right' : 'wrong'
  const s = partsScore(i)
  return s >= i.parts.length ? 'right' : s > 0 ? 'part' : 'wrong'
}
const fmt = (v) => {
  if (v == null) return '–'
  const n = Number(v)
  const whole = Math.floor(n)
  return n - whole === 0.5 ? `${whole || ''}½` : String(n)
}

const S = {
  wrap: { maxWidth: 760, margin: '0 auto', padding: '16px 16px 64px' },
  previewFrame: { background: 'var(--bg)', minHeight: '100vh' },
  previewBar: { position: 'sticky', top: 0, zIndex: 5, background: 'var(--pkb)', borderBottom: '1px solid var(--pkbs)', padding: '8px 16px', fontSize: 14, color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  summary: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 24px', margin: '0 0 16px' },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pkd)', margin: '0 0 8px' },
  title: { fontFamily: SERIF, fontSize: 28, color: 'var(--tx)', margin: '0 0 8px', lineHeight: 1.2 },
  sub: { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.55, margin: '8px 0' },
  note: { fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, margin: '8px 0 0' },
  link: { color: 'var(--pkd)', fontSize: 14 },
  linkBtn: { border: 'none', background: 'none', color: 'var(--pkd)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, marginLeft: 'auto' },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 8px', borderBottom: '1px solid var(--bd)' },
  tabBtn: (active) => ({ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 12, color: active ? 'var(--pkd)' : 'var(--tx2)', borderBottom: active ? '2px solid var(--pk)' : '2px solid transparent', marginBottom: -1 }),
  toolbar: { display: 'flex', alignItems: 'center', gap: 16, margin: '8px 0' },
  toggle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--tx)', cursor: 'pointer' },
  strip: { display: 'flex', flexWrap: 'wrap', gap: 4, margin: '8px 0 0' },
  chip: (active, state) => ({
    minWidth: 32, height: 32, padding: '0 8px', borderRadius: 24, cursor: 'pointer', fontFamily: MONO, fontSize: 12,
    border: `${active ? 2 : 1}px solid ${active ? 'var(--tx)' : state === 'right' ? 'var(--pkd)' : state === 'part' ? 'var(--bds)' : 'var(--err-bd)'}`,
    background: state === 'right' ? 'var(--pkb)' : state === 'part' ? 'var(--bgc)' : 'var(--err-bg)',
    color: state === 'wrong' ? 'var(--err-tx)' : 'var(--tx)',
  }),
  card: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 24px', margin: '16px 0' },
  qNo: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx2)', margin: '0 0 8px' },
  stem: { fontSize: 16, color: 'var(--tx)', lineHeight: 1.55, marginBottom: 16 },
  optionCol: { display: 'flex', flexDirection: 'column', gap: 8 },
  option: (isKey, wrongPick) => ({
    display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 16px', borderRadius: 12, fontSize: 14, lineHeight: 1.5, color: 'var(--tx)',
    border: `${isKey || wrongPick ? 2 : 1}px solid ${isKey ? 'var(--pkd)' : wrongPick ? 'var(--err-bd)' : 'var(--bds)'}`,
    background: isKey ? 'var(--pkb)' : wrongPick ? 'var(--err-bg)' : 'transparent',
  }),
  letter: { fontFamily: MONO, fontWeight: 700, color: 'var(--tx2)', minWidth: 16 },
  optTag: (good) => ({ fontFamily: MONO, fontSize: 12, whiteSpace: 'nowrap', color: good ? 'var(--pkd)' : 'var(--err-tx)', fontWeight: 700 }),
  verdict: (good) => ({ fontSize: 16, fontWeight: 600, color: good ? 'var(--pkd)' : 'var(--err-tx)', margin: '16px 0 8px' }),
  why: { background: 'var(--bg)', border: '1px solid var(--bd)', borderLeft: '4px solid var(--pk)', borderRadius: 12, padding: '8px 16px', margin: '8px 0 0' },
  whyTitle: { fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pkd)', margin: '8px 0' },
  whyText: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.6 },
  whyBtn: { padding: '4px 16px', borderRadius: 24, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8, marginRight: 8 },
  typedRow: (good) => ({ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 16px', borderRadius: 12, fontSize: 16, color: 'var(--tx)',
    border: `2px solid ${good ? 'var(--pkd)' : 'var(--err-bd)'}`, background: good ? 'var(--pkb)' : 'var(--err-bg)' }),
  label: { fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--tx2)', margin: '8px 8px 4px 0' },
  part: { margin: '16px 0 0', paddingTop: 16, borderTop: '1px dashed var(--bd)' },
  partPrompt: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.5, fontWeight: 600 },
  response: { fontSize: 14, color: 'var(--tx)', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg)', borderRadius: 12, padding: '8px 16px', margin: '4px 0 8px' },
  comment: (full) => ({ display: 'flex', gap: 16, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5, color: 'var(--tx)', borderRadius: 12, padding: '8px 16px',
    border: `1px solid ${full ? 'var(--pkbs)' : 'var(--bds)'}`, background: full ? 'var(--pkb)' : 'var(--bgc)' }),
  mark: { fontFamily: MONO, fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 16 },
  primaryBtn: (off) => ({ padding: '8px 24px', borderRadius: 24, border: 'none', background: 'var(--pkd)', color: '#fff', fontSize: 16, fontWeight: 600, cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1, fontFamily: 'inherit' }),
  secondaryBtn: (off) => ({ padding: '8px 24px', borderRadius: 24, border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx)', fontSize: 16, cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1, fontFamily: 'inherit' }),
}
