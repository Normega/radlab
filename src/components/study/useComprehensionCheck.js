import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSubmitLock } from '../../lib/useSubmitLock'

// A multiple-choice comprehension check on a game's start screen (Sandy Study 4,
// 2026-11-27); rendered by ComprehensionCheck.jsx. The game's own Begin stays
// disabled until every question has been answered correctly; a wrong answer is
// marked and can't be picked again, and the participant tries another. Nothing
// is scored: the record is how many wrong answers each question took, and which.
//
// A STUDY setting, not a game one: `studies.comprehension_checks` maps a game key
// (aptitude_suite, color_max, foggy_valleys) to the slug of a composable
// instrument of type `comprehension_check`, whose config holds the questions:
//   { title?, intro?, retry_text?, questions: [{ id, text, options: [{ id, text }], correct }] }
// Sandy Study 3 shares the Aptitude Suite and ColourMax and sets nothing, so its
// start screens are unchanged. Read under the participant's own session ("studies:
// enrolled participant read"); an unreadable study setting means no check, as
// before. An instrument the study names but that can't be read blocks Begin with
// a retry, because the study asked for the check.
//
// Saved once, when the last question is answered correctly: ONE instrument_responses
// row (instrument_type 'comprehension_check', schedule_id), behind a submit lock;
// Begin waits for the save, and a failed save offers a retry.

const VERSION = 'comprehension_check_v1'

function validConfig(c) {
  return Array.isArray(c?.questions) && c.questions.length > 0 && c.questions.every(q =>
    q?.id && q?.text && Array.isArray(q.options) && q.options.length > 1 && q.options.some(o => o?.id === q.correct))
}

async function loadCheck(db, studyId, game) {
  const { data: study, error: studyErr } = await db.from('studies').select('comprehension_checks').eq('id', studyId).maybeSingle()
  if (studyErr) {
    console.warn('comprehension_checks unreadable, no check shown:', studyErr.message)
    return null
  }
  const slug = study?.comprehension_checks?.[game]
  if (!slug) return null
  const { data, error } = await db.from('composable_instruments').select('id, slug, type, config').eq('slug', slug).single()
  if (error) throw error
  if (data.type !== 'comprehension_check' || !validConfig(data.config)) throw new Error(`instrument ${slug} is not a usable comprehension check`)
  return data
}

/**
 * @param enabled  false outside a live study session (previews, sim mode): no check
 * @returns status: 'off' | 'loading' | 'error' | 'open' | 'saving' | 'failed' | 'passed';
 *          cleared: true when the game may start
 */
export function useComprehensionCheck({ db, studyId, userId, scheduleId = null, game, enabled }) {
  const active = !!enabled && !!studyId
  const [inst, setInst] = useState(undefined)        // undefined loading · null none · row
  const [loadError, setLoadError] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [answers, setAnswers] = useState({})         // qid -> { wrong: [optionId], solved }
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const shownAt = useRef(null)
  const { submit, busy } = useSubmitLock(`comprehension:${game}`)

  useEffect(() => {
    if (!active) return
    let live = true
    loadCheck(db, studyId, game)
      .then(row => {
        if (!live) return
        if (row && !shownAt.current) shownAt.current = new Date().toISOString()
        setInst(row)
      })
      .catch(err => {
        if (!live) return
        console.error('comprehension check load:', err)
        setLoadError(err.message ?? String(err))
      })
    return () => { live = false }
  }, [db, studyId, game, active, loadAttempt])

  const questions = useMemo(() => inst?.config?.questions ?? [], [inst])

  const save = useCallback(async (final) => {
    setSaveError(null)
    await submit(async () => {
      if (!userId) throw new Error('no participant on this session')
      const qs = questions.map(q => {
        const wrong = final[q.id]?.wrong ?? []
        return { id: q.id, correct: q.correct, wrong, tries: wrong.length + 1 }
      })
      const response = {
        version:     VERSION,
        game,
        shown_at:    shownAt.current,
        passed_at:   new Date().toISOString(),
        questions:   qs,
        total_wrong: qs.reduce((n, q) => n + q.wrong.length, 0),
      }
      const { error } = await db.from('instrument_responses').insert({
        user_id:         userId,
        instrument_id:   inst.id,
        instrument_slug: inst.slug,
        instrument_type: inst.type,
        schedule_id:     scheduleId ?? null,
        step_index:      null,
        response,
      })
      if (error) throw error          // releases the lock so the retry can run
      setSaved(true)
    }).catch(err => {
      console.error('comprehension check save:', err)
      setSaveError(err.message ?? String(err))
    })
  }, [submit, userId, questions, game, db, inst, scheduleId])

  // Clicks are one at a time, so the next state is computed here rather than in
  // an updater, and the save starts from the click that answers the last question.
  const choose = useCallback((qid, optionId) => {
    const q = questions.find(x => x.id === qid)
    const a = answers[qid] ?? { wrong: [], solved: false }
    if (!q || a.solved || a.wrong.includes(optionId)) return
    const next = { ...answers, [qid]: optionId === q.correct ? { ...a, solved: true } : { ...a, wrong: [...a.wrong, optionId] } }
    setAnswers(next)
    if (questions.every(x => next[x.id]?.solved)) save(next)
  }, [questions, answers, save])

  const allSolved = questions.length > 0 && questions.every(q => answers[q.id]?.solved)
  const status =
    !active || inst === null ? 'off' :
    loadError ? 'error' :
    inst === undefined ? 'loading' :
    saved ? 'passed' :
    saveError ? 'failed' :
    allSolved ? 'saving' : 'open'

  return {
    status,
    cleared: status === 'off' || status === 'passed',
    config: inst?.config ?? null,
    answers, choose, busy, saveError,
    retrySave: () => save(answers),
    retryLoad: () => { setLoadError(null); setLoadAttempt(n => n + 1) },
  }
}
