// ── Flow game: Flow Short Scale (FSS) ──────────────────────────────────────
//
// Pure, DOM-free and node-testable. The prototype imports a byte-identical copy
// from public/prototypes/flow-game/fss.js (fss.test.mjs fails if they drift).
//
// Rheinberg, Vollmeyer & Engeser, FSS – Flow Short Scale (English version).
// Items 1–10 are the flow items, 11–13 worry, 14–16 the fit of demands to
// skill. WORDING IS UNVERIFIED: typed from the English version, to be checked
// against Carleigh's copy before any participant sees it.

export const FSS_VERIFIED = false

export const FSS_INSTRUCTIONS = 'Please think about the game you just played and rate how well each statement describes it.'

const AGREE7 = { points: 7, labels: { 1: 'Not at all', 4: 'Partly', 7: 'Very much' } }

export const FSS_ITEMS = [
  { n: 1, text: 'I feel just the right amount of challenge.', scale: AGREE7, sub: 'flow' },
  { n: 2, text: 'My thoughts/activities run fluidly and smoothly.', scale: AGREE7, sub: 'flow' },
  { n: 3, text: "I don't notice time passing.", scale: AGREE7, sub: 'flow' },
  { n: 4, text: 'I have no difficulty concentrating.', scale: AGREE7, sub: 'flow' },
  { n: 5, text: 'My mind is completely clear.', scale: AGREE7, sub: 'flow' },
  { n: 6, text: 'I am totally absorbed in what I am doing.', scale: AGREE7, sub: 'flow' },
  { n: 7, text: 'The right thoughts/movements occur of their own accord.', scale: AGREE7, sub: 'flow' },
  { n: 8, text: 'I know what I have to do each step of the way.', scale: AGREE7, sub: 'flow' },
  { n: 9, text: 'I feel that I have everything under control.', scale: AGREE7, sub: 'flow' },
  { n: 10, text: 'I am completely lost in thought.', scale: AGREE7, sub: 'flow' },
  { n: 11, text: 'Something important to me is at stake here.', scale: AGREE7, sub: 'worry' },
  { n: 12, text: "I won't make any mistake here.", scale: AGREE7, sub: 'worry' },
  { n: 13, text: 'I am worried about failing.', scale: AGREE7, sub: 'worry' },
  { n: 14, text: 'Compared to all other activities which I partake in, this one is …',
    scale: { points: 9, labels: { 1: 'Easy', 9: 'Difficult' } }, sub: 'fit' },
  { n: 15, text: 'I think that my competence in this area is …',
    scale: { points: 9, labels: { 1: 'Low', 9: 'High' } }, sub: 'fit' },
  { n: 16, text: 'For me personally, the current demands are …',
    scale: { points: 9, labels: { 1: 'Too low', 5: 'Just right', 9: 'Too high' } }, sub: 'fit' },
]

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

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

// answers: { [itemNumber]: 1..points | null }. Subscale means use the answered
// items and report how many there were; skipped items stay missing.
export function scoreFss(answers) {
  const vals = sub => FSS_ITEMS.filter(i => i.sub === sub).map(i => answers[i.n]).filter(v => v != null)
  const flow = vals('flow')
  const worry = vals('worry')
  return {
    flow: mean(flow), flowAnswered: flow.length,
    worry: mean(worry), worryAnswered: worry.length,
    difficulty: answers[14] ?? null,
    competence: answers[15] ?? null,
    demands: answers[16] ?? null,
  }
}
