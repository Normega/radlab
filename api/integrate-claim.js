import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// POST /api/integrate-claim  { claim_id }
//   → { ok, action, divergence, note, version_id }
//
// The last mile of the contribution pipeline. A TA accepts a student's
// submission; this drafts the actual page section FROM THE SOURCE the student
// cited (cached by api/claim-source.js at submit time), and files it as a
// PENDING proposal in the same review queue staff ingest already uses.
//
// Three deliberate constraints:
//
//  1. **Never publishes.** The output is a `wiki_page_versions` row with
//     review_status 'pending', exactly like an ingest proposal. A textbook
//     students are examined on does not take unreviewed model writes.
//
//  2. **The student's summary is evidence, not source material.** The model
//     drafts from the paper and is asked separately whether the student's
//     reading matches it. That verdict is written back to the claim, which
//     gives the TA a misreading signal they would otherwise have to find by
//     reading the paper themselves.
//
//  3. **Narrow job, cheap model.** This is one paper into one section, not the
//     whole-chapter sweep api/ingest.js performs — at ~600 contributions a
//     term, that distinction is the difference between roughly $100 and
//     several thousand dollars.

export const config = { maxDuration: 120 }

const MODEL = 'claude-sonnet-5'
const MAX_SOURCE_CHARS = 55_000

const SYSTEM = `You write for the Field Guide, an undergraduate abnormal-psychology reference.

House style:
- Plain, exact prose. No hedging adverbs ("fairly", "quite", "somewhat").
- Every claim carries its evidence. Numbers where the source gives numbers.
- Name the study design when it bears on how much the finding supports.
- No filler openers, no "in conclusion", no restating the section heading.
- British/Canadian spelling, matching the rest of the Guide.
- Markdown. Two to four short paragraphs, or a short paragraph plus a tight
  list. This is one section of a page, not a whole page.

You are given a source paper, the gap the section must fill, and a student's
summary of that paper. Draft the section from THE PAPER. The student's summary
is not source material — it is a claim about the paper that you must judge.

Never state anything the paper does not support. If the paper does not actually
address the gap, say so in "note" and return an empty draft rather than
inventing coverage.`

