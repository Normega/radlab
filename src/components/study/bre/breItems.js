// In-task items of the Breath Attention and Emotional Recovery study (plan WP-I2), verbatim from the
// REB package: 07_Questionnaire_Packet.md, "In-task ratings (Design V6)", and for the strategy check
// 06_Participant_Instructions_and_Scripts.md, Screen 7. Change a word here only with an REB amendment.
//
// Every rating is 1 to 7 with labelled ends and no default, answered by a click, except the adherence
// item, a percentage. The item id is what bre_ratings.item_id records; the position label (where in
// the session it was asked) is added by the task when the participant answers.

const ANCHORS = {
  notAtAll_extremely:  { low: 'Not at all', high: 'Extremely' },
  notAtAll_completely: { low: 'Not at all', high: 'Completely' },
}

export const UPSET = {
  id: 'upset', text: 'How upset do you feel right now?',
  low: 'Not at all upset', high: 'Extremely upset',
}

/** Emotion check: one screen, five items. At baseline, after the neutral clips, after each block. */
export const EMOTION_CHECK = ['stressed', 'anxious', 'sad', 'angry', 'calm'].map(e => ({
  id: `emo_${e}`, text: `Right now, how ${e} do you feel?`, ...ANCHORS.notAtAll_extremely,
}))

/** After the upset rating at the end of every break and recovery period. */
export const STRATEGY = [
  { id: 'strat_explore',  text: 'During that break, how much were you exploring your breathing as a changing sensory experience?', ...ANCHORS.notAtAll_completely },
  { id: 'strat_evaluate', text: 'During that break, how much were you evaluating whether you were able to breathe normally?', ...ANCHORS.notAtAll_completely },
]

/** After each recovery period, one set per clip block. */
export const APPRAISAL = [
  { id: 'appr_relevance',  text: 'How personally relevant did the clips feel?', ...ANCHORS.notAtAll_extremely },
  { id: 'appr_handle',     text: 'How able did you feel to handle the feelings the clips brought up?', low: 'Not at all able', high: 'Completely able' },
  { id: 'appr_rumination', text: 'During the recovery period, how much did you keep thinking about the clips?', low: 'Not at all', high: 'The whole time' },
]

/** After the neutral clips and after each recovery period. Each item begins "During the breaks...". */
export const BREATH_STEM = 'During the breaks...'
export const BREATH = [
  { id: 'breath_aware',    text: 'How aware were you of your breathing?', ...ANCHORS.notAtAll_extremely },
  { id: 'breath_explore',  text: 'How much did you explore different sensations of your breathing?', ...ANCHORS.notAtAll_extremely },
  { id: 'breath_curious',  text: 'How curious did you feel about your breathing?', ...ANCHORS.notAtAll_extremely },
  { id: 'breath_checking', text: 'How much were you checking whether your breathing was normal or as expected?', ...ANCHORS.notAtAll_extremely },
  { id: 'breath_pleasant', text: 'How pleasant or unpleasant did your breathing feel?', low: 'Very unpleasant', high: 'Very pleasant', mid: 'Neutral' },
  // The one percentage item (bre_ratings allows 0–100 for this id only). Answered by clicking one of
  // eleven buttons, 0% to 100% in steps of 10: no default, same click-to-answer as the 1–7 items.
  { id: 'breath_adherence_pct', text: 'For about what percentage of the time were you using the strategy you were taught?', percent: true },
]
export const PERCENT_STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

/** Strategy check after the training audio. Shown in random order, the order recorded. */
export const STRATEGY_CHECK = {
  id: 'strategy_check',
  text: 'Which description best matches what you were asked to do during the breaks?',
  options: [
    { key: 'sf',   text: 'I explored the sensations of my breathing with curiosity, following whatever caught my interest.' },
    { key: 'em',   text: 'I kept track of the overall pattern of my breathing and checked how it compared with my usual breathing.' },
    { key: 'slow', text: 'I tried to slow down and deepen my breathing so that I would relax.' },
  ],
}
/** The correct option is the participant's own condition; "slow" is wrong for both. */
export const strategyCheckCorrect = (condition, key) => key === condition

/** Break cues: audio and on screen at the start of every break and after each in-break rating. */
export const BREAK_CUE = {
  sf: 'Explore the sensations of your breathing, following whatever catches your interest.',
  em: 'Monitor the overall pattern of your breathing and how it compares with your usual breathing.',
}

/** Every rating item, by id, for validation and the export. */
export const ALL_ITEMS = Object.fromEntries(
  [UPSET, ...EMOTION_CHECK, ...STRATEGY, ...APPRAISAL, ...BREATH].map(i => [i.id, i]),
)
export function isValidValue(itemId, v) {
  const item = ALL_ITEMS[itemId]
  if (!item || !Number.isInteger(v)) return false
  return item.percent ? PERCENT_STEPS.includes(v) : v >= 1 && v <= 7
}
