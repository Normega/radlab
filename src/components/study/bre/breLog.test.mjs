import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBreWriter } from './breLog.js'

function fakeDb(failures = []) {
  const rows = []; let call = 0
  return {
    rows,
    from: (table) => ({
      insert: async (row) => {
        const f = failures[call++]
        if (f === 'dup') { rows.push([table, row]); return { error: { code: '23505', message: 'dup' } } }
        if (f) return { error: { code: 'X', message: 'down' } }
        rows.push([table, row]); return { error: null }
      },
    }),
  }
}
const opts = (db) => ({ db, userId: 'u', studyId: 's', scheduleId: 'sch', step: 'bre_main', sleep: async () => {} })

test('events are written in order with a running seq and the marker outcome', async () => {
  const db = fakeDb(); const w = createBreWriter(opts(db))
  w.event('clip_on', { tMs: 5, marker: { code: 31, sent: true, device: 'bbtk' }, detail: { clip: 'A1' } })
  w.event('clip_off', { tMs: 55 })
  await w.drain()
  assert.deepEqual(db.rows.map(([t, r]) => [t, r.seq, r.event, r.marker, r.marker_sent]),
    [['bre_events', 0, 'clip_on', 31, true], ['bre_events', 1, 'clip_off', null, null]])
  assert.equal(db.rows[0][1].run_id, w.runId)
  assert.equal(w.pending(), 0)
})

test('a retry that hits the primary key counts as saved, so nothing is written twice', async () => {
  const db = fakeDb(['down', 'dup']); const w = createBreWriter(opts(db))
  w.rating({ id: 'r1', item_id: 'upset', position: 'upset_b1_m1', value: 4, onset_ms: 1, rt_ms: 900 })
  await w.drain()
  assert.equal(w.pending(), 0)
  assert.equal(db.rows.length, 1)
})

test('a write that keeps failing stays queued, in front of later writes', async () => {
  const db = fakeDb(['down', 'down', 'down']); const w = createBreWriter(opts(db))
  w.event('a'); await w.drain()
  assert.equal(w.pending(), 1)
  w.event('b'); await w.drain()
  assert.deepEqual(db.rows.map(([, r]) => r.event), ['a', 'b'])
  assert.equal(w.pending(), 0)
})
