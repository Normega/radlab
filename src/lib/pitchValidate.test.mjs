// Run directly:  node src/lib/pitchValidate.test.mjs
//
// Server-side validation for api/pitch.js (the /lab/contact pitch form), and
// the honeypot path through the handler. The handler's database and email
// steps need live services and are verified on the deployment instead.

import { validatePitch, default as handler } from '../../api/pitch.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

const good = {
  name: '  Ada Lovelace ',
  email: 'ada@example.com',
  role: 'undergrad',
  build_what: 'A breath-paced rhythm game for first-year students.',
  values_fit: 'It trains slow exhalation through play, not instruction.',
  portfolio_url: 'https://example.com/my-game',
}

{
  const r = validatePitch(good)
  check('valid pitch passes', r.ok)
  check('fields are trimmed', r.ok && r.value.name === 'Ada Lovelace')
  check('honeypot is not part of the stored value', r.ok && !('website' in r.value))
}

const bad = [
  ['missing name', { ...good, name: '   ' }],
  ['bad email', { ...good, email: 'ada@example' }],
  ['unknown role', { ...good, role: 'professor' }],
  ['short build answer', { ...good, build_what: 'a game' }],
  ['short values answer', { ...good, values_fit: 'breath' }],
  ['long answer', { ...good, values_fit: 'x'.repeat(3001) }],
  ['long name', { ...good, name: 'x'.repeat(121) }],
  ['missing link', { ...good, portfolio_url: '' }],
  ['link without scheme', { ...good, portfolio_url: 'example.com' }],
  ['javascript: link', { ...good, portfolio_url: 'javascript:alert(1)' }],
  ['ftp link', { ...good, portfolio_url: 'ftp://example.com/file' }],
  ['null body', null],
]
for (const [name, body] of bad) check(`${name} is rejected`, validatePitch(body).ok === false)

function fakeRes() {
  return {
    statusCode: null, payload: null, headers: {},
    status(c) { this.statusCode = c; return this },
    json(p) { this.payload = p; return this },
    setHeader(k, v) { this.headers[k] = v },
  }
}

{
  const res = fakeRes()
  await handler({ method: 'GET', headers: {}, body: {} }, res)
  check('GET is refused with 405', res.statusCode === 405)
}

{
  // No env vars are set here, so reaching the database would return 500.
  // A 200 proves the honeypot returns before any storage or email.
  const res = fakeRes()
  await handler({ method: 'POST', headers: {}, body: { ...good, website: 'http://spam.example' } }, res)
  check('filled honeypot gets a silent 200', res.statusCode === 200 && res.payload?.ok === true)
}

console.log(`pitchValidate: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
