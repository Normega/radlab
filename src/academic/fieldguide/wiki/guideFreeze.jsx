import { useEffect, useState, useSyncExternalStore } from 'react'

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

// Staff "see what students see": ONE switch for the whole Guide, not per page.
// It started as local state on the page reader, so the index and the feeds
// showed a staff banner with nothing to press (Norm, 2026-09-29). Kept for the
// tab (sessionStorage) so moving between pages doesn't drop it.
const PREVIEW_KEY = 'fg-freeze-preview'
const listeners = new Set()
let previewOn = (() => { try { return sessionStorage.getItem(PREVIEW_KEY) === '1' } catch { return false } })()
const setPreview = (on) => {
  previewOn = on
  try { on ? sessionStorage.setItem(PREVIEW_KEY, '1') : sessionStorage.removeItem(PREVIEW_KEY) } catch { /* private mode */ }
  listeners.forEach(fn => fn())
}
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const useFreezePreview = () => [
  useSyncExternalStore(subscribe, () => previewOn, () => false),
  setPreview,
]

// Which table a reader should read. Students read the snapshot while a freeze
// is open; staff read live unless they have switched to the student view.
export const pageTable = (freeze, isStaff, staffPreview = false) =>
  freeze?.active && (!isStaff || staffPreview) ? 'wiki_page_snapshots' : 'wiki_pages'

// Only items from before the freeze began, for student-facing change feeds —
// a feed of edits students cannot see yet would be a feed of broken promises.
export const beforeFreeze = (freeze, isStaff, at, staffPreview = false) =>
  !freeze?.active || (isStaff && !staffPreview) || !at || new Date(at) < new Date(freeze.starts_at)

const TZ = 'America/Toronto'
export const freezeDate = (ts, withTime = false) => ts
  ? new Date(ts).toLocaleString('en-CA', {
      timeZone: TZ, month: 'short', day: 'numeric',
      ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    })
  : ''

// The freeze line at the top of a reader page. Nothing renders outside a
// freeze. Students are told which edition they are reading and when it
// updates; staff are told students cannot see their changes yet, and get the
// switch to the student view on every page that shows the banner.
export function FreezeBanner({ freeze, isStaff }) {
  const [preview, setPreviewOn] = useFreezePreview()
  if (!freeze?.active) return null
  const reopen = freezeDate(freeze.ends_at)
  const since = freezeDate(freeze.starts_at, true)
  return (
    <div style={S.box} role="status">
      {isStaff ? (
        <>
          <strong>{freeze.label}.</strong> Students are reading the Guide as it stood on {since};
          anything you publish now reaches them on {reopen}.
          <button type="button" style={S.btn} onClick={() => setPreviewOn(!preview)}>
            {preview ? 'Back to the live Guide' : 'See what students see'}
          </button>
          {preview && <div style={S.note}>You are viewing the frozen edition, as students do. Editing is off until you switch back.</div>}
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
