import { seededRandom } from './interleaveOrder.js'

// Step-order randomization inside one session (plan P2): consecutive steps that
// share a `shuffle_group` (session_template_nodes.shuffle_group) are put in a
// random order per participant; every other step keeps its place. Seeded by the
// participant's link token, so a reload, and the session-progress resume that
// counts steps, sees the same order.
//
// What was shown where is a recorded fact either way: each response carries the
// step_index it was given at, and each node keeps its template `order_index`.
//
// Only a contiguous run shuffles. Two runs of the same group separated by a fixed
// step are shuffled separately: a shuffle must never move a step across a step
// that was meant to stay put (a consent check, a break, the debrief).
export function shuffleStepGroups(nodes, seed) {
  if (!Array.isArray(nodes) || nodes.length < 2) return nodes ?? []
  const out = []
  let i = 0
  let run = 0
  while (i < nodes.length) {
    const g = nodes[i]?.shuffle_group
    if (!g) { out.push(nodes[i]); i++; continue }
    let j = i
    while (j < nodes.length && nodes[j]?.shuffle_group === g) j++
    const block = nodes.slice(i, j)
    const rand = seededRandom(`${seed}:${g}:${run++}`)
    for (let k = block.length - 1; k > 0; k--) {
      const r = Math.floor(rand() * (k + 1))
      ;[block[k], block[r]] = [block[r], block[k]]
    }
    out.push(...block)
    i = j
  }
  return out
}
