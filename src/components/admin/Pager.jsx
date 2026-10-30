import { useState } from 'react'

// Shows a long admin list 25 rows at a time. Liliana Study 3 — Paid listed all
// 546 enrolments and 51 sessions on one page (2026-10-27).
//
//   const { rows, pager } = usePaged(items)
//   …{rows.map(…)}…
//   {pager}
//
// The page is clamped rather than reset when the list changes, so withdrawing
// someone on page 4 keeps you on page 4 unless it no longer exists.

export const ROWS_PER_PAGE = 25

export function usePaged(items, size = ROWS_PER_PAGE) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(page, pages - 1)
  const start = current * size
  return {
    rows: items.slice(start, start + size),
    pager: items.length > size
      ? <Pager start={start} end={Math.min(start + size, items.length)} total={items.length}
          onPrev={current > 0 ? () => setPage(current - 1) : null}
          onNext={current < pages - 1 ? () => setPage(current + 1) : null} />
      : null,
  }
}

function Pager({ start, end, total, onPrev, onNext }) {
  return (
    <div style={S.bar}>
      <button style={{ ...S.btn, ...(onPrev ? {} : S.off) }} onClick={onPrev ?? undefined} disabled={!onPrev}>← Previous</button>
      <span style={S.count}>{start + 1}–{end} of {total}</span>
      <button style={{ ...S.btn, ...(onNext ? {} : S.off) }} onClick={onNext ?? undefined} disabled={!onNext}>Next →</button>
    </div>
  )
}

const S = {
  bar:   { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  btn:   { background: '#fff', color: 'var(--tx)', border: '1px solid var(--bd)', borderRadius: 24, padding: '4px 16px', fontSize: 14, cursor: 'pointer', fontFamily: '"DM Sans",system-ui,sans-serif' },
  off:   { color: 'var(--tx3)', cursor: 'default' },
  count: { fontFamily: '"Space Mono",monospace', fontSize: 12, color: 'var(--tx2)' },
}
