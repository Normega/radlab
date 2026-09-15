/**
 * Experience Factory — item bank and level configuration.
 *
 * Design: src/games/ExperienceFactory/DESIGN.md (v0.2, Norm-approved 2026-09-15).
 * The three categories are the curriculum; the item bank is policy-reviewed
 * content, so edits here are content edits, not refactors — check with Norm.
 *
 * Tier semantics:
 *   1  modality-cued  (thoughts arrive as text, feelings as faces, sensations
 *                      as colors/tones — the modality gives the answer away)
 *   2  all-text       (the modality shortcut is gone; classify by content)
 *   3  trap           (items engineered to be miscategorized; each carries a
 *                      teaching note used by end-of-round reports and practice)
 */

export const CATEGORIES = ['thought', 'feeling', 'sensation']

export const CATEGORY_META = {
  thought:   { label: 'Thought',   color: '#BCD6FF', glow: 'rgba(150,190,255,0.55)', key: '1' },
  feeling:   { label: 'Feeling',   color: '#F2A6B3', glow: 'rgba(242,166,179,0.55)', key: '2' },
  sensation: { label: 'Sensation', color: '#5FB89A', glow: 'rgba(95,184,154,0.55)',  key: '3' },
}

// ── Thoughts (text, tiers 1-2) ────────────────────────────────────────────────

const THOUGHTS = [
  ['I always mess things up.', 'neg'],
  ["I'm not good enough at this.", 'neg'],
  ['Nobody really wants me around.', 'neg'],
  ['I should have known better.', 'neg'],
  ["I'm falling behind everyone else.", 'neg'],
  ["I'm such an idiot.", 'neg'],
  ['I handled that really well.', 'pos'],
  ["I'm getting better every day.", 'pos'],
  ['People enjoy my company.', 'pos'],
  ['That was a smart decision.', 'pos'],
  ['He never listens to anyone.', 'neg'],
  ["She's always so kind to people.", 'pos'],
  ["They have no idea what they're doing.", 'neg'],
  ['My neighbour is a genuinely good person.', 'pos'],
  ['This is going to go badly.', 'neg'],
  ['What if I embarrass myself?', 'neg'],
  ["They're probably talking about me.", 'neg'],
  ['Tomorrow will be a better day.', 'pos'],
  ["I'll never get all this done.", 'neg'],
  ["I can't believe I said that yesterday.", 'neg'],
  ['That summer at the lake was perfect.', 'pos'],
  ['I used to be so much fitter.', 'neg'],
  ['I need to buy groceries after this.', 'neutral'],
  ['I should call my mother tonight.', 'neutral'],
  ['If I leave now I can still make the bus.', 'neutral'],
  ["She's so much smarter than me.", 'neg'],
  ['My life is better than it used to be.', 'pos'],
  ['It might rain later.', 'neutral'],
].map(([text, valence], i) => ({
  id: `th_${i + 1}`, category: 'thought', modality: 'text', tier: 2, text, valence,
}))

// ── Feelings ──────────────────────────────────────────────────────────────────

// Tier 1: faces from the shared affect system — 8 emotions x 3 zones, rendered
// with AURenderer via EXPRESSION_TABLE[emotion][zone]. Unlabeled (decided).
const FACE_EMOTIONS = ['Alert', 'Excited', 'Good', 'Calm', 'Still', 'Sad', 'Bad', 'Tense']
const FACE_VALENCE  = { Alert: 'neg', Excited: 'pos', Good: 'pos', Calm: 'pos', Still: 'neutral', Sad: 'neg', Bad: 'neg', Tense: 'neg' }
const FACE_ZONES    = ['mild', 'moderate', 'strong']

const FEELING_FACES = FACE_EMOTIONS.flatMap(emotion =>
  FACE_ZONES.map(zone => ({
    id: `ff_${emotion.toLowerCase()}_${zone}`,
    category: 'feeling', modality: 'face', tier: 1,
    emotion, zone, valence: FACE_VALENCE[emotion],
  }))
)

