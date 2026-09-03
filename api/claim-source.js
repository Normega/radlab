import { createClient } from '@supabase/supabase-js'
import { extractText, getDocumentProxy } from 'unpdf'

// POST /api/claim-source  { claim_id, doi?, pdf_path? }
//   → { ok, kind: 'oa'|'upload', chars, url?, title?, note? }
//
// Captures the SOURCE behind a student contribution while the student is still
// holding it, so that accepting the claim later can draft the page section from
// the paper rather than from the student's summary (see api/integrate-claim.js).
//
// Two routes to the same cached text:
//   'oa'     — resolve the DOI to open-access full text (OpenAlex, then
//              Unpaywall), download, extract. No file is retained.
//   'upload' — the student uploaded a PDF because no OA copy exists; we extract
//              its text and the PDF itself is never read again.
//
// Only the extracted text is stored (gap_claims.source_fulltext), truncated to
// what one section-drafting call needs, and purged once the claim resolves
// (purge_claim_sources). This is deliberately the narrowest retention that
// makes the feature work.
//
// Writes only to the caller's OWN claim: ownership is checked with the
// student's JWT before the service key touches anything.

export const config = { maxDuration: 60 }

// Enough for the model to draft one section with real detail; well short of
// retaining a redistributable copy of a paper.
const MAX_CHARS = 60_000
const UA = 'radlab-fieldguide/1.0 (mailto:psy240@radlab.zone)'

const clean = (t) => String(t ?? '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!r.ok) return null
  return r.json().catch(() => null)
}

// Collect EVERY open-access copy, not just the "best" one, and try them in
// order. This matters in practice: publishers routinely sit behind a bot
// challenge (Elsevier answers a plain fetch with a Cloudflare interstitial and
// HTTP 403), while the PMC or repository mirror of the very same paper serves
// the PDF without complaint. Preferring mirrors first turns a large class of
// "no full text found" into a successful capture.
const BLOCKED_HOSTS = /sciencedirect|elsevier|biologicalpsychiatryjournal|wiley|springer|tandfonline|sagepub/i
const MIRROR_HOSTS  = /ncbi\.nlm\.nih\.gov|europepmc|pmc|arxiv|biorxiv|psyarxiv|osf\.io|doaj|repository|\.edu/i

function rankUrls(urls) {
  const seen = new Set()
  return urls
    .filter(u => u && !seen.has(u) && seen.add(u))
    .sort((a, b) => {
      const score = (u) => (MIRROR_HOSTS.test(u) ? 0 : BLOCKED_HOSTS.test(u) ? 2 : 1)
      return score(a) - score(b)
    })
}

async function findOpenAccess(doi) {
  const d = encodeURIComponent(doi.trim().toLowerCase())
  const urls = []
  let title = null

  const oa = await fetchJson(`https://api.openalex.org/works/doi:${d}`)
  if (oa) {
    title = oa.title ?? null
    for (const loc of [oa.best_oa_location, ...(oa.locations ?? [])]) {
      if (!loc?.is_oa) continue
      urls.push(loc.pdf_url, loc.landing_page_url)
    }
  }

  const up = await fetchJson(`https://api.unpaywall.org/v2/${d}?email=psy240@radlab.zone`)
  if (up) {
    title = title ?? up.title ?? null
    for (const loc of [up.best_oa_location, ...(up.oa_locations ?? [])]) {
      if (!loc) continue
      urls.push(loc.url_for_pdf, loc.url)
    }
  }

  const ranked = rankUrls(urls)
  return ranked.length ? { urls: ranked, title } : null
}

