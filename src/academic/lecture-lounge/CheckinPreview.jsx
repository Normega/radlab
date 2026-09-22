import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import CheckinRunner from './CheckinRunner'

const MONO = '"Space Mono", "Courier New", monospace'

// See a check-in exactly as a student will, without releasing it (Norm,
// 2026-09-22: "particularly important for quizzes").
//
// Renders the real student CheckinRunner — same steps, same wording, same
// option lists — in its `preview` mode, which writes nothing. Nothing about
// the check-in changes either: no status move, no broadcast, so no student
// device can tell a preview is happening. It shows the SAVED check-in, which
// is what students would actually get; an edit still open in the planner is
// not reflected until it is saved.
//
// The answer key is fetched here rather than passed in, so the preview works
// from the Run tab (which never loads keys) as well as the Plan tab (which
// does). checkin_quiz_keys is readable by class admins only, the same people
// who can open this.
export default function CheckinPreview({ checkin, session, onClose }) {
  const hasQuiz = (checkin.config?.activities ?? []).includes('quiz')
  const [answerKey, setAnswerKey] = useState(checkin.quizAnswerKey ?? null)
  const [run, setRun] = useState(0)   // bump to restart from the first step

  useEffect(() => {
    if (!hasQuiz || checkin.quizAnswerKey) return
    let live = true
    supabase.from('checkin_quiz_keys').select('answer_key').eq('checkin_id', checkin.id).maybeSingle()
      .then(({ data }) => { if (live) setAnswerKey(data?.answer_key ?? {}) })
    return () => { live = false }
  }, [checkin.id, checkin.quizAnswerKey, hasQuiz])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={S.backdrop} onClick={onClose} role="presentation">
      <div style={S.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
           aria-label={`Preview of check-in ${checkin.position}`}>
        <div style={S.banner}>
          <span>Preview · #{checkin.position} · students can’t see this, and nothing is saved</span>
          <button style={S.close} onClick={onClose} aria-label="Close preview">×</button>
        </div>
        <div style={S.phone}>
          <CheckinRunner
            key={run}
            checkinId={checkin.id}
            config={checkin.config}
            session={session}
            onComplete={() => {}}
            preview={{ answerKey: hasQuiz ? answerKey : null, onRestart: () => setRun((n) => n + 1) }}
          />
        </div>
      </div>
    </div>
  )
}

const S = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,16,24,.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12,
  },
  panel: {
    width: 'min(420px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
    background: 'var(--bg)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,.35)',
  },
  // Amber, not the class pink: this must never be mistaken for the live view.
  banner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    fontFamily: MONO, fontSize: 11.5, letterSpacing: .4, lineHeight: 1.4,
    background: '#b8860b', color: '#fff', padding: '9px 12px 9px 14px',
  },
  close: {
    flexShrink: 0, background: 'none', border: 'none', color: '#fff', fontSize: 22,
    lineHeight: 1, cursor: 'pointer', padding: '0 2px',
  },
  phone: { overflowY: 'auto', padding: '4px 0 8px' },
}
