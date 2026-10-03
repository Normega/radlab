// The screener's phase-2 answers (e.g. PHQ-8, GAD-7), held on the participant's
// device between passing the screener and giving consent. Nothing is written to
// the database before consent; SessionEntry flushes the draft into
// questionnaire_responses once consent is on record.
//
// Why localStorage as well as sessionStorage (2026-10-03): sessionStorage is
// per TAB. On the open-recruitment route (Liliana Study 3 — Paid, /join/:slug)
// the session stops after the screener to collect an email address, and consent
// happens from the link emailed to that address, which opens in a NEW tab. The
// draft written in the first tab was invisible there, so the flush found nothing:
// all 47 paid participants who had passed the screener by 2026-10-03 lost their
// screener answers (the SONA route, which consents in the same tab, lost none).
// localStorage is shared by every tab of the same browser, so the emailed link
// now finds the draft when it is opened in the same browser. A link opened on a
// different device still cannot — that needs server-side holding, which would
// mean storing answers before consent.
//
// The localStorage copy outlives the tab, so it carries an expiry and is
// removed the moment it is flushed.

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function draftKey(studyId, participantId) {
  return `screener_draft_${studyId}_${participantId}`
}

function stores(storage) {
  const out = []
  for (const s of [storage?.session, storage?.local]) if (s) out.push(s)
  return out
}

function defaultStorage() {
  const pick = (name) => { try { return globalThis[name] ?? null } catch { return null } }
  return { session: pick('sessionStorage'), local: pick('localStorage') }
}

/** Save the draft to every available store. Returns true if any write succeeded. */
export function writeScreenerDraft(studyId, participantId, draft, storage = defaultStorage()) {
  const key = draftKey(studyId, participantId)
  const value = JSON.stringify(draft)
  let ok = false
  for (const s of stores(storage)) {
    try { s.setItem(key, value); ok = true } catch { /* full, or blocked in private mode */ }
  }
  return ok
}

/**
 * Take the draft: read it from whichever store has it, and remove it from all
 * of them before returning, so a retry can never flush it twice. Returns null
 * when there is none, it cannot be parsed, or it is older than the TTL.
 */
export function takeScreenerDraft(studyId, participantId, storage = defaultStorage(), now = Date.now()) {
  const key = draftKey(studyId, participantId)
  let raw = null
  for (const s of stores(storage)) {
    try { raw = raw ?? s.getItem(key) } catch { /* unreadable store */ }
    try { s.removeItem(key) } catch { /* nothing to clear */ }
  }
  if (!raw) return null
  let draft
  try { draft = JSON.parse(raw) } catch { return null }
  const at = Date.parse(draft?.completedAt ?? '')
  if (!Number.isFinite(at) || now - at > DRAFT_TTL_MS) return null
  return draft
}
