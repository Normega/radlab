#!/usr/bin/env node
// Upload Tune's audio clips to the `public-assets` Supabase Storage bucket under
// tune-audio/. One-time setup (and re-run whenever clips change).
//
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/upload-tune-audio.mjs ./tune-audio-clips
//
// The service-role key bypasses RLS to write to Storage — keep it out of the repo
// and out of the browser; run this only locally/CI. The last arg is the folder of
// <clipId>.mp3 files (defaults to ./tune-audio-clips).

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const dir = process.argv[2] || './tune-audio-clips'
const BUCKET = 'public-assets'
const PREFIX = 'tune-audio'

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const files = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.mp3'))
if (!files.length) { console.error(`No .mp3 files in ${dir}`); process.exit(1) }

let ok = 0, fail = 0
for (const f of files) {
  const body = readFileSync(join(dir, f))
  const { error } = await supabase.storage.from(BUCKET).upload(`${PREFIX}/${f}`, body, {
    contentType: 'audio/mpeg',
    upsert: true,
  })
  if (error) { console.error('FAIL', f, error.message); fail++ }
  else { console.log('ok  ', `${PREFIX}/${f}`); ok++ }
}
console.log(`\nDone: ${ok} uploaded, ${fail} failed → ${BUCKET}/${PREFIX}/`)
process.exit(fail ? 1 : 0)
