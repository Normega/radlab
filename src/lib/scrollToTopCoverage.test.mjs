// Every participant-facing screen that pages through content starts each page at
// the top -- including screens written after this test.
//
// Why a structural test: the defect is invisible on a desktop, where a page
// usually fits, and only shows on a phone, where the participant is left at the
// bottom of the next page wherever they tapped Next. It went unnoticed across
// many surveys until Norm hit it on 2026-10-09 (src/lib/scrollToTop.js), and the
// first fix covered seven components and missed seven more. Whether a new
// component pages is a code decision made far from here, so it is asserted.
//
// The rule: in the participant-facing folders below, a component that keeps a
// page-like position in state (page, step, section, screen, slide, phase, item,
// …) must call useScrollToTopOn(<that position>), or be listed in ALLOWED with a
// reason. And every session runner (a file that renders StepDispatcher) must mark
// its scroll panel with data-scroll-root, or scrollToTop has nothing to reset.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

const PARTICIPANT_FACING = [
  'components/study', 'components/questionnaire', 'components/vas', 'components/ScreenerPage.jsx',
  'ripple', 'academic/lecture-lounge',
  'pages/SessionEntry.jsx', 'pages/admin/StudySessionRunner.jsx',
  'pages/OpenJoin.jsx', 'pages/StudySignup.jsx', 'pages/StudyJoin.jsx',
]

const PAGE_STATE = /const \[(page|pageIndex|pageIdx|step|stepIndex|currentStep|currentIndex|sec|section|sectionIndex|screen|screenIndex|slide|slideIdx|slideIndex|phase|itemIndex|pkgIndex|pkgScaleIndex),\s*set\w+\]\s*=\s*useState/

// Paging state that must NOT jump the page, each with its reason.
const ALLOWED = {
  'components/study/GuidedTextBlock.jsx':
    'a block inside a screen (intro → run → done); jumping to the page top would move the participant away from it. The screen around it resets on its own change.',
  'components/study/PhysioSetupStep.jsx':
    'Breath Belt hardware setup run by an RA in the lab; phases change on device events, not a Next press.',
}

function files(rel) {
  const full = join(SRC, rel)
  if (!statSync(full, { throwIfNoEntry: false })) return []
  if (!statSync(full).isDirectory()) return [full]
  return readdirSync(full).flatMap(e => files(join(rel, e))).filter(f => f.endsWith('.jsx'))
}

const all = [...new Set(PARTICIPANT_FACING.flatMap(files))]
const relOf = f => relative(SRC, f).split(sep).join('/')

test('the folders being checked exist (so an empty list cannot pass by accident)', () => {
  assert.ok(all.length > 40, `only ${all.length} files found`)
})

test('every paging participant screen calls useScrollToTopOn, or says why not', () => {
  const missing = []
  for (const f of all) {
    const src = readFileSync(f, 'utf8')
    if (!PAGE_STATE.test(src)) continue
    if (src.includes('useScrollToTopOn(')) continue
    if (ALLOWED[relOf(f)]) continue
    missing.push(relOf(f))
  }
  assert.deepEqual(missing, [],
    'These keep a page/step/section/screen/phase in state but never call useScrollToTopOn: on a phone, ' +
    'each new page opens wherever the participant tapped Next. Add useScrollToTopOn(<that state>) ' +
    '(src/lib/scrollToTop.js), or list the file in ALLOWED with the reason it must not scroll.')
})

test('the allowlist names real files that really have paging state', () => {
  for (const rel of Object.keys(ALLOWED)) {
    const f = join(SRC, rel)
    assert.ok(statSync(f, { throwIfNoEntry: false }), `${rel} no longer exists; remove it from ALLOWED`)
    assert.match(readFileSync(f, 'utf8'), PAGE_STATE, `${rel} no longer pages; remove it from ALLOWED`)
  }
})

test('every session runner marks its scroll panel', () => {
  for (const f of all) {
    const src = readFileSync(f, 'utf8')
    if (!/<StepDispatcher\b/.test(src)) continue
    if (relOf(f) === 'components/study/SessionDemoModal.jsx') {
      // Renders inside DemoModal, which carries the marker.
      assert.match(readFileSync(join(SRC, 'components/DemoModal.jsx'), 'utf8'), /data-scroll-root/)
      continue
    }
    assert.match(src, /data-scroll-root/, `${relOf(f)} renders session steps but no data-scroll-root panel`)
  }
})

test('the rule can see a violation (so a pass means something)', () => {
  const fake = "const [page, setPage] = useState(0)\nreturn <div>{page}</div>"
  assert.match(fake, PAGE_STATE)
  assert.ok(!fake.includes('useScrollToTopOn('))
})
