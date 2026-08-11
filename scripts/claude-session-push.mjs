#!/usr/bin/env node
//
// claude-session-push.mjs — the workbench capture hook.
//
// Registered as a `Stop` hook (fires each time Claude finishes a turn) and a
// `SessionEnd` hook (final reconciling push). Reads the session's JSONL
// transcript, distils it to narrative + tool headlines, and POSTs the turns the
// server has not seen yet to /api/session-push.
//
// ---------------------------------------------------------------------------
// The rule this file exists to enforce: TOOL OUTPUT NEVER LEAVES THIS MACHINE.
// ---------------------------------------------------------------------------
// What gets sent is Norm's prompts, Claude's prose, and a one-line headline per
// tool call ("Edit src/App.jsx", "Bash: run the build"). Not file contents, not
// query results, not diffs, not thinking blocks. That is a deliberate choice over
// scrubbing a richer feed: a scrubber has to be right every time, whereas not
// collecting the data is right by construction. Sessions in this repo routinely
// hold participant rows and Supabase project internals; a leak here is a student
// reading study data, not a broken page.
//
// The endpoint re-applies the same caps and a secret scrub, because this file is
// a script on a laptop and the server is the actual trust boundary.
//
// ---------------------------------------------------------------------------
// Turning it on
// ---------------------------------------------------------------------------
// Capture is off unless ~/.claude/workbench.json exists:
//
//   { "endpoint": "https://radlab.zone/api/session-push", "token": "<secret>" }
//
// No config file → this script exits 0 and does nothing. That is what makes the
// checked-in .claude/settings.json safe for anyone else who clones the repo: they
// get the hook registration and no capture, rather than a confusing failure.
//
// This script NEVER fails the session. Every path exits 0. A sharing feature that
// can break Norm's actual work is a worse feature than no sharing feature.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const CONFIG_PATH = path.join(homedir(), '.claude', 'workbench.json')
const STATE_DIR = path.join(homedir(), '.claude', 'workbench-state')

const MIN_INTERVAL_MS = 4000   // debounce; SessionEnd always pushes
const MAX_BODY_CHARS = 4000
const MAX_TOOLS_PER_TURN = 40
const MAX_HEADLINE_CHARS = 200
const MAX_TURNS_PER_PUSH = 400

// ---------------------------------------------------------------------------
// Distillation
// ---------------------------------------------------------------------------

