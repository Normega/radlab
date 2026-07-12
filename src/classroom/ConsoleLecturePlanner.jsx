import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const ACTIVITY_DEFS = [
  { key: 'mood', label: 'Mood' },
  { key: 'pacing', label: 'Pacing' },
  { key: 'prompt', label: 'Prompt' },
  { key: 'question_box', label: 'Question box' },
  { key: 'quiz', label: 'Quiz' },
]

function emptyQuizItem() {
  // Random, not position-derived — a position-derived id (q1, q2, ...) would
  // collide after removing an earlier question and adding a new one.
  return { id: `q_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`, text: '', options: ['', ''], correct: 0 }
}

// Correct answers never round-trip through this component's onChange back
// into checkins.config — CheckinForm.submit splits { id, text, options }
// (safe, public) from { correct } (goes to checkin_quiz_keys, admin-only
// table) before saving. See 20260713_lecture_lounge_quiz.sql.
function QuizItemsEditor({ items, onChange }) {
  function updateItem(i, patch) { onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))) }
  function addItem() { onChange([...items, emptyQuizItem()]) }
  function removeItem(i) { onChange(items.filter((_, idx) => idx !== i)) }
  function updateOption(i, optIdx, value) {
    const next = [...items[i].options]
    next[optIdx] = value
    updateItem(i, { options: next })
  }
  function addOption(i) {
    if (items[i].options.length >= 6) return
    updateItem(i, { options: [...items[i].options, ''] })
  }
  function removeOption(i, optIdx) {
    if (items[i].options.length <= 2) return
    const next = items[i].options.filter((_, idx) => idx !== optIdx)
    updateItem(i, { options: next, correct: items[i].correct >= next.length ? 0 : items[i].correct })
  }

  return (
    <div style={{ marginTop: 10 }}>
      <label style={S.fieldLabel}>Quiz questions</label>
      {items.map((it, i) => (
        <div key={it.id} style={S.quizItemBox}>
          <div style={S.quizItemHeader}>
            <input
              type="text" value={it.text} onChange={(e) => updateItem(i, { text: e.target.value })}
              placeholder="Question text" style={{ ...S.input, flex: 1 }}
            />
            <button type="button" style={S.linkBtnDanger} onClick={() => removeItem(i)}>Remove</button>
          </div>
          {it.options.map((opt, optIdx) => (
            <div key={optIdx} style={S.quizOptionRow}>
              <input type="radio" checked={it.correct === optIdx} onChange={() => updateItem(i, { correct: optIdx })} title="Correct answer" />
              <input
                type="text" value={opt} onChange={(e) => updateOption(i, optIdx, e.target.value)}
                placeholder={`Option ${optIdx + 1}`} style={{ ...S.input, flex: 1 }}
              />
              <button type="button" style={S.orderBtn} disabled={it.options.length <= 2} onClick={() => removeOption(i, optIdx)}>×</button>
            </div>
          ))}
          <button type="button" style={S.ghostBtnSm} onClick={() => addOption(i)} disabled={it.options.length >= 6}>+ Option</button>
        </div>
      ))}
      <button type="button" style={S.addBtn} onClick={addItem}>+ Add question</button>
    </div>
  )
}

function ActivitiesEditor({ activities, onChange, promptText, onPromptTextChange, quizItems, onQuizItemsChange }) {
  function toggle(key) {
    if (activities.includes(key)) onChange(activities.filter((a) => a !== key))
    else onChange([...activities, key])
  }
  function move(key, dir) {
    const i = activities.indexOf(key)
    const j = i + dir
    if (j < 0 || j >= activities.length) return
    const next = [...activities]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div>
      <div style={S.activityRow}>
        {ACTIVITY_DEFS.map((a) => (
          <label key={a.key} style={S.activityChip(activities.includes(a.key))}>
            <input type="checkbox" checked={activities.includes(a.key)} onChange={() => toggle(a.key)} style={{ marginRight: 6 }} />
            {a.label}
          </label>
        ))}
      </div>
      {activities.length > 0 && (
        <div style={S.orderList}>
          <p style={S.orderLabel}>Order</p>
          {activities.map((key, i) => (
            <div key={key} style={S.orderRow}>
              <span style={S.orderIndex}>{i + 1}.</span>
              <span style={S.orderName}>{ACTIVITY_DEFS.find((a) => a.key === key)?.label}</span>
              <button type="button" style={S.orderBtn} disabled={i === 0} onClick={() => move(key, -1)}>↑</button>
              <button type="button" style={S.orderBtn} disabled={i === activities.length - 1} onClick={() => move(key, 1)}>↓</button>
            </div>
          ))}
        </div>
      )}
      {activities.includes('prompt') && (
        <div style={{ marginTop: 10 }}>
          <label style={S.fieldLabel}>Prompt text</label>
          <input
            type="text" value={promptText} onChange={(e) => onPromptTextChange(e.target.value)}
            placeholder="What was today's key takeaway?" style={S.input}
          />
        </div>
      )}
      {activities.includes('quiz') && <QuizItemsEditor items={quizItems} onChange={onQuizItemsChange} />}
    </div>
  )
}

