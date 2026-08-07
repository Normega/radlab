// The lapsed tier of renderEmail: which lead-in wins, when the withdrawal
// link appears, and that the progress line rides lapsed sends the way it
// already rode single-miss ones. The precedence chain matters most — a
// reminder resend must never carry the withdrawal offer, because its copy
// nudges about a link that is still live.
//
// Run: node supabase/functions/_shared/emailTemplate.test.mjs
// On Node < 22.18 (type stripping not yet on by default), add the flag:
//   node --experimental-strip-types supabase/functions/_shared/emailTemplate.test.mjs
import assert from 'node:assert'
import { test } from 'node:test'
import { renderEmail } from './emailTemplate.ts'

const BASE = {
  first_name: 'Ada',
  study_day: 5,
  link_url: 'https://radlab.zone/s/tok123',
  expires_hours: 8,
  custom_subject: null,
  custom_body: null,
  unsubscribe_url: 'https://radlab.zone/unsubscribe/unsub123',
}

const WITHDRAW_URL = 'https://radlab.zone/withdraw/unsub123'

test('lapsed send leads with the get-back-on-track copy and carries the withdrawal link', () => {
  const { html, text } = renderEmail({
    ...BASE,
    lapsed: true,
    withdraw_url: WITHDRAW_URL,
    progress: { completed: 3, total: 12, pct: 25 },
  })
  assert.match(text, /missed a few check-ins in a row/)
  assert.match(text, /formally withdraw/)
  assert.match(text, /responded to 3 out of 12 check-ins \(25%\)/)
  assert.ok(text.includes(WITHDRAW_URL), 'plain text carries the withdraw URL')
  assert.ok(html.includes(WITHDRAW_URL), 'html carries the withdraw URL')
  assert.ok(html.includes('you can do that here'), 'html renders the withdraw paragraph')
})

test('single-miss ack is unchanged and never shows a withdrawal link', () => {
  const { html, text } = renderEmail({
    ...BASE,
    after_missed: true,
    progress: { completed: 8, total: 10, pct: 80 },
  })
  assert.match(text, /Missing the occasional session is normal/)
  assert.ok(!text.includes('withdraw/'), 'no withdraw URL in text')
  assert.ok(!html.includes('withdraw/'), 'no withdraw URL in html')
  assert.ok(!html.includes('{{withdraw_html}}'), 'placeholder is cleared, not leaked')
})

test('reminder lead-in wins over lapsed', () => {
  const { text } = renderEmail({
    ...BASE,
    is_reminder: true,
    lapsed: true,
    progress: { completed: 3, total: 12, pct: 25 },
  })
  assert.match(text, /Just a friendly reminder/)
  assert.ok(!text.includes('missed a few check-ins in a row'))
})

test('final notice wins over everything and suppresses the progress line', () => {
  const { text } = renderEmail({
    ...BASE,
    final_notice: 'window',
    lapsed: true,
    progress: { completed: 3, total: 12, pct: 25 },
  })
  assert.match(text, /final reminder/)
  assert.ok(!text.includes('responded to'))
  assert.ok(!text.includes('missed a few check-ins in a row'))
})

test('plain send leaks neither placeholder nor withdraw copy', () => {
  const { html, text } = renderEmail(BASE)
  assert.ok(!html.includes('{{withdraw_html}}'))
  assert.ok(!html.includes('withdraw'))
  assert.ok(!text.includes('withdraw'))
})
