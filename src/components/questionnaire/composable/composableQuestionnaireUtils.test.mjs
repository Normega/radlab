// Run directly:  node src/components/questionnaire/composable/composableQuestionnaireUtils.test.mjs
//
// The validator's one empty-page exception (Norm, 23 Nov 2026): an introduction-only
// definition -- instructions, and pages that are all empty -- is valid, so the Sense
// Foraging 2b retest's sf2b-retest-intro passes the admin builder as well as the
// renderer. Any other empty page is still an error.
//
// The validator imports the component registry, whose components are .jsx and whose
// imports are extensionless (Vite resolves them). A small resolve hook stands in for
// Vite: .jsx modules become an empty stub, extensionless relative imports get .js.

import { register } from 'node:module'

const HOOK = `
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
const STUB = 'data:text/javascript,export default function Stub(){}'
export async function resolve(specifier, context, next) {
  if (specifier.endsWith('.jsx')) return { url: STUB, shortCircuit: true }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !path.extname(specifier)
      && context.parentURL?.startsWith('file:')) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
    if (existsSync(base + '.js')) return next(pathToFileURL(base + '.js').href, context)
    if (existsSync(base + '.jsx')) return { url: STUB, shortCircuit: true }
  }
  return next(specifier, context)
}
`
register('data:text/javascript,' + encodeURIComponent(HOOK))

const { validateComposableDefinition } = await import('./composableQuestionnaireUtils.js')
const { isIntroductionOnly } = await import('../../../lib/introductionOnly.js')

let pass = 0, fail = 0
function check(name, cond) {
  if (cond) { pass++ } else { fail++; console.error(`  FAIL: ${name}`) }
}

const INSTRUCTIONS = 'People notice things in different ways.\n\nIn the doing mode, ...'
const intro = {
  slug: 'sf2b-retest-intro',
  name: 'Two ways of noticing',
  questionnaire_type: 'composable',
  instructions: INSTRUCTIONS,
  pages: [{ id: 'intro_p1', components: [] }],
}
const likert = { id: 'q1', type: 'likert', question: 'Q?', scale: [{ value: 1, label: 'No' }, { value: 2, label: 'Yes' }] }

// 1. The retest introduction is valid, and recognised as introduction-only.
check('introduction-only definition is valid', validateComposableDefinition(intro).length === 0)
check('isIntroductionOnly(intro)', isIntroductionOnly(intro))
check('two empty pages with instructions also valid',
  validateComposableDefinition({ ...intro, pages: [{ id: 'a', components: [] }, { id: 'b', components: [] }] }).length === 0)

// 2. Exactly that case: without instructions, an empty page is still an error.
for (const [label, instructions] of [['no instructions', undefined], ['empty instructions', ''], ['blank instructions', '  \n ']]) {
  const d = { ...intro, instructions }
  check(`${label}: empty page refused`, validateComposableDefinition(d).some(e => /add at least one component/.test(e)))
  check(`${label}: not introduction-only`, !isIntroductionOnly(d))
}

// 3. A mix of empty and filled pages is not introduction-only: the empty page is refused.
{
  const d = { ...intro, pages: [{ id: 'a', components: [] }, { id: 'b', components: [likert] }] }
  check('mixed pages: not introduction-only', !isIntroductionOnly(d))
  check('mixed pages: empty page refused', validateComposableDefinition(d).some(e => /Page 1: add at least one component/.test(e)))
}

// 4. Nothing else loosened: no pages at all is still refused, and a normal definition is still valid.
check('no pages refused', validateComposableDefinition({ ...intro, pages: [] }).length > 0)
check('not introduction-only without pages', !isIntroductionOnly({ ...intro, pages: [] }))
check('normal definition valid', validateComposableDefinition({ ...intro, pages: [{ id: 'p', components: [likert] }] }).length === 0)
check('normal definition is not introduction-only', !isIntroductionOnly({ ...intro, pages: [{ id: 'p', components: [likert] }] }))

console.log(`composableQuestionnaireUtils: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
