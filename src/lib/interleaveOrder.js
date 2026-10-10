// Constrained, seeded item order for a composable questionnaire.
//
// Why not a plain shuffle: a random permutation regularly leaves runs of items
// from the same facet next to each other, and items shown together correlate
// more just for being together. For a scale whose factor structure is under
// test, that clumping can manufacture or merge factors. So the order is drawn at
// random from the orders that satisfy spacing rules, not shuffled and then
// "fixed" (fixing biases where items land).
//
// Seeded: the same seed always gives the same order, so a participant who
// reloads mid-questionnaire sees the order they started with. The caller seeds
// with the participant's schedule id, which is stable per person and session.
//
// The spec lives on the definition as `interleave` (all positions 1-indexed):
//   {
//     items:                [ids]           every component placed by this order
//     page_sizes:           [n, ...]        sums to items.length
//     clusters:             { name: [ids] } kept apart:
//     cluster_min_gap:      3                 same-cluster items >= 3 positions apart
//     cluster_max_per_page: 2                 and at most 2 on one page
//     groups:   [{ items, min_gap, max_per_page }]   broader sets with their own limits;
//               a group may also set min_per_page, max_run_outside (at most n
//               non-members in a row), avoid_positions ([1-indexed]) and
//               avoid_adjacent ([ids], e.g. anchored checks: never next to them)
//     pairs:    [[a, b]], pair_min_gap: 3            named pairs kept apart
//     apart_pages: [[a, b]]                          named pairs never on one page
//     anchored: { id: { min_position, max_position, not_page_edge } }
//   }
// Prototype and its 10,000-seed check: scripts/sense_foraging/interleave_prototype.py

const NODE_BUDGET = 400
const MAX_ATTEMPTS = 1000

// cyrb128 string hash → sfc32 generator. Small, fast, well distributed, and the
// same in every browser, which Math.random cannot be seeded to be.
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

