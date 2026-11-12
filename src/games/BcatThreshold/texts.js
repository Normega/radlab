// ── BCAT threshold: every participant-facing text ──────────────────────────
//
// Ported from the test build, NextStudy/Thresholds/6_online_pilot/js/texts.js (2026-11-11), whose texts were
// adapted from approved study materials (Study 4 task screens and Qualtrics condition texts; the touch arm is
// new). Kept word for word apart from: the HTML became plain strings, the curly quotes are characters, the
// key labels come from config.keys, and key names are marked [[like this]] so the page draws them as key caps
// (the test build already showed W, S and the space bar as keys; the arrow-key names are now caps too).
// The consent, decline, welcome, debrief and goodbye texts are not here: consent and debrief are separate
// study steps, so their [NORM: ...] markers were dropped with them.
//
// Texts marked NEW below are not in the test build: they say what this step needs and the test build did not
// (the keys-up cue, the end of the step, error screens). They add no claim about the study.
//
// `n` is the number of pulses a participant sees per round (lead-in included), 4 in the approved config (no lead-in).

/** [[W]] -> a key cap. Split a text into strings and { key } parts. */
export function richParts(text) {
  const out = []
  const re = /\[\[(.+?)\]\]/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push({ key: m[1] })
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const cap = label => `[[${label}]]`

/**
 * The three instruction pages of an arm: [{ heading?, paragraphs }].
 * @param {'vision'|'touch'|'breath'} arm
 * @param {number} n  pulses per round, lead-in included
 * @param {{ grow: { label }, shrink: { label } }} keys  config.keys
 */
export function instructionPages(arm, n, keys) {
  const K = cap(keys.grow.label), Ks = cap(keys.shrink.label)
  const welcome = {
    heading: 'Welcome to the Sensory Attention Task',
    paragraphs: [
      `In this task you will see a circle grow and shrink ${n} times in a row. You will be judging whether things are speeding up, slowing down, or staying the same.`,
    ],
  }
  const arms = {
    vision: [
      `In the task, you will see a circle that “pulses”: it will grow and shrink ${n} times in a row.`,
      `We would like you to watch the circle and judge whether it changes speed as it pulses. You should be judging only over those ${n} pulses, not what happened on previous rounds.`,
      'The circle could: (i) speed up, (ii) slow down, or (iii) stay the same speed.',
      'Please just watch the circle. Do not press any keys while the circle is pulsing.',
    ],
    breath: [
      `In the task, you will see a circle that “pulses”: it will grow and shrink ${n} times in a row. As the circle pulses, please breathe along with the circle. Please breathe in when the circle expands, and breathe out when the circle shrinks.`,
      `As you breathe in, hold down the ${K} key. As you breathe out, hold down the ${Ks} key. Use your left hand.`,
      `We would like you to notice your breath and judge whether it changes speed as it pulses. You should be judging only over those ${n} breaths, not what happened on previous rounds.`,
      'Your breath could: (i) speed up, (ii) slow down, or (iii) stay the same speed.',
    ],
    touch: [
      `In the task, you will see a circle that “pulses”: it will grow and shrink ${n} times in a row. As the circle pulses, please tap along with the circle: hold down the ${K} key while the circle expands, and hold down the ${Ks} key while the circle shrinks. Use your left hand.`,
      `We would like you to notice your finger tapping and judge whether it changes speed as it pulses. You should be judging only over those ${n} pulses, not what happened on previous rounds.`,
      'Your tapping could: (i) speed up, (ii) slow down, or (iii) stay the same speed.',
    ],
  }
  if (!arms[arm]) throw new Error(`instructionPages: unknown arm ${JSON.stringify(arm)}`)
  const responses = {
    paragraphs: [
      `After each set of circles, you will be asked if things: slowed down (${cap('left arrow')}), stayed the same (${cap('up arrow')}), or sped up (${cap('right arrow')}). There will be a picture to remind you.`,
      'Keep your right hand on the arrow keys.',
      'The next round starts as soon as you answer. If you need a break, take it before you answer.',
    ],
  }
  return [welcome, { paragraphs: arms[arm] }, responses]
}

export const CONTINUE_HINT = `Press the ${cap('space bar')} to continue.`

export const PRACTICE_INTRO = 'First, three practice rounds. In these, the changes are large and easy to see.'

export const PRACTICE_FEEDBACK = {
  speeding: 'In that round, the circle sped up.',
  slowing: 'In that round, the circle slowed down.',
  no_change: 'In that round, the circle stayed the same speed.',
}

export const READY = 'That’s the end of the practice. In the task, the changes are often much smaller, and sometimes there is no change at all. Just give your best guess.'

/** The cue line during practice circles (the test build showed it in practice only). */
export function pacerReminder(arm, keys) {
  if (arm === 'vision') return 'Just watch the circle.'
  const K = cap(keys.grow.label), Ks = cap(keys.shrink.label)
  return arm === 'breath'
    ? `Hold ${K} as you breathe in, ${Ks} as you breathe out`
    : `Hold ${K} while the circle grows, ${Ks} while the circle shrinks`
}

/** The answer screen. Words as on the test build's picture (img/SpeedImg.png); the icons are drawn in the step. */
export const ANSWER_QUESTION = 'Did you sense a change?'
export const ANSWER_LABELS = { slowed: 'slower', same: 'same', sped_up: 'faster' }
/** What the answer screen shows, for screen readers. */
export const ANSWER_PICTURE_ALT = 'Did you sense a change? Left arrow: slower. Up arrow: same. Right arrow: faster.'

// ── NEW: not in the test build ─────────────────────────────────────────────

/** Touch and breath arms: the next round waits until W and S are up. */
export function releaseKeysCue(keys) {
  return `Let go of ${cap(keys.grow.label)} and ${cap(keys.shrink.label)} to start.`
}

export const CONTINUE = 'Continue'

export const DONE = {
  heading: 'Thank you',
  paragraphs: ['You have finished this part of the study.'],
}

// Device check (the test build's wording, app.js deviceProblem)
export const DEVICE = {
  mobile: 'This study needs a desktop or laptop computer with a physical keyboard. It cannot be done on a phone or tablet.',
  small_screen: 'This study needs a screen of at least 800 × 500 pixels.',
}

export const ERRORS = {
  no_arm: 'This part of the session could not start. Please reload the page. If it happens again, contact the research team.',
  engine: 'Sorry, something went wrong and this part of the session stopped. Please contact the research team.',
}
