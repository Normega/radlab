import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// POST /api/summarize-checkin  { checkin_id }   (Authorization: main JWT)
//   → { ok, summary } | { ok, summary: null, reason }
//
// Groups a prompt check-in's free-text responses into a few themes for the
// results screen — the projector shows mood and pacing already; this gives
// the room's WORDS the same treatment (Norm, 2026-09-06). Fired by the Run
// tab when the instructor presses "Show class"; idempotent to re-fire.
//
// Anonymity: quotes are verbatim but unattributed, and the model is told to
// skip anything identifying or inappropriate rather than repeat it. The
// stored summary lands on the checkin row, which members can already read —
// aggregate only, never per-student rows.
//
// Cost: ~200 short responses ≈ a few thousand input tokens on Haiku —
// fractions of a cent per check-in. Latency ~2-4s, raced against a client
// timeout so a slow model never holds the room hostage.

const TOOL = {
  name: 'group_responses',
  description: 'Group anonymous student responses into themes for a projector slide.',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'One short sentence naming the dominant thread of the room, plain language.' },
      themes: {
        type: 'array', minItems: 2, maxItems: 4,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Three-to-six-word theme name' },
            share: { type: 'integer', description: 'Approximate percent of responses in this theme, integer 0-100' },
            quote: { type: 'string', description: 'One SHORT representative quote, verbatim, no names, nothing identifying' },
          },
          required: ['label', 'share', 'quote'],
        },
      },
    },
    required: ['headline', 'themes'],
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const checkinId = String(req.body?.checkin_id ?? '')
  if (!checkinId) return res.status(400).json({ error: 'checkin_id required' })

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!url || !serviceKey || !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    // Caller must be an admin of the checkin's class (or lab/super) — same
    // rule as the console route that hosts the button.
    const jwt = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    const { data: { user }, error: uErr } = await service.auth.getUser(jwt)
    if (uErr || !user) return res.status(401).json({ error: 'Unauthorized' })

    const { data: ck } = await service.from('checkins')
      .select('id, config, lectures!inner(class_id)').eq('id', checkinId).maybeSingle()
    if (!ck) return res.status(404).json({ error: 'No such check-in' })

    const { data: prof } = await service.from('profiles').select('role, super_admin').eq('id', user.id).single()
    let allowed = prof?.role === 'lab' || prof?.super_admin === true
    if (!allowed) {
      const { data: adminRow } = await service.from('class_admins')
        .select('id').eq('class_id', ck.lectures.class_id).eq('user_id', user.id).maybeSingle()
      allowed = !!adminRow
    }
    if (!allowed) return res.status(403).json({ error: 'Not a class admin' })

    const promptText = ck.config?.prompt_text ?? ''
    const { data: rows } = await service.from('checkin_responses')
      .select('prompt_response').eq('checkin_id', checkinId)
      .not('prompt_response', 'is', null).neq('prompt_response', '')
      .order('created_at', { ascending: false }).limit(400)
    const texts = (rows ?? []).map(r => r.prompt_response.trim()).filter(Boolean)

    if (texts.length < 3) {
      await service.from('checkins').update({ results_summary: null }).eq('id', checkinId)
      return res.status(200).json({ ok: true, summary: null, reason: `only ${texts.length} responses` })
    }

    const anthropic = new Anthropic()
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{
        role: 'user',
        content: `These are anonymous in-lecture responses from university students to the prompt below. Group them into 2-4 themes for a projector slide the whole class will see.\n\nRules: theme labels in plain language; shares are rough percentages summing to ~100; each quote VERBATIM from a response, short, and skipped in favor of another if it contains a name, anything identifying, or anything inappropriate to project. Do not invent content that is not in the responses.\n\nPROMPT: ${promptText}\n\nRESPONSES (${texts.length}):\n${texts.map((t, i) => `${i + 1}. ${t.slice(0, 300)}`).join('\n')}`,
      }],
    })
    const call = msg.content.find(b => b.type === 'tool_use')
    if (!call) throw new Error('model returned no grouping')
    const summary = { ...call.input, n: texts.length, generated_at: new Date().toISOString() }

    await service.from('checkins').update({ results_summary: summary }).eq('id', checkinId)
    return res.status(200).json({ ok: true, summary })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
