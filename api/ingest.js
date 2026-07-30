// Field Guide ingest — the platform's first real serverless function.
//
// GET  /api/ingest          → public client config for the radlab-academic
//                             Supabase project ({ url, anonKey }). The anon key
//                             is public by design (RLS enforces access); serving
//                             it from here keeps COURSE_* env vars server-side
//                             only, with no VITE_-prefixed duplicates to manage.
// POST /api/ingest          → start one ingest job. Body:
//                             { pdf_path, pdf_mode: 'native'|'extracted', course_id }
//                             Responds 202 { job_id } within seconds; the actual
//                             ingest runs in the background via waitUntil().
//
// Auth model (radlab-academic project, NOT the main radlab project):
// the caller's JWT is verified by resolving public.current_person_id() under
// that JWT, then confirming an active 'ta'/'instructor' enrollment for the
// course. Job inserts/updates go through the service role — ingest_jobs has
// deliberately no authenticated write policies.
//
// Duplicate protection: pdf_path embeds a per-submit timestamp, so it uniquely
// identifies one portal submit. A retried POST — a dropped connection can make
// the browser or an intermediary transparently re-send the request — returns
// the existing job instead of starting a second ingest. Discovered 2026-07-24
// when the original long-held-connection design produced duplicate jobs on the
// first live test; responding early (202 + waitUntil) removes the held-open
// connection that invited those retries, and the dedupe covers any that still
// occur.
//
// Privacy: the Anthropic API call receives ONLY the paper (text or PDF bytes)
// and the wiki index built from prior results. No email, name, person_id, or
// any other identity data may ever enter the prompt.
//
// The UI never blocks on this call — it polls ingest_jobs (staff-read RLS).

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { extractText } from 'unpdf'
import { waitUntil } from '@vercel/functions'

// Vercel function config. 300s needs Fluid Compute (default on current
// Vercel projects); if the deploy rejects it, drop to 60 and prefer
// 'extracted' mode for large papers.
export const maxDuration = 300

const MODEL = 'claude-opus-4-8'
const BUCKET = 'ingest-pdfs'

