// The two coded tasks as plain data: an ordered list of operations the runner (BreTask.jsx) plays.
// Plan §6a (bre_baseline) and §6b/§6c (bre_main). Pure, so the timeline is tested without a browser
// (breScript.test.mjs): every rating present once, labelled from where it is asked, in plan order.
//
// Operation kinds
//   text     instruction screen, Continue
//   rating   one screen of 1+ items; `where` names its place, so labels come from recorded facts
//   segment  a timed cross (fixation, break, recovery minute), optional cue at its start
//   audio    training script with a cross, advances when it ends
//   clip     one film clip, autoplay, no controls, advances when it ends
//   check    the strategy check (shuffled options, one replay of the training audio if wrong)
//
// Ratings pause the clock (decision of Nov 20): each segment is its own timed operation, so a
// 60 s segment is 60 s of strategy time however long the ratings between segments take.

import { MARKERS as M } from '../../../lib/physioMarkers.js'
import { BREATH_STEM } from './breItems.js'
import { clipsFor } from './breClips.js'

// On-screen text, verbatim from 06_Participant_Instructions_and_Scripts.md unless marked PLAN
// (wording from the build plan §6b, not in the REB package: Maya to confirm).
export const TEXT = {
  screen3: 'For the next 3 minutes, please sit quietly with your eyes open and look at the cross in the centre of the screen. You do not need to do anything in particular. The screen will move on by itself.',
  screen4: 'Throughout the study you will be asked how you feel right now, using a scale from 1 (Not at all) to 7 (Extremely). Click the number that best describes how you feel at that moment. Try it now: How upset do you feel right now?',
  screen5: 'You will now hear a short recording describing a way of paying attention to your breathing. Please put on the headphones and listen carefully. You will use this approach during the breaks later in the session.',
  screen6: 'Now practise this approach for 2 minutes. Keep your eyes open and look at the cross on the screen. A short reminder will play at the start.',
  screen8: 'You will now watch some short film clips. After each clip there will be a break. During every break, please use the approach you just learned, keeping your eyes on the cross. You will be asked how you feel at several points. Some clips are neutral, and some are sad or anger-provoking. If at any point you want to pause or stop, tell the research assistant.',
  screen10: 'Please use your breathing approach for the next 3 minutes. You will be asked how you feel once a minute.',
  screen12: 'Thank you. You have finished the tasks. Please let the research assistant know you are done.',
  // PLAN
  practiceIntro: 'Here are the questions you will be asked after the breaks. Answer them now for the practice you just did.',
  questions: 'If you have any questions about the approach, ask the research assistant now.',
}

const SEC = 1000
export const DUR = { baseline: 180 * SEC, practice: 120 * SEC, break: 60 * SEC, recoveryMinute: 60 * SEC }

const EMOTIONS = ['emo_stressed', 'emo_anxious', 'emo_sad', 'emo_angry', 'emo_calm']
const STRATEGY = ['strat_explore', 'strat_evaluate']
const APPRAISAL = ['appr_relevance', 'appr_handle', 'appr_rumination']
const BREATH = ['breath_aware', 'breath_explore', 'breath_curious', 'breath_checking', 'breath_pleasant', 'breath_adherence_pct']

/**
 * The export column an answer belongs in, from where it was asked:
 *   upset + 'b1_m2' → upset_b1_m2;  emo_sad + 'b1' → emo_b1_sad;  breath_aware + 'practice' → breath_practice_aware
 */
export function positionFor(itemId, where) {
  if (itemId === 'upset') return `upset_${where}`
  const i = itemId.indexOf('_')
  return `${itemId.slice(0, i)}_${where}_${itemId.slice(i + 1)}`
}

const rating = (id, items, where, ctx = {}) => ({ kind: 'rating', id, items, where, ...ctx })

export function baselineScript() {
  return [
    rating('upset_practice', ['upset'], 'practice', { intro: TEXT.screen4, practice: true, block: 'baseline' }),
    { kind: 'text', id: 'screen3', text: TEXT.screen3 },
    { kind: 'segment', id: 'baseline_fixation', ms: DUR.baseline, cue: false, markerOn: M.baseline_on, markerOff: M.baseline_off, block: 'baseline' },
    rating('upset_baseline', ['upset'], 'baseline', { block: 'baseline' }),
    rating('emo_baseline', EMOTIONS, 'baseline', { block: 'baseline' }),
  ]
}