export function seededRandom(seed) {
  let [a, b, c, d] = cyrb128(String(seed))
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

function shuffled(list, rand) {
  const a = list.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Everything the rules need, precomputed once per spec.
function compile(spec) {
  const pageOf = []
  const starts = new Set()
  const ends = new Set()
  let pos = 0
  spec.page_sizes.forEach((n, p) => {
    starts.add(pos)
    for (let k = 0; k < n; k++) pageOf.push(p)
    pos += n
    ends.add(pos - 1)
  })

  const clusterOf = new Map()
  for (const [name, ids] of Object.entries(spec.clusters ?? {})) for (const id of ids) clusterOf.set(id, name)

  const groups = (spec.groups ?? []).map(g => ({
    members: new Set(g.items), minGap: g.min_gap ?? 1, maxPerPage: g.max_per_page ?? Infinity,
    minPerPage: g.min_per_page ?? 0, maxRunOutside: g.max_run_outside ?? Infinity,
    avoidSlots: new Set((g.avoid_positions ?? []).map(n => n - 1)), avoidAdjacent: new Set(g.avoid_adjacent ?? []),
  }))

  const apart = new Map()
  for (const [a, b] of spec.apart_pages ?? []) {
    if (!apart.has(a)) apart.set(a, [])
    if (!apart.has(b)) apart.set(b, [])
    apart.get(a).push(b)
    apart.get(b).push(a)
  }

  const partners = new Map()
  for (const [a, b] of spec.pairs ?? []) {
    if (!partners.has(a)) partners.set(a, [])
    if (!partners.has(b)) partners.set(b, [])
    partners.get(a).push(b)
    partners.get(b).push(a)
  }

  // Anchored ids: allowed 0-indexed slots.
  const anchors = Object.entries(spec.anchored ?? {}).map(([id, a]) => {
    const slots = []
    for (let s = 0; s < pageOf.length; s++) {
      const one = s + 1
      if (a.min_position != null && one < a.min_position) continue
      if (a.max_position != null && one > a.max_position) continue
      if (a.not_page_edge && (starts.has(s) || ends.has(s))) continue
      slots.push(s)
    }
    return { id, slots }
  })

  // A page's per-page minimums are checked when its last free slot is filled.
  const anchoredSlots = new Set()
  const lastFree = new Map()
  return {
    pageOf, clusterOf, groups, partners, apart, anchors, anchoredSlots, lastFree,
    clusterGap: spec.cluster_min_gap ?? 1,
    clusterPerPage: spec.cluster_max_per_page ?? Infinity,
    pairGap: spec.pair_min_gap ?? 1,
  }
}

// May `id` go at slot `pos`, given the slots filled so far (null = empty or anchored)?
function fits(c, seq, pos, id) {
  const cluster = c.clusterOf.get(id)
  const page = c.pageOf[pos]
  const near = (gap, test) => {
    for (let back = 1; back < gap; back++) {
      const other = seq[pos - back]
      if (other != null && test(other)) return true
    }
    return false
  }
  if (cluster != null) {
    if (near(c.clusterGap, o => c.clusterOf.get(o) === cluster)) return false
    let onPage = 0
    for (let s = 0; s < pos; s++) if (c.pageOf[s] === page && seq[s] != null && c.clusterOf.get(seq[s]) === cluster) onPage++
    if (onPage >= c.clusterPerPage) return false
  }
  for (const g of c.groups) {
    const member = g.members.has(id)
    let onPage = 0
    for (let s = 0; s < pos; s++) if (c.pageOf[s] === page && seq[s] != null && g.members.has(seq[s])) onPage++
    if (member) {
      if (near(g.minGap, o => g.members.has(o))) return false
      if (onPage >= g.maxPerPage) return false
      if (g.avoidSlots.has(pos)) return false
      if (g.avoidAdjacent.has(seq[pos - 1]) || g.avoidAdjacent.has(seq[pos + 1])) return false
      onPage++
    } else if (g.maxRunOutside !== Infinity) {
      // the run of non-members this slot would extend, including anchored slots just after it
      let run = 1
      for (let s = pos - 1; s >= 0 && seq[s] != null && !g.members.has(seq[s]); s--) run++
      for (let s = pos + 1; c.anchoredSlots.has(s) && !g.members.has(seq[s]); s++) run++
      if (run > g.maxRunOutside) return false
    }
    if (g.minPerPage && c.lastFree.get(page) === pos && onPage < g.minPerPage) return false
  }
  const mates = c.partners.get(id)
  if (mates && near(c.pairGap, o => mates.includes(o))) return false
  const away = c.apart.get(id)
  if (away) for (let s = 0; s < pos; s++) if (c.pageOf[s] === page && away.includes(seq[s])) return false
  return true
}

// Which slots hold anchors decides where each page's last free slot is.
function setAnchoredSlots(c, slots) {
  c.anchoredSlots = new Set(slots)
  c.lastFree = new Map()
  c.pageOf.forEach((p, s) => { if (!c.anchoredSlots.has(s)) c.lastFree.set(p, s) })
}

function attempt(c, free, rand) {
  const n = c.pageOf.length
  const seq = new Array(n).fill(null)
  const fixed = new Set()
  for (const a of c.anchors) {
    const open = a.slots.filter(s => !fixed.has(s))
    if (!open.length) return null
    const s = open[Math.floor(rand() * open.length)]
    seq[s] = a.id
    fixed.add(s)
  }
  setAnchoredSlots(c, fixed)
  let nodes = 0
  const dfs = (pos, left) => {
    if (++nodes > NODE_BUDGET) return false
    while (pos < n && fixed.has(pos)) pos++
    if (pos >= n) return left.length === 0
    for (const id of shuffled(left, rand)) {
      if (!fits(c, seq, pos, id)) continue
      seq[pos] = id
      if (dfs(pos + 1, left.filter(x => x !== id))) return true
      seq[pos] = null
    }
    return false
  }
  return dfs(0, free) ? seq : null
}

// { order, pages, positions } or null when no valid order is found (the caller
// falls back to the definition's own fixed pages and records that it did).
export function interleaveOrder(spec, seed) {
  const c = compile(spec)
  const anchored = new Set(c.anchors.map(a => a.id))
  const free = spec.items.filter(id => !anchored.has(id))
  for (let k = 0; k < MAX_ATTEMPTS; k++) {
    const order = attempt(c, free, seededRandom(`${seed}:${k}`))
    if (!order) continue
    const pages = []
    let i = 0
    for (const size of spec.page_sizes) { pages.push(order.slice(i, i + size)); i += size }
    const positions = Object.fromEntries(order.map((id, j) => [id, j + 1]))
    return { order, pages, positions }
  }
  return null
}

// Every rule, checked independently of how the order was built. Used by the
// tests and available to anyone auditing an exported order.
export function orderViolations(spec, order) {
  const c = compile(spec)
  const out = []
  if (order.length !== c.pageOf.length) out.push(`length ${order.length} != ${c.pageOf.length}`)
  if (new Set(order).size !== order.length) out.push('duplicate item')
  for (const id of spec.items) if (!order.includes(id)) out.push(`missing ${id}`)
  // Each slot is judged as the search saw it: earlier slots and anchors filled, later slots empty.
  const anchoredIds = new Set(c.anchors.map(a => a.id))
  setAnchoredSlots(c, order.flatMap((id, s) => (anchoredIds.has(id) ? [s] : [])))
  for (let pos = 0; pos < order.length; pos++) {
    const id = order[pos]
    const seen = order.map((x, s) => (s < pos || anchoredIds.has(x) ? x : null))
    if (!anchoredIds.has(id) && !fits(c, seen, pos, id)) out.push(`rule broken at ${pos + 1} (${id})`)
  }
  for (const a of c.anchors) {
    const at = order.indexOf(a.id)
    if (!a.slots.includes(at)) out.push(`${a.id} at ${at + 1}, outside its allowed positions`)
  }
  return out
}

// The definition-level checks validateComposableDefinition adds for `interleave`.
export function validateInterleaveSpec(spec, componentIds) {
  const errors = []
  if (!Array.isArray(spec?.items) || !spec.items.length) return ['interleave: items must be a non-empty list.']
  const items = new Set(spec.items)
  if (items.size !== spec.items.length) errors.push('interleave: items repeat an id.')
  for (const id of spec.items) if (!componentIds.has(id)) errors.push(`interleave: "${id}" is not a component.`)
  const sizes = spec.page_sizes ?? []
  if (!sizes.length || sizes.some(n => !Number.isInteger(n) || n < 1)) errors.push('interleave: page_sizes must be positive whole numbers.')
  else if (sizes.reduce((a, b) => a + b, 0) !== spec.items.length) errors.push('interleave: page_sizes must add up to the number of items.')
  const known = id => items.has(id)
  for (const [name, ids] of Object.entries(spec.clusters ?? {})) for (const id of ids) if (!known(id)) errors.push(`interleave: cluster "${name}" names "${id}", which is not in items.`)
  for (const g of spec.groups ?? []) for (const id of g.items ?? []) if (!known(id)) errors.push(`interleave: a group names "${id}", which is not in items.`)
  for (const pair of spec.pairs ?? []) for (const id of pair) if (!known(id)) errors.push(`interleave: a pair names "${id}", which is not in items.`)
  for (const pair of spec.apart_pages ?? []) for (const id of pair) if (!known(id)) errors.push(`interleave: apart_pages names "${id}", which is not in items.`)
  for (const g of spec.groups ?? []) {
    for (const id of g.avoid_adjacent ?? []) if (!known(id)) errors.push(`interleave: a group avoids "${id}", which is not in items.`)
    for (const n of g.avoid_positions ?? []) if (!Number.isInteger(n) || n < 1 || n > spec.items.length) errors.push(`interleave: avoid_positions ${n} is not a position.`)
  }
  // Rules are checked looking backwards from each free slot, and anchors are
  // placed first, so an anchored item must not itself be under a spacing rule.
  const ruled = new Set([
    ...Object.values(spec.clusters ?? {}).flat(),
    ...(spec.groups ?? []).flatMap(g => g.items ?? []),
    ...(spec.pairs ?? []).flat(),
    ...(spec.apart_pages ?? []).flat(),
  ])
  for (const id of Object.keys(spec.anchored ?? {})) {
    if (!known(id)) errors.push(`interleave: anchored "${id}" is not in items.`)
    if (ruled.has(id)) errors.push(`interleave: anchored "${id}" cannot also be in a cluster, group or pair.`)
  }
  return errors
}
