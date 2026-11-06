// Condition slots whose arms are objects rather than strings.
//
// A slot's arms are usually strings ('breathing', 'reading'), and draw_assignment
// balances each slot on its own, in shuffled blocks of one of each arm. Two
// separate slots are therefore each balanced but not crossed. A crossed slot
// lists every combination as an object, e.g.
//
//   condition: [{ relaxation_arm: 'breathing', valley_order: 'thin_first' }, …4]
//
// so one draw balances all four exactly, in blocks of four without replacement
// (Sandy Study 4, decision E7, 2026-11-05). The steps keep reading
// `relaxation_arm` and `valley_order`: expandAssignments hands them the parts.

/** True when a slot's arms are structured (objects), not plain strings. */
export function isStructuredArms(arms) {
  return Array.isArray(arms) && arms.some(a => a !== null && typeof a === 'object' && !Array.isArray(a))
}

/**
 * The drawn values, plus each key of an object-valued draw as an assignment of
 * its own. A slot drawn under that name directly keeps its own value. Arrays
 * (counterbalance orders) are values, not bundles, and are left alone.
 */
export function expandAssignments(drawn) {
  const out = { ...drawn }
  for (const v of Object.values(drawn ?? {})) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) continue
    for (const [k, x] of Object.entries(v)) if (!(k in out)) out[k] = x
  }
  return out
}