/** A clip followed by a 60 s break (neutral 1, neutral 2, washout). */
function clipWithBreak(where, clip, emotion) {
  const ctx = { block: where, emotion, clipIds: [clip] }
  return [
    { kind: 'clip', id: `clip_${where}`, clip, ...ctx },
    rating(`upset_${where}_clip`, ['upset'], `${where}_clip`, ctx),
    { kind: 'segment', id: `break_${where}`, ms: DUR.break, cue: true, markerOn: M.break_on, markerOff: M.break_off, ...ctx },
    rating(`upset_${where}_break`, ['upset'], `${where}_break`, ctx),
    rating(`strat_${where}`, STRATEGY, where, ctx),
  ]
}

/** Two clips back to back, then the 3-minute recovery with a rating each minute. */
function block(where, b) {
  const ctx = { block: where, emotion: b.emotion, clipIds: b.clips }
  const ops = b.clips.map((clip, i) => ({ kind: 'clip', id: `clip_${where}_${'ab'[i]}`, clip, ...ctx }))
  ops.push(rating(`upset_${where}_m0`, ['upset'], `${where}_m0`, ctx))
  for (const m of [1, 2, 3]) {
    ops.push({ kind: 'segment', id: `recovery_${where}_${m}`, ms: DUR.recoveryMinute, cue: true,
      header: m === 1 ? TEXT.screen10 : null, markerOn: M.recovery_on, markerOff: M.recovery_off, segment: m, ...ctx })
    ops.push(rating(`upset_${where}_m${m}`, ['upset'], `${where}_m${m}`, ctx))
  }
  ops.push(rating(`strat_${where}`, STRATEGY, where, ctx))
  ops.push(rating(`emo_${where}`, EMOTIONS, where, ctx))
  ops.push(rating(`appr_${where}`, APPRAISAL, where, ctx))
  ops.push(rating(`breath_${where}`, BREATH, where, { ...ctx, stem: BREATH_STEM }))
  return ops
}

/**
 * bre_main for one participant. `assignment` = { version, condition, sequence } (sequence only for
 * main). Throws if any of them is missing or unknown: the task must not start on a guess.
 */
export function mainScript({ version, condition, sequence }, plan) {
  if (condition !== 'sf' && condition !== 'em') throw new Error(`unknown condition "${condition}"`)
  const c = clipsFor({ version, sequence }, plan)
  return [
    { kind: 'text', id: 'screen5', text: TEXT.screen5 },
    { kind: 'audio', id: 'training', audio: `bre_train_${condition}`, markerOn: M.training_on, markerOff: M.training_off, block: 'training' },
    { kind: 'text', id: 'screen6', text: TEXT.screen6 },
    { kind: 'segment', id: 'guided_practice', ms: DUR.practice, cue: true, markerOn: M.practice_on, markerOff: M.practice_off, block: 'training' },
    { kind: 'check', id: 'strategy_check', condition, audio: `bre_train_${condition}`, block: 'training' },
    rating('strat_practice', STRATEGY, 'practice', { intro: TEXT.practiceIntro, practice: true, block: 'training' }),
    rating('breath_practice', BREATH, 'practice', { stem: BREATH_STEM, practice: true, block: 'training' }),
    { kind: 'text', id: 'questions', text: TEXT.questions },
    { kind: 'text', id: 'screen8', text: TEXT.screen8 },
    ...clipWithBreak('n1', c.n1, 'neutral'),
    ...clipWithBreak('n2', c.n2, 'neutral'),
    rating('emo_neutral', EMOTIONS, 'neutral', { block: 'neutral', emotion: 'neutral', clipIds: [c.n1, c.n2] }),
    rating('breath_neutral', BREATH, 'neutral', { block: 'neutral', emotion: 'neutral', clipIds: [c.n1, c.n2], stem: BREATH_STEM }),
    ...block('b1', c.b1),
    ...clipWithBreak('w', c.w, 'neutral'),
    ...block('b2', c.b2),
  ]
}