const FEELING_WORDS = [
  ['joy', 'pos'],
  ['quiet contentment', 'pos'],
  ['a surge of excitement', 'pos'],
  ['calm', 'pos'],
  ['sadness', 'neg'],
  ['loneliness', 'neg'],
  ['irritation', 'neg'],
  ['a flash of anger', 'neg'],
  ['nervousness', 'neg'],
  ['dread', 'neg'],
  ['boredom', 'neg'],
  ['relief', 'pos'],
  ['gratitude', 'pos'],
  ['pride', 'pos'],
  ['embarrassment', 'neg'],
  ['hopefulness', 'pos'],
].map(([text, valence], i) => ({
  id: `fw_${i + 1}`, category: 'feeling', modality: 'text', tier: 2, text, valence,
}))

// ── Sensations ────────────────────────────────────────────────────────────────

const SENSATION_COLORS = [
  ['warm amber glow', '#E8A33C'],
  ['deep red', '#A83232'],
  ['cool blue', '#4A7FB5'],
  ['soft green', '#7FAE7A'],
].map(([name, hex], i) => ({
  id: `sc_${i + 1}`, category: 'sensation', modality: 'color', tier: 1,
  text: name, hex, valence: 'neutral',
}))

// Synth specs consumed by playSensationTone() — no audio assets (house rule:
// procedural Web Audio, per Drift/Tune/OwlBarn).
const SENSATION_TONES = [
  { id: 'st_1', text: 'a low hum',            spec: { type: 'tone',  freq: 110,  decay: 1.6 } },
  { id: 'st_2', text: 'a bright chime',       spec: { type: 'tone',  freq: 1318, decay: 1.1 } },
  { id: 'st_3', text: 'a rising sweep',       spec: { type: 'sweep', from: 220,  to: 880, dur: 1.1 } },
  { id: 'st_4', text: 'a falling two-note',   spec: { type: 'pair',  freqs: [660, 440], gap: 0.35, decay: 0.9 } },
].map(t => ({ ...t, category: 'sensation', modality: 'tone', tier: 1, valence: 'neutral' }))

const SENSATION_WORDS = [
  ['warmth in the chest', 'pos'],
  ['tingling in the fingers', 'neutral'],
  ['a tight jaw', 'neg'],
  ['heaviness in the eyelids', 'neutral'],
  ['butterflies in the stomach', 'neutral'],
  ['cool air on the skin', 'neutral'],
  ['a racing heartbeat', 'neg'],
  ['dry mouth', 'neg'],
  ['tension across the shoulders', 'neg'],
  ['a growling stomach', 'neutral'],
  ['ringing in the ears', 'neg'],
  ['goosebumps on the arms', 'neutral'],
  ['aching feet', 'neg'],
  ['pressure behind the eyes', 'neg'],
  ['an itch on the forearm', 'neutral'],
  ['a lump in the throat', 'neg'],
].map(([text, valence], i) => ({
  id: `sw_${i + 1}`, category: 'sensation', modality: 'text', tier: 2, text, valence,
}))

// ── Trap items (tier 3) ───────────────────────────────────────────────────────
// Each note is shown in practice feedback and end-of-round reports, never
// mid-round (DESIGN.md, Feedback rules).

const TRAPS = [
  ['I feel like a failure.', 'thought', '"Feel like" followed by a verdict is a judgment wearing a feeling costume.'],
  ['I feel that nobody listens to me.', 'thought', '"I feel that..." introduces a belief, not an emotion.'],
  ['I feel anxious.', 'feeling', 'A named emotion is a feeling, even inside a sentence.'],
  ['My heart is pounding.', 'sensation', 'A body event, described without interpretation.'],
  ['Everything is hopeless.', 'thought', 'A claim about the world. Compare: "hopelessness" is the feeling.'],
  ['hopelessness', 'feeling', 'The emotion itself, no claim attached.'],
  ["I can't take this anymore.", 'thought', 'A prediction about your limits.'],
  ['a knot in the stomach', 'sensation', "The body's signal, before any story about it."],
  ["I'm so stupid.", 'thought', 'A self-judgment, however loud it feels.'],
  ['shame', 'feeling', 'The emotion, named directly.'],
  ['burning cheeks', 'sensation', 'What shame feels like in the body.'],
  ['I feel ignored.', 'thought', '"Ignored" describes what others did, which is an interpretation.'],
].map(([text, category, note], i) => ({
  id: `tr_${i + 1}`, category, modality: 'text', tier: 3, text, note, valence: 'neg',
}))

