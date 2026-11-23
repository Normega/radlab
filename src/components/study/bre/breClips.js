// Which clip plays where (plan §5, §6c, §8a). Every event and rating the task writes records
// CLIP_PLAN.id, so data collected under one plan can never be mistaken for another.
//
// PROVISIONAL until Maya decides (open decisions in the plan, §14):
//   O1  sad pairs 1 and 2, anger pairs 1 and 2, and the order within each pair
//   O2  the main version's three neutral clips (neutral 1, neutral 2, washout) and their order
//   O3  the neutral version's order of all seven neutral clips (recommended: fixed)
// The placeholders below only make the task runnable for the dry run. Replace them, give the plan a
// new id (date it), and set `provisional: false`. The task shows "PROVISIONAL CLIP PLAN" in the RA
// panel while this is true.

export const CLIP_PLAN = Object.freeze({
  id: 'provisional-2026-11-23',
  provisional: true,
  pairs: {
    sad:   { 1: ['S4', 'S5'], 2: ['S6', 'S8'] },
    anger: { 1: ['A1', 'A3'], 2: ['A4', 'A7'] },
  },
  // main version: neutral 1, neutral 2, washout (the package suggests P1 first)
  mainNeutral: { n1: 'P1', n2: 'P2', w: 'N1' },
  // neutral version: the seven positions, fixed for everyone
  neutralOrder: { n1: 'P1', n2: 'P2', b1: ['N1', 'N2'], w: 'N3', b2: ['N5', 'N8'] },
})

/** The 8 main-version sequences (plan §5): [block 1, block 2] as [emotion, pair]. */
export const SEQUENCES = Object.freeze({
  1: [['sad', 1], ['anger', 1]],
  2: [['sad', 1], ['anger', 2]],
  3: [['sad', 2], ['anger', 1]],
  4: [['sad', 2], ['anger', 2]],
  5: [['anger', 1], ['sad', 1]],
  6: [['anger', 2], ['sad', 1]],
  7: [['anger', 1], ['sad', 2]],
  8: [['anger', 2], ['sad', 2]],
})

/**
 * The clips for one participant: { n1, n2, w, b1: {emotion, pair, clips}, b2: {...} }.
 * Throws on anything it cannot resolve: a task must never guess which clip to show.
 */
export function clipsFor({ version, sequence }, plan = CLIP_PLAN) {
  if (version === 'neutral') {
    const o = plan.neutralOrder
    return {
      n1: o.n1, n2: o.n2, w: o.w,
      b1: { emotion: 'neutral', pair: null, clips: [...o.b1] },
      b2: { emotion: 'neutral', pair: null, clips: [...o.b2] },
    }
  }
  if (version !== 'main') throw new Error(`unknown version "${version}"`)
  const seq = SEQUENCES[Number(sequence)]
  if (!seq) throw new Error(`unknown sequence "${sequence}"`)
  const block = ([emotion, pair]) => {
    const clips = plan.pairs[emotion]?.[pair]
    if (!clips || clips.length !== 2) throw new Error(`no ${emotion} pair ${pair} in clip plan ${plan.id}`)
    return { emotion, pair, clips: [...clips] }
  }
  return { ...plan.mainNeutral, b1: block(seq[0]), b2: block(seq[1]) }
}

/** Every clip id a participant's session needs, in play order (for preloading). */
export function clipOrder(c) {
  return [c.n1, c.n2, ...c.b1.clips, c.w, ...c.b2.clips]
}
