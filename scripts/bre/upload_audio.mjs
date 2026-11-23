// WP-M2: upload the four rendered audio files (scripts/tts/bre_audio.py) to the private `audios`
// bucket and study_audios (folder "ER Audio"), titled by key. Idempotent: an existing title is
// skipped, so re-rendering means deleting the old rows in /admin/audio first.
//
//   node scripts/bre/upload_audio.mjs "I:/Shared drives/Maya/Design/audio" [--upload]
import { readFileSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const dir = process.argv[2]
const doUpload = process.argv.includes('--upload')
if (!dir) { console.error('usage: upload_audio.mjs <audio dir> [--upload]'); process.exit(1) }
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

const FOLDER = 'ER Audio'
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
const { data: existing, error } = await db.from('study_audios').select('title, storage_path').eq('folder', FOLDER)
if (error) throw error
const have = new Set((existing ?? []).map(r => r.title))

let failed = 0
for (const [key, clip] of Object.entries(manifest.clips)) {
  const file = `${key}.mp3`
  const { size } = statSync(join(dir, file))
  const line = `${key.padEnd(13)} ${clip.seconds.toFixed(2)}s ${(size / 1e3).toFixed(0)} KB`
  if (have.has(key)) { console.log(`${line}  exists`); continue }
  if (!doUpload) { console.log(`${line}  would upload`); continue }
  const path = `er_audio/${randomUUID().replace(/-/g, '').slice(0, 8)}_${key}.mp3`
  const { error: upErr } = await db.storage.from('audios').upload(path, readFileSync(join(dir, file)), {
    contentType: 'audio/mpeg', cacheControl: '3600', upsert: false,
  })
  if (upErr) { console.log(`${line}  UPLOAD FAILED: ${upErr.message}`); failed++; continue }
  const { error: rowErr } = await db.from('study_audios').insert({
    title: key, folder: FOLDER, storage_path: path, file_name: file,
    file_size_bytes: size, duration_seconds: Math.round(clip.seconds),
  })
  if (rowErr) { await db.storage.from('audios').remove([path]); console.log(`${line}  ROW FAILED: ${rowErr.message}`); failed++; continue }
  console.log(`${line}  uploaded -> ${path}`)
}
if (failed) process.exit(1)
