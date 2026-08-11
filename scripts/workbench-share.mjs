#!/usr/bin/env node
//
// workbench-share.mjs — opt a single Claude Code session into workbench capture.
//
// Nothing is captured without a marker written by this script. `workbench.json`
// says *where* and *how* to push; this says *whether*, one session at a time.
//
//   node scripts/workbench-share.mjs on  <session-id>
//   node scripts/workbench-share.mjs off <session-id>
//   node scripts/workbench-share.mjs status [<session-id>]
//
// Norm's usual route is to say "share this session" in the session itself, and
// Claude runs `on` with that session's id. **Claude: your own session id is the
// UUID in your scratchpad path**, which is the same UUID as your transcript
// filename in ~/.claude/projects/<project-slug>/<session-id>.jsonl — do not
// guess it from the directory listing, because concurrent sessions on the same
// project would make the most-recent file the wrong answer.
//
// Opting in publishes the session **from its beginning**, not from the moment of
// opt-in: a session usually becomes worth sharing because of something that has
// already happened, and the work leading up to it is the part a student learns
// from. `off` stops further pushes but does not unpublish what already went — use
// the console at /workbench/admin to delete a session outright.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const OPTIN_DIR = path.join(homedir(), '.claude', 'workbench-optin')
const CONFIG_PATH = path.join(homedir(), '.claude', 'workbench.json')

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function markerPath(sessionId) {
  return path.join(OPTIN_DIR, `${sessionId}.json`)
}

function requireId(sessionId) {
  if (!sessionId || !UUID_RE.test(sessionId)) {
    console.error('Need a session id (uuid). Usage: workbench-share.mjs on|off <session-id>')
    process.exit(1)
  }
  return sessionId
}

const [, , rawCommand, sessionArg] = process.argv
const command = (rawCommand || 'status').toLowerCase()

if (command === 'on') {
  const sessionId = requireId(sessionArg)
  mkdirSync(OPTIN_DIR, { recursive: true })
  writeFileSync(
    markerPath(sessionId),
    JSON.stringify({ session_id: sessionId, opted_in_at: new Date().toISOString() }, null, 2),
    'utf8'
  )
  console.log(`Capture ON for session ${sessionId}`)
  console.log(`  marker: ${markerPath(sessionId)}`)
  if (!existsSync(CONFIG_PATH)) {
    // The two switches are independent, and this one alone does nothing.
    console.log('')
    console.log(`  NOTE: ${CONFIG_PATH} does not exist, so nothing will actually be pushed.`)
    console.log('  Create it with { "endpoint": ..., "token": ..., "projects": [...] }.')
  }
  console.log('')
  console.log('  The whole session publishes from its start on the next completed turn.')
  console.log('  Visible to nobody until shared at /workbench/admin.')
} else if (command === 'off') {
  const sessionId = requireId(sessionArg)
  const p = markerPath(sessionId)
  if (existsSync(p)) {
    rmSync(p)
    console.log(`Capture OFF for session ${sessionId} — no further turns will be pushed.`)
    console.log('  Turns already published stay published; delete the session at /workbench/admin.')
  } else {
    console.log(`Session ${sessionId} was not opted in; nothing to do.`)
  }
} else if (command === 'status') {
  if (sessionArg) {
    const sessionId = requireId(sessionArg)
    console.log(existsSync(markerPath(sessionId)) ? 'ON' : 'OFF', sessionId)
  } else {
    const markers = existsSync(OPTIN_DIR)
      ? readdirSync(OPTIN_DIR).filter((f) => f.endsWith('.json'))
      : []
    console.log(`config: ${existsSync(CONFIG_PATH) ? CONFIG_PATH : '(none — nothing will push)'}`)
    if (!markers.length) {
      console.log('No sessions opted in.')
    } else {
      console.log(`${markers.length} session(s) opted in:`)
      for (const f of markers) {
        let at = '?'
        try { at = JSON.parse(readFileSync(path.join(OPTIN_DIR, f), 'utf8')).opted_in_at } catch {}
        console.log(`  ${f.replace(/\.json$/, '')}  (since ${at})`)
      }
    }
  }
} else {
  console.error(`Unknown command "${command}". Use on, off, or status.`)
  process.exit(1)
}
