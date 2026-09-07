import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// POST /api/lounge-ai  { action, ... }   (Authorization: main JWT)
//
// The Lecture Lounge's model-calling endpoint. TWO endpoints live here as one
// function on purpose: api/ is capped at 12 Vercel functions (see CLAUDE.md —
// the 13th breaks deployment while CI stays green, which is exactly how this
// consolidation came about, 2026-09-07). Both actions are class-admin gated
// and both call Claude, so they share the whole preamble anyway.
//
//   action: 'summarize' { checkin_id }
//     → groups a prompt check-in's free-text answers into themes for the
//       results screen. Writes checkins.results_summary. Fired when the
//       instructor presses "Show class".
//
//   action: 'propose'   { slug, deck }
//     → reads an instructor's existing slide deck and proposes a run of show.
//       WRITES NOTHING — a proposal for a human to look at (Study 5
//       prototype). Norm's real run of show is live; a prototype must not be
//       able to touch it.
//
//   action: 'accept'    { slug, deck, item }
//     → creates ONE proposed check-in as `planned`. The only write path from
//       a proposal, and deliberately per-item: the instructor accepts what
//       they want and ignores the rest. It refuses rather than overwrites —
//       an occupied position, or an existing weekly, is reported back with
//       nothing changed. Nothing here can modify or delete an existing row.

const SUMMARIZE_TOOL = {
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

const PROPOSE_TOOL = {
  name: 'propose_run_of_show',
  description: 'Propose in-lecture check-ins for a slide deck.',
  input_schema: {
    type: 'object',
    properties: {
      reading: { type: 'string', description: 'Two sentences: what this lecture is doing pedagogically, in the instructor’s own terms.' },
      items: {
        type: 'array', minItems: 3, maxItems: 6,
        items: {
          type: 'object',
          properties: {
            after_slide: { type: 'integer', description: 'Slide number this check-in should follow (1-based, as numbered in the outline).' },
            slide_title: { type: 'string', description: 'That slide’s heading, so a human can locate it.' },
            position: { type: 'integer', description: 'Console position: arrival 1, then ascending, ending below 99.' },
            activities: {
              type: 'array',
              items: { type: 'string', enum: ['mood', 'pacing', 'prompt', 'quiz', 'question_box'] },
              description: 'Which activities this check-in runs, in order.',
            },
            prompt_text: { type: 'string', description: 'Exact wording if activities include prompt; empty string otherwise.' },
            quiz_items: {
              type: 'array', maxItems: 5,
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
                  has_right_answer: { type: 'boolean', description: 'False for split-the-room questions where no option is correct.' },
                  correct_index: { type: 'integer', description: 'Zero-based index of the correct option. Only meaningful when has_right_answer is true; omit otherwise.' },
                },
                required: ['text', 'options', 'has_right_answer'],
              },
            },
            rationale: { type: 'string', description: 'One sentence: why here, why this form.' },
          },
          required: ['after_slide', 'slide_title', 'position', 'activities', 'prompt_text', 'rationale'],
        },
      },
      weekly: {
        type: 'object',
        description: 'A between-lecture asynchronous question for the class wall.',
        properties: { prompt_text: { type: 'string' }, rationale: { type: 'string' } },
        required: ['prompt_text', 'rationale'],
      },
    },
    required: ['reading', 'items', 'weekly'],
  },
}

const strip = (html) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()

function outlineFromDeck(html) {
  const sections = html.match(/<section[^>]*>[\s\S]*?<\/section>/g) ?? []
  return sections.map((sec, i) => {
    const notes = sec.match(/<aside class="notes">([\s\S]*?)<\/aside>/)
    const body = sec.replace(/<aside[\s\S]*?<\/aside>/g, '')
    const h1 = body.match(/<h1>([\s\S]*?)<\/h1>/)
    const kicker = body.match(/<p class="kicker">([\s\S]*?)<\/p>/)
    return {
      n: i + 1,
      kicker: kicker ? strip(kicker[1]) : '',
      title: h1 ? strip(h1[1]) : '(untitled)',
      body: strip(body).slice(0, 420),
      notes: notes ? strip(notes[1]).slice(0, 320) : '',
    }
  })
}