function userPrompt({ ask, section, pageTitle, existing, citation, studentText, limitation, source }) {
  return `## The page
${pageTitle}${section ? ` — section "${section}"` : ''}

## The gap this must fill
${ask ?? '(no ask recorded)'}

${existing ? `## What the section says today (you are ADDING to this — do not restate it)\n${existing}\n` : '## The section has no content yet.\n'}
## The student's summary (judge it; do not copy it)
${studentText ?? '(none)'}
${limitation ? `\nThe student noted this limitation: ${limitation}` : ''}

## Citation to use
${citation ?? '(none recorded — cite by author and year from the source text)'}

## The source paper (extracted text, may be truncated)
${source}

---
Return ONLY a JSON object:
{
  "draft": "markdown for the section body, or \\"\\" if the paper does not address the gap",
  "citation": "the formatted citation you used",
  "student_reading": "agrees" | "diverges" | "unclear",
  "note": "one or two sentences for the TA: what you added, and — if student_reading is not \\"agrees\\" — exactly where the student's summary departs from the paper"
}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const url = process.env.COURSE_SUPABASE_URL
  const anonKey = process.env.COURSE_SUPABASE_ANON_KEY
  const serviceKey = process.env.COURSE_SUPABASE_SERVICE_KEY
  if (!url || !anonKey || !serviceKey || !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing COURSE_SUPABASE_* or ANTHROPIC_API_KEY' })
  }

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!jwt || jwt === 'undefined' || jwt === 'null') {
    return res.status(401).json({ error: 'Your session was not sent — reload the page and sign in again.' })
  }
  const { claim_id } = req.body ?? {}
  if (!claim_id) return res.status(400).json({ error: 'Required: claim_id' })

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })
  const service = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Staff only — and specifically staff of the course the claim belongs to.
  const { data: personId } = await userClient.rpc('current_person_id')
  if (!personId) return res.status(403).json({ error: 'No person record' })

  const { data: claim, error: claimErr } = await service
    .from('gap_claims')
    .select('id, status, submitted_text, limitation, source_citation, source_fulltext, source_kind, gap_id')
    .eq('id', claim_id).maybeSingle()
  if (claimErr) return res.status(500).json({ error: claimErr.message })
  if (!claim) return res.status(404).json({ error: 'No such claim' })

  const { data: gap } = await service
    .from('page_gaps').select('ask, section, slug, page_id, course_id').eq('id', claim.gap_id).maybeSingle()
  if (!gap) return res.status(404).json({ error: 'Claim has no gap' })

  const { data: staff } = await userClient
    .from('enrollments').select('role, status')
    .eq('course_id', gap.course_id).eq('status', 'active')
  if (!staff?.some(e => e.role === 'ta' || e.role === 'instructor')) {
    return res.status(403).json({ error: 'Staff of this course only' })
  }

  if (claim.status !== 'accepted') {
    return res.status(409).json({ error: 'Only an accepted contribution is drafted into the Guide.' })
  }
  if (!claim.source_fulltext) {
    // Nothing to draft from: the student submitted before source capture
    // existed, or no full text was ever found. Say so plainly — this is the
    // case where a TA must fall back to the student's text by hand.
    await service.rpc('record_claim_integration', {
      p_claim_id: claim_id, p_status: 'skipped',
      p_note: 'No source full text was captured for this claim.',
    })
    return res.status(422).json({ error: 'No source text captured for this claim — nothing to draft from.' })
  }

  const { data: page } = await service
    .from('wiki_pages').select('id, title, content').eq('id', gap.page_id).maybeSingle()

  // Only the target section is shown as "what exists", so the model writes a
  // delta rather than a replacement of the page.
  const existing = (() => {
    const body = page?.content
    if (!body || !gap.section) return null
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    const re = new RegExp(`##+\\s*${gap.section.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}[\\s\\S]*?(?=\\n##\\s|$)`, 'i')
    return text.match(re)?.[0]?.slice(0, 6000) ?? null
  })()

  try {
    const anthropic = new Anthropic()
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: userPrompt({
          ask: gap.ask, section: gap.section,
          pageTitle: page?.title ?? gap.slug,
          existing,
          citation: claim.source_citation,
          studentText: claim.submitted_text,
          limitation: claim.limitation,
          source: claim.source_fulltext.slice(0, MAX_SOURCE_CHARS),
        }),
      }],
    })

    const raw = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('')
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))

    if (!parsed.draft?.trim()) {
      await service.rpc('record_claim_integration', {
        p_claim_id: claim_id, p_status: 'failed',
        p_note: parsed.note || 'The source does not address this gap.',
      })
      return res.status(200).json({ ok: false, reason: 'no-coverage', note: parsed.note })
    }

    const heading = gap.section ? `## ${gap.section}\n\n` : ''
    const { data: version, error: verErr } = await service
      .from('wiki_page_versions')
      .insert({
        page_id: gap.page_id,
        kind: 'proposed',
        action: 'update',
        title: page?.title ?? null,
        content: `${heading}${parsed.draft.trim()}\n`,
        created_by: personId,
        review_status: 'pending',
        note: `Student contribution · ${parsed.citation ?? claim.source_citation ?? 'source cited on the claim'}`,
      })
      .select('id').single()
    if (verErr) throw new Error(verErr.message)

    await service.rpc('record_claim_integration', {
      p_claim_id: claim_id, p_status: 'drafted',
      p_note: parsed.note ?? null, p_version_id: version.id,
    })

    return res.status(200).json({
      ok: true,
      version_id: version.id,
      divergence: parsed.student_reading ?? 'unclear',
      note: parsed.note ?? null,
    })
  } catch (err) {
    await service.rpc('record_claim_integration', {
      p_claim_id: claim_id, p_status: 'failed', p_note: err.message,
    })
    return res.status(500).json({ error: err.message })
  }
}
