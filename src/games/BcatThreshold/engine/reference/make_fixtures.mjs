// How the reference fixtures in this folder were made. Not run by the tests.
//
//   node src/games/BcatThreshold/engine/reference/make_fixtures.mjs "<path to 6_online_pilot/tests/reference>"
//
// Source: NextStudy/Thresholds/6_online_pilot/tests/reference/ on the Interoception drive. Those files
// were written by make_reference.py and make_reference_stable_sort.py from unchanged, SHA-256-checked
// copies of the Python prototype (4_task_prototype: ae_engine.py, bcat_adaptive.py 0.3.0, the YAML).
//
// Every file is copied byte for byte except case_A_default_40.json. Its spec.logL_slowing_rows holds three
// full likelihood rows of the slowing cell (3 x 336,600 numbers, 20 MB). Here each row is replaced by
// spec.logL_slowing_rows_sampled: every STRIDE-th value (index 0, STRIDE, 2*STRIDE, ...), plus the sum and
// the sum of absolute values of the whole row, summed in index order. Everything else in case A is unchanged.
// provenance.json records the SHA-256 of every source file and every file written.

import { readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const STRIDE = 211   // prime, so the samples fall across every grid dimension of the row
const src = process.argv[2]
if (!src) { console.error('usage: node make_fixtures.mjs <source reference folder>'); process.exit(1) }
const out = dirname(fileURLToPath(import.meta.url))
const sha = buf => createHash('sha256').update(buf).digest('hex')

const files = readdirSync(src).filter(f => /^(case_.*|ndtr|readouts_stable_sort)\.json$/.test(f)).sort()
const provenance = { source: 'NextStudy/Thresholds/6_online_pilot/tests/reference/', stride: STRIDE, files: {} }
for (const f of files) {
  const buf = readFileSync(join(src, f))
  const entry = { source_sha256: sha(buf), source_bytes: buf.length }
  if (f === 'case_A_default_40.json') {
    const j = JSON.parse(buf)
    const sampled = {}
    for (const [key, row] of Object.entries(j.spec.logL_slowing_rows)) {
      let sum = 0, sumAbs = 0
      for (let i = 0; i < row.length; i++) { sum += row[i]; sumAbs += Math.abs(row[i]) }
      const values = []
      for (let i = 0; i < row.length; i += STRIDE) values.push(row[i])
      sampled[key] = { n: row.length, stride: STRIDE, sum, sum_abs: sumAbs, values }
    }
    delete j.spec.logL_slowing_rows
    j.spec.logL_slowing_rows_sampled = sampled
    writeFileSync(join(out, f), JSON.stringify(j))
    entry.reduced = 'spec.logL_slowing_rows -> spec.logL_slowing_rows_sampled'
  } else {
    copyFileSync(join(src, f), join(out, f))
  }
  const written = readFileSync(join(out, f))
  entry.fixture_sha256 = sha(written)
  entry.fixture_bytes = written.length
  provenance.files[f] = entry
}
writeFileSync(join(out, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n')
console.log(`wrote ${files.length} fixtures and provenance.json to ${out}`)