async function pdfToText(buf) {
  const doc = await getDocumentProxy(new Uint8Array(buf))
  const { text } = await extractText(doc, { mergePages: true })
  return clean(text)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const url = process.env.COURSE_SUPABASE_URL
  const anonKey = process.env.COURSE_SUPABASE_ANON_KEY
  const serviceKey = process.env.COURSE_SUPABASE_SERVICE_KEY
  if (!url || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing COURSE_SUPABASE_* env vars' })
  }

  // Match the tolerant form the other endpoints use, and reject the string
  // "undefined" explicitly: a client that lost its session stringifies to
  // `Bearer undefined`, which is non-empty and would otherwise sail past this
  // check and fail later as an anonymous request.
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!jwt || jwt === 'undefined' || jwt === 'null') {
    return res.status(401).json({ error: 'Your session was not sent — reload the page and sign in again.' })
  }

  const { claim_id, doi, pdf_path } = req.body ?? {}
  if (!claim_id || (!doi && !pdf_path)) {
    return res.status(400).json({ error: 'Required: claim_id, and one of doi | pdf_path' })
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })
  const service = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Ownership, checked explicitly rather than by "did RLS let me see it".
  // Resolving the person first separates the two failures that otherwise look
  // identical: a token the server could not authenticate at all, and a real
  // session asking after somebody else's claim.
  const { data: personId, error: whoErr } = await userClient.rpc('current_person_id')
  if (whoErr || !personId) {
    return res.status(401).json({
      error: 'Your sign-in could not be verified — reload the page and try again.',
      detail: whoErr?.message ?? null,
    })
  }

  const { data: claim, error: claimErr } = await service
    .from('gap_claims').select('id, status, person_id').eq('id', claim_id).maybeSingle()
  if (claimErr) return res.status(500).json({ error: claimErr.message })
  if (!claim) return res.status(404).json({ error: 'That claim no longer exists — reload the gap board.' })
  if (claim.person_id !== personId) return res.status(403).json({ error: 'Not your claim' })
  if (claim.status === 'accepted') {
    return res.status(409).json({ error: 'This contribution has already been accepted.' })
  }

  try {
    let kind, text, sourceUrl = null, title = null, note = null

    if (pdf_path) {
      kind = 'upload'
      const { data: file, error: dlErr } = await service.storage.from('ingest-pdfs').download(pdf_path)
      if (dlErr) return res.status(400).json({ error: `Could not read the upload: ${dlErr.message}` })
      text = await pdfToText(await file.arrayBuffer()).catch(() => null)
      if (!text) return res.status(422).json({ error: 'That PDF could not be read (is it a scan with no text layer?).' })
    } else {
      kind = 'oa'
      const found = await findOpenAccess(doi)
      if (!found) {
        return res.status(404).json({
          error: 'No open-access full text found for that DOI.',
          hint: 'upload',
        })
      }
      title = found.title

      // Try each open-access copy until one yields real text. A publisher
      // challenge page, a dead mirror, or a landing page that isn't the paper
      // all simply fall through to the next candidate.
      for (const candidate of found.urls.slice(0, 6)) {
        try {
          const r = await fetch(candidate, { headers: { 'User-Agent': UA }, redirect: 'follow' })
          if (!r.ok) continue
          const ctype = r.headers.get('content-type') ?? ''
          const buf = await r.arrayBuffer()
          let got = null
          if (ctype.includes('pdf')) {
            got = await pdfToText(buf).catch(() => null)
          } else if (ctype.includes('html')) {
            const html = Buffer.from(buf).toString('utf8')
            // A bot challenge is short and says so; don't cache it as a paper.
            if (/Just a moment|cf-browser-verification|Enable JavaScript/i.test(html)) continue
            got = clean(html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                            .replace(/<[^>]+>/g, ' '))
            if (got && got.length >= 2000) note = 'Captured from the article page rather than a PDF.'
          }
          if (got && got.length >= 2000) { text = got; sourceUrl = candidate; break }
        } catch { /* next candidate */ }
      }
    }

    // A few hundred characters is a paywall notice or a cookie banner, not a
    // paper. Better to say so than to cache noise and draft from it later.
    if (!text || text.length < 2000) {
      return res.status(422).json({
        error: 'That link did not yield a readable full text.',
        hint: 'upload',
      })
    }

    const truncated = text.length > MAX_CHARS
    // Through the RPC, not a direct update: gap_claims_guard rejects writes
    // that carry no person identity, and the service key has none. The RPC
    // sets radlab.claim_flow so the write lands in the guard's bookkeeping
    // escape (20260903_claim_bookkeeping).
    const { error: upErr } = await service.rpc('record_claim_source', {
      p_claim_id: claim_id,
      p_kind: kind,
      p_fulltext: text.slice(0, MAX_CHARS),
      p_url: sourceUrl,
    })
    if (upErr) return res.status(500).json({ error: upErr.message })

    return res.status(200).json({
      ok: true, kind, chars: Math.min(text.length, MAX_CHARS), truncated,
      url: sourceUrl, title, note,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
