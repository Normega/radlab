// The class RCT's two text arms as SQL for intervention_modules (Oct 2026).
//
//   node scripts/classrct/modules-sql.mjs nr > nr.sql    (or sm)
//
// Bundles src/data/classRct/<arm>.js with rolldown (the data files use
// extensionless imports, which plain Node cannot load), then prints one upsert
// per day keyed on module_id, so re-running after a content edit replaces the
// definitions in place. Apply with the Supabase MCP or the SQL editor. The
// modules are the definitions exactly as /dev/class-rct renders them.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const FILES = { nr: 'nonreactivity', sm: 'reappraisal' }
const arm = process.argv[2]
if (!FILES[arm]) { console.error('usage: modules-sql.mjs nr|sm'); process.exit(1) }

const dir = mkdtempSync(join(tmpdir(), 'classrct-'))
const out = join(dir, `${arm}.mjs`)
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['rolldown', `src/data/classRct/${FILES[arm]}.js`, '--format', 'esm', '--file', out],
  { stdio: 'ignore', shell: process.platform === 'win32' })
const { MODULES } = await import(pathToFileURL(out).href)
rmSync(dir, { recursive: true, force: true })

const lit = s => s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`
const rows = Object.values(MODULES).map(m => {
  const json = JSON.stringify(m)
  if (json.includes('$def$')) throw new Error(`${m.module_id}: definition contains the quote tag`)
  return `(${lit(m.module_id)}, ${lit(m.condition)}, ${lit(m.phase)}, ${m.lesson}, ${lit(m.title)}, ${lit(m.subtitle)}, $def$${json}$def$::jsonb)`
})
console.log(`-- ${FILES[arm]}: ${rows.length} modules, generated ${new Date().toISOString()}
insert into intervention_modules (module_id, condition, phase, lesson, title, subtitle, definition)
values
${rows.join(',\n')}
on conflict (module_id) do update set
  condition = excluded.condition, phase = excluded.phase, lesson = excluded.lesson,
  title = excluded.title, subtitle = excluded.subtitle, definition = excluded.definition;`)
