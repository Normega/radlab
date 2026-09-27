#!/usr/bin/env node
// Night Safari art generation — local only, never deployed (see docs/markdowns/safari_build_plan.md §4.3).
//
//   node scripts/safari/gen-art.mjs <job.json>
//
// A job file is an array of requests:
//   { "id": "owlbarn_paintover_land", "prompt": "...", "images": ["path/a.png", ...],
//     "size": "1536x1024", "quality": "high", "n": 2, "background": "opaque" | "transparent",
//     "mask": "path/mask.png" }
// With `images` the request goes to /v1/images/edits (reference/paint-over); without, to
// /v1/images/generations.
//
// Outputs land in $SAFARI_ART_DIR (default I:\Shared drives\ComeSee\Safari\art\generated).
// Every output is recorded in ledger.jsonl there: model, prompt, inputs, usage, date. The
// ledger is also the spend cap: the script refuses to run once it holds SAFARI_ART_CAP images
// (default 400), and a single run may not request more than SAFARI_ART_RUN_CAP (default 12).

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
)
const KEY = env.OPENAI_API_KEY
if (!KEY) { console.error('OPENAI_API_KEY missing from .env.local'); process.exit(1) }

const MODEL = process.env.SAFARI_ART_MODEL || 'gpt-image-2'
const OUT = process.env.SAFARI_ART_DIR || 'I:\\Shared drives\\ComeSee\\Safari\\art\\generated'
const CAP = Number(process.env.SAFARI_ART_CAP || 400)
const RUN_CAP = Number(process.env.SAFARI_ART_RUN_CAP || 12)
// One global ledger regardless of where a run writes its images, so the spend cap is real.
const LEDGER = process.env.SAFARI_ART_LEDGER || 'I:/Shared drives/ComeSee/Safari/art/generated/ledger.jsonl'

const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
fs.mkdirSync(OUT, { recursive: true })

const used = fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).length : 0
const asked = jobs.reduce((s, j) => s + (j.n || 1), 0)
if (asked > RUN_CAP) { console.error(`run asks for ${asked} images; per-run cap is ${RUN_CAP}`); process.exit(1) }
if (used + asked > CAP) { console.error(`ledger holds ${used}; ${asked} more would pass the cap of ${CAP}`); process.exit(1) }
console.log(`ledger ${used}/${CAP}; this run ${asked}; model ${MODEL}`)

// Requests are streamed: a high-quality image takes longer than 60 s, and something on this
// network path drops a connection that sits silent for 60 s (UND_ERR_SOCKET at exactly 1:00).
// Partial-image events keep it alive. Collects the *.completed events into { data, usage }.
async function readStream(res) {
  const out = { data: [], usage: undefined }
  const dec = new TextDecoder(); let buf = ''
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2)
      const line = block.split('\n').find(l => l.startsWith('data:'))
      if (!line) continue
      const ev = JSON.parse(line.slice(5).trim())
      if (ev.type?.endsWith('.completed')) { out.data.push({ b64_json: ev.b64_json }); if (ev.usage) out.usage = ev.usage }
      else if (ev.type?.endsWith('.partial_image')) process.stdout.write('.')
      else if (ev.type === 'error' || ev.error) throw new Error(JSON.stringify(ev.error || ev))
    }
  }
  process.stdout.write('\n')
  if (!out.data.length) throw new Error('stream ended with no completed image')
  return out
}

const mime = f => (f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg')

async function run(job) {
  const n = job.n || 1
  let res
  if (job.images?.length) {
    const fd = new FormData()
    fd.append('model', MODEL)
    fd.append('prompt', job.prompt)
    fd.append('n', String(n))
    if (job.size) fd.append('size', job.size)
    if (job.quality) fd.append('quality', job.quality)
    if (job.background) fd.append('background', job.background)
    if (job.input_fidelity) fd.append('input_fidelity', job.input_fidelity)
    fd.append('stream', 'true'); fd.append('partial_images', '3')
    // Optional mask for the first image: transparent pixels are repainted, opaque ones kept.
    // Used to chain tiles (the overlap already painted in the previous tile is kept).
    if (job.mask) fd.append('mask', new Blob([fs.readFileSync(job.mask)], { type: 'image/png' }), path.basename(job.mask))
    for (const f of job.images) {
      fd.append('image[]', new Blob([fs.readFileSync(f)], { type: mime(f) }), path.basename(f))
    }
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: fd })
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: job.prompt, n, size: job.size, quality: job.quality, background: job.background, stream: true, partial_images: 3 }),
    })
  }
  if (!res.ok) throw new Error(`${job.id}: ${res.status} ${await res.text()}`)
  const body = await readStream(res)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  body.data.forEach((d, i) => {
    const file = path.join(OUT, `${job.id}_${stamp}_${i + 1}.png`)
    fs.writeFileSync(file, Buffer.from(d.b64_json, 'base64'))
    fs.appendFileSync(LEDGER, JSON.stringify({
      file: path.relative(path.dirname(LEDGER), file), id: job.id, model: MODEL, date: new Date().toISOString(),
      prompt: job.prompt, inputs: (job.images || []).map(f => path.basename(f)), mask: job.mask ? path.basename(job.mask) : undefined,
      size: job.size, quality: job.quality, usage: i === 0 ? body.usage : undefined,
      licence: 'OpenAI API output — owned by RADlab per OpenAI terms',
    }) + '\n')
    console.log('wrote', file)
  })
  if (body.usage) console.log(job.id, 'usage', JSON.stringify(body.usage))
}

for (const job of jobs) {
  try { await run(job) } catch (e) {
    console.error(job.id, String(e.message || e), e.cause ? `(${e.cause.code || ''} ${e.cause.message || e.cause})` : '')
    process.exitCode = 1
  }
}
