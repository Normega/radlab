import { useRef, useState, useCallback } from 'react'

/**
 * useSubmitLock — run a submit handler at most once.
 *
 * Why a ref and not just a `saving` state flag: `setSaving(true)` does not take
 * effect until React re-renders, so two events dispatched in the same tick both
 * read `saving === false` and both proceed. Every form step on the platform
 * guarded its insert this way, which is a race rather than a lock. A ref is
 * written synchronously, so the second call sees the lock the first one set.
 *
 * On success the lock is NOT released: a completed submit must never repeat.
 * On failure it is, so a participant whose insert failed can try again — a
 * one-shot lock that survives an error would strand them on a dead button.
 *
 * Scope note, and it matters: this is per component instance. It cannot stop a
 * duplicate caused by the component REMOUNTING, which is the likelier cause of
 * the duplicates seen in the live test (a 643 ms gap is too slow for same-tick
 * batching). The durable guard for that is in the database —
 * `20260818_questionnaire_submit_guard.sql`. This hook stops the client making
 * the request; the trigger stops the row existing. Both are wanted.
 *
 *   const { submit, busy } = useSubmitLock(slug)
 *   await submit(async () => {
 *     const { error } = await db.from('x').insert(row)
 *     if (error) throw error        // releases the lock so a retry is possible
 *     onComplete({})
 *   })
 *
 * lockKey names WHAT is being submitted. Pass it wherever one mounted instance
 * can be asked to submit more than one thing in turn -- a step wrapper reused
 * across two questionnaires, say. When it changes the lock releases, because a
 * lock held for the previous subject must not silence the next one. Omitting it
 * keeps the plain one-shot behaviour.
 *
 * That is not a hypothetical. Two Breath Belt participants froze mid-session on
 * 2026-08-20: StudySessionRunner rendered StepDispatcher with no per-step key,
 * so PANAS and the PHQ-4 that followed it shared one QuestionnaireStepWrapper,
 * and PANAS's completed submit left the lock held. PHQ-4 rendered, was
 * answered, and its final tap did nothing at all -- no insert, no advance, no
 * request of any kind. The key on StepDispatcher is the real fix; this is the
 * second layer, because a stale lock now costs an unrecoverable freeze rather
 * than the duplicate row the lock was written to prevent.
 */

// The lock itself, with no React in it, so its rules can be tested directly.
// `locked` is a plain closure variable rather than state for the same reason
// the hook used a ref: it must be readable and writable synchronously.
export function createSubmitLock() {
  let locked = false
  let key
  let keyed = false

  return {
    get locked() { return locked },
    // Bind the lock to a subject. Releases a lock held for a different one.
    rekey(nextKey) {
      if (keyed && nextKey === key) return
      keyed = true
      key   = nextKey
      locked = false
    },
    async run(fn) {
      if (locked) return { skipped: true }
      locked = true
      try {
        const result = await fn()
        return { skipped: false, result }
      } catch (err) {
        locked = false
        throw err
      }
    },
  }
}

export function useSubmitLock(lockKey) {
  const lockRef = useRef(null)
  if (lockRef.current === null) lockRef.current = createSubmitLock()
  // Rekeyed during render, not in an effect: an effect lands after the child
  // has already been handed its onComplete, which is too late to be a guard.
  lockRef.current.rekey(lockKey)

  const [busy, setBusy] = useState(false)

  const submit = useCallback(async (fn) => {
    const lock = lockRef.current
    if (lock.locked) return { skipped: true }
    setBusy(true)
    try {
      return await lock.run(fn)
    } finally {
      setBusy(false)
    }
  }, [])

  return { submit, busy }
}