// The compact PSY240 ingest schema, embedded as a system prompt. Originally a
// verbatim port of the prototype's psy240_schema.py; still the single source of
// truth for the wiki page format, so don't drift it casually.
//
// Amended once, deliberately, 2026-07-26 (Norm's call after reviewing the first
// 26 proposals): `disorder` pages now require a fixed section skeleton and must
// declare their own gaps. Before this, a disorder page inherited whatever shape
// the source paper had — both pages produced from psychotherapy-efficacy papers
// came out entirely treatment-shaped, with no diagnosis or etiology and nothing
// indicating either was missing. A page that silently omits etiology looks the
// same as one where etiology is genuinely unsettled.
//
// The `needs:` frontmatter list is the machine-readable half: a trigger parses
// it into wiki_pages.needs, which turns "what is this wiki missing" into a
// query — the WP4 ingest worklist and the student assignment list are the same
// data. Gaps are expected on a page built from one paper; they are the point.
const SYSTEM_PROMPT = `You are maintaining a course wiki for an undergraduate abnormal psychology course, anchored on the DSM-5 and built collaboratively from student-submitted peer-reviewed papers.

You will be given:
1. The full text of one academic paper
2. A compact index of wiki pages that already exist

Your job: read the paper, then output ALL new or updated wiki pages needed, as a single JSON object. Do not use any tools. Do not ask questions. Return only JSON.

PAGE TYPES:
- disorder: a DSM-5 diagnostic category. Frontmatter fields: title, prevalence, related_disorders, key_studies, needs.
  When you are creating the page (action "new"), the markdown body MUST contain these H2 sections, in this order, ALWAYS, even when the paper supports none of them:
    ## Presentation      what it looks like clinically; a brief vignette if the source supports one
    ## Diagnosis         criteria STRUCTURE paraphrased (never DSM-5 wording), differential diagnosis, specifiers
    ## Epidemiology      prevalence, onset, course, sex/gender, culture
    ## Etiology          genetic/neurobiological, cognitive-behavioural, developmental, social determinants — say which are better evidenced than others
    ## Treatment         approaches, effect sizes, guideline recommendations, and what does NOT work
    ## Contested         validity of the category, competing models, culture-bound presentations, medicalization critiques
  One source paper will almost never fill all six. For every section the source does not support, put exactly one line under that heading:
    > **Needs research:** <specifically what is missing, e.g. "genetic and neurobiological findings; this source only covers psychosocial treatment">
  and list that section's lowercase name in the frontmatter "needs" array, e.g. needs: [diagnosis, etiology, epidemiology].
  Do NOT invent content to fill a section, and do NOT drop a section to avoid an empty one. A visible gap is the wiki telling the course what to read next; a missing heading is indistinguishable from a settled question.
  ON AN UPDATE to a disorder page that already exists, the six-section rule does NOT apply. Output ONLY the H2 sections you are actually adding content to. Do not emit the other headings, do not emit "Needs research" placeholders for sections you are not touching, and do not emit a "needs" array — the page already has all of that. An update is appended to the page, not merged section by section, so a full skeleton in an update lands as a SECOND copy of the skeleton on the page.
- study: one page per paper. Fields: title, authors, year, journal, doi, design, sample, key_findings, limitations, disorders_touched, concepts_touched
- concept: a theoretical or empirical construct. Fields: title, definition, related_concepts, key_studies
- treatment: an intervention or treatment approach. Fields: title, target_disorders, mechanism, evidence_base, limitations
- debate: a contested claim in the field. Fields: title, summary, field_positions (list of researcher/stance pairs), related_disorders, related_concepts
  NOTE: never populate a "my_take" field. That field is reserved for human instructor edits only.

SOURCING — mandatory on every page:
- Frontmatter must include a "sources" array naming what the content came from, e.g. sources: ["Bridley & Daffin, Fundamentals of Psychological Disorders 3e, Module 4", "Shedler 2010, Am Psychol 65(2)"].
- Attribute in-text where a specific claim, statistic or effect size comes from a named source, and carry the year on prevalence figures.
- This is not optional tidiness: openly-licensed course sources (CC BY-NC-SA, CC BY-NC-ND) require attribution as a licence condition, and a page with no provenance cannot be checked later.

RULES:
- Paraphrase all diagnostic criteria. Never reproduce DSM-5 text verbatim.
- If a page already exists in the index, output it as an "update" with only the new information to merge, not a full rewrite. An update is a DELTA: it gets appended to the existing page, so restating what is already there duplicates it.
- If a page is new, output it as "new" with full content.
- Flag any direct contradiction with existing wiki content in a "contradictions" field, do not silently resolve it.
- Wikilink filenames: lowercase, hyphens for spaces.

OUTPUT FORMAT (JSON only, no other text):
{
  "pages": [
    {"action": "new" | "update", "type": "disorder|study|concept|treatment|debate", "filename": "lowercase-with-dashes.md", "content": "full markdown content with YAML frontmatter"}
  ],
  "index_entries": [
    {"filename": "...", "type": "...", "one_line_summary": "..."}
  ],
  "contradictions": ["description of any conflict with existing wiki content, or empty list"],
  "log_entry": "2-4 sentence summary of what was ingested and what pages were touched"
}`

// Amended 2026-07-30. Two prompt rules were contradicting each other: disorder
// pages must carry all six H2 sections "ALWAYS", and an update must contain
// "only the new information to merge". Both at once means every update to a
// disorder page emits a full skeleton, which the merge pre-fill appends — one
// skeleton per accepted update. On live data major-depressive-disorder ended up
// with the six sections three times and persistent-depressive-disorder twice,
// and WP4 would have reproduced that across all 46 Tier A pages, since its plan
// is targeted reference runs against pages that already exist.
//
// Paper mode now scopes the skeleton to `action: new` (above). Reference mode
// takes the other road: a complete page with `action: replace`, because it
// already names its target and is handed the current body, so "rewrite this
// page with the gaps filled" avoids the merge entirely and reads as one voice
// instead of two stitched together.