// Shared gate: a valid main-project JWT belonging to a lab/super user or an
// admin of the class in question.
async function requireClassAdmin(service, req, classId) {
  const jwt = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const { data: { user }, error } = await service.auth.getUser(jwt)
  if (error || !user) return { error: 'Unauthorized', status: 401 }
  const { data: prof } = await service.from('profiles').select('role, super_admin').eq('id', user.id).single()
  if (prof?.role === 'lab' || prof?.super_admin === true) return { user }
  const { data: adm } = await service.from('class_admins')
    .select('id').eq('class_id', classId).eq('user_id', user.id).maybeSingle()
  return adm ? { user } : { error: 'Not a class admin', status: 403 }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const action = String(req.body?.action ?? '')
  if (!['summarize', 'propose', 'accept'].includes(action)) {
    return res.status(400).json({ error: "action must be 'summarize', 'propose' or 'accept'" })
  }

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!url || !serviceKey || !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    // ── Group a prompt check-in's answers into themes ─────────────────────
    if (action === 'summarize') {
      const checkinId = String(req.body?.checkin_id ?? '')
      if (!checkinId) return res.status(400).json({ error: 'checkin_id required' })

      const { data: ck } = await service.from('checkins')
        .select('id, config, lectures!inner(class_id)').eq('id', checkinId).maybeSingle()
      if (!ck) return res.status(404).json({ error: 'No such check-in' })
      const gate = await requireClassAdmin(service, req, ck.lectures.class_id)
      if (gate.error) return res.status(gate.status).json({ error: gate.error })

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
        tools: [SUMMARIZE_TOOL],
        tool_choice: { type: 'tool', name: SUMMARIZE_TOOL.name },
        messages: [{
          role: 'user',
          content: `These are anonymous in-lecture responses from university students to the prompt below. Group them into 2-4 themes for a projector slide the whole class will see.\n\nRules: theme labels in plain language; shares are rough percentages summing to ~100; each quote VERBATIM from a response, short, and skipped in favor of another if it contains a name, anything identifying, or anything inappropriate to project. Do not invent content that is not in the responses.\n\nPROMPT: ${ck.config?.prompt_text ?? ''}\n\nRESPONSES (${texts.length}):\n${texts.map((t, i) => `${i + 1}. ${t.slice(0, 300)}`).join('\n')}`,
        }],
      })
      const call = msg.content.find(b => b.type === 'tool_use')
      if (!call) throw new Error('model returned no grouping')
      const summary = { ...call.input, n: texts.length, generated_at: new Date().toISOString() }
      await service.from('checkins').update({ results_summary: summary }).eq('id', checkinId)
      return res.status(200).json({ ok: true, summary })
    }

    // ── Accept ONE proposed check-in into the planner ─────────────────────
    if (action === 'accept') {
      const slug = String(req.body?.slug ?? '').trim().toLowerCase()
      const deck = String(req.body?.deck ?? '').trim()
      const item = req.body?.item
      if (!slug || !/^L\d{1,2}$/i.test(deck) || !item) {
        return res.status(400).json({ error: 'slug, deck and item required' })
      }
      const { data: cls } = await service.from('classes').select('id').eq('slug', slug).maybeSingle()
      if (!cls) return res.status(404).json({ error: 'No such class' })
      const gate = await requireClassAdmin(service, req, cls.id)
      if (gate.error) return res.status(gate.status).json({ error: gate.error })

      const number = Number(deck.replace(/\D/g, ''))
      const { data: lec } = await service.from('lectures')
        .select('id, number').eq('class_id', cls.id).eq('number', number).maybeSingle()
      if (!lec) return res.status(404).json({ error: `No lecture numbered ${number} in this class` })

      const { data: siblings } = await service.from('checkins')
        .select('id, position, kind').eq('lecture_id', lec.id)

      // Refuse, never overwrite. An occupied position or an existing weekly
      // is reported back and left exactly as it was.
      if (item.weekly) {
        if ((siblings ?? []).some(c => c.kind === 'weekly')) {
          return res.status(409).json({ error: 'This lecture already has a question of the week.' })
        }
        const { data: made, error } = await service.from('checkins').insert({
          lecture_id: lec.id, kind: 'weekly', status: 'planned', position: 99,
          config: { activities: ['prompt'], prompt_text: String(item.prompt_text ?? '') },
        }).select('id').single()
        if (error) throw new Error(error.message)
        return res.status(200).json({ ok: true, created: made.id, kind: 'weekly' })
      }

      const position = Number(item.position)
      if (!Number.isFinite(position)) return res.status(400).json({ error: 'item.position required' })
      if ((siblings ?? []).some(c => c.position === position && c.kind !== 'weekly')) {
        return res.status(409).json({ error: `Position ${position} is already taken — nothing changed.` })
      }

      const activities = (item.activities ?? []).filter(a =>
        ['mood', 'pacing', 'prompt', 'quiz', 'question_box'].includes(a))
      if (!activities.length) return res.status(400).json({ error: 'item.activities must name at least one activity' })

      const config = { activities }
      if (activities.includes('prompt')) config.prompt_text = String(item.prompt_text ?? '')
      let answerKey = null
      if (activities.includes('quiz')) {
        const raw = (item.quiz_items ?? []).slice(0, 5)
        const built = raw.map((q) => ({
          id: `q_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
          text: String(q.text ?? ''),
          options: (q.options ?? []).map(String).slice(0, 6),
        }))
        if (!built.length) return res.status(400).json({ error: 'a quiz check-in needs quiz_items' })
        config.quiz_items = built
        // Only a quiz that actually HAS a right answer gets a key. A
        // split-the-room question must not acquire one by default: revealing
        // a fabricated key in front of a lecture hall is the failure mode
        // this whole feature is supposed to prevent.
        const scored = raw
          .map((q, i) => [built[i].id, q.has_right_answer ? Number(q.correct_index ?? 0) : null])
          .filter((pair) => pair[1] !== null)
        if (scored.length) answerKey = Object.fromEntries(scored)
      }

      const { data: made, error } = await service.from('checkins').insert({
        lecture_id: lec.id, kind: 'live', status: 'planned', position, config,
      }).select('id').single()
      if (error) throw new Error(error.message)
      if (answerKey) {
        await service.from('checkin_quiz_keys').insert({ checkin_id: made.id, answer_key: answerKey })
      }
      return res.status(200).json({ ok: true, created: made.id, position, scored: !!answerKey })
    }

    // ── Propose a run of show from a deck (writes nothing) ────────────────
    const slug = String(req.body?.slug ?? '').trim().toLowerCase()
    const deck = String(req.body?.deck ?? '').trim()
    if (!slug || !/^L\d{1,2}$/i.test(deck)) {
      return res.status(400).json({ error: 'slug and deck (e.g. L1) required' })
    }
    const { data: cls } = await service.from('classes').select('id, name').eq('slug', slug).maybeSingle()
    if (!cls) return res.status(404).json({ error: 'No such class' })
    const gate = await requireClassAdmin(service, req, cls.id)
    if (gate.error) return res.status(gate.status).json({ error: gate.error })

    const origin = process.env.SITE_URL || `https://${req.headers.host}`
    const deckRsp = await fetch(`${origin}/${slug}/${deck.toUpperCase()}.html`)
    if (!deckRsp.ok) return res.status(404).json({ error: `No deck at /${slug}/${deck.toUpperCase()}.html` })
    const outline = outlineFromDeck(await deckRsp.text())
    if (!outline.length) return res.status(422).json({ error: 'Could not parse slides from that deck' })

    const anthropic = new Anthropic()
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      tools: [PROPOSE_TOOL],
      tool_choice: { type: 'tool', name: PROPOSE_TOOL.name },
      messages: [{
        role: 'user',
        content: `You are helping a university instructor instrument an existing lecture with live in-class check-ins. Below is the slide outline of one lecture, including the instructor's own presenter notes — those notes are the best evidence of what they are trying to do in the room.

Propose where the check-ins go. Principles:
- FEWER, BETTER. A three-hour lecture supports about four or five; a fifty-minute one, two or three. Overuse is the commonest failure.
- The first check-in is the arrival ritual (position 1) and usually pairs mood + pacing with one light opening prompt.
- Put substantive check-ins where the lecture ALREADY pauses: exercises, breaks, a case the room is meant to argue about. Read the notes for these.
- Use 'quiz' for split-the-room commitment questions. If no option is truly correct — the point is the class split — set has_right_answer false and say so in the rationale.
- Use 'question_box' where students would want to ask something anonymously; do not also ask a free-text prompt in the same check-in, since two open-ended asks in one check-in is a tax nobody pays twice.
- Prompts must be answerable in one or two sentences on a phone, and must have no single right answer.
- End with ONE weekly question for the class wall: a single line, forcing a stance, no correct answer, unanswerable without having met the lecture's ideas.

Positions order the run of show: arrival 1, then ascending. Keep them under 99.

COURSE: ${cls.name}
DECK: ${deck.toUpperCase()} (${outline.length} slides)

${outline.map(s => `--- Slide ${s.n}${s.kicker ? ` [${s.kicker}]` : ''}: ${s.title}\n${s.body}${s.notes ? `\nPRESENTER NOTES: ${s.notes}` : ''}`).join('\n')}`,
      }],
    })
    const call = msg.content.find(b => b.type === 'tool_use')
    if (!call) throw new Error('model returned no proposal')

    return res.status(200).json({
      ok: true,
      deck: deck.toUpperCase(),
      slides: outline.length,
      proposal: call.input,
      note: 'Nothing has been saved. This action writes nothing.',
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