// Injected by the harness, not typed by the user, and often long. Stripping them
// is what makes a user turn read like something a person actually said.
function stripNoise(text) {
  return String(text ?? '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Absolute paths are rewritten relative to the project root; anything outside it
// collapses to its basename. A student seeing "src/App.jsx" learns something;
// seeing "I:\Shared drives\Interoception-2025\..." learns the shape of a drive
// they have no business knowing about.
function tidyPath(p, projectDir) {
  if (typeof p !== 'string' || !p) return ''
  const norm = p.replace(/\\/g, '/')
  const root = (projectDir || '').replace(/\\/g, '/')
  if (root && norm.toLowerCase().startsWith(root.toLowerCase())) {
    return norm.slice(root.length).replace(/^\//, '') || '.'
  }
  if (/^([a-zA-Z]:\/|\/)/.test(norm)) return norm.split('/').pop()
  return norm
}

// One line per tool call. Prefer the field a human wrote (a Bash `description`, a
// Task `description`) over the machine payload — it is both safer and more
// legible than a raw command line.
function toolHeadline(name, input, projectDir) {
  const i = input && typeof input === 'object' ? input : {}
  const p = (v) => tidyPath(v, projectDir)

  switch (name) {
    case 'Read':
    case 'NotebookEdit':
      return p(i.file_path)
    case 'Edit':
      return p(i.file_path)
    case 'Write':
      return p(i.file_path)
    case 'Bash':
    case 'PowerShell':
      return i.description || String(i.command ?? '').split('\n')[0]
    case 'Grep':
      return i.pattern ? `"${i.pattern}"${i.path ? ` in ${p(i.path)}` : ''}` : ''
    case 'Glob':
      return i.pattern ?? ''
    case 'Agent':
    case 'Task':
      return i.description || i.subagent_type || ''
    case 'TaskCreate':
    case 'TaskUpdate':
      return i.subject || i.status || ''
    case 'WebFetch':
      return i.url ?? ''
    case 'WebSearch':
      return i.query ?? ''
    case 'Skill':
      return i.skill ?? ''
    case 'SendUserFile':
      return Array.isArray(i.files) ? i.files.map(p).join(', ') : ''
    case 'Artifact':
      return i.title || p(i.file_path) || ''
    default: {
      // MCP and anything unrecognised: name the most descriptive short string
      // present, never the whole payload.
      for (const key of ['name', 'title', 'description', 'query', 'subject', 'slug', 'path']) {
        if (typeof i[key] === 'string' && i[key]) return i[key]
      }
      return ''
    }
  }
}

// Friendlier label for MCP tools, whose raw names are unreadable
// (mcp__supabase__execute_sql → supabase.execute_sql).
function toolLabel(name) {
  const m = /^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/.exec(name)
  if (m) return `${m[1].replace(/_/g, '-')}.${m[2]}`
  return name
}

function clip(text, max) {
  const s = String(text ?? '')
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n… [truncated]`
}

// Walks the transcript and emits one turn per *message* — each user prompt, and
// each assistant message with the tools that message called.
//
// The first draft merged every consecutive assistant message into one turn, which
// looked tidier and was wrong twice over. Checked against a real 4-hour session
// (the Sidelong prototype, ~40 messages and 200 tool calls), it produced **two
// turns**: one prompt, one enormous reply. Worse, that merged turn keeps `seq`
// 1 forever while its content grows, and the push path only sends seq > the
// server's high-water mark — so a long session would publish one stale fragment
// and then go silent for hours, which is precisely the failure this feature
// exists to avoid.
//
// One turn per message is append-only and therefore stable: a turn, once written
// to the transcript, never changes again. Grouping runs of assistant turns back
// into one readable block is the frontend's job, where it costs nothing and
// breaks nothing.
//
// Sidechains (subagent transcripts) are skipped: the parent turn already carries
// an "Agent: <description>" headline, and subagent chatter would triple the
// volume without adding a thing a student wants to read.
export function distil(transcriptPath, projectDir) {
  let lines = []
  try {
    lines = readFileSync(transcriptPath, 'utf8').split('\n')
  } catch {
    return { turns: [], title: null }
  }

  const turns = []
  let title = null

  for (const line of lines) {
    if (!line.trim()) continue
    let o
    try { o = JSON.parse(line) } catch { continue }
    if (o.isSidechain) continue

    if (o.type === 'user') {
      const content = o.message?.content
      // A list-shaped user message is tool_result plumbing, not something a
      // person said. Dropping it here is the single biggest reason tool output
      // cannot reach the server even by accident.
      if (typeof content !== 'string') continue
      if (o.isMeta) continue
      const body = stripNoise(content)
      if (!body) continue

      if (!title) title = body.split('\n')[0].slice(0, 160)
      turns.push({
        seq: turns.length,
        role: 'user',
        body: clip(body, MAX_BODY_CHARS),
        tools: [],
        at: o.timestamp || new Date().toISOString(),
      })
      continue
    }

    if (o.type === 'assistant') {
      const blocks = o.message?.content
      if (!Array.isArray(blocks)) continue

      let prose = ''
      const tools = []
      for (const b of blocks) {
        if (b.type === 'text' && b.text) {
          prose += (prose ? '\n\n' : '') + b.text
        } else if (b.type === 'tool_use') {
          // `thinking` and `redacted_thinking` fall through here deliberately —
          // Norm's call: thinking blocks are never published.
          tools.push({
            name: clip(toolLabel(b.name || 'tool'), 60),
            headline: clip(toolHeadline(b.name, b.input, projectDir), MAX_HEADLINE_CHARS),
          })
        }
      }
      if (!prose && !tools.length) continue

      turns.push({
        seq: turns.length,
        role: 'assistant',
        body: clip(prose.trim(), MAX_BODY_CHARS) || null,
        tools: tools.slice(0, MAX_TOOLS_PER_TURN),
        at: o.timestamp || new Date().toISOString(),
      })
    }
  }

  return { turns, title }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function stateFile(sessionId) {
  return path.join(STATE_DIR, `${sessionId}.json`)
}

function readState(sessionId) {
  try {
    return JSON.parse(readFileSync(stateFile(sessionId), 'utf8'))
  } catch {
    return { max_seq: -1, last_push: 0 }
  }
}

function writeState(sessionId, state) {
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(stateFile(sessionId), JSON.stringify(state), 'utf8')
  } catch {
    // A lost state file costs one redundant full push, which the server dedupes.
    // Not worth failing over.
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  if (!existsSync(CONFIG_PATH)) return            // capture not enabled here

  let config
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    return
  }
  const endpoint = process.env.WORKBENCH_ENDPOINT || config.endpoint
  const token = process.env.WORKBENCH_PUSH_TOKEN || config.token
  if (!endpoint || !token) return

  let payload
  try {
    payload = JSON.parse(await readStdin())
  } catch {
    return
  }

  const sessionId = payload.session_id
  const transcriptPath = payload.transcript_path
  const cwd = payload.cwd || process.cwd()
  if (!sessionId || !transcriptPath) return

  const isEnd = payload.hook_event_name === 'SessionEnd'

  // A project allowlist in the config file is a second switch, independent of
  // which repos carry a .claude/settings.json. Either can turn a project off;
  // both must be on for anything to be captured.
  const projectKey = cwd.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  if (Array.isArray(config.projects) && config.projects.length) {
    const allowed = config.projects.some(
      (p) => projectKey === String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    )
    if (!allowed) return
  }

  const state = readState(sessionId)
  if (!isEnd && Date.now() - (state.last_push ?? 0) < MIN_INTERVAL_MS) return

  const { turns, title } = distil(transcriptPath, cwd)
  if (!turns.length) return

  const from = (state.max_seq ?? -1) + 1
  const fresh = turns.filter((t) => t.seq >= from).slice(0, MAX_TURNS_PER_PUSH)
  if (!fresh.length && !isEnd) return

  const bodyPayload = {
    session_id: sessionId,
    project_key: projectKey,
    project_label: projectKey.split('/').filter(Boolean).pop() || projectKey,
    cwd,
    git_branch: payload.git_branch || null,
    title,
    turns: fresh,
  }
  if (isEnd) bodyPayload.ended_reason = payload.reason || 'other'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(bodyPayload),
  })

  if (!res.ok) {
    // Reset the high-water mark so the next turn retries this range rather than
    // skipping past it. Silent gaps are worse than duplicate work.
    writeState(sessionId, { max_seq: state.max_seq ?? -1, last_push: Date.now() })
    return
  }

  const result = await res.json().catch(() => ({}))
  writeState(sessionId, {
    max_seq: typeof result.max_seq === 'number' ? result.max_seq : state.max_seq ?? -1,
    last_push: Date.now(),
  })
}

// Only run when invoked as the hook. Importing this file (scripts/dev/
// workbench-preview.mjs does, to eyeball the distillation against a real
// transcript) must not read stdin or push anything.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))

if (invokedDirectly) {
  main().catch(() => {}).finally(() => process.exit(0))
}
