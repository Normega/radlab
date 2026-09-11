// Run directly:  node src/lib/experimentGraphEntryLock.test.mjs
//
// The Experiment Builder pins exactly ONE timepoint: the graph's entry, which
// validate() requires to sit at day_offset 0. Until 2026-09-11 the builder
// pinned by VALUE instead (`day_offset === 0`), so every later timepoint set to
// day 0 had its offset field disabled and its Remove button hidden — and since
// clearing the field yields Number('') === 0, one stray keystroke locked a node
// for good. A live study (PHL245) ended up with four test sessions at day 0 and
// no way to move them in the UI.
//
// These checks pin the rule to the graph's structure, using that study's real
// shape: five day-0 timepoints, of which only the first may be locked.

import { entryNode } from './experimentGraph.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

// Shape of "Academic Feedback Study (PHL245)" as of 2026-09-11: every timepoint
// at day 0, the leftover of same-day testing.
const PHL245 = {
  nodes: [
    { id: 'ts1hhjalnu', type: 'timepoint', label: 'Time 0', day_offset: 0 },
    { id: 'xiu2jorzt',  type: 'timepoint', label: 'Time 1', day_offset: 0 },
    { id: 'bvh5l8je6',  type: 'session',   label: 'Baseline' },
    { id: 'se129x7vp',  type: 'session',   label: 'PHL245 Test 1' },
    { id: '6v87da0y8',  type: 'timepoint', label: 'Time 2', day_offset: 0 },
    { id: '9jwoveil1',  type: 'session',   label: 'PHL245 Test 2' },
    { id: 'x0xhml9n3',  type: 'timepoint', label: 'Time 3', day_offset: 0 },
    { id: 'mcudgqqlj',  type: 'session',   label: 'PHL245 Test 3' },
    { id: 'vbmt1i9wg',  type: 'timepoint', label: 'Time 4', day_offset: 0 },
    { id: 'rm16zz48k',  type: 'session',   label: 'PHL245 Test 4' },
  ],
  edges: [
    { from: 'ts1hhjalnu', to: 'bvh5l8je6' }, { from: 'bvh5l8je6', to: 'xiu2jorzt' },
    { from: 'xiu2jorzt',  to: 'se129x7vp' }, { from: 'se129x7vp', to: '6v87da0y8' },
    { from: '6v87da0y8',  to: '9jwoveil1' }, { from: '9jwoveil1', to: 'x0xhml9n3' },
    { from: 'x0xhml9n3',  to: 'mcudgqqlj' }, { from: 'mcudgqqlj', to: 'vbmt1i9wg' },
    { from: 'vbmt1i9wg',  to: 'rm16zz48k' },
  ],
}

// The same predicate EditPanel uses.
const isLocked = (g, id) => entryNode(g)?.id === id

const timepoints = PHL245.nodes.filter(n => n.type === 'timepoint')

check('entry is Time 0', entryNode(PHL245)?.id === 'ts1hhjalnu')
check('exactly one timepoint is locked',
  timepoints.filter(n => isLocked(PHL245, n.id)).length === 1)
for (const n of timepoints.filter(n => n.label !== 'Time 0')) {
  check(`${n.label} (day 0) stays editable and removable`, !isLocked(PHL245, n.id))
}

// The regression this replaced: locking by value would have caught all five.
const lockedByValue = timepoints.filter(n => n.day_offset === 0).length
check('the old value-based rule would have locked all five timepoints', lockedByValue === 5)

// Order in the nodes array must not matter — the entry is structural.
const shuffled = { ...PHL245, nodes: [...PHL245.nodes].reverse() }
check('entry is found by structure, not array position', entryNode(shuffled)?.id === 'ts1hhjalnu')

console.log(`experimentGraphEntryLock: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
