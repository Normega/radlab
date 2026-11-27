// Which clip plays where (plan §5, §6c, §8a). Every event and rating the task writes records
// CLIP_PLAN.id, so data collected under one plan can never be mistaken for another.
//
// Plan 'maya-2026-11-27': Maya's picks (email "Picking specific video pairs", Nov 27), adopted by Norm
// as proposed. Two viewers rated each emotional clip 0-100 for how upsetting it was; within each emotion
// the strongest and weakest clips form one pair and the middle two the other, with the stronger clip
// second (averages: S4 89, S8 76, S5 62.5, S6 38; A3 87.5, A4 55, A1 33.5, A7 32.5).
//   O1  sad 1 = S6 -> S4, sad 2 = S5 -> S8; anger 1 = A7 -> A3, anger 2 = A1 -> A4
//   O2  main-version neutrals: N3, N5, then N8 as the washout
//   O3  neutral version: not yet chosen by Maya. Default: the same lead-in and washout as the main
//       version (N3, N5, N8), so the versions differ only in the two blocks, which take the other four
//       neutral clips (P1+P2, N1+N2). If O3 changes, give the plan a new id.
// The dry-run plan before this was 'provisional-2026-11-23'; rows record which plan they ran under.

export const CLIP_PLAN = Object.freeze({
  id: 'maya-2026-11-27',
  provisional: false,
  pairs: {
    sad:   { 1: ['S6', 'S4'], 2: ['S5', 'S8'] },
    anger: { 1: ['A7', 'A3'], 2: ['A1', 'A4'] },
  },
  // main version: neutral 1, neutral 2, washout
  mainNeutral: { n1: 'N3', n2: 'N5', w: 'N8' },
  // neutral version: the seven positions, fixed for everyone (O3 default, see above)
  neutralOrder: { n1: 'N3', n2: 'N5', b1: ['P1', 'P2'], w: 'N8', b2: ['N1', 'N2'] },
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