export const ITEM_POOLS = {
  thoughts: THOUGHTS,
  feelingFaces: FEELING_FACES,
  feelingWords: FEELING_WORDS,
  sensationColors: SENSATION_COLORS,
  sensationTones: SENSATION_TONES,
  sensationWords: SENSATION_WORDS,
  traps: TRAPS,
}

// The same moment of experience at three levels — the intro's worked example.
export const INTRO_TRIPLET = [
  { category: 'thought',   text: '"Everyone saw me trip."' },
  { category: 'feeling',   text: 'embarrassment' },
  { category: 'sensation', text: 'burning cheeks' },
]

// ── Levels ────────────────────────────────────────────────────────────────────
//
// travelMs: item's ride from belt edge to the sorting gate.
// dwellMs:  time at the gate before an unanswered item drifts off (missed);
//           null = the belt waits (level 1 only).
// observeGapMs: pause between an observe response and the next question orb.

export const LEVELS = [
  {
    level: 1, name: 'Apprentice',
    travelMs: 1600, dwellMs: null, observeGapMs: 10000,
    mix: 'cued',      // thoughts text / feelings faces / sensations colors+tones
    practiceCount: 6, sortCount: 16, observeCount: 6,
  },
  {
    level: 2, name: 'Journeyman',
    travelMs: 1200, dwellMs: 4000, observeGapMs: 8000,
    mix: 'text',      // all categories as text, tiers 1-2 content, no traps
    practiceCount: 4, sortCount: 16, observeCount: 6,
  },
  {
    level: 3, name: 'Machinist',
    travelMs: 900, dwellMs: 2500, observeGapMs: 6000,
    mix: 'traps',     // all text + tier-3 traps mixed in
    practiceCount: 4, sortCount: 16, observeCount: 6,
  },
]

export const MAX_LEVEL = LEVELS.length

// Accuracy needed on a session's sort trials to unlock the next lever setting.
export const UNLOCK_ACCURACY = 0.75

// Points: ~10 per minute of actual play, capped so an idle tab cannot farm.
export const POINTS_PER_MIN = 10
export const POINTS_CAP = 60

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function take(pool, n) {
  return shuffle(pool).slice(0, n)
}

/**
 * Build one round's items for a level: balanced across the three categories,
 * shuffled, with the level's mix rules applied.
 */
export function buildSortItems(levelCfg, count) {
  const per = Math.floor(count / 3)
  const extra = count - per * 3
  let thoughts, feelings, sensations

  if (levelCfg.mix === 'cued') {
    thoughts   = take(ITEM_POOLS.thoughts, per + extra)
    feelings   = take(ITEM_POOLS.feelingFaces, per)
    sensations = take([...ITEM_POOLS.sensationColors, ...ITEM_POOLS.sensationTones], per)
  } else {
    thoughts   = take(ITEM_POOLS.thoughts, per + extra)
    feelings   = take(ITEM_POOLS.feelingWords, per)
    sensations = take(ITEM_POOLS.sensationWords, per)
  }

  let items = [...thoughts, ...feelings, ...sensations]

  if (levelCfg.mix === 'traps') {
    // Swap in traps for a third of the round, keeping the count constant.
    const traps = take(ITEM_POOLS.traps, Math.floor(count / 3) + 1)
    items = [...shuffle(items).slice(0, count - traps.length), ...traps]
  }

  return shuffle(items)
}

export function buildPracticeItems(levelCfg, count) {
  // Practice uses the same mix as the level's real rounds, one category at a
  // time so the mapping is unmistakable, then shuffled pairs.
  return buildSortItems(levelCfg, count)
}
