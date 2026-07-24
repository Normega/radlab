// Field Guide ingest — the platform's first real serverless function.
//
// GET  /api/ingest          → public client config for the radlab-academic
//                             Supabase project ({ url, anonKey }). The anon key
//                             is public by design (RLS enforces access); serving
//                             it from here keeps COURSE_* env vars server-side
//                             only, with no VITE_-prefixed duplicates to manage.
// POST /api/ingest          → run one ingest job. Body:
//                             { pdf_path, pdf_mode: 'native'|'extracted', course_id }
//
// Auth model (radlab-academic project, NOT the main radlab project):
// the caller's JWT is verified by resolving public.current_person_id() under
// that JWT, then confirming an active 'ta'/'instructor' enrollment for the
// course. Job inserts/updates go through the service role — ingest_jobs has
// deliberately no authenticated write policies.
//
// Privacy: the Anthropic API call receives ONLY the paper (text or PDF bytes)
// and the wiki index built from prior results. No email, name, person_id, or
// any other identity data may ever enter the prompt.
//
// The UI never blocks on this call — it polls ingest_jobs (staff-read RLS).

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { extractText } from 'unpdf'

// Vercel function config. 300s needs Fluid Compute (default on current
// Vercel projects); if the deploy rejects it, drop to 60 and prefer
// 'extracted' mode for large papers.
export const maxDuration = 300

const MODEL = 'claude-opus-4-8'
const BUCKET = 'ingest-pdfs'

// Ported verbatim from the prototype's psy240_schema.py — the compact PSY240
// ingest schema embedded as a system prompt. Do not redesign this schema in
// code changes; it is the single source of truth for the wiki page format.
const SYSTEM_PROMPT = `You are maintaining a course wiki for an undergraduate abnormal psychology course, anchored on the DSM-5 and built collaboratively from student-submitted peer-reviewed papers.

You will be given:
1. The full text of one academic paper
2. A compact index of wiki pages that already exist

Your job: read the paper, then output ALL new or updated wiki pages needed, as a single JSON object. Do not use any tools. Do not ask questions. Return only JSON.

PAGE TYPES:
- disorder: a DSM-5 diagnostic category. Fields: title, dsm5_criteria_summary (paraphrased, never verbatim DSM-5 text), prevalence, related_disorders, key_studies
- study: one page per paper. Fields: title, authors, year, journal, doi, design, sample, key_findings, limitations, disorders_touched, concepts_touched
- concept: a theoretical or empirical construct. Fields: title, definition, related_concepts, key_studies
- treatment: an intervention or treatment approach. Fields: title, target_disorders, mechanism, evidence_base, limitations
- debate: a contested claim in the field. Fields: title, summary, field_positions (list of researcher/stance pairs), related_disorders, related_concepts
  NOTE: never populate a "my_take" field. That field is reserved for human instructor edits only.

RULES:
- Paraphrase all diagnostic criteria. Never reproduce DSM-5 text verbatim.
- If a page already exists in the index, output it as an "update" with only the new information to merge, not a full rewrite.
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

  const { pdf_path, pdf_mode, course_id } = req.body ?? {}
  if (!pdf_path || !course_id || !['native', 'extracted'].includes(pdf_mode)) {
    return res.status(400).json({ error: 'Required: pdf_path, course_id, pdf_mode ("native" | "extracted")' })
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

  const { data: job, error: jobErr } = await service
    .from('ingest_jobs')
    .insert({ course_id, created_by: personId, pdf_path, pdf_mode, status: 'processing' })
    .select('id')
    .single()
  if (jobErr) return res.status(500).json({ error: `Could not create job: ${jobErr.message}` })

  const fail = async (message, rawOutput) => {
    await service.from('ingest_jobs').update({
      status: 'failed',
      error: message.slice(0, 4000),
      // Preserve raw model output for debugging malformed-JSON failures.
      result_json: rawOutput ? { raw_output: rawOutput } : null,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id)
    return res.status(500).json({ error: message, job_id: job.id })
  }

  try {
    // ── Load the PDF from storage ──
    const { data: blob, error: dlErr } = await service.storage.from(BUCKET).download(pdf_path)
    if (dlErr || !blob) return await fail(`PDF download failed: ${dlErr?.message || 'not found'}`)
    const pdfBuffer = Buffer.from(await blob.arrayBuffer())

    // ── Wiki index: aggregate index_entries from this course's done jobs ──
    // (latest entry per filename wins — enables the "update vs new" behavior
    // across successive ingests during the test phase)
    const { data: doneJobs } = await service
      .from('ingest_jobs')
      .select('result_json')
      .eq('course_id', course_id)
      .eq('status', 'done')
      .order('created_at', { ascending: true })
    const indexByFile = new Map()
    for (const row of doneJobs ?? []) {
      for (const entry of row.result_json?.index_entries ?? []) {
        if (entry?.filename) indexByFile.set(entry.filename, entry)
      }
    }
    const wikiIndex = indexByFile.size
      ? [...indexByFile.values()].map(e => `- ${e.filename} (${e.type}): ${e.one_line_summary}`).join('\n')
      : '(the wiki is empty — every page will be new)'

    // ── Build the user content per mode (ported from build_user_prompt) ──
    const closing = 'Return the JSON object as specified in your instructions. Return only JSON.'
    let userContent
    if (pdf_mode === 'extracted') {
      const { text } = await extractText(new Uint8Array(pdfBuffer), { mergePages: true })
      if (!text?.trim()) return await fail('Text extraction produced no text — try native mode')
      userContent = [{
        type: 'text',
        text: `EXISTING WIKI INDEX:\n${wikiIndex}\n\nPAPER TEXT:\n${text}\n\n${closing}`,
      }]
    } else {
      userContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') },
        },
        {
          type: 'text',
          text: `EXISTING WIKI INDEX:\n${wikiIndex}\n\nThe paper is the attached PDF document.\n\n${closing}`,
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
        system: SYSTEM_PROMPT,
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
        return await fail('Model output was not valid JSON after one retry', raw)
      }
    }

    await service.from('ingest_jobs').update({
      status: 'done',
      result_json: result,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      completed_at: new Date().toISOString(),
    }).eq('id', job.id)

    return res.status(200).json({ job_id: job.id, status: 'done' })
  } catch (err) {
    return await fail(err?.message || 'Ingest failed')
  }
}
