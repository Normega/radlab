// 24 veggie sprite filenames (PNGs in public/images/veggies/).
// Exactly one unique sprite is assigned per value each session.

export const VEGGIES = [
  'beet', 'carrot', 'daikon', 'garlic', 'ginger',
  'horseradish', 'kohlrabi', 'leek', 'onion', 'other1',
  'other2', 'other3', 'other4', 'other5', 'other6',
  'other7', 'parsnip', 'potato', 'potato_boots', 'radish',
  'rutabaga', 'sweetpotato', 'taro', 'turmeric',
]

// Mulberry32 seeded PRNG — same helper as constants.js
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

// Returns a Map<valueWord, veggieName> with no repeats within a session.
// valueWords must have length ≤ 24.
export function assignVeggies(valueWords, seed) {
  const rand     = mulberry32(seed)
  const shuffled = shuffle(VEGGIES, rand)
  const map      = new Map()
  valueWords.forEach((word, i) => map.set(word, shuffled[i]))
  return map
}

export function veggieUrl(name) {
  return `/images/veggies/${name}.png`
}