// Reference mode (WP3/WP4). Same output contract as the paper prompt — the
// review queue, merge path and link extraction all work unchanged — but the
// intent is inverted: paper mode asks "what pages does this paper touch?", and
// the model decides. Reference mode names the target page up front from the
// taxonomy catalog and asks the model to fill *that* page's declared gaps from
// an open reference work.
//
// Two things this prompt insists on that the paper prompt cannot:
//   - `sources:` frontmatter with per-section provenance, because scaffold
//     content has to be traceable to a licence-compatible source (plan §2.1);
//     it's the audit trail if anyone ever asks where a claim came from.
//   - the copyright frame. Reference sources are exactly the material where
//     over-copying is tempting: StatPearls is CC BY-NC-ND (read and cite, never
//     remix) and DSM-5-TR is never a source at all — the page links criteria
//     and does not carry them.
const SYSTEM_PROMPT_REFERENCE = `You are building a course wiki page for an undergraduate abnormal psychology course (PSY240), from an open reference work rather than from a single research paper.

You will be given:
1. The reference source (a textbook module, clinical guideline, or public-health reference)
2. The TARGET page you are filling, from the course's DSM-5-TR-anchored catalogue
3. That page's current content, if any, and the sections it has declared it still needs
4. A compact index of wiki pages that already exist

Your job: produce the COMPLETE target page as a single JSON object. Do not use any tools. Do not ask questions. Return only JSON.

THE TARGET PAGE IS A WHOLE-PAGE REWRITE, NOT A DELTA:
- If the target already has content, output it with action "replace" and return the ENTIRE page: everything worth keeping from the current body, with the needed sections now filled from your source. Accepting a "replace" overwrites the page, so anything you leave out is lost — carry the existing material forward, and do not restate the same point twice because it appeared in both.
- If the target has no content yet, output action "new" with the full page.
- Either way the page you return must stand alone and read as one coherent voice. Do NOT write an "Update from <source>" section, and do not repeat the section skeleton.

TARGET PAGE STRUCTURE (disorder pages) — these H2 sections, in this order, ALWAYS, exactly once each:
  ## Presentation      what it looks like clinically; a brief vignette if the source supports one
  ## Diagnosis         criteria STRUCTURE paraphrased, differential diagnosis, specifiers
  ## Epidemiology      prevalence, onset, course, sex/gender, culture
  ## Etiology          genetic/neurobiological, cognitive-behavioural, developmental, social determinants — say which are better evidenced
  ## Treatment         approaches, effect sizes, guideline recommendations, and what does NOT work
  ## Contested         validity of the category, competing models, culture-bound presentations, medicalization critiques
Overview and foundations pages use headings that suit their subject instead, but follow the same gap rules.

PRIORITY: fill the sections listed as NEEDED first. If the source does not cover a needed section, say so rather than padding it.

FOR EVERY SECTION the source does not support, write exactly one line under that heading:
  > **Needs research:** <specifically what is missing>
and list that section's lowercase name in the frontmatter "needs" array.

SOURCING — mandatory:
- Frontmatter must include a "sources" array naming what this content came from, e.g. sources: ["Bridley & Daffin, Fundamentals of Psychological Disorders 3e, Module 12", "NIMH health topic: Schizophrenia"].
- Attribute in-text where a specific claim, statistic or effect size comes from a named source.
- Prevalence and epidemiology figures must carry their source and year.

COPYRIGHT — non-negotiable:
- Never reproduce DSM-5-TR criteria text, tables or decision trees. Paraphrase the STRUCTURE of criteria only; the page links the official chapter, it does not carry it.
- Paraphrase everything. Do not copy sentences from the source, even when it is openly licensed — some course sources are CC BY-NC-ND, which permits citing but not remixing.
- Facts, prevalence figures and classifications are free to state; wording is not.

RULES:
- The target page is ONE page in the output, with action "replace" if it already has content or "new" if it does not. See the whole-page-rewrite rule above.
- Keep any existing claim that your source does not contradict, including its in-text attribution. If your source DOES contradict it, keep both and say so, and also record it in "contradictions" — do not silently drop the older claim.
- You may also output additional NEW pages for concepts or treatments the source introduces that the wiki lacks, but the target page is the point — do not drown it.
- Flag any contradiction with existing wiki content in "contradictions"; do not silently resolve it.
- Wikilink filenames: lowercase, hyphens for spaces.

OUTPUT FORMAT (JSON only, no other text):
{
  "pages": [
    {"action": "new" | "replace", "type": "disorder|study|concept|treatment|debate", "filename": "lowercase-with-dashes.md", "content": "full markdown content with YAML frontmatter"}
  ],
  "index_entries": [
    {"filename": "...", "type": "...", "one_line_summary": "..."}
  ],
  "contradictions": ["description of any conflict with existing wiki content, or empty list"],
  "log_entry": "2-4 sentence summary of what was ingested, which target sections it filled, and which remain needed"
}`

