import { useEffect, useState } from 'react'

// Guide freeze (20260929_guide_freeze.sql). During a freeze window students
// read the snapshot taken at its start — the text they are examined on —
// while staff keep reading and writing the live pages, so ingests and
// accepted contributions carry on and reach students when the window closes.
//
// guide_freeze_state() is also what takes the snapshot on the first read of a
// window, so every reader calls it before choosing a table. One call per
// course per minute is plenty: the answer changes twice a term.

const TTL_MS = 60_000
const cache = new Map() // courseId -> { at, value }

// undefined while loading; then { active, starts_at, ends_at, label, next? }.
export function useGuideFreeze(courseClient, courseId) {
  const hit = courseId ? cache.get(courseId) : null
  const fresh = hit && Date.now() - hit.at < TTL_MS
  const [state, setState] = useState(fresh ? hit.value : undefined)

  useEffect(() => {
    if (!courseClient || !courseId) return
    const c = cache.get(courseId)
    if (c && Date.now() - c.at < TTL_MS) { setState(c.value); return }
    let live = true
    // Fail open to the live pages: a missing answer — an RPC error or a
    // rejected request — must never leave the reader stuck on "Loading…".
    // Failures are not cached, so the next page load asks again.
    const settle = (value, keep) => {
      if (keep) cache.set(courseId, { at: Date.now(), value })
      if (live) setState(value)
    }
    Promise.resolve(courseClient.rpc('guide_freeze_state', { p_course_id: courseId }))
      .then(({ data, error }) => settle(error || !data ? { active: false } : data, !error && !!data))
      .catch(() => settle({ active: false }, false))
    return () => { live = false }
  }, [courseClient, courseId])

  return state
}

// Which table a reader should read. Students read the snapshot while a freeze
// is open; staff read live unless they have asked to see what students see.
export const pageTable = (freeze, isStaff, staffPreview = false) =>
  freeze?.active && (!isStaff || staffPreview) ? 'wiki_page_snapshots' : 'wiki_pages'

// Only items from before the freeze began, for student-facing change feeds —
// a feed of edits students cannot see yet would be a feed of broken promises.
export const beforeFreeze = (freeze, isStaff, at) =>
  !freeze?.active || isStaff || !at || new Date(at) < new Date(freeze.starts_at)

const TZ = 'America/Toronto'
export const freezeDate = (ts, withTime = false) => ts
  ? new Date(ts).toLocaleString('en-CA', {
      timeZone: TZ, month: 'short', day: 'numeric',
      ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    })
  : ''

// The freeze line at the top of a reader page. Nothing renders outside a
// freeze. Students are told which edition they are reading and when it
// updates; staff are told that students cannot see their changes yet, and can
// switch to the student view.
export function FreezeBanner({ freeze, isStaff, preview, onTogglePreview }) {
  if (!freeze?.active) return null
  const reopen = freezeDate(freeze.ends_at)
  const since = freezeDate(freeze.starts_at, true)
  return (
    <div style={S.box} role="status">
      {isStaff ? (
        <>
          <strong>{freeze.label}.</strong> Students are reading the Guide as it stood on {since};
          anything you publish now reaches them on {reopen}.
          {onTogglePreview && (
            <button type="button" style={S.btn} onClick={onTogglePreview}>
              {preview ? 'Back to the live page' : 'See what students see'}
            </button>
          )}
          {preview && <div style={S.note}>You are viewing the frozen edition.</div>}
        </>
      ) : (
        <>
          <strong>{freeze.label}:</strong> this is the Guide as it stood on {since}, the text
          you are examined on. Changes made since then appear on {reopen}.
        </>
      )}
    </div>
  )
}

const S = {
  box: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderLeft: '3px solid #1F5C8B', borderRadius: 8, padding: '10px 14px', margin: '0 0 16px', fontSize: 14, lineHeight: 1.55, color: 'var(--tx)' },
  btn: { marginLeft: 10, fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 16, border: '1px solid var(--bd)', background: 'var(--bg)', color: 'var(--tx)', cursor: 'pointer' },
  note: { marginTop: 6, fontSize: 13, color: 'var(--tx2)' },
}
