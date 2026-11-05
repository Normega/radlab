// Run directly:  node src/games/FoggyValleys/valleyOrder.test.mjs
//
// Which fog each Foggy Valleys session step runs, from the drawn valley order.
// A missing or unknown order must give null, so the step fails closed.

import { fogFor, VALLEY_ORDERS } from './valleyOrder.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

check('thin first: light mist, then heavy fog',
  fogFor(1, { valley_order: 'thin_first' }) === 'thin' && fogFor(2, { valley_order: 'thin_first' }) === 'thick')
check('thick first: heavy fog, then light mist',
  fogFor(1, { valley_order: 'thick_first' }) === 'thick' && fogFor(2, { valley_order: 'thick_first' }) === 'thin')
check('each order plays both fogs once',
  Object.values(VALLEY_ORDERS).every(o => [...o].sort().join() === 'thick,thin'))
check('no drawn order fails closed', fogFor(1, null) === null && fogFor(1, {}) === null && fogFor(2, { relaxation_arm: 'breathing' }) === null)
check('an unknown order fails closed', fogFor(1, { valley_order: 'thin' }) === null)
check('a third position does not exist', fogFor(3, { valley_order: 'thin_first' }) === null)

console.log(`valleyOrder: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
