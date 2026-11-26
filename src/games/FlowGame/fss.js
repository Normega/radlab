// ── Flow game: Flow Short Scale (FSS) ──────────────────────────────────────
//
// Pure, DOM-free and node-testable. The prototype imports a byte-identical copy
// from public/prototypes/flow-game/fss.js (fss.test.mjs fails if they drift).
//
// Rheinberg, Vollmeyer & Engeser (2003), FSS – Flow Short Scale (English version).
// Items 1–10 are the flow items (Fluency: 2, 4, 5, 7, 8, 9; Absorption: 1, 3, 6,
// 10), 11–13 worry, 14–16 the fit of demands to skill. Items 1–13 and their
// 7-point labels were checked word for word against the FSS manual Carleigh sent
// (2026-11-26). The manual does not print items 14–16, so their wording is still
// unverified (`verified: false`) until it is checked against the 2003 original.

export const FSS_INSTRUCTIONS = 'Please think about the game you just played and rate how well each statement describes it.'

const AGREE7 = { points: 7, labels: { 1: 'Not at all', 4: 'Partly', 7: 'Very much' } }

export const FSS_ITEMS = [
  { n: 1, text: 'I feel just the right amount of challenge.', scale: AGREE7, sub: 'flow', factor: 'absorption', verified: true },
  { n: 2, text: 'My thoughts/activities run fluidly and smoothly.', scale: AGREE7, sub: 'flow', factor: 'fluency', verified: true },
  { n: 3, text: "I don't notice time passing.", scale: AGREE7, sub: 'flow', factor: 'absorption', verified: true },
  { n: 4, text: 'I have no difficulty concentrating.', scale: AGREE7, sub: 'flow', factor: 'fluency', verified: true },
  { n: 5, text: 'My mind is completely clear.', scale: AGREE7, sub: 'flow', factor: 'fluency', verified: true },
  { n: 6, text: 'I am totally absorbed in what I am doing.', scale: AGREE7, sub: 'flow', factor: 'absorption', verified: true },
  { n: 7, text: 'The right thoughts/movements occur of their own accord.', scale: AGREE7, sub: 'flow', factor: 'fluency', verified: true },
  { n: 8, text: 'I know what I have to do each step of the way.', scale: AGREE7, sub: 'flow', factor: 'fluency', verified: true },
  { n: 9, text: 'I feel that I have everything under control.', scale: AGREE7, sub: 'flow', factor: 'fluency', verified: true },
  { n: 10, text: 'I am completely lost in thought.', scale: AGREE7, sub: 'flow', factor: 'absorption', verified: true },
  { n: 11, text: 'Something important to me is at stake here.', scale: AGREE7, sub: 'worry', verified: true },
  { n: 12, text: "I won't make any mistake here.", scale: AGREE7, sub: 'worry', verified: true },
  { n: 13, text: 'I am worried about failing.', scale: AGREE7, sub: 'worry', verified: true },
  { n: 14, text: 'Compared to all other activities which I partake in, this one is …',
    scale: { points: 9, labels: { 1: 'Easy', 9: 'Difficult' } }, sub: 'fit', verified: false },
  { n: 15, text: 'I think that my competence in this area is …',
    scale: { points: 9, labels: { 1: 'Low', 9: 'High' } }, sub: 'fit', verified: false },
  { n: 16, text: 'For me personally, the current demands are …',
    scale: { points: 9, labels: { 1: 'Too low', 5: 'Just right', 9: 'Too high' } }, sub: 'fit', verified: false },
]

// True only once every item's wording has been checked.
export const FSS_VERIFIED = FSS_ITEMS.every(i => i.verified)

// Pages for the stacked layout: a new page wherever the scale changes, at most
// `perPage` items each (the platform's v2 rule, src/lib/legacyToStacked.js).
export function fssPages(perPage = 7) {
  const pages = []
  let cur = []
  for (const it of FSS_ITEMS) {
    const prev = cur[cur.length - 1]
    if (cur.length && (cur.length >= perPage || prev.scale.points !== it.scale.points)) {
      pages.push(cur)
      cur = []
    }
    cur.push(it)
  }
  if (cur.length) pages.push(cur)
  return pages
}

const sum = xs => xs.reduce((a, b) => a + b, 0)
const mean = xs => (xs.length ? sum(xs) / xs.length : null)

// answers: { [itemNumber]: 1..points | null }.
// The manual scores sums: flow total = items 1–10 (10–70), worry = 11–13 (3–21),
// Fluency = 2, 4, 5, 7, 8, 9 and Absorption = 1, 3, 6, 10; its T-norms use the
// flow total and worry sums. A sum is reported only when every item of the scale
// was answered (a sum over fewer items would read as a lower score); the mean of
// the answered items and the count answered are always reported.
export function scoreFss(answers) {
  const scale = pick => {
    const items = FSS_ITEMS.filter(pick)
    const vals = items.map(i => answers[i.n]).filter(v => v != null)
    return {
      total: vals.length === items.length ? sum(vals) : null,
      mean: mean(vals),
      answered: vals.length,
      of: items.length,
    }
  }
  return {
    flow: scale(i => i.sub === 'flow'),
    fluency: scale(i => i.factor === 'fluency'),
    absorption: scale(i => i.factor === 'absorption'),
    worry: scale(i => i.sub === 'worry'),
    difficulty: answers[14] ?? null,
    competence: answers[15] ?? null,
    demands: answers[16] ?? null,
  }
}
