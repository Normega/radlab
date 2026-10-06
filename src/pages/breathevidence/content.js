// Content for /breathevidence, the BCAT-DDM planning page shared with Nansi.
// Kept apart from the layout so a session can update the plan without touching JSX.
// Source of truth for every number here: docs/markdowns/bcat_ddm_plan.md (§6a–§6f, §7).
// When a decision is made, move it from DECISIONS (status 'open') to 'decided' with the
// date and the answer, and add a line to the plan's §7 Decisions log.

export const UPDATED = '2026-10-06'

export const STAGE = [
  { label: 'Design simulations', state: 'done', note: 'Four rounds, 2,000+ simulated sessions' },
  { label: 'Participant prototype', state: 'done', note: 'Live at /prototypes/bcat-ddm.html' },
  { label: 'Design decisions', state: 'now', note: 'Open questions below' },
  { label: 'Build the lab task', state: 'next', note: 'Belt, triggers, data storage' },
  { label: 'Pilot', state: 'next', note: 'Tune window length and change sizes' },
]

export const QUESTION = [
  'When breathing changes, how does the evidence that it has changed build up into noticing it? '
    + 'The central aim is the best overall model of that accumulation, tested with a drift diffusion model '
    + 'fitted to the moment-by-moment stream of button presses.',
  'The secondary aim is individual differences in what people respond to: the change from one breath to the next, '
    + 'or the total departure from their recent baseline. The model measures this as a single number per person.',
]

export const PARAMETERS = [
  ['vL', 'Total-change gain', 'How strongly a departure from the recent baseline pushes toward noticing.'],
  ['vT', 'Breath-to-breath gain', 'How strongly a difference between consecutive breaths pushes toward noticing.'],
  ['s', 'Breath-to-breath share', 'The part of a person’s sensitivity carried by breath-to-breath change: 0 = only total change, 1 = only breath-to-breath. The main individual difference.'],
  ['δ', 'Criterion', 'A steady pull back toward zero, so ordinary breathing variability is ignored. Mainly sets how often someone presses when nothing changed.'],
  ['a', 'Boundary', 'How much accumulated evidence it takes to press. Higher means more cautious.'],
  ['λ', 'Leak', 'How quickly accumulated evidence fades. Zero means perfect accumulation.'],
  ['Ter', 'Non-decision time', 'Time to register and press, about 0.35 s.'],
]

export const DESIGN = {
  name: 'Roving steps with a ramp block',
  summary: 'One unbroken pacing stream. For the first 30 minutes the pace steps up or down every few breaths, '
    + 'and each new pace becomes the baseline for the next change, so the pacer never has to return to a fixed rate. '
    + 'The last 10 minutes are gradual ramps. Steps are sensed mainly through breath-to-breath change and ramps through '
    + 'total change, so the two parts together tell the evidence channels apart.',
  facts: [
    ['About 50', 'changes in 40 minutes (the first draft had 23)'],
    ['ρ ≈ .87', 'recovery of each person’s breath-to-breath share'],
    ['~60%', 'of people assigned their correct model'],
    ['Group-level', 'a leak in accumulation is detectable when memory is long'],
  ],
}

export const ROUNDS = [
  {
    title: 'Round 1: how many changes fit in 40 minutes?',
    finding: 'More changes is not more information. Roving steps doubled the number of changes but recovered some parameters worse than the first draft. Gradual ramps made the difference for people who track total change.',
  },
  {
    title: 'Round 2: which evidence do people accumulate?',
    finding: 'Whether someone tracks breath-to-breath change, total change, or a mix can be identified for each person in every design tested. Roving steps with a ramp block did this best.',
  },
  {
    title: 'Round 3: how long is evidence held? One-breath "blips"',
    finding: 'Memory span is a real unknown: Study 1 is fitted equally well by people who forget in 2 seconds and people who hold evidence for a minute. One-breath blips measured it worse than the roving + ramp design on every count.',
  },
  {
    title: 'Round 4: smooth 3–4-breath "bumps"',
    finding: 'Bumps beat blips but still lost when used alone. A bump block can stand in for the ramp block, with no meaningful difference between them. The design search ends here.',
  },
]

export const COMPARISON = {
  columns: ['Design', 'Right model per person', 'Breath-to-breath share (ρ)', 'Leak found for the group', 'Memory span ranked (ρ)'],
  rows: [
    ['Roving + ramp block', '.64', '.87', 'Yes', '.78–.82'],
    ['Roving + bump block', '.59', '.88', 'Weakly', '.81–.85'],
    ['Double blips', '.26', '.56', 'No', '.71'],
    ['Smooth bumps alone', '.27', '.65', 'No', '.76–.77'],
  ],
  note: 'Same 30 simulated people per group in each design, 40 minutes each. Differences smaller than about .1 are within noise.',
}

// status: 'open' | 'decided'
export const DECISIONS = [
  { area: 'Design', q: 'Aim priority: the best group-level model, per-person evidence weights, or both equally? This sets how much time goes to the ramp block.', status: 'open' },
  { area: 'Design', q: 'Response window after a change (currently 5 breaths). Every press is used in the model, so the window mainly matters for scoring and for when probes appear.', status: 'open' },
  { area: 'Design', q: 'Quest pre-run: reuse the existing faster/same/slower Quest, or a short press-when-noticed version that matches the main task?', status: 'open' },
  { area: 'Design', q: 'Watch condition (watch the pacer without following it): how long, and does it need every change size? Not yet simulated.', status: 'open' },
  { area: 'Practical', q: 'One visit of about 60 minutes, or two sessions? Two would improve per-person memory-span estimates.', status: 'open' },
  { area: 'Practical', q: 'Longest comfortable continuous pacing run, and how often to break.', status: 'open' },
  { area: 'Practical', q: 'Whether capnography or electrodermal activity is available in the lab.', status: 'open' },
  { area: 'Practical', q: 'Probe scales: two new continuous sliders (calm–activated, tired–alert). The existing arousal rating mixes the two.', status: 'open' },
  { area: 'Practical', q: 'Where the Intero2025 PsychoPy task and the Study 5 breath-analysis R code live, so the analysis reuses the published breath detection.', status: 'open' },
]

export const NEXT = [
  'Settle the open decisions above.',
  'Try the prototype in both conditions, especially the ramp block: are the ramps comfortable to follow, and noticeable at all?',
  'Build the lab version: Polar belt, physiology triggers, data saved to the platform.',
  'Pilot a handful of people to set the response window and the change sizes.',
  'Write the analysis as a hierarchical model, which also prevents the fits that collapse in single-person fitting.',
]

export const LINKS = [
  { label: 'Try the prototype', href: '/prototypes/bcat-ddm.html', note: 'Participant side, with a researcher view at the end' },
  { label: 'Design write-up (Google Doc)', href: 'https://docs.google.com/document/d/1g4111SODzbDdzlvrnmzYpil9ONMNDieQX04CjGio_C8/edit', note: 'The model, designs and first results, for comments' },
]
