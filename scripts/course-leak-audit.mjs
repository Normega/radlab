#!/usr/bin/env node
/*
 * course-leak-audit — keeps course identities out of shared code.
 *
 * The rule (academic.md, "One course never wears another's identity"): the
 * URL names the course, per-course configuration lives in registries
 * (courseFeatures.js, the reply-to/DECKS maps), and shared code never
 * hard-codes a course code — especially not as a fallback when no course
 * resolved. Every cross-course bug of 2026-09-05 (PSY240-branded PSY309
 * sign-ins, psy240 retry links, alphabetical course tiebreaks) was one of
 * those hard-codes.
 *
 * Mechanism: same ratchet as design-audit. Counts /\bpsy\d{3}\b/i per file
 * across src/ and api/; a file exceeding its baselined count — or a new file
 * mentioning a course at all — fails the build with a pointer to the rule.
 * Registries and legacy copy live in the baseline; run with --update after
 * deliberately moving something into a registry so the lower count locks in.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BASELINE_PATH = join(ROOT, 'design-audit', 'course-leak-baseline.json')
const SCAN_DIRS = ['src', 'api']
const EXT = /\.(jsx?|mjs)$/

const files = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (EXT.test(e.name)) files.push(p)
  }
}
for (const d of SCAN_DIRS) walk(join(ROOT, d))

const counts = {}
for (const f of files) {
  const n = (readFileSync(f, 'utf8').match(/\bpsy\d{3}\b/gi) ?? []).length
  if (n) counts[relative(ROOT, f).replaceAll('\\', '/')] = n
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n')
  console.log(`course-leak-audit · baseline updated (${Object.keys(counts).length} files)`)
  process.exit(0)
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {}
const offenders = Object.entries(counts)
  .filter(([f, n]) => n > (baseline[f] ?? 0))
  .map(([f, n]) => `  ${f}: ${n} course-code mention${n === 1 ? '' : 's'} (baseline ${baseline[f] ?? 0})`)

if (offenders.length) {
  console.error('course-leak-audit · new hard-coded course references:\n' + offenders.join('\n'))
  console.error(
    '\nCourse codes belong in registries (courseFeatures.js, courseRoutes maps),\n' +
    'never in shared code and NEVER as a fallback when no course resolved —\n' +
    "that is how PSY309 users got PSY240's sign-in emails. See academic.md.\n" +
    'Deliberately extending a registry? node scripts/course-leak-audit.mjs --update',
  )
  process.exit(1)
}
console.log(`course-leak-audit · clean (${Object.keys(counts).length} baselined files, no new leaks)`)
