// Run: node --experimental-strip-types supabase/functions/buddy_send/logic.test.mjs
// (npm test picks it up too.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  torontoNow, inSendWindow, isPaused, currentMilestone, newlyCompleted, pickQuote,
  formatMeeting, formatDate, randomToken, sha256Hex,
} from './logic.ts'
import { renderBuddyEmail } from './email.ts'

test('Toronto time: 8:00 EDT Monday is 12:00 UTC', () => {
  const t = torontoNow(new Date('2026-09-28T12:00:00Z'))
  assert.deepEqual(t, { date: '2026-09-28', hour: 8, isoDow: 1 })
  assert.equal(inSendWindow(t), true)
})

test('Toronto time: 8:00 EST (after DST ends) is 13:00 UTC', () => {
  assert.equal(torontoNow(new Date('2026-11-02T12:00:00Z')).hour, 7)
  assert.deepEqual(torontoNow(new Date('2026-11-02T13:00:00Z')), { date: '2026-11-02', hour: 8, isoDow: 1 })
})

test('Toronto date rolls over at Toronto midnight, not UTC midnight', () => {
  // 01:30 UTC Tuesday = 21:30 Monday in Toronto
  assert.deepEqual(torontoNow(new Date('2026-09-29T01:30:00Z')), { date: '2026-09-28', hour: 21, isoDow: 1 })
  assert.equal(torontoNow(new Date('2026-09-28T04:00:00Z')).hour, 0) // midnight is 0, not 24
})

test('send window: weekdays 8–11 only', () => {
  const at = (isoDow, hour) => inSendWindow({ date: 'x', hour, isoDow })
  assert.equal(at(1, 7), false)
  assert.equal(at(1, 8), true)
  assert.equal(at(5, 11), true)
  assert.equal(at(5, 12), false)
  assert.equal(at(6, 8), false)
  assert.equal(at(7, 9), false)
})

test('pause is inclusive of paused_until', () => {
  assert.equal(isPaused('2026-10-05', '2026-10-05'), true)
  assert.equal(isPaused('2026-10-05', '2026-10-06'), false)
  assert.equal(isPaused(null, '2026-10-06'), false)
})

const ms = [
  { position: 2, title: 'B', target_date: '2026-10-16', done_at: null },
  { position: 1, title: 'A', target_date: '2026-10-09', done_at: '2026-10-08T15:00:00Z' },
  { position: 3, title: 'C', target_date: null, done_at: null },
]

test('current milestone is the lowest unfinished position', () => {
  assert.equal(currentMilestone(ms).title, 'B')
  assert.equal(currentMilestone(ms.map(m => ({ ...m, done_at: 'x' }))), null)
})

test('celebration: only milestones done after the previous send', () => {
  assert.deepEqual(newlyCompleted(ms, '2026-10-08T12:00:00Z').map(m => m.title), ['A'])
  assert.deepEqual(newlyCompleted(ms, '2026-10-09T12:00:00Z'), [])
  assert.deepEqual(newlyCompleted(ms, null), [], 'no previous send → no celebration')
})

test('quotes: never a repeat until every active quote has been used', () => {
  const quotes = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}` }))
  const uses = new Map()
  const seen = []
  for (let i = 0; i < 10; i++) {
    const q = pickQuote(quotes, uses)
    seen.push(q.id)
    uses.set(q.id, (uses.get(q.id) ?? 0) + 1)
  }
  assert.equal(new Set(seen.slice(0, 5)).size, 5)
  assert.equal(new Set(seen.slice(5)).size, 5)
})

test('quotes: a newly added quote goes to the front', () => {
  const uses = new Map([['a', 3], ['b', 3]])
  assert.equal(pickQuote([{ id: 'a' }, { id: 'b' }, { id: 'new' }], uses).id, 'new')
  assert.equal(pickQuote([], uses), null)
})

test('formatting matches the spec examples', () => {
  assert.equal(formatMeeting('2026-10-02T19:00:00+00:00'), 'Fri Oct 2, 3:00 pm')
  assert.equal(formatDate('2026-10-09'), 'Fri Oct 9')
})

test('token is 64 hex chars and hashes like the database does', async () => {
  const t = randomToken()
  assert.match(t, /^[0-9a-f]{64}$/)
  assert.notEqual(t, randomToken())
  assert.equal(await sha256Hex(t), createHash('sha256').update(t).digest('hex'))
})

const base = {
  firstName: 'John', current: ms[0], completed: [], linkUrl: 'https://radlab.zone/buddy/abc',
  meetingAt: '2026-10-02T19:00:00+00:00', zoomUrl: 'https://utoronto.zoom.us/my/normanfarb',
  quote: { quote: '"Make it so."', source: 'Captain Picard', tag: 'The reading list will not make itself so.' },
}

test('email: subject, copy, and quote below the button', () => {
  const e = renderBuddyEmail(base)
  assert.equal(e.subject, "Today's check-in: B")
  assert.match(e.html, /Morning, John,/)
  assert.match(e.html, /Current milestone: <strong>B<\/strong> \(target Fri Oct 16\)/)
  assert.match(e.html, /Next meeting with Norm: Fri Oct 2, 3:00 pm\./)
  assert.match(e.html, /Reply to this email to reach Norm/)
  assert.ok(e.html.indexOf('>Check in</a>') < e.html.indexOf('Make it so'), 'quote must sit below the button')
  assert.match(e.text, /"Make it so\." \(Captain Picard\)\. The reading list/)
  assert.doesNotMatch(e.html, /Milestone complete/)
})

test('email: the only link that is not Zoom is the check-in page (Safe Links)', () => {
  const hrefs = [...renderBuddyEmail(base).html.matchAll(/href="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(hrefs.filter(h => !h.includes('zoom.us')), ['https://radlab.zone/buddy/abc'])
})

test('email: celebration, no meeting, test prefix, escaping', () => {
  const e = renderBuddyEmail({ ...base, completed: [ms[1]], meetingAt: null, isTest: true,
    current: { ...ms[0], title: 'Read <everything> & more' } })
  assert.match(e.subject, /^\[TEST\] Today's check-in: Read <everything>/)
  assert.match(e.html, /Milestone complete: <strong>A<\/strong>\. Next up: Read &lt;everything&gt; &amp; more\./)
  assert.doesNotMatch(e.html, /Next meeting/)
  assert.ok(e.html.indexOf('Milestone complete') < e.html.indexOf('Morning, John'), 'celebration opens the email')
})