function emptyCheckinForm(nextPosition) {
  return { position: nextPosition, activities: [], promptText: '', autoCloseSeconds: '', quizItems: [] }
}

function quizItemsValid(items) {
  return items.length > 0 && items.every((it) => it.text.trim() && it.options.filter((o) => o.trim()).length >= 2)
}

function CheckinForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  const quizOk = !form.activities.includes('quiz') || quizItemsValid(form.quizItems)

  function submit(e) {
    e.preventDefault()
    const isQuiz = form.activities.includes('quiz')
    onSave({
      position: Number(form.position) || 0,
      config: {
        activities: form.activities,
        ...(form.activities.includes('prompt') ? { prompt_text: form.promptText } : {}),
        ...(isQuiz ? { quiz_items: form.quizItems.map(({ id, text, options }) => ({ id, text, options })) } : {}),
      },
      auto_close_seconds: form.autoCloseSeconds === '' ? null : Number(form.autoCloseSeconds),
      ...(isQuiz ? { quizAnswerKey: Object.fromEntries(form.quizItems.map((qi) => [qi.id, qi.correct])) } : {}),
    })
  }

  return (
    <form onSubmit={submit} style={S.checkinForm}>
      <div style={S.fieldRow}>
        <div>
          <label style={S.fieldLabel}>Position</label>
          <input type="number" value={form.position} onChange={(e) => set('position', e.target.value)} style={{ ...S.input, width: 70 }} />
        </div>
        <div>
          <label style={S.fieldLabel}>Auto-close (seconds, optional)</label>
          <input type="number" value={form.autoCloseSeconds} onChange={(e) => set('autoCloseSeconds', e.target.value)} style={{ ...S.input, width: 140 }} placeholder="none" />
        </div>
      </div>
      <ActivitiesEditor
        activities={form.activities}
        onChange={(v) => set('activities', v)}
        promptText={form.promptText}
        onPromptTextChange={(v) => set('promptText', v)}
        quizItems={form.quizItems}
        onQuizItemsChange={(v) => set('quizItems', v)}
      />
      <div style={S.formBtnRow}>
        <button type="submit" style={S.primaryBtnSm} disabled={form.activities.length === 0 || !quizOk}>Save check-in</button>
        <button type="button" style={S.ghostBtnSm} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function CheckinRow({ checkin, onEdit, onDelete }) {
  const activities = checkin.config?.activities ?? []
  return (
    <div style={S.checkinRow}>
      <span style={S.checkinPos}>#{checkin.position}</span>
      <span style={S.checkinSummary}>{activities.map((a) => ACTIVITY_DEFS.find((d) => d.key === a)?.label ?? a).join(' → ') || '(no activities)'}</span>
      {checkin.auto_close_seconds != null && <span style={S.autoCloseBadge}>{checkin.auto_close_seconds}s auto-close</span>}
      <span style={S.statusBadge}>{checkin.status}</span>
      <button style={S.linkBtn} onClick={onEdit}>Edit</button>
      <button style={S.linkBtnDanger} onClick={onDelete}>Delete</button>
    </div>
  )
}

function LectureCard({ lecture, checkins, expanded, onToggle, onEditLecture, onDeleteLecture, onCreateCheckin, onUpdateCheckin, onDeleteCheckin }) {
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ number: lecture.number ?? '', title: lecture.title ?? '', lecture_date: lecture.lecture_date ?? '' })
  const [creatingCheckin, setCreatingCheckin] = useState(false)
  const [editingCheckinId, setEditingCheckinId] = useState(null)

  async function saveLecture(e) {
    e.preventDefault()
    const ok = await onEditLecture(lecture.id, {
      number: editForm.number === '' ? null : Number(editForm.number),
      title: editForm.title,
      lecture_date: editForm.lecture_date || null,
    })
    if (ok) setEditing(false)
  }

  const nextPosition = (checkins?.length ?? 0) + 1

  return (
    <div style={S.lectureCard}>
      <div style={S.lectureHeader} onClick={onToggle}>
        <span style={S.lectureNum}>{lecture.number != null ? `#${lecture.number}` : '—'}</span>
        <span style={S.lectureTitle}>{lecture.title || '(untitled lecture)'}</span>
        <span style={S.lectureDate}>{lecture.lecture_date ?? ''}</span>
        <span style={S.chevron}>{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div style={S.lectureBody} onClick={(e) => e.stopPropagation()}>
          {!editing ? (
            <div style={S.lectureActions}>
              <button style={S.linkBtn} onClick={() => setEditing(true)}>Edit lecture</button>
              <button style={S.linkBtnDanger} onClick={() => onDeleteLecture(lecture.id)}>Delete lecture</button>
            </div>
          ) : (
            <form onSubmit={saveLecture} style={S.lectureEditForm}>
              <input type="number" placeholder="#" value={editForm.number} onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))} style={{ ...S.input, width: 60 }} />
              <input type="text" placeholder="Title" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} style={{ ...S.input, flex: 1 }} />
              <input type="date" value={editForm.lecture_date ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, lecture_date: e.target.value }))} style={S.input} />
              <button type="submit" style={S.primaryBtnSm}>Save</button>
              <button type="button" style={S.ghostBtnSm} onClick={() => setEditing(false)}>Cancel</button>
            </form>
          )}

          <p style={S.subLabel}>Check-ins</p>
          {(checkins ?? []).map((c) =>
            editingCheckinId === c.id ? (
              <CheckinForm
                key={c.id}
                initial={{
                  position: c.position, activities: c.config?.activities ?? [],
                  promptText: c.config?.prompt_text ?? '', autoCloseSeconds: c.auto_close_seconds ?? '',
                  quizItems: (c.config?.quiz_items ?? []).map((qi) => ({ ...qi, correct: c.quizAnswerKey?.[qi.id] ?? 0 })),
                }}
                onSave={async (patch) => { if (await onUpdateCheckin(c.id, patch)) setEditingCheckinId(null) }}
                onCancel={() => setEditingCheckinId(null)}
              />
            ) : (
              <CheckinRow key={c.id} checkin={c} onEdit={() => setEditingCheckinId(c.id)} onDelete={() => onDeleteCheckin(c.id)} />
            )
          )}

          {creatingCheckin ? (
            <CheckinForm
              initial={emptyCheckinForm(nextPosition)}
              onSave={async (patch) => { if (await onCreateCheckin(lecture.id, patch)) setCreatingCheckin(false) }}
              onCancel={() => setCreatingCheckin(false)}
            />
          ) : (
            <button style={S.addBtn} onClick={() => setCreatingCheckin(true)}>+ New check-in</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConsoleLecturePlanner({ classInfo }) {
  const [lectures, setLectures] = useState(undefined)
  const [checkinsByLecture, setCheckinsByLecture] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [creatingLecture, setCreatingLecture] = useState(false)
  const [newLecture, setNewLecture] = useState({ number: '', title: '', lecture_date: '' })
  const [errorMsg, setErrorMsg] = useState(null)

  // Every mutation goes through this so an RLS denial or any other DB error
  // surfaces to the instructor instead of failing silently (see CLAUDE.md's
  // RLS section — that failure mode is exactly what bit WP3a live).
  async function run(promiseFactory) {
    const { error } = await promiseFactory()
    if (error) { setErrorMsg(error.message); return false }
    setErrorMsg(null)
    return true
  }

  async function reload() {
    // One embedded query instead of lectures-then-checkins as two sequential
    // round trips — checkin counts per lecture are small, so sorting the
    // nested array client-side is simpler than PostgREST's embedded-order syntax.
    const { data: lecs } = await supabase
      .from('lectures')
      .select('*, checkins(*)')
      .eq('class_id', classInfo.id)
      .order('number', { ascending: true, nullsFirst: false })
    const rows = lecs ?? []
    // Leaving the embedded `checkins` array on each lecture row is harmless
    // (LectureCard only reads its own named fields) — simpler than stripping it.
    setLectures(rows)

    // checkin_quiz_keys isn't embeddable from checkins in one shot the way
    // class_questions is (correct answers are deliberately kept off any row
    // students can read — see the migration — so it's a fully separate,
    // admin-only fetch, not just a stylistic choice).
    const quizCheckinIds = rows.flatMap((l) => (l.checkins ?? []).filter((c) => (c.config?.activities ?? []).includes('quiz')).map((c) => c.id))
    let keysByCheckin = {}
    if (quizCheckinIds.length) {
      const { data: keys } = await supabase.from('checkin_quiz_keys').select('checkin_id, answer_key').in('checkin_id', quizCheckinIds)
      keysByCheckin = Object.fromEntries((keys ?? []).map((k) => [k.checkin_id, k.answer_key]))
    }

    const grouped = {}
    for (const l of rows) {
      grouped[l.id] = [...(l.checkins ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((c) => (c.id in keysByCheckin ? { ...c, quizAnswerKey: keysByCheckin[c.id] } : c))
    }
    setCheckinsByLecture(grouped)
  }

  useEffect(() => {
    // Deferred so reload()'s setState calls don't run synchronously within
    // the effect body.
    queueMicrotask(() => reload())
  }, [classInfo.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createLecture(e) {
    e.preventDefault()
    const ok = await run(() => supabase.from('lectures').insert({
      class_id: classInfo.id,
      number: newLecture.number === '' ? null : Number(newLecture.number),
      title: newLecture.title,
      lecture_date: newLecture.lecture_date || null,
    }))
    if (!ok) return
    setNewLecture({ number: '', title: '', lecture_date: '' })
    setCreatingLecture(false)
    reload()
  }

  async function editLecture(id, patch) {
    const ok = await run(() => supabase.from('lectures').update(patch).eq('id', id))
    if (ok) reload()
    return ok
  }
  async function deleteLecture(id) {
    if (!window.confirm('Delete this lecture and all its check-ins?')) return
    const ok = await run(() => supabase.from('lectures').delete().eq('id', id))
    if (ok) reload()
  }
  // quizAnswerKey isn't a checkins column — it goes to the separate
  // admin-only checkin_quiz_keys table (see 20260713_lecture_lounge_quiz.sql
  // for why correct answers can't live anywhere a student can read).
  async function saveQuizKey(checkinId, quizAnswerKey) {
    if (!quizAnswerKey) return true
    return run(() => supabase.from('checkin_quiz_keys').upsert({ checkin_id: checkinId, answer_key: quizAnswerKey }))
  }

  async function createCheckin(lectureId, { quizAnswerKey, ...patch }) {
    const { data, error } = await supabase.from('checkins').insert({ lecture_id: lectureId, ...patch }).select('id').single()
    if (error) { setErrorMsg(error.message); return false }
    if (!(await saveQuizKey(data.id, quizAnswerKey))) return false
    setErrorMsg(null)
    reload()
    return true
  }
  async function updateCheckin(id, { quizAnswerKey, ...patch }) {
    const ok = await run(() => supabase.from('checkins').update(patch).eq('id', id))
    if (!ok) return false
    if (!(await saveQuizKey(id, quizAnswerKey))) return false
    reload()
    return ok
  }
  async function deleteCheckin(id) {
    if (!window.confirm('Delete this check-in?')) return
    const ok = await run(() => supabase.from('checkins').delete().eq('id', id))
    if (ok) reload()
  }

  if (lectures === undefined) return <p style={S.loading}>Loading…</p>

  return (
    <div>
      <div style={S.header}>
        <p style={S.eyebrow}>Planning console</p>
        <h1 style={S.title}>{classInfo.name}</h1>
      </div>

      {errorMsg && (
        <div style={S.errorBanner}>
          {errorMsg}
          <button style={S.errorDismiss} onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}

      {lectures.map((l) => (
        <LectureCard
          key={l.id} lecture={l} checkins={checkinsByLecture[l.id]}
          expanded={expandedId === l.id} onToggle={() => setExpandedId(expandedId === l.id ? null : l.id)}
          onEditLecture={editLecture} onDeleteLecture={deleteLecture}
          onCreateCheckin={createCheckin} onUpdateCheckin={updateCheckin} onDeleteCheckin={deleteCheckin}
        />
      ))}

      {creatingLecture ? (
        <form onSubmit={createLecture} style={S.lectureEditForm}>
          <input type="number" placeholder="#" value={newLecture.number} onChange={(e) => setNewLecture((f) => ({ ...f, number: e.target.value }))} style={{ ...S.input, width: 60 }} />
          <input type="text" placeholder="Title" value={newLecture.title} onChange={(e) => setNewLecture((f) => ({ ...f, title: e.target.value }))} style={{ ...S.input, flex: 1 }} />
          <input type="date" value={newLecture.lecture_date} onChange={(e) => setNewLecture((f) => ({ ...f, lecture_date: e.target.value }))} style={S.input} />
          <button type="submit" style={S.primaryBtnSm}>Save</button>
          <button type="button" style={S.ghostBtnSm} onClick={() => setCreatingLecture(false)}>Cancel</button>
        </form>
      ) : (
        <button style={S.addBtn} onClick={() => setCreatingLecture(true)}>+ New lecture</button>
      )}
    </div>
  )
}

const S = {
  loading: { padding: 40, color: 'var(--tx2)', fontSize: 14 },
  header: { marginBottom: 24 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 6 },
  title: { fontFamily: SERIF, fontSize: 32, color: 'var(--tx)' },
  errorBanner: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#fdecec', border: '1px solid #f3b8b8', color: '#a33',
    borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16,
  },
  errorDismiss: { background: 'none', border: 'none', color: '#a33', fontSize: 16, cursor: 'pointer', lineHeight: 1 },

  lectureCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  lectureHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' },
  lectureNum: { fontFamily: MONO, fontSize: 13, color: 'var(--pk)', minWidth: 28 },
  lectureTitle: { flex: 1, fontSize: 15, color: 'var(--tx)', fontWeight: 500 },
  lectureDate: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)' },
  chevron: { color: 'var(--tx3)' },
  lectureBody: { padding: '0 18px 18px', borderTop: '1px solid var(--bd)' },
  lectureActions: { display: 'flex', gap: 12, padding: '12px 0 4px' },
  lectureEditForm: { display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0', flexWrap: 'wrap' },

  subLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--tx3)', margin: '16px 0 8px' },

  checkinRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg)', marginBottom: 6, flexWrap: 'wrap' },
  checkinPos: { fontFamily: MONO, fontSize: 12, color: 'var(--tx3)' },
  checkinSummary: { flex: 1, fontSize: 13, color: 'var(--tx)' },
  autoCloseBadge: { fontFamily: MONO, fontSize: 11, color: 'var(--pkd)', background: 'var(--pkb)', padding: '2px 8px', borderRadius: 6 },
  statusBadge: { fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', textTransform: 'uppercase' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--pk)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
  linkBtnDanger: { background: 'none', border: 'none', color: '#c04a4a', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 },

  checkinForm: { background: 'var(--bg)', borderRadius: 10, padding: 14, marginBottom: 8 },
  fieldRow: { display: 'flex', gap: 20, marginBottom: 10 },
  fieldLabel: { display: 'block', fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 4 },
  input: { padding: '7px 10px', borderRadius: 7, border: '1px solid var(--bds)', fontSize: 13, fontFamily: 'inherit' },

  activityRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  activityChip: (active) => ({
    display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 20, fontSize: 13,
    border: `1px solid ${active ? 'var(--pk)' : 'var(--bds)'}`, background: active ? 'var(--bgp)' : 'var(--bgc)',
    color: active ? 'var(--pkd)' : 'var(--tx2)', cursor: 'pointer',
  }),
  quizItemBox: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 10, padding: 12, marginBottom: 8 },
  quizItemHeader: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 },
  quizOptionRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 },

  orderList: { marginTop: 10 },
  orderLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 4 },
  orderRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0' },
  orderIndex: { fontFamily: MONO, color: 'var(--tx3)', width: 16 },
  orderName: { flex: 1, color: 'var(--tx)' },
  orderBtn: { border: '1px solid var(--bds)', background: 'var(--bgc)', borderRadius: 5, width: 22, height: 22, cursor: 'pointer', fontSize: 11 },

  formBtnRow: { display: 'flex', gap: 8, marginTop: 12 },
  primaryBtnSm: { padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--pk)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  ghostBtnSm: { padding: '7px 16px', borderRadius: 8, border: '1px solid var(--bds)', background: 'none', color: 'var(--tx2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  addBtn: { padding: '10px 16px', borderRadius: 8, border: '1px dashed var(--bds)', background: 'none', color: 'var(--pk)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', width: '100%', marginTop: 4 },
}
