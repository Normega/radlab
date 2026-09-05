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
 *   free_breath      TARGET_BREATHS = 8 self-paced breaths (FreeBreath.jsx); ~2 min at typical pace
 *   drift            TARGETS_MS = 6 intervals summing 60 s + reproductions
 *   pond_watch       TRIAL_COUNT = 60 × (~2 s ITI + 0.8 s + 0.65 s)
 *   farm_joy         3 rounds, 12 required selections of 24 veggies
 *   delve / tune     open-ended by design (no win state, user ends it)
 *   alongside        open-ended; its arc runs ~5 min but the player ends it
 *   sidelong         open-ended; its arc runs ~4.5 min but the player ends it
 *
 * `trials: null` renders as an em dash, not "N/A" — a card should not say
 * nothing twice.
 *
 * NOT IN THIS CATALOG (Norm, 2026-08-13): **Owl Barn** and **Breath Guardian**
 * were pulled back to in-development — they need more work before participants
 * meet them. Their routes in `App.jsx` are still live and their tables still
 * collect data; they are simply not listed here, so they appear on neither
 * `/games` nor the About-page carousel. They are linked from the "In
 * development" section of `/prototypes/` and from `/admin/games`. Re-adding an
 * entry here is all it takes to put either back on the catalog.
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
    slug: 'free_breath',
    title: 'Free Breathing',
    to: '/games/free-breath',
    badge: 'Breath shapes',
    desc: 'No pacer — hold to breathe in, hold to breathe out, at whatever pace is yours. Eight breaths, each drawn as a shape.',
    category: 'breath',
    bucket: 'quick',
    duration: '~2 min',
    trials: 8,
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
    slug: 'alongside',
    title: 'Alongside',
    to: '/games/alongside',
    badge: 'Attention · Sense foraging',
    desc: 'A creature of light drifts through a night meadow. It cannot be caught — but it can be kept company, and it knows where the good places are.',
    category: 'attention',
    bucket: 'open',
    duration: null,
    trials: null,
  },
  {
    slug: 'sidelong',
    title: 'Sidelong',
    to: '/games/sidelong',
    badge: 'Attention · Sense foraging',
    desc: 'A night sky where the faint stars are never where you point. Rest your gaze and they bloom beside it — look straight at one and it goes out.',
    category: 'attention',
    bucket: 'open',
    duration: null,
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

/**
 * Live routes deliberately absent from GAMES (see the header note) — in
 * development, listed on `/prototypes/` and `/admin/games` only.
 *
 * They are still named here because the lookups below feed the unlock-bounce
 * banner: Breath Guardian sits behind Contact, so a participant who opens it
 * early gets redirected, and "Complete Contact before beginning ___" needs a
 * title to fill in. Without this the banner silently renders nothing.
 */
export const DEV_GAMES = [
  { slug: 'owl_barn',        title: 'Owl Barn',        to: '/games/owl-barn',        inDevelopment: true },
  { slug: 'breath_guardian', title: 'Breath Guardian', to: '/games/breath-guardian', inDevelopment: true },
]

/** Look a game up by its slug (`ebb_flow`). Catalog first, then in-development. */
export function gameBySlug(slug) {
  return GAMES.find(g => g.slug === slug)
    ?? DEV_GAMES.find(g => g.slug === slug)
    ?? null
}

/**
 * Look a game up by the last segment of its route (`ebb-flow`), which is what
 * the `?from=` unlock-bounce parameter carries.
 */
export function gameByRouteSlug(routeSlug) {
  if (!routeSlug) return null
  const path = `/games/${routeSlug}`
  return GAMES.find(g => g.to === path)
    ?? DEV_GAMES.find(g => g.to === path)
    ?? null
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