export default async function handler(req, res) {
  const url = process.env.COURSE_SUPABASE_URL
  const anonKey = process.env.COURSE_SUPABASE_ANON_KEY
  const serviceKey = process.env.COURSE_SUPABASE_SERVICE_KEY

  if (!url || !anonKey || !serviceKey || !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing COURSE_SUPABASE_* or ANTHROPIC_API_KEY env vars' })
  }

  if (req.method === 'GET') {
    // Public client config — the anon key is designed to be public.
    return res.status(200).json({ url, anonKey })
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { pdf_path, pdf_mode, course_id, source_type = 'paper', target_slug = null, source_citation = null } = req.body ?? {}
  if (!pdf_path || !course_id || !['native', 'extracted'].includes(pdf_mode)) {
    return res.status(400).json({ error: 'Required: pdf_path, course_id, pdf_mode ("native" | "extracted")' })
  }
  if (!['paper', 'reference'].includes(source_type)) {
    return res.status(400).json({ error: 'source_type must be "paper" or "reference"' })
  }
  // Mirrors the DB constraint, so a bad request fails here with a readable
  // message rather than as a check-constraint violation two layers down.
  if (source_type === 'reference' && !target_slug) {
    return res.status(400).json({ error: 'reference mode requires target_slug (the catalogue page to fill)' })
  }
  if (source_type === 'paper' && target_slug) {
    return res.status(400).json({ error: 'target_slug only applies to reference mode' })
  }

  // ── Auth: verify the JWT against radlab-academic, then the enrollment ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' })

  // Client scoped to the caller's JWT: RLS applies, so current_person_id()
  // resolves the caller and the enrollments query can only see their own rows.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: personId, error: personErr } = await userClient.rpc('current_person_id')
  if (personErr || !personId) {
    return res.status(401).json({ error: 'Invalid session or unknown user' })
  }

  const { data: staffRows, error: enrollErr } = await userClient
    .from('enrollments')
    .select('id, role')
    .eq('course_id', course_id)
    .eq('status', 'active')
    .in('role', ['ta', 'instructor'])
  if (enrollErr) return res.status(500).json({ error: `Enrollment check failed: ${enrollErr.message}` })
  if (!staffRows?.length) {
    return res.status(403).json({ error: 'No active TA/instructor enrollment for this course' })
  }

  // ── Service role from here on (ingest_jobs has no authenticated writes) ──
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Idempotency: a job already exists for this exact submit → return it
  // instead of starting a duplicate ingest.
  const { data: existing } = await service
    .from('ingest_jobs')
    .select('id, status')
    .eq('course_id', course_id)
    .eq('pdf_path', pdf_path)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) {
    return res.status(200).json({ job_id: existing.id, status: existing.status, deduped: true })
  }

  const { data: job, error: jobErr } = await service
    .from('ingest_jobs')
    .insert({ course_id, created_by: personId, pdf_path, pdf_mode, status: 'processing', source_type, target_slug, source_citation })
    .select('id')
    .single()
  if (jobErr) return res.status(500).json({ error: `Could not create job: ${jobErr.message}` })

  // Respond now; run the ingest in the background. waitUntil keeps the
  // function alive (up to maxDuration) after the response is sent, so no
  // HTTP connection stays open for the minutes-long model call.
  waitUntil(runIngest(service, job.id, { pdf_path, pdf_mode, course_id, personId, source_type, target_slug }))
  return res.status(202).json({ job_id: job.id, status: 'processing' })
}

