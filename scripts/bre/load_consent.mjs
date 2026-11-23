// Loads the Breath Attention and Emotional Recovery consent form (REB package 03_Consent_Form.md, on the
// shared drive) as the study's active consent form. Kept out of the repo because it names the student
// researcher and her contact details. Each run adds a new study_consent_forms row (old versions stay, for
// the record of what participants saw) and points studies.active_consent_form_id at it.
//
//   node scripts/bre/load_consent.mjs "<path>/03_Consent_Form.md"            # writes a preview, no DB
//   node scripts/bre/load_consent.mjs "<path>/03_Consent_Form.md" --load [--final]
//
// Without --final the form opens with an INTERNAL PILOT banner (REB approval and protocol number still
// pending, plan O7). With --final it refuses to load while "[PROTOCOL NUMBER]" is still in the text.
// The "[ ] I agree" / "[ ] Yes" lines are dropped: ConsentGate renders those choices itself.
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const STUDY_ID = 'a227145d-a66b-4053-be1f-169c825081ab'
const [src] = process.argv.slice(2)
const load = process.argv.includes('--load')
const final = process.argv.includes('--final')
if (!src) { console.error('usage: load_consent.mjs <03_Consent_Form.md> [--load] [--final]'); process.exit(1) }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')

function toHtml(md) {
  const out = []
  let list = false
  const close = () => { if (list) { out.push('</ul>'); list = false } }
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line === '!header' || /^\[ \]/.test(line)) { close(); continue }
    if (line.startsWith('# ')) { close(); out.push(`<h2>${inline(line.slice(2))}</h2>`); continue }
    if (line.startsWith('### ')) { close(); out.push(`<h4>${inline(line.slice(4))}</h4>`); continue }
    if (line.startsWith('## ')) { close(); out.push(`<h3>${inline(line.slice(3))}</h3>`); continue }
    if (line.startsWith('- ')) { if (!list) { out.push('<ul>'); list = true } out.push(`<li>${inline(line.slice(2))}</li>`); continue }
    close(); out.push(`<p>${inline(line)}</p>`)
  }
  close()
  return out.join('')
}

const md = readFileSync(src, 'utf8')
if (final && md.includes('[PROTOCOL NUMBER]')) { console.error('refusing --final: [PROTOCOL NUMBER] is still in the form'); process.exit(1) }
const banner = final ? '' : '<p><strong>INTERNAL PILOT: lab members only.</strong> This is the submitted draft of the consent form, for testing the study. It has not yet been approved by the REB. Pilot data are marked as test data and not analysed.</p>'
const html = banner + toHtml(md)

if (!load) {
  const out = 'consent_preview.html'
  writeFileSync(out, `<!doctype html><meta charset="utf-8"><body style="max-width:720px;margin:32px auto;font:16px/1.6 system-ui">${html}</body>`)
  console.log(`preview written to ${out} (${html.length} chars). Re-run with --load to load it.`)
  process.exit(0)
}

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const { data: form, error } = await db.from('study_consent_forms').insert({ study_id: STUDY_ID, html_content: html }).select('id').single()
if (error) throw error
const { error: upErr } = await db.from('studies').update({ active_consent_form_id: form.id }).eq('id', STUDY_ID)
if (upErr) throw upErr
console.log(`consent form ${form.id} loaded (${html.length} chars, ${final ? 'final' : 'INTERNAL PILOT banner'})`)
