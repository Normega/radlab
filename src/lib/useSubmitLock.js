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
 *   const { submit, busy } = useSubmitLock()
 *   await submit(async () => {
 *     const { error } = await db.from('x').insert(row)
 *     if (error) throw error        // releases the lock so a retry is possible
 *     onComplete({})
 *   })
 */
export function useSubmitLock() {
  const lockedRef = useRef(false)
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async (fn) => {
    if (lockedRef.current) return { skipped: true }
    lockedRef.current = true
    setBusy(true)
    try {
      const result = await fn()
      return { skipped: false, result }
    } catch (err) {
      lockedRef.current = false
      throw err
    } finally {
      setBusy(false)
    }
  }, [])

  return { submit, busy }
}
