// ── dbWrite ───────────────────────────────────────────────────────────────────
// A supabase write that cannot fail silently.
//
// Why this exists (2026-07-30): supabase-js never throws on a database error —
// it returns `{ data, error }`. `await supabase.from('x').update({…}).eq(…)`
// therefore discards RLS denials, constraint violations and network failures
// identically, and the code proceeds as though the write happened. A sweep found
// 40 such sites. Nothing was broken at the time, but the repo has been bitten
// before: `stillwater_responses` had an anon-only INSERT policy and
// `drift_performance`/`drift_trials` had none, so authenticated users were
// silently blocked from writing game data (see CLAUDE.md).
//
// TWO failure modes, and they are not the same — today produced one of each:
//
//   1. `error` is set: constraint violation, a WITH CHECK denial, a dropped
//      connection.
//   2. ZERO ROWS AFFECTED, with no error at all. An RLS USING clause that
//      doesn't match filters the row out rather than raising, so PostgREST
//      reports success having changed nothing. This is also what an `.eq()` on
//      a row that doesn't exist looks like — the `ripples` settings bug, where
//      every toggle reported success and wrote nothing.
//
// Checking `error` alone would have caught NEITHER of this morning's bugs. To
// detect (2) the caller must ask for the affected rows back:
//
//   dbWrite(
//     supabase.from('game_sessions')
//       .update({ ended_at: new Date().toISOString() })
//       .eq('id', sessionId)
//       .select('id'),          // <- required for expectRows
//     'game_sessions.ended_at',
//     { expectRows: true },
//   )
//
// `.select()` returns the rows the write actually touched, subject to RLS SELECT
// permission on that table — so only use expectRows where the caller can read
// its own rows back (true for every table this is applied to).
//
// NEVER THROWS. These calls sit in game-completion and study-flow paths; a lost
// `ended_at` stamp must not become a crashed session for a participant mid-task.
// Callers get a result object and decide.

/** Failure listeners — lets a UI layer surface write failures without every
 *  call site growing error-handling code. Nothing subscribes yet. */
const listeners = new Set()

export function onWriteFailure(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify(failure) {
  for (const fn of listeners) {
    try { fn(failure) } catch { /* a broken listener must not break the write path */ }
  }
}

/** Transient = worth one retry. RLS and constraint failures are deterministic:
 *  retrying just fails again, more slowly. */
function isTransient(error) {
  if (!error) return false
  const msg = String(error.message ?? '').toLowerCase()
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout')) return true
  const code = String(error.code ?? '')
  return code.startsWith('5') || code === 'PGRST504'
}

/**
 * @param {PromiseLike} query   a supabase query builder, already fully chained
 * @param {string}      label   identifies the write in logs, e.g. 'game_sessions.ended_at'
 * @param {object}     [opts]
 * @param {boolean}    [opts.expectRows=false]  treat "0 rows affected" as failure
 *                                              (requires the query to end in .select())
 * @param {number}     [opts.retries=1]         retries for transient failures only
 * @returns {Promise<{ok: boolean, data: any, error: any, reason: null|'error'|'no_rows'}>}
 */
export async function dbWrite(query, label, opts = {}) {
  const { expectRows = false, retries = 1 } = opts

  let attempt = 0
  let result
  for (;;) {
    // A query builder is thenable but single-use; re-running means re-awaiting
    // the same builder, which supabase-js supports for a fresh request.
    result = await query
    if (!result.error || !isTransient(result.error) || attempt >= retries) break
    attempt += 1
    await new Promise(r => setTimeout(r, 400 * attempt))
  }

  const { data, error } = result

  if (error) {
    const failure = { label, reason: 'error', error, attempts: attempt + 1 }
    console.error(
      `dbWrite ${label} failed${attempt ? ` after ${attempt + 1} attempts` : ''}:`,
      error.message ?? error, error.code ? `(code ${error.code})` : '',
    )
    notify(failure)
    return { ok: false, data: null, error, reason: 'error' }
  }

  if (expectRows && Array.isArray(data) && data.length === 0) {
    const failure = { label, reason: 'no_rows', error: null, attempts: attempt + 1 }
    console.warn(
      `dbWrite ${label}: succeeded but changed 0 rows — the row is missing, or an RLS ` +
      `USING clause filtered it out. Nothing was written.`,
    )
    notify(failure)
    return { ok: false, data, error: null, reason: 'no_rows' }
  }

  return { ok: true, data, error: null, reason: null }
}
