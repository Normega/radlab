import { createClient } from '@supabase/supabase-js'
import { extractText, getDocumentProxy } from 'unpdf'

// POST /api/cite  { course_id, pdf_path? , doi? }
//   → { doi, citation, source, note }
//
// Reads a DOI off an uploaded PDF and resolves it to a formatted citation, so
// the operator confirms a suggestion instead of typing 180 characters. Also
// accepts a DOI directly, for the case where the PDF has none printed on it.
//
// **This endpoint only ever SUGGESTS.** The portal requires an explicit accept
// before the citation reaches the ingest job, and that is not decoration:
// attribution is a licence condition for the CC BY-NC-SA course sources, and a
// wrong citation that auto-filled and nobody read is worse than a typed one,
// because it carries the authority of having been looked up. It matters more
// from WP6, when ~300 students are the ones uploading.
//
// Nothing here writes to the database.

export const config = { maxDuration: 30 }

// Deliberately conservative. The DOI spec permits almost anything after the
// prefix, but a greedy match on PDF-extracted text swallows trailing
// punctuation, hyphenation artefacts and the next word. Trailing junk is
// trimmed below rather than matched here.
const DOI_RE = /\b(10\.\d{4,9}\/[^\s"'<>{}\\^`]+)/gi

function cleanDoi(raw) {
  let d = raw.trim()
  // PDFs routinely end a DOI line with a period, a bracket, or a citation comma.
  d = d.replace(/[.,;:)\]}>]+$/, '')
  // Some publishers print "doi:10.x/y." inline mid-sentence.
  d = d.replace(/\.$/, '')
  return d
}

// The first DOI on the opening pages is usually the paper's own; DOIs appearing
// later are its references. Preferring the earliest occurrence is why only the
// first pages are scanned rather than the whole document.
function findDoi(text) {
  const hits = [...(text || '').matchAll(DOI_RE)].map(m => cleanDoi(m[1]))
  if (!hits.length) return null
  // A self-citation often repeats; the most common early DOI beats the first if
  // there is a tie-break to make.
  const counts = new Map()
  for (const h of hits.slice(0, 12)) counts.set(h, (counts.get(h) ?? 0) + 1)
  let best = hits[0], bestN = counts.get(hits[0]) ?? 1
  for (const [d, n] of counts) if (n > bestN) { best = d; bestN = n }
  return best
}

// doi.org content negotiation returns a *formatted* citation in one request —
// no parsing, no template of ours to drift from a real style guide.
async function formatViaDoiOrg(doi) {
  const r = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
    headers: { Accept: 'text/x-bibliography; style=apa' },
    redirect: 'follow',
  })
  if (!r.ok) return null
  const t = (await r.text()).trim()
  if (!t || t.length > 1000 || /^<!DOCTYPE|^<html/i.test(t)) return null
  return t.replace(/\s+/g, ' ')
}

// Fallback: Crossref's structured record, assembled ourselves. Used when
// content negotiation is unavailable, and also to report the title so the
// operator can sanity-check that the DOI belongs to the PDF in front of them.
async function lookupCrossref(doi) {
  const r = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=norman@radlab.zone`,
    { headers: { Accept: 'application/json' } })
  if (!r.ok) return null
  const j = await r.json()
  const m = j?.message
  if (!m) return null
  const authors = (m.author ?? [])
    .map(a => [a.family, a.given?.[0]].filter(Boolean).join(', ').trim())
    .filter(Boolean)
  const year = m.issued?.['date-parts']?.[0]?.[0]
  return {
    title: Array.isArray(m.title) ? m.title[0] : m.title,
    container: Array.isArray(m['container-title']) ? m['container-title'][0] : m['container-title'],
    year,
    authorLine: authors.length > 3 ? `${authors[0]} et al.` : authors.join('; '),
  }
}

export default async function handler(req, res) {
  const url = process.env.COURSE_SUPABASE_URL
  const anonKey = process.env.COURSE_SUPABASE_ANON_KEY
  const serviceKey = process.env.COURSE_SUPABASE_SERVICE_KEY
  if (!url || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing COURSE_SUPABASE_* env vars' })
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { course_id, pdf_path = null, doi: doiIn = null } = req.body ?? {}
  if (!course_id || (!pdf_path && !doiIn)) {
    return res.status(400).json({ error: 'Required: course_id, and one of pdf_path or doi' })
  }

  // ── Auth: same shape as /api/ingest, but ANY active enrollment passes ──
  // Resolving a DOI is not a privileged act, and from WP6 the uploader is a
  // student. Who may actually start an ingest is enforced in /api/ingest.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: personId } = await userClient.rpc('current_person_id')
  if (!personId) return res.status(401).json({ error: 'Invalid session or unknown user' })

  const { data: enrollments } = await userClient
    .from('enrollments').select('id').eq('course_id', course_id).eq('status', 'active')
  if (!enrollments?.length) {
    return res.status(403).json({ error: 'No active enrollment for this course' })
  }

  try {
    let doi = doiIn ? cleanDoi(doiIn.replace(/^\s*(doi:|https?:\/\/(dx\.)?doi\.org\/)/i, '')) : null
    let note = null

    if (!doi) {
      // Scan only the opening pages: the first DOI is the document's own, and
      // everything past the reference list belongs to other people's papers.
      const service = createClient(url, serviceKey, { auth: { persistSession: false } })
      const { data: blob, error: dlErr } = await service.storage.from('ingest-pdfs').download(pdf_path)
      if (dlErr) return res.status(404).json({ error: `Could not read ${pdf_path}: ${dlErr.message}` })

      const buf = new Uint8Array(await blob.arrayBuffer())
      const pdf = await getDocumentProxy(buf)
      const { text } = await extractText(pdf, { mergePages: false })
      const pages = Array.isArray(text) ? text : [text]
      const head = pages.slice(0, 3).join('\n')

      doi = findDoi(head)
      if (!doi) {
        return res.status(200).json({
          doi: null,
          citation: null,
          source: null,
          note: pages.join('').trim().length < 200
            ? 'No DOI found — and this PDF has almost no text layer, so it is probably a scan. Type the citation by hand.'
            : 'No DOI found on the first pages. Open-licensed textbooks and reports usually have none; type the citation by hand.',
        })
      }
    }

    // doi.org first (a real formatted citation), Crossref for the title so the
    // operator can check the DOI actually belongs to this PDF.
    const [formatted, meta] = await Promise.all([
      formatViaDoiOrg(doi).catch(() => null),
      lookupCrossref(doi).catch(() => null),
    ])

    let citation = formatted
    let source = formatted ? 'doi.org (APA)' : null
    if (!citation && meta) {
      citation = [
        meta.authorLine || null,
        meta.year ? `(${meta.year}).` : null,
        meta.title ? `${meta.title}.` : null,
        meta.container ? `${meta.container}.` : null,
        `doi:${doi}`,
      ].filter(Boolean).join(' ')
      source = 'crossref (assembled)'
      note = 'doi.org did not return a formatted citation; this was assembled from Crossref fields. Check it.'
    }
    if (!citation) {
      return res.status(200).json({
        doi, citation: null, source: null,
        note: `Found DOI ${doi} in the PDF, but neither doi.org nor Crossref could resolve it. Type the citation by hand.`,
      })
    }

    return res.status(200).json({ doi, citation, source, note, title: meta?.title ?? null })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
