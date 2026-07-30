/**
 * Games catalog — single source of truth for the games page (§ revised Games
 * Page, Figma node 4047:3653).
 *
 * Previously each game's title/badge/blurb was duplicated between
 * `pages/GamesPage.jsx` and `pages/PlatformPage.jsx`, and the two had already
 * drifted apart. The redesign card shows the PlatformPage copy, so that is the
 * copy that lives here.
 *
 * `duration` / `trials` are DERIVED FROM EACH GAME'S OWN CONSTANTS, not from
 * the Figma mock (whose numbers disagreed between its two frames). Sources:
 *   still_water      2 wheel selections (StillWater.jsx phase1 → phase2)
 *   face_read        TRIAL_COUNT = 10                       (FaceRead.jsx:11)
 *   first_contact    MIN_CYCLES_BEFORE_COMPLETE = 4 × 4 s   (FirstContact/constants.js)
 *   ebb_flow         MIN_TRIALS_PER_SESSION = 10, 4 breaths × 4 s + 0.8 s ITI
 *   breath_guardian  FREE 30 s + WAVE 75 s + SELF 60 s = 165 s
 *   drift            TARGETS_MS = 6 intervals summing 60 s + reproductions
 *   pond_watch       TRIAL_COUNT = 60 × (~2 s ITI + 0.8 s + 0.65 s)
 *   owl_barn         player-paced crossing, no fixed trial count
 *   farm_joy         3 rounds, 12 required selections of 24 veggies
 *   delve / tune     open-ended by design (no win state, user ends it)
 *
 * `trials: null` renders as an em dash, not "N/A" — a card should not say
 * nothing twice.
 */

export const CATEGORIES = [
  { id: 'emotion',   label: 'Emotion' },
  { id: 'breath',    label: 'Breath & Body' },
  { id: 'attention', label: 'Attention & Timing' },
  { id: 'values',    label: 'Values' },
]

// Buckets re-tuned from the Figma's "Under 5 / About 5 / At your own pace".
// With the real numbers above, 8 of 11 games are under five minutes, which
// left the middle bucket almost empty and the first one useless. These
// boundaries split the actual distribution 3 / 6 / 2.
export const DURATION_BUCKETS = [
  { id: 'quick',  label: 'A minute or two' },
  { id: 'medium', label: 'Three to five minutes' },
  { id: 'open',   label: 'At your own pace' },
]

