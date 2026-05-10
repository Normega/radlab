import { VALUE_TAXONOMY } from './data/values.js'

export const PHASE = {
  INTRO:              'INTRO',
  ROUND_1_SORTING:    'ROUND_1_SORTING',
  ROUND_2_GREENHOUSE: 'ROUND_2_GREENHOUSE',
  ROUND_3_PLANTING:   'ROUND_3_PLANTING',
  HARVEST:            'HARVEST',
  SESSION_COMPLETE:   'SESSION_COMPLETE',
}

export const CFG = {
  SAMPLE_TOTAL:              24,
  GREENHOUSE_MAX:            6,
  FINAL_MAX:                 3,
  POINTS_HARVEST:            10,
  POINTS_EARLY:              5,
  COLS:                      4,
  ROWS:                      6,
  ROUND1_REVEAL_DELAY_MS:    1000,
  ROUND1_REQUIRED_SELECTIONS: 12,
}

// How many to sample from each category per session
const SAMPLE_COUNTS = {
  'Cognitive/exploration': 3,
  'Character/conduct':     4,
  'Relational':            4,
  'Moral/civic':           3,
  'Hedonic/openness':      4,
  'Meaning/order':         3,
  'Wellbeing/self':        3,
}

function mulberry32(seed) {
  let t = seed
  return () => {
    t = (t + 0x6D2B79F5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(arr, rand) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Returns 24 { word, category } objects, stratified by category.
export function sampleValues(seed) {
  const rand   = mulberry32(seed)
  const result = []
  for (const { category, values } of VALUE_TAXONOMY) {
    const n     = SAMPLE_COUNTS[category] ?? values.length
    const picked = shuffle(values, rand).slice(0, n)
    for (const word of picked) result.push({ word, category })
  }
  return shuffle(result, rand)
}
