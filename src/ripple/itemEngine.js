// Ripple rotating item engine (§8 of ripple_spec.md).
//
// Item bank lives here — versioned in code, not in a DB table, so changes are
// reviewable and bank_version is stamped on every response for longitudinal safety.
//
// State shape stored in ripples.item_state (jsonb):
//   { [poolId]: { remaining: [item_id, ...], cycle: number, checkinsSinceLast: number } }
//
// drawItems() is pure (given the same item_state, same item is always next) except
// on reshuffles, which are random and immediately persisted back to item_state.

export const BANK_VERSION = 1

// v1 bank: two pools.
// cadence = show one item from this pool every N check-ins.
// Items are drawn without replacement per pool; exhausted pool reshuffles + increments cycle.
export const POOLS = [
  {
    id: 'stress',
    cadence: 2,
    items: [
      { id: 'str_1', question: 'How manageable does your workload feel right now?', left: 'Overwhelming', right: 'Manageable' },
      { id: 'str_2', question: 'How much are you on top of things today?',          left: 'Falling behind', right: 'On top of it' },
      { id: 'str_3', question: 'How confident do you feel about what\'s ahead?',   left: 'Worried',        right: 'Confident'  },
    ],
  },
  {
    id: 'satisfaction',
    cadence: 3,
    items: [
      { id: 'sat_1', question: 'How satisfied are you with your life right now?',       left: 'Not at all', right: 'Completely' },
      { id: 'sat_2', question: 'How well is life going for you right now?',             left: 'Poorly',     right: 'Very well'  },
      { id: 'sat_3', question: 'How close is your life to how you\'d like it to be?',  left: 'Far off',    right: 'Just right' },
    ],
  },
]

function shuffled(ids) {
  const arr = [...ids]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function freshPoolState(pool) {
  return { remaining: shuffled(pool.items.map(i => i.id)), cycle: 0, checkinsSinceLast: 0 }
}

/**
 * Draw 0–2 items for today's check-in (friction budget: at most one item per pool,
 * at most 2 pools per check-in).
 *
 * @param {object|null} itemState — ripples.item_state from DB (null = first check-in ever)
 * @returns {{ drawn: Array, nextState: object }}
 *   drawn: [{ poolId, itemId, question, left, right, bankVersion }]
 *   nextState: updated item_state to persist back to ripples
 */
export function drawItems(itemState) {
  const state = itemState ?? {}
  const nextState = {}
  const drawn = []

  for (const pool of POOLS) {
    // Merge saved pool state with fresh defaults (handles missing fields gracefully)
    const saved = state[pool.id]
    const ps = saved
      ? { ...freshPoolState(pool), ...saved }
      : freshPoolState(pool)

    const newCheckinsSinceLast = (ps.checkinsSinceLast ?? 0) + 1

    if (newCheckinsSinceLast < pool.cadence) {
      nextState[pool.id] = { ...ps, checkinsSinceLast: newCheckinsSinceLast }
      continue
    }

    // Due — draw one item
    let remaining = [...(ps.remaining ?? [])]
    let cycle = ps.cycle ?? 0

    if (remaining.length === 0) {
      remaining = shuffled(pool.items.map(i => i.id))
      cycle += 1
    }

    const itemId = remaining.shift()
    const item = pool.items.find(i => i.id === itemId)

    if (item) {
      drawn.push({ poolId: pool.id, itemId, question: item.question, left: item.left, right: item.right, bankVersion: BANK_VERSION })
    }

    nextState[pool.id] = { remaining, cycle, checkinsSinceLast: 0 }

    if (drawn.length >= 2) break  // friction budget
  }

  // Preserve state for any pools not reached (due to the friction-budget break)
  for (const pool of POOLS) {
    if (!(pool.id in nextState)) {
      nextState[pool.id] = state[pool.id] ?? freshPoolState(pool)
    }
  }

  return { drawn, nextState }
}

/**
 * Format item responses for ripple_checkins.items (jsonb).
 * @param {Array} drawn   — from drawItems()
 * @param {Array} values  — parallel array of 1–7 ratings (same order as drawn)
 */
export function formatItemResponses(drawn, values) {
  return drawn.map((item, i) => ({
    item_id:      item.itemId,
    pool_id:      item.poolId,
    bank_version: item.bankVersion,
    value:        values[i] ?? null,
  }))
}
