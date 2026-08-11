---
description: Start or stop pushing this Claude Code session to the lab Workbench
---

Manage workbench capture for **this session**. Argument: `$ARGUMENTS` — one of `on`, `off`,
or empty/`status`.

## Finding the session id

The session id is the **UUID in your own scratchpad directory path** (it is the same UUID as
your transcript filename, `~/.claude/projects/<project-slug>/<session-id>.jsonl`).

Do **not** infer it from the newest `.jsonl` in the project directory — Norm runs several
sessions on this repo at once, so the most recently modified file is frequently a different
session, and opting the wrong one in publishes work he did not choose to share.

## What to run

From the repo root:

- `on` → `node scripts/workbench-share.mjs on <session-id>`
- `off` → `node scripts/workbench-share.mjs off <session-id>`
- empty or `status` → `node scripts/workbench-share.mjs status`

## What to tell Norm afterwards

For `on`:
- The **whole session publishes from its start**, not from this moment — everything said so far
  is included.
- It is visible to **nobody** until he shares it at `/workbench/admin`.
- Updates land automatically on each completed turn from here on.
- If the session began before `.claude/settings.json` existed in the working tree, the `Stop`
  hook is not loaded and nothing will push until Claude Code restarts. Offer to push once by
  hand instead: build the hook payload (`session_id`, `transcript_path`, `cwd`,
  `hook_event_name: "Stop"`) as JSON and pipe it into
  `node scripts/claude-session-push.mjs`.

For `off`:
- Further turns stop pushing immediately.
- Turns **already published stay published** — `off` is not an unpublish. Deleting the session
  outright is a `/workbench/admin` action.

## Before saying yes to `on`, look at the session

Capture sends prompts, prose and one-line tool headlines — never tool output. But **prose is
sent verbatim**, so anything Norm or you typed into the conversation goes too. The endpoint
redacts its own credentials and common key shapes (`sk-ant-`, JWTs, connection strings), and
that is a backstop, not a guarantee: a password or participant name typed as ordinary text
will be published.

If this session contains that kind of thing, say so before running `on` rather than after.

See website.md §29c for the full design.
