// Writes the Breath Attention and Emotional Recovery task's events and ratings
// (bre_events, bre_ratings; 20261123_bre_task_tables.sql).
//
// The task's clock must never wait on the network, so writes are queued and sent in order in the
// background. Each row gets its id when it is created, so a retry of a write that did land hits the
// primary key (23505) and counts as done: nothing is ever written twice, and nothing is updated
// (participant data rule 5). A write that keeps failing stays queued and is retried with the next
// one; `pending()` lets the RA panel and the end of the task see that something has not saved yet.

export function createBreWriter({ db, userId, studyId, scheduleId, step, isTest = false, runId = crypto.randomUUID(),
  sleep = (ms) => new Promise(r => setTimeout(r, ms)) }) {
  const queue = []
  let flushing = null
  let seq = 0
  const base = { user_id: userId, study_id: studyId, schedule_id: scheduleId ?? null, is_test: !!isTest, run_id: runId, step }

  async function insert(table, row) {
    for (const delay of [0, 500, 2000]) {
      if (delay) await sleep(delay)
      const { error } = await db.from(table).insert(row)
      if (!error || error.code === '23505') return true
      console.warn(`${table} write failed:`, error.message)
    }
    return false
  }

  function flush() {
    if (flushing) return flushing
    flushing = (async () => {
      while (queue.length) {
        const [table, row] = queue[0]
        if (!(await insert(table, row))) break   // keep it; the next write retries it first
        queue.shift()
      }
      flushing = null
    })()
    return flushing
  }

  return {
    runId,
    /** Log an event. `marker` is a physioMarkers log entry, if this event sent one. */
    event(event, { tMs = performance.now(), marker = null, detail = {} } = {}) {
      const row = {
        ...base, id: crypto.randomUUID(), seq: seq++, event, t_ms: tMs, t_wall: new Date().toISOString(), detail,
        marker: marker?.code ?? null, marker_sent: marker ? marker.sent : null, marker_device: marker?.device ?? null,
      }
      queue.push(['bre_events', row]); flush()
      return row
    },
    /** Save one answered rating. `id` is the one made when the rating screen appeared. */
    rating(r) {
      const row = { ...base, ...r, answered_at: new Date().toISOString() }
      queue.push(['bre_ratings', row]); flush()
      return row
    },
    pending: () => queue.length,
    /** Resolves when everything queued so far has been written (or has failed its retries). */
    drain: () => flush(),
  }
}
