// v1 — shared seeded PRNG for per-trial randomization (stimulus order, jitter,
// item sampling). This is the client-side convention from randomizer_spec.md §7:
//
//   - Seed from the session link token or session id:
//       const rng = mulberry32(hashStringToInt(token))
//   - Log the seed in the results jsonb alongside trial data so every trial
//     sequence is reproducible after the fact.
//
// Condition assignment does NOT belong here — that runs server-side through
// draw_assignment (see useAssignment hook) and writes participant_assignments.
// FarmJoy carries older inline copies of mulberry32; consolidate imports here
// opportunistically, not as a blocking refactor.

/** Deterministic PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 32-bit FNV-1a hash — turns a session token/id into a mulberry32 seed. */
export function hashStringToInt(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < (str ?? '').length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Fisher-Yates shuffle using the supplied rng. Returns a new array. */
export function seededShuffle(arr, rng) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Pick one element using the supplied rng. */
export function seededPick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)]
}