async function runIngest(service, jobId, { pdf_path, pdf_mode, course_id, personId, source_type = 'paper', target_slug = null }) {
  const markFailed = async (message, rawOutput) => {
    await service.from('ingest_jobs').update({
      status: 'failed',
      error: message.slice(0, 4000),
      // Preserve raw model output for debugging malformed-JSON failures. Only
      // set when there is something to preserve — a persistence failure comes
      // after the parsed result is already saved, and must not null it out.
      ...(rawOutput ? { result_json: { raw_output: rawOutput } } : {}),
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)
  }

  try {
    // ── Load the PDF from storage ──
    const { data: blob, error: dlErr } = await service.storage.from(BUCKET).download(pdf_path)
    if (dlErr || !blob) return await markFailed(`PDF download failed: ${dlErr?.message || 'not found'}`)
    const pdfBuffer = Buffer.from(await blob.arrayBuffer())

    // ── Wiki index: read wiki_pages, the source of truth (WP1) ──
    // Previously this replayed index_entries out of every done job's
    // result_json. That made the index a function of ingest history rather
    // than of the wiki, so a page edited or retired after ingest still
    // advertised its original summary to the model, and pages created any
    // other way were invisible. Rendered as `<slug>.md` because the system
    // prompt's contract is filenames.
    //
    // Only pages with an ACCEPTED body count as existing. A shell — created
    // so an invented page appears in the wiki and resolves inbound links —
    // has no reviewed content, so there is nothing for the model to write a
    // delta against. Including shells here caused exactly that: the model saw
    // `borderline-personality-disorder` in the index, returned
    // `action: "update"` per the system prompt's "only the new information to
    // merge", and the reviewer accepted a body that was a Fonagy addendum with
    // no definition in front of it. Excluding bodiless pages means a page
    // nobody has reviewed yet is proposed afresh — two competing full drafts
    // to choose between, which is a reviewable state; a delta against nothing
    // is not. (Found 2026-07-26 on live data, after two accepted updates both
    // produced fragments.)
    const { data: indexPages } = await service
      .from('wiki_pages')
      .select('slug, type, summary')
      .eq('course_id', course_id)
      .neq('status', 'archived')
      .not('content', 'is', null)
      .order('slug', { ascending: true })
    const wikiIndex = indexPages?.length
      ? indexPages.map(p => `- ${p.slug}.md (${p.type}): ${p.summary ?? ''}`).join('\n')
      : '(the wiki is empty — every page will be new)'

    // ── Reference mode: the brief for the page being filled ──
    // Named target + its current body + its declared gaps. Without this the
    // model is just reading a textbook chapter and guessing what the course
    // wants; with it, the run is answerable — it either filled the sections it
    // was pointed at or it didn't, and wiki_gap_report says which.
    let targetBrief = ''
    if (source_type === 'reference') {
      const { data: cat } = await service
        .from('disorders')
        .select('slug, title, tier, lecture, dsm_chapter, tier_review_note')
        .eq('course_id', course_id)
        .eq('slug', target_slug)
        .maybeSingle()
      if (!cat) {
        return await markFailed(`No catalogue entry for "${target_slug}" in this course — reference runs must target a seeded page.`)
      }
      const { data: page } = await service
        .from('wiki_pages')
        .select('content, needs, status')
        .eq('course_id', course_id)
        .eq('slug', target_slug)
        .maybeSingle()

      const gaps = page?.needs?.length ? page.needs.join(', ') : null
      targetBrief =
        `TARGET PAGE: ${cat.slug}.md — "${cat.title}"\n` +
        `Catalogue: tier ${cat.tier}` +
        (cat.dsm_chapter ? `, DSM-5-TR chapter ${cat.dsm_chapter}` : '') +
        (cat.lecture ? `, taught in lecture ${cat.lecture}` : '') + '\n' +
        (cat.tier_review_note ? `Editorial note: ${cat.tier_review_note}\n` : '') +
        (page?.content
          ? `SECTIONS STILL NEEDED: ${gaps ?? '(none declared — extend where the source adds something)'}\n\n` +
            `CURRENT PAGE CONTENT (produce an "update" that merges into this; do not restate it):\n${page.content}\n`
          : `This page has no accepted content yet — produce it as "new", in full.\n`) +
        '\n'
    }

    // ── Build the user content per mode (ported from build_user_prompt) ──
    const closing = 'Return the JSON object as specified in your instructions. Return only JSON.'
    let userContent
    if (pdf_mode === 'extracted') {
      const { totalPages, text } = await extractText(new Uint8Array(pdfBuffer), { mergePages: true })
      // Empty or near-empty extraction is the signature of a scanned PDF with
      // no OCR text layer (often just a repeated header line per page) — not a
      // corrupt file. Real papers run thousands of chars/page; ~100/page is a
      // conservative floor. Don't silently send header-noise to the model.
      const chars = text?.trim().length ?? 0
      if (chars < Math.max(500, (totalPages ?? 1) * 100)) {
        return await markFailed(
          `Extracted only ${chars} characters from ${totalPages} page(s) — this looks like a scanned PDF with no text layer. Use native mode, which reads page images.`
        )
      }
      userContent = [{
        type: 'text',
        text: `${targetBrief}EXISTING WIKI INDEX:\n${wikiIndex}\n\n${source_type === 'reference' ? 'REFERENCE SOURCE TEXT' : 'PAPER TEXT'}:\n${text}\n\n${closing}`,
      }]
    } else {
      userContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') },
        },
        {
          type: 'text',
          text: `${targetBrief}EXISTING WIKI INDEX:\n${wikiIndex}\n\nThe ${source_type === 'reference' ? 'reference source' : 'paper'} is the attached PDF document.\n\n${closing}`,
        },
      ]
    }

    // ── Call the Messages API (streaming: large JSON output) ──
    const anthropic = new Anthropic()
    let inputTokens = 0
    let outputTokens = 0

    const callModel = async (extraNudge) => {
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        thinking: { type: 'adaptive' },
        system: source_type === 'reference' ? SYSTEM_PROMPT_REFERENCE : SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: extraNudge
            ? [...userContent, { type: 'text', text: extraNudge }]
            : userContent,
        }],
      })
      const msg = await stream.finalMessage()
      inputTokens += msg.usage.input_tokens
        + (msg.usage.cache_creation_input_tokens ?? 0)
        + (msg.usage.cache_read_input_tokens ?? 0)
      outputTokens += msg.usage.output_tokens
      if (msg.stop_reason === 'refusal') {
        throw new Error(`Model refused the request${msg.stop_details?.explanation ? `: ${msg.stop_details.explanation}` : ''}`)
      }
      if (msg.stop_reason === 'max_tokens') {
        throw new Error('Output truncated at max_tokens — paper may be too large for one call')
      }
      return msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
    }

    const parseJson = (raw) => {
      // Tolerate a fenced ```json block despite the return-only-JSON instruction.
      const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      return JSON.parse(stripped)
    }

    let raw = await callModel()
    let result
    try {
      result = parseJson(raw)
    } catch {
      // One retry per the plan, then fail with the raw output preserved.
      raw = await callModel('Your previous attempt was not valid JSON. Return ONLY the JSON object, with no surrounding text or code fences.')
      try {
        result = parseJson(raw)
      } catch {
        return await markFailed('Model output was not valid JSON after one retry', raw)
      }
    }

    // Save the parsed result before persisting proposals: the tokens are
    // already spent, so a downstream write failure must never lose the output.
    await service.from('ingest_jobs').update({
      result_json: result,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    }).eq('id', jobId)

    const failures = await persistProposals(service, { jobId, courseId: course_id, personId, result })
    if (failures.length) {
      return await markFailed(
        `Model output parsed, but ${failures.length} page(s) failed to persist: ${failures.join('; ')}`
      )
    }

    await service.from('ingest_jobs').update({
      status: 'done',
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)
  } catch (err) {
    await markFailed(err?.message || 'Ingest failed')
  }
}

