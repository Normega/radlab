// Run directly:  node src/lib/armSteps.test.mjs
//
// Arm-conditional steps (session_template_nodes.show_if). The Sense Foraging 2b retest
// gives the vignette arm sf2b-vignettes and the no-vignette arm its introduction alone;
// everything after is shared. The checks that matter: a session without show_if is
// untouched, each arm gets exactly its steps, and a missing arm is never read as
// "show everything".

import { armSlotsOf, stepsForArms } from './armSteps.js'

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

const SLOT = 'sf2b_retest_vignettes'
const retest = [
  { id: 'v',  show_if: { slot: SLOT, in: ['vignettes'] } },
  { id: 'i',  show_if: { slot: SLOT, in: ['no_vignettes'] } },
  { id: 'scale' }, { id: 'cand' }, { id: 'ffmq' }, { id: 'prac' }, { id: 'debrief', show_if: null },
]
const ids = nodes => (nodes ?? []).map(n => n.id).join(',')

// 1. No conditions anywhere: no slots, every step kept in order (every study today).
{
  const plain = [{ id: 'a' }, { id: 'b', shuffle_group: 'g' }, { id: 'c' }]
  check('no show_if → no slots', armSlotsOf(plain).length === 0)
  check('no show_if → every step', ids(stepsForArms(plain, {})) === 'a,b,c')
  check('no show_if, no arms object → every step', ids(stepsForArms(plain, undefined)) === 'a,b,c')
  check('null nodes → no slots', armSlotsOf(null).length === 0)
  check('null nodes → empty list', stepsForArms(null, {}).length === 0)
}

// 2. The retest's two arms: six steps each, alternatives only at the start.
{
  check('one slot named', armSlotsOf(retest).join() === SLOT)
  const vig = stepsForArms(retest, { [SLOT]: 'vignettes' })
  const nov = stepsForArms(retest, { [SLOT]: 'no_vignettes' })
  check('vignette arm', ids(vig) === 'v,scale,cand,ffmq,prac,debrief')
  check('no-vignette arm', ids(nov) === 'i,scale,cand,ffmq,prac,debrief')
  check('both arms six steps', vig.length === 6 && nov.length === 6)
}

// 3. Fails closed: a missing or malformed arm returns null, never the full list.
{
  check('missing arm → null', stepsForArms(retest, {}) === null)
  check('no arms object → null', stepsForArms(retest, undefined) === null)
  check('object arm → null', stepsForArms(retest, { [SLOT]: { value: 'vignettes' } }) === null)
  check('malformed in → null', stepsForArms([{ id: 'x', show_if: { slot: SLOT, in: 'vignettes' } }], { [SLOT]: 'vignettes' }) === null)
  check('unknown arm value → only unconditioned steps', ids(stepsForArms(retest, { [SLOT]: 'other' })) === 'scale,cand,ffmq,prac,debrief')
}

console.log(`armSteps: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
