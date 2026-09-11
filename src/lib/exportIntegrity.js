// Export integrity: no collected response is dropped or overwritten on its way
// into the participant master.
//
// The master used to lose data silently in two ways:
//   * a "duplicate" filter that kept only the LAST row inside a two-minute window
//     measured on participant clocks, which were off by up to an hour;
//   * cell writes where a second row naming the same column replaced the first.
//
// Policy (2026-09-10, supabase/migrations/20260911_responses_never_overwrite.sql):
// the only rows left out of the master are provable copies. Every other row gets
// cells of its own — a repeat of an already-named block is suffixed `_r2`, `_r3`
// and listed in the integrity report, never written over.

// A double submission can only arrive within a few seconds of the previous
// submission, with nothing else collected in between.
export const RESUBMISSION_WINDOW_MS = 5000

// Separates provable copies from real responses.
//
//   * Rows the database flagged (`resubmission_of`) are copies: byte-identical,
//     same variable, nothing collected in between, within 5 s of server time.
//   * Rows with a server `received_at` and no flag are real, always.
//   * Rows collected before the flag existed (no `received_at`) get the same test
//     here on the timestamps they have: identical payload, same variable, within
//     5 s, and no other row from that participant in between. The earliest copy
//     is kept.
//
// `kept` comes back in time order, which callers rely on for occurrence counts.
export function splitResubmissions(rows, { subjectOf, keyOf, payloadOf, timeOf }) {
  const kept = []
  const omitted = []
  const legacy = []
  for (const r of rows ?? []) {
    if (r?.resubmission_of) omitted.push(r)
    else if (r?.received_at) kept.push(r)
    else legacy.push(r)
  }

  const byTime = legacy
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (timeOf(a.r) - timeOf(b.r)) || (a.i - b.i))
    .map(x => x.r)

  const lastBySubject = new Map()
  for (const r of byTime) {
    const subject = subjectOf(r)
    const prev = subject == null ? undefined : lastBySubject.get(subject)
    const isCopy = prev !== undefined
      && keyOf(prev) === keyOf(r)
      && payloadOf(prev) === payloadOf(r)
      && timeOf(r) - timeOf(prev) <= RESUBMISSION_WINDOW_MS
    if (isCopy) omitted.push(r)
    else kept.push(r)
    if (subject != null) lastBySubject.set(subject, r)
  }

  const ordered = kept
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (timeOf(a.r) - timeOf(b.r)) || (a.i - b.i))
    .map(x => x.r)
  return { kept: ordered, omitted }
}

// Hands out names for repeated blocks. The first use of a base name within a
// scope (a participant) keeps it; the nth becomes `<base>_r<n>`. Every suffixed
// name is recorded, so the export can say exactly where a repeat was found.
export function createRepeatNamer() {
  const used = new Map()
  const repeats = []
  function name(scope, base, detail) {
    const k = `${scope}|${base}`
    const n = (used.get(k) ?? 0) + 1
    used.set(k, n)
    if (n === 1) return base
    const suffixed = `${base}_r${n}`
    repeats.push({ scope, base, name: suffixed, ...(detail ?? {}) })
    return suffixed
  }
  return { name, repeats }
}

// Writes one cell without ever replacing an existing one. A collision the block
// naming did not anticipate still keeps both values: the second lands in the next
// free `<column>_r<n>`, and the collision is reported.
export function putCell(target, column, value, onCollision) {
  const has = c => Object.prototype.hasOwnProperty.call(target, c)
  if (!has(column)) {
    target[column] = value
    return column
  }
  let n = 2
  while (has(`${column}_r${n}`)) n++
  const written = `${column}_r${n}`
  target[written] = value
  if (onCollision) onCollision({ column, written_as: written })
  return written
}