// Wikilink target for a model-supplied filename: 'Panic-Disorder.md' → 'panic-disorder'.
const toSlug = (filename) => filename.trim().toLowerCase().replace(/\.md$/, '')

// The model returns page bodies with YAML frontmatter but no separate title
// field, so read it from the frontmatter. Falling back to a de-slugified title
// is display-only — it never round-trips back into a slug (see taxonomy §4:
// slugs are stored, never derived).
function extractTitle(content, slug) {
  const frontmatter = content?.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const titleLine = frontmatter?.[1].match(/^title:\s*(.+)$/m)
  const title = titleLine?.[1].trim().replace(/^["']|["']$/g, '')
  if (title) return title
  return slug.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

// Write each returned page as a *proposed* version awaiting review.
//
// Nothing here touches wiki_pages.content. A page that doesn't exist yet is
// created as a shell (slug/type/title/summary) so it appears in the index and
// resolves inbound wikilinks; its body stays null until a reviewer promotes a
// proposal. That keeps the invariant that published content — the thing
// students read and the thing WP7 exports — has always been through review,
// and it's why retiring the job-replay index above is safe: wiki_pages now
// gets a row for every page the model produces.
//
// Returns an array of human-readable failures (empty on success).
async function persistProposals(service, { jobId, courseId, personId, result }) {
  const summaries = new Map(
    (result?.index_entries ?? [])
      .filter(e => e?.filename)
      .map(e => [toSlug(e.filename), e.one_line_summary ?? null])
  )

  const failures = []
  for (const page of result?.pages ?? []) {
    if (!page?.filename || !page?.type) {
      failures.push(`malformed page entry: ${JSON.stringify(page)?.slice(0, 120)}`)
      continue
    }
    const slug = toSlug(page.filename)
    const title = extractTitle(page.content, slug)
    const summary = summaries.get(slug) ?? null

    try {
      const { data: existing, error: lookupErr } = await service
        .from('wiki_pages')
        .select('id')
        .eq('course_id', courseId)
        .eq('slug', slug)
        .maybeSingle()
      if (lookupErr) throw new Error(lookupErr.message)

      let pageId = existing?.id
      if (!pageId) {
        const { data: created, error: insertErr } = await service
          .from('wiki_pages')
          .insert({
            course_id: courseId,
            slug,
            type: page.type,
            title,
            summary,
            status: 'proposed',
            created_by: personId,
            updated_by: personId,
          })
          .select('id')
          .single()
        if (insertErr) throw new Error(insertErr.message)
        pageId = created.id
      }
      // An existing page's summary is deliberately left alone — overwriting it
      // from an unreviewed proposal would change what students see.

      const { error: versionErr } = await service
        .from('wiki_page_versions')
        .insert({
          page_id: pageId,
          kind: 'proposed',
          // Anything the model returns that isn't a recognised action lands as
          // `new`, which is the safe default: a `new` proposal is reviewed as a
          // whole page, whereas mislabelling something as `update` would have
          // the UI pre-merge it onto the existing body.
          action: ['update', 'replace'].includes(page.action) ? page.action : 'new',
          title,
          summary,
          content: page.content ?? null,
          job_id: jobId,
          created_by: personId,
          review_status: 'pending',
        })
      if (versionErr) throw new Error(versionErr.message)
    } catch (err) {
      failures.push(`${slug}: ${err.message}`)
    }
  }
  return failures
}
