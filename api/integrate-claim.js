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

// Structured output as a tool call rather than "return JSON in your reply".
// Parsing free text broke exactly as you would expect: a long draft ran past
// max_tokens, the JSON ended mid-string, and JSON.parse surfaced "Unexpected
// end of JSON input" to the reviewer. A tool call is schema-validated by the
// API, so fences, prose preambles and raw newlines inside strings stop being
// failure modes; only truncation remains, and that is now detected explicitly.
const TOOL = {
  name: 'file_section',
  description: 'Return the drafted section and your judgement of the student summary.',
  input_schema: {
    type: 'object',
    properties: {
      draft: {
        type: 'string',
        description: 'Markdown for the section body. Empty string if the paper does not address the gap.',
      },
      citation: { type: 'string', description: 'The formatted citation used.' },
      student_reading: {
        type: 'string', enum: ['agrees', 'diverges', 'unclear'],
        description: "Whether the student's summary matches what the paper says.",
      },
      note: {
        type: 'string',
        description: 'One or two sentences for the TA: what was added, and where the summary departs from the paper if it does.',
      },
    },
    required: ['draft', 'student_reading', 'note'],
  },
}

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
summary of that paper. You have two jobs, and the second matters as much as the
first.

1. Draft the section from THE PAPER. The student's summary is not source
   material — it is a claim about the paper.

2. Judge that claim. Set student_reading to "diverges" if the summary contains
   ANY of these, however well written it is:
     - a statement the paper contradicts (including reversals: saying more
       where the paper says fewer, or increased where it says reduced);
     - a claim the paper does not make, or attributes to others while
       disputing;
     - the wrong study type — e.g. crediting a review with experiments it only
       cites, or critiquing a review for its "sample size" or missing control
       group;
     - a causal claim where the paper reports association, or states the chain
       is untested;
     - a treatment or mechanism conclusion the paper explicitly declines to
       draw.
   One such error is enough. "agrees" means the summary is faithful, not merely
   plausible or fluent; use "unclear" only when the paper genuinely does not
   settle the point. Fluent writing is not evidence of accurate reading.

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
Call the file_section tool with your answer.`
}

// One place that turns a draft into a pending proposal, shared by the accept
// path and the reuse path above.
async function fileProposal({ service, gap, page, personId, draft, citation }) {
  const heading = gap.section ? `## ${gap.section}\n\n` : ''
  const { data: version, error } = await service
    .from('wiki_page_versions')
    .insert({
      page_id: gap.page_id,
      kind: 'proposed',
      action: 'update',
      title: page?.title ?? null,
      content: `${heading}${String(draft).trim()}\n`,
      created_by: personId,
      review_status: 'pending',
      note: `Student contribution · ${citation ?? 'source cited on the claim'}`,
    })
    .select('id').single()
  if (error) throw new Error(error.message)
  return version
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
  // file:false is the REVIEW pass — compare the summary against the paper and
  // keep the draft on the claim without filing anything. file:true (accept)
  // files it, reusing the draft review already produced rather than paying for
  // a second identical call.
  const { claim_id, file = true } = req.body ?? {}
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
    .select('id, status, submitted_text, limitation, source_citation, source_fulltext, source_kind, gap_id, integration_draft, integration_note, integration_status')
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

  if (file && claim.status !== 'accepted') {
    return res.status(409).json({ error: 'Only an accepted contribution is filed into the Guide.' })
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

  // Accepting something a TA already compared: file the draft as it stands.
  if (file && claim.integration_draft && claim.integration_status === 'reviewed') {
    try {
      const version = await fileProposal({
        service, gap, page, personId,
        draft: claim.integration_draft, citation: claim.source_citation,
      })
      await service.rpc('record_claim_integration', {
        p_claim_id: claim_id, p_status: 'drafted',
        p_note: claim.integration_note ?? null, p_version_id: version.id,
      })
      return res.status(200).json({ ok: true, filed: true, reused: true,
                                    version_id: version.id, note: claim.integration_note })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  try {
    const anthropic = new Anthropic()
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
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

    if (msg.stop_reason === 'max_tokens') {
      throw new Error('The draft ran past the length limit before it finished. Try again, or shorten the gap.')
    }
    const parsed = msg.content.find(c => c.type === 'tool_use')?.input
    if (!parsed) throw new Error('The model returned no draft.')

    if (!parsed.draft?.trim()) {
      await service.rpc('record_claim_integration', {
        p_claim_id: claim_id, p_status: 'failed',
        p_note: parsed.note || 'The source does not address this gap.',
      })
      return res.status(200).json({ ok: false, reason: 'no-coverage', note: parsed.note })
    }

    const verdict = parsed.student_reading ?? 'unclear'

    if (!file) {
      // Review pass: keep the draft and the verdict on the claim so the queue
      // shows them beside the student's own words, and so accepting is free.
      await service.rpc('record_claim_integration', {
        p_claim_id: claim_id, p_status: 'reviewed',
        p_note: parsed.note ?? null, p_draft: parsed.draft.trim(),
        p_verdict: verdict,
      })
      return res.status(200).json({
        ok: true, filed: false, divergence: verdict,
        note: parsed.note ?? null, draft: parsed.draft.trim(),
      })
    }

    const version = await fileProposal({
      service, gap, page, personId,
      draft: parsed.draft, citation: parsed.citation ?? claim.source_citation,
    })

    await service.rpc('record_claim_integration', {
      p_claim_id: claim_id, p_status: 'drafted',
      p_note: parsed.note ?? null, p_version_id: version.id, p_draft: parsed.draft.trim(),
      p_verdict: verdict,
    })

    return res.status(200).json({
      ok: true, filed: true, version_id: version.id,
      divergence: verdict, note: parsed.note ?? null,
    })
  } catch (err) {
    await service.rpc('record_claim_integration', {
      p_claim_id: claim_id, p_status: 'failed', p_note: err.message,
    })
    return res.status(500).json({ error: err.message })
  }
}
