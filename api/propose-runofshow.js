import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// POST /api/propose-runofshow  { slug, deck }   (Authorization: main JWT)
//   → { ok, deck, slides, proposal }
//
// Study 5 prototype (DSI proposal, 2026-09-06): read an instructor's EXISTING
// slide deck and propose where the check-ins go — position, kind, wording —
// so adopting the Lecture Lounge becomes editing a proposal rather than
// authoring one from nothing.
//
// READ-ONLY BY CONSTRUCTION. This endpoint writes nothing: no checkins row,
// no config, no quiz key. It returns a proposal for a human to look at. That
// is deliberate for the first outing — Norm's real L1 run of show is planned
// and Wednesday is a live lecture, so a prototype must not be able to touch
// it. A future version can offer per-item "add to planner" once the shape is
// trusted.
//
// The deck is fetched over HTTP from our own origin (decks are public static
// files), which keeps this working identically on preview and production
// without bundling the deck corpus into the function.

const TOOL = {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const slug = String(req.body?.slug ?? '').trim().toLowerCase()
  const deck = String(req.body?.deck ?? '').trim()
  if (!slug || !/^L\d{1,2}$/i.test(deck)) return res.status(400).json({ error: 'slug and deck (e.g. L1) required' })

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  if (!url || !serviceKey || !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    // Same gate as the console route that will eventually host this.
    const jwt = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    const { data: { user }, error: uErr } = await service.auth.getUser(jwt)
    if (uErr || !user) return res.status(401).json({ error: 'Unauthorized' })
    const { data: cls } = await service.from('classes').select('id, name').eq('slug', slug).maybeSingle()
    if (!cls) return res.status(404).json({ error: 'No such class' })
    const { data: prof } = await service.from('profiles').select('role, super_admin').eq('id', user.id).single()
    let allowed = prof?.role === 'lab' || prof?.super_admin === true
    if (!allowed) {
      const { data: adm } = await service.from('class_admins')
        .select('id').eq('class_id', cls.id).eq('user_id', user.id).maybeSingle()
      allowed = !!adm
    }
    if (!allowed) return res.status(403).json({ error: 'Not a class admin' })

    const origin = process.env.SITE_URL || `https://${req.headers.host}`
    const deckRsp = await fetch(`${origin}/${slug}/${deck.toUpperCase()}.html`)
    if (!deckRsp.ok) return res.status(404).json({ error: `No deck at /${slug}/${deck.toUpperCase()}.html` })
    const outline = outlineFromDeck(await deckRsp.text())
    if (!outline.length) return res.status(422).json({ error: 'Could not parse slides from that deck' })

    const anthropic = new Anthropic()
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
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
      note: 'Nothing has been saved. This endpoint writes nothing.',
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
