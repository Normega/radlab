// WP-M1: upload the 16 film clips of the Breath Attention and Emotional Recovery study to the
// private `videos` bucket and the video library (folder "ER Clips"), titled with the lab ids
// used in the REB documents (A1, S4, N2, P1, ...). Same storage-path shape and row fields as
// /admin/videos/new (src/pages/admin/VideoUpload.jsx). Idempotent: a title already in the
// folder is skipped, so a rerun only fills gaps.
//
//   node scripts/bre/upload_clips.mjs "I:/Shared drives/Maya/Videos"          # dry run
//   node scripts/bre/upload_clips.mjs "I:/Shared drives/Maya/Videos" --upload
//
// Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY (an sb_secret_ key) in .env.local, and
// ffprobe on PATH for the duration and the 1280x720 pre-flight check.
import { readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.argv[2]
const doUpload = process.argv.includes('--upload')
if (!root) { console.error('usage: upload_clips.mjs <Videos dir> [--upload]'); process.exit(1) }

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

const FOLDER = 'ER Clips'
const POOL = { A: 'Anger', S: 'Sadness', N: 'Neutral', P: 'Neutral (practice)' }
const CLIPS = [
  ['A1', 'Anger/Anger1.mp4'], ['A3', 'Anger/Anger3.mp4'], ['A4', 'Anger/Anger4.mp4'], ['A7', 'Anger/Anger7.mp4'],
  ['S3', 'Sadness/Sad3.mp4'], ['S4', 'Sadness/Sad4.mp4'], ['S5', 'Sadness/Sad5.mp4'], ['S6', 'Sadness/Sad6.mp4'], ['S8', 'Sadness/Sad8.mp4'],
  ['N1', 'Neutral/Neutral1.mp4'], ['N2', 'Neutral/Neutral2.mp4'], ['N3', 'Neutral/Neutral3.mp4'], ['N5', 'Neutral/Neutral5.mp4'], ['N8', 'Neutral/Neutral8.mp4'],
  ['P1', 'Practice/Practice1.mp4'], ['P2', 'Practice/Practice2.mp4'],
]

function probe(path) {
  const out = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', path]))
  const v = out.streams.find(s => s.codec_type === 'video')
  return { width: v?.width, height: v?.height, codec: v?.codec_name, duration: Number(out.format.duration) }
}

const { data: existing, error: exErr } = await db.from('video_library').select('id, title, storage_path').eq('folder', FOLDER)
if (exErr) throw exErr
const have = new Map((existing ?? []).map(r => [r.title, r]))

let failed = 0
for (const [title, rel] of CLIPS) {
  const path = join(root, rel)
  const { size } = statSync(path)
  const m = probe(path)
  const ok = m.width === 1280 && m.height === 720 && m.codec === 'h264'
  const line = `${title.padEnd(3)} ${rel.padEnd(24)} ${m.width}x${m.height} ${m.codec} ${m.duration.toFixed(2)}s ${(size / 1e6).toFixed(1)} MB`
  if (!ok) { console.log(`${line}  PRE-FLIGHT FAIL`); failed++; continue }
  if (have.has(title)) { console.log(`${line}  exists (${have.get(title).storage_path})`); continue }
  if (!doUpload) { console.log(`${line}  would upload`); continue }

  const base = rel.split('/').pop().replace(/\.mp4$/i, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase()
  const storagePath = `er_clips/${randomUUID().replace(/-/g, '').slice(0, 8)}_${base}.mp4`
  const { error: upErr } = await db.storage.from('videos').upload(storagePath, readFileSync(path), {
    contentType: 'video/mp4', cacheControl: '3600', upsert: false,
  })
  if (upErr) { console.log(`${line}  UPLOAD FAILED: ${upErr.message}`); failed++; continue }
  const { error: rowErr } = await db.from('video_library').insert({
    title,
    description: `${POOL[title[0]]} clip ${title}, Breath Attention and Emotional Recovery study (REB clip id). Source file ${rel}.`,
    folder: FOLDER,
    storage_path: storagePath,
    file_name: rel.split('/').pop(),
    duration_secs: Math.round(m.duration),
    file_size_bytes: size,
    mime_type: 'video/mp4',
    created_by: null,
  })
  if (rowErr) {
    await db.storage.from('videos').remove([storagePath])
    console.log(`${line}  ROW FAILED (file removed): ${rowErr.message}`); failed++; continue
  }
  console.log(`${line}  uploaded -> ${storagePath}`)
}
if (failed) { console.error(`${failed} clip(s) failed`); process.exit(1) }
