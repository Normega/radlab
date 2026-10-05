// Batch schedule builder for the BCAT-DDM power simulation.
// Reads a JSON array of { key, design, options } and writes { key: schedule }
// using the same generator the task will run (src/games/BcatDdm/schedule.js).
//
//   node scripts/bcat_ddm_sim/make_schedules.mjs <spec.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { buildSchedule } from '../../src/games/BcatDdm/schedule.js'

const [specPath, outPath] = process.argv.slice(2)
if (!specPath || !outPath) {
  console.error('usage: node make_schedules.mjs <spec.json> <out.json>')
  process.exit(1)
}

const specs = JSON.parse(readFileSync(specPath, 'utf8'))
const out = {}
for (const { key, design, options } of specs) {
  const s = buildSchedule(design, options)
  // Python needs only timing + events; drop the echoed options to keep the file small.
  out[key] = { design: s.design, durationMs: s.durationMs, breaths: s.breaths, pauses: s.pauses, events: s.events }
}
writeFileSync(outPath, JSON.stringify(out))
console.log(`wrote ${specs.length} schedules → ${outPath}`)