// Unlock gates. `requires` names the profile signal, since the two gating
// games record completion on `profiles` rather than `game_sessions`:
//   still_water   → profiles.still_water_sessions > 0
//   first_contact → profiles.first_contact_complete
export const GAMES = [
  {
    slug: 'still_water',
    title: 'Still Water',
    to: '/games/still-water',
    badge: 'Emotion check-in',
    desc: 'How are you arriving? Two quick questions map your mood on the feeling wheel.',
    category: 'emotion',
    bucket: 'quick',
    duration: '~1 min',
    trials: 2,
  },
  {
    slug: 'face_read',
    title: 'Face Read',
    to: '/games/face-read',
    badge: 'Emotion recognition',
    desc: 'A face animates into an expression. Can you name the feeling — and how strong it is?',
    category: 'emotion',
    bucket: 'quick',
    duration: '~2 min',
    trials: 10,
    unlock: { requires: 'still_water', label: 'Still Water' },
  },
  {
    slug: 'first_contact',
    title: 'Contact',
    to: '/games/first-contact',
    badge: 'Breath sync',
    desc: 'Breathe together with your Ripple. The more you sync, the more it comes alive.',
    category: 'breath',
    bucket: 'quick',
    duration: '~1 min',
    trials: 4,
  },
  {
    slug: 'ebb_flow',
    title: 'Ebb & Flow',
    to: '/games/ebb-flow',
    badge: 'Breath sync · Interoception',
    desc: 'Breathe with your Ripple. Notice when something changes. A quiet game of awareness.',
    category: 'breath',
    bucket: 'medium',
    duration: '~4 min',
    trials: 10,
    unlock: { requires: 'first_contact', label: 'Contact' },
  },
  {
    slug: 'breath_guardian',
    title: 'Breath Guardian',
    to: '/games/breath-guardian',
    badge: 'Breath regulation · Boundaries',
    desc: 'Hold to breathe in and raise the shield; release to breathe out and welcome the world through.',
    category: 'breath',
    bucket: 'medium',
    duration: '~3 min',
    trials: null,
    unlock: { requires: 'first_contact', label: 'Contact' },
  },
  {
    slug: 'drift',
    title: 'Drift',
    to: '/games/drift',
    badge: 'Time perception · Felt duration',
    desc: 'A tone marks an interval. A face breathes while you wait. Then you reproduce the duration from felt sense alone.',
    category: 'attention',
    bucket: 'medium',
    duration: '~3 min',
    trials: 6,
  },
  {
    slug: 'pond_watch',
    title: 'Pond Watch',
    to: '/games/pond-watch',
    badge: 'Go / No-Go · Reaction time',
    desc: "A duck appears — hit spacebar. A heron glides past — don't you dare touch it. Sounds easy. Your brain will betray you.",
    category: 'attention',
    bucket: 'medium',
    duration: '~4 min',
    trials: 60,
  },
  {
    slug: 'delve',
    title: 'Delve',
    to: '/games/delve',
    badge: 'Attention · Sense foraging',
    desc: "An image waits behind haze. Rest your attention in one place and it slowly comes clear; what you've seen fades back.",
    category: 'attention',
    bucket: 'open',
    duration: null,
    trials: null,
  },
  {
    slug: 'tune',
    title: 'Tune',
    to: '/games/tune',
    badge: 'Attention · Sense foraging',
    desc: 'A world of sound waits in a soft haze. Rest your attention near a voice and it clarifies as the rest softens back.',
    category: 'attention',
    bucket: 'open',
    duration: null,
    trials: null,
  },
  {
    slug: 'owl_barn',
    title: 'Owl Barn',
    to: '/games/owl-barn',
    badge: 'Hearing · Rhythm · Strategy',
    desc: 'Cross a dark barn while owls hoot overhead. Read the silence — 3 taps or 8.',
    category: 'attention',
    bucket: 'medium',
    duration: '~3 min',
    trials: null,
  },
  {
    slug: 'farm_joy',
    title: 'Farm Joy',
    to: '/games/farm-joy',
    badge: 'Values clarification',
    desc: 'Plant the values that grow joy.',
    category: 'values',
    bucket: 'medium',
    duration: '~5 min',
    trials: null,
  },
]

/** Look a game up by its slug (`ebb_flow`). */
export function gameBySlug(slug) {
  return GAMES.find(g => g.slug === slug) ?? null
}

/**
 * Look a game up by the last segment of its route (`ebb-flow`), which is what
 * the `?from=` unlock-bounce parameter carries.
 */
export function gameByRouteSlug(routeSlug) {
  if (!routeSlug) return null
  return GAMES.find(g => g.to === `/games/${routeSlug}`) ?? null
}

/**
 * The DURATION / TRIALS pairs shown on a card, with the null cases spelled the
 * same way everywhere. Shared by the games page and the About-page carousel so
 * the two can't drift again.
 */
export function metaRows(game) {
  return [
    ['Duration', game.duration ?? 'Open-ended'],
    ['Trials',   game.trials ?? '—'],
  ]
}

/**
 * Group the catalog into rendered sections for one sort mode.
 * Returns [{ id, label, games }] with empty sections dropped, so adding a
 * game to a new category never leaves a stranded header behind.
 */
export function groupGames(sortBy) {
  const [buckets, key] = sortBy === 'duration'
    ? [DURATION_BUCKETS, 'bucket']
    : [CATEGORIES, 'category']

  return buckets
    .map(b => ({ ...b, games: GAMES.filter(g => g[key] === b.id) }))
    .filter(b => b.games.length > 0)
}
