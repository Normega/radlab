// Payload builders for session_diagnostics (migration 20260905).
//
// Split out from the components so the shape can be unit-tested without a DOM:
// the whole point of these rows is that they are trustworthy after the fact, and
// a payload that silently drops step_index or truncates the wrong field is worse
// than no row at all (CLAUDE.md participant-data rule 4 — never assert a label
// you cannot demonstrate).
//
// Every field is a recorded fact. Nothing here infers a device family from the
// user-agent string: that parsing belongs in analysis, where it can be redone
// when the guesses turn out wrong, not baked into the row at write time.

// Postgres text is unbounded, but a runaway error string (a stack in a message,
// a data: URL in a UA) would bloat the row for no diagnostic gain.
const UA_MAX  = 400
const ERR_MAX = 500

const clip = (value, max) => {
  if (value == null) return null
  const s = String(value)
  return s.length > max ? s.slice(0, max) : s
}

/** Viewport as "WxH", or null where there is no window (SSR, tests). */
export function viewportString(win) {
  const w = win?.innerWidth
  const h = win?.innerHeight
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null
  return `${Math.round(w)}x${Math.round(h)}`
}

/**
 * One row per session, written once when the runner mounts. This is the
 * denominator: without it a crash row says "someone on iOS broke" and cannot
 * say whether iOS breaks more often than anything else.
 */
export function sessionStartRow({ participantId, studyId, scheduleId, nav, win }) {
  if (!participantId) return null   // nothing identifiable to attach it to
  return {
    participant_id: participantId,
    study_id:       studyId ?? null,
    schedule_id:    scheduleId ?? null,
    step_index:     null,
    kind:           'session_start',
    user_agent:     clip(nav?.userAgent, UA_MAX),
    viewport:       viewportString(win),
  }
}

/**
 * One row when a step throws while rendering. step_index/category/subcategory
 * name WHERE it broke, which is the field that turned the 2026-08-27 incident
 * from "three people had problems" into "nine of twelve stalled at a game".
 */
export function stepCrashRow({ participantId, studyId, scheduleId, stepIndex, node, error, nav, win }) {
  if (!participantId) return null
  const activity = node?.activity ?? node?.activities ?? {}
  return {
    participant_id: participantId,
    study_id:       studyId ?? null,
    schedule_id:    scheduleId ?? null,
    // 0 is a legitimate step index, so only undefined/null becomes null.
    step_index:       stepIndex ?? null,
    kind:             'step_crash',
    user_agent:       clip(nav?.userAgent, UA_MAX),
    viewport:         viewportString(win),
    step_category:    activity.category ?? null,
    step_subcategory: activity.subcategory ?? null,
    error_message:    clip(error?.message ?? String(error ?? ''), ERR_MAX),
  }
}
