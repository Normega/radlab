import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

// POST /api/session-push   — the workbench ingest endpoint (§ Workbench in website.md)
// GET  /api/session-push?session_id=…  → { max_seq } so a hook that lost its
//                                        local high-water mark can resync.
//
// Called by scripts/claude-session-push.mjs running as a Claude Code `Stop` hook
// on Norm's machine. That is the one thing shaping this file: the caller is a
// shell script, not a browser, so there is no user JWT to check and the
// two-client pattern in api/ingest.js does not apply. Authentication is a shared
// secret, and the writes go through the service role.
//
// Because the service role bypasses RLS, **this endpoint is the trust boundary**.
// Everything the hook is supposed to guarantee is re-checked here rather than
// assumed: shape, caps, and the secret scrub. A hook is a file on a laptop; it
// can be edited, stale, or replaced by an older copy, and none of those should be
// able to write something the schema's comments promise is impossible.
//
// What this endpoint will NOT accept, by design: tool output. The body carries
// tool *headlines* only. If a future version wants diffs, that is a schema change
// and a redaction review, not a new field slipped past here.

export const config = { maxDuration: 30 }

const MAX_TURNS_PER_PUSH = 400
const MAX_BODY_CHARS = 4000
const MAX_TOOLS_PER_TURN = 40
const MAX_HEADLINE_CHARS = 200
const MAX_TITLE_CHARS = 160

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Belt and braces. Tool output never reaches this endpoint, so the realistic
// exposure is a secret pasted into a *prompt* — which is exactly the kind of
// thing that gets pasted into a prompt. Each pattern is anchored on a distinctive
// prefix rather than on entropy, because entropy heuristics flag hashes, UUIDs
// and minified code, and a scrubber that cries wolf gets turned off.
const SECRET_PATTERNS = [
  [/sk-ant-[A-Za-z0-9_-]{16,}/g, '[anthropic-key-redacted]'],
  [/sk-[A-Za-z0-9]{32,}/g, '[api-key-redacted]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[jwt-redacted]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[aws-key-redacted]'],
  [/\bghp_[A-Za-z0-9]{20,}/g, '[github-token-redacted]'],
  [/\bpostgres(?:ql)?:\/\/[^\s'"]+/gi, '[connection-string-redacted]'],
  // service_role / anon keys and generic secrets assigned in config-ish text
  [/\b(service_role|service[_-]?key|api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9._-]{20,}['"]?/gi,
    (m) => `${m.split(/[:=]/)[0].trim()}=[redacted]`],
]

// The pattern list above can only catch secrets that announce themselves with a
// known prefix. This catches the two it cannot: our own credentials, by exact
// match, because the server is the one place that knows them.
//
// Not hypothetical. The session that built this feature discusses the push token
// in prose, so capturing it would have published a working write-credential to
// whichever student it was shared with — a random base64 string no prefix rule
// will ever match. Any transcript where the operator pasted or discussed these
// values has the same problem.
//
// Split across a run of text is not covered, and neither is any other secret the
// author happens to type. Redaction stays a backstop; the real protection is that
// tool output is never collected at all.
function selfSecrets() {
  return [process.env.WORKBENCH_PUSH_TOKEN, process.env.SUPABASE_SERVICE_KEY]
    .filter((v) => typeof v === 'string' && v.length >= 12)
}

function scrub(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  for (const [re, replacement] of SECRET_PATTERNS) out = out.replace(re, replacement)
  for (const secret of selfSecrets()) out = out.split(secret).join('[credential-redacted]')
  return out
}

function clip(text, max) {
  if (typeof text !== 'string') return null
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n… [truncated at ${max} characters]`
}

// Constant-time comparison that does not leak the secret's length through an
// early return on mismatched sizes.
function secretMatches(provided, expected) {
  const a = Buffer.from(String(provided ?? ''), 'utf8')
  const b = Buffer.from(String(expected ?? ''), 'utf8')
  if (b.length === 0) return false
  const padded = Buffer.alloc(b.length)
  a.copy(padded)
  return timingSafeEqual(padded, b) && a.length === b.length
}

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  const pushToken = process.env.WORKBENCH_PUSH_TOKEN

  if (!url || !serviceKey || !pushToken) {
    // Named explicitly: a silent 500 here would look like a hook bug and get
    // debugged on the wrong machine.
    return res.status(500).json({
      error: 'Server not configured',
      missing: [
        !url && 'SUPABASE_URL',
        !serviceKey && 'SUPABASE_SERVICE_KEY',
        !pushToken && 'WORKBENCH_PUSH_TOKEN',
      ].filter(Boolean),
    })
  }

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!secretMatches(bearer, pushToken)) {
    return res.status(401).json({ error: 'Bad or missing push token' })
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // This project has migrated to Supabase's new API key scheme, so the legacy
  // `service_role` JWT still displayed on Settings → API is dead. Pasting it
  // produces "Legacy API keys are disabled" from PostgREST, which names the
  // problem but not the fix, and reads as a fault in this endpoint rather than a
  // wrong value in an env var. It has cost two rounds already — so say the fix.
  const explainKey = (message) =>
    /legacy api key/i.test(message ?? '')
      ? `${message} — SUPABASE_SERVICE_KEY looks like the legacy service_role JWT. This project uses the new key scheme: create a secret key (Supabase → Settings → API Keys → Create new secret key), which starts with "sb_secret_", and redeploy.`
      : message

  // ---- GET: resync ---------------------------------------------------------
  if (req.method === 'GET') {
    const sessionId = req.query?.session_id
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return res.status(400).json({ error: 'session_id must be a uuid' })
    }
    const { data, error } = await supabase
      .from('claude_session_turns')
      .select('seq')
      .eq('session_id', sessionId)
      .order('seq', { ascending: false })
      .limit(1)
    if (error) return res.status(500).json({ error: explainKey(error.message) })
    return res.status(200).json({ session_id: sessionId, max_seq: data?.[0]?.seq ?? -1 })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ---- Validate ------------------------------------------------------------
  const body = req.body || {}
  const sessionId = body.session_id
  const projectKey = typeof body.project_key === 'string' ? body.project_key.trim() : ''

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return res.status(400).json({ error: 'session_id must be a uuid' })
  }
  if (!projectKey) {
    return res.status(400).json({ error: 'project_key is required' })
  }
  if (!Array.isArray(body.turns)) {
    return res.status(400).json({ error: 'turns must be an array' })
  }
  if (body.turns.length > MAX_TURNS_PER_PUSH) {
    return res.status(413).json({
      error: `Too many turns in one push (${body.turns.length} > ${MAX_TURNS_PER_PUSH}); send them in batches`,
    })
  }

  const turns = []
  for (const [i, t] of body.turns.entries()) {
    if (!t || typeof t !== 'object') {
      return res.status(400).json({ error: `turns[${i}] is not an object` })
    }
    if (!Number.isInteger(t.seq) || t.seq < 0) {
      return res.status(400).json({ error: `turns[${i}].seq must be a non-negative integer` })
    }
    if (t.role !== 'user' && t.role !== 'assistant') {
      return res.status(400).json({ error: `turns[${i}].role must be "user" or "assistant"` })
    }

    const tools = Array.isArray(t.tools) ? t.tools.slice(0, MAX_TOOLS_PER_TURN) : []
    turns.push({
      session_id: sessionId,
      seq: t.seq,
      role: t.role,
      body: clip(scrub(t.body ?? ''), MAX_BODY_CHARS) || null,
      tools: tools.map((tool) => ({
        name: clip(String(tool?.name ?? 'tool'), 60),
        headline: clip(scrub(String(tool?.headline ?? '')), MAX_HEADLINE_CHARS),
      })),
      at: t.at && !Number.isNaN(Date.parse(t.at)) ? new Date(t.at).toISOString() : new Date().toISOString(),
    })
  }

  // ---- Upsert the session --------------------------------------------------
  // The session row is written before the turns so a turn insert can never
  // fail its foreign key on a session's very first push.
  const lastTurnAt = turns.length ? turns[turns.length - 1].at : null
  const sessionRow = {
    id: sessionId,
    project_key: projectKey,
    project_label: clip(body.project_label ?? null, 80),
    cwd: clip(body.cwd ?? null, 400),
    git_branch: clip(body.git_branch ?? null, 200),
    last_push_at: new Date().toISOString(),
  }
  if (body.title) sessionRow.title = clip(scrub(String(body.title)), MAX_TITLE_CHARS)
  if (lastTurnAt) sessionRow.last_turn_at = lastTurnAt
  if (body.ended_reason) {
    sessionRow.ended_at = new Date().toISOString()
    sessionRow.end_reason = clip(String(body.ended_reason), 60)
  }

  const { error: sessionError } = await supabase
    .from('claude_sessions')
    .upsert(sessionRow, { onConflict: 'id' })
  if (sessionError) {
    return res.status(500).json({ error: explainKey(`session upsert failed: ${sessionError.message}`) })
  }

  // ---- Append the turns ----------------------------------------------------
  // ignoreDuplicates makes a re-push a no-op instead of an error, which is what
  // lets the hook be dumb about its high-water mark: when in doubt it resends,
  // and the worst case is wasted bytes. A published turn is never rewritten.
  if (turns.length) {
    const { error: turnError } = await supabase
      .from('claude_session_turns')
      .upsert(turns, { onConflict: 'session_id,seq', ignoreDuplicates: true })
    if (turnError) {
      return res.status(500).json({ error: explainKey(`turn insert failed: ${turnError.message}`) })
    }
  }

  // ---- Recount -------------------------------------------------------------
  const { count, error: countError } = await supabase
    .from('claude_session_turns')
    .select('seq', { count: 'exact', head: true })
    .eq('session_id', sessionId)
  if (!countError && typeof count === 'number') {
    await supabase.from('claude_sessions').update({ turn_count: count }).eq('id', sessionId)
  }

  const { data: maxRow } = await supabase
    .from('claude_session_turns')
    .select('seq')
    .eq('session_id', sessionId)
    .order('seq', { ascending: false })
    .limit(1)

  return res.status(200).json({
    ok: true,
    session_id: sessionId,
    received: turns.length,
    turn_count: count ?? null,
    max_seq: maxRow?.[0]?.seq ?? -1,
  })
}
