// The class trial's own touches on both text-delivered arms (Norm, Oct 8 2026),
// applied after each arm is assembled so the arms' scripts stay as written.
//
//   - condition: the trial's own, so the admin Training Library groups these
//     modules apart from Liliana's (her non_reactivity / reappraisal groups);
//   - badge: "Today's practice", not the arm's name. Students are told they
//     are in one of three programs, not which (arms are revealed at the debrief);
//   - lead_out.invite: one line inviting that day's practice into the rest of
//     the day, matched to the one-line Quest that ends the Sense Foraging arm.
//     No arm follows the line up the next day.
//
// A closing paragraph that already began "For the rest of today" (day 14 of
// the non-reactivity arm) now lives in the invite, so it is dropped there.

export const BADGE = 'Today’s practice'

const CONDITION = { nr: 'classrct_nonreactivity', sm: 'classrct_stress_mindset' }

// Week 4's choice days (22–27) offer three earlier practices, so their lines fit
// all three.
export const INVITE = {
  nr: {
    1: 'Once or twice, notice a single breath: the air coming in, and going out. Nothing to change.',
    2: 'When a thought or feeling pulls at you, give it a quiet label (“thinking”, “worry”, “planning”), then come back to the breath.',
    3: 'Pause once and notice whatever is here: sounds, sensations, thoughts. Let each one come and go.',
    4: 'If something stressful comes up, take a breathing space: notice what’s here, gather on a few breaths, then widen to the whole body.',
    5: 'Check in with your body once: where it meets the chair or the ground, and anything else you can feel.',
    6: 'Pick one moment to notice one thing you can see, hear, feel, smell and taste.',
    7: 'Label one thought or feeling as it arises, and notice whether naming it changes how it feels.',
    8: 'When a thought shows up, picture setting it on a leaf and letting the stream carry it.',
    9: 'For a few breaths, note what you see, then what you hear, then what you feel.',
    10: 'When things get busy, see if you can stay steady like the mountain: the weather changes, the mountain stays.',
    11: 'When a strong feeling comes, watch it the way a lighthouse watches a storm: from where you stand, without being swept in.',
    12: 'Use a breathing space on one stressful moment today, even if it lasts only a minute.',
    13: 'Investigate one ordinary experience with a detective’s curiosity: what exactly is it like?',
    14: 'If something arises, see if you can approach it the same way: not as a problem to solve, but as data to observe.',
    15: 'If today’s stressful thought comes back, see if you can set it on a leaf and let it drift by.',
    16: 'Pick up one everyday object and look at it as if for the first time.',
    17: 'If you notice discomfort, stay with it for one breath, curious about what it is actually like.',
    18: 'When stress shows up, steady yourself with what you can see, hear and feel.',
    19: 'When you feel the urge to react, see if you can take one breath first.',
    20: 'If the stressful moment comes back to mind, let it be weather passing over the mountain.',
    21: 'Bring a detective’s curiosity to the next stressful moment: where do you feel it, and how does it change?',
    22: 'Return once to what you practised today, even for a single breath.',
    23: 'Find one moment when you can step back and watch, the way you did in today’s practice.',
    24: 'When something pulls at you, meet it the way you met today’s practice: curious, without rushing to react.',
    25: 'Pause once and try today’s practice in miniature: a few breaths is enough.',
    26: 'Notice one time you’re carried off by a thought or feeling, and gently come back.',
    27: 'If a stressful moment comes, bring today’s practice to it.',
    28: 'Choose one practice from these four weeks you’d like to keep, and try it once more today.',
  },
  sm: {
    1: 'When you feel stressed, notice one way your body is gearing up to help you: a faster heart, sharper focus.',
    2: 'Notice one moment of stress, and name it to yourself: “this is stress.”',
    3: 'If something stressful comes up, ask yourself: could this be a challenge rather than a threat?',
    4: 'When stress shows up, ask what it tells you that you care about.',
    5: 'When you notice stress, try thinking of it as energy you can use, not only something to get rid of.',
    6: 'Notice one stress signal in your body, and treat it as information rather than an alarm.',
    7: 'Try to catch stress as it starts: the first tightness, the first rush.',
    8: 'Notice whether one of the triggers you mapped shows up, and how you respond to it.',
    9: 'Watch for one of your early warning signals, and pause when you notice it.',
    10: 'When a stressful thought shows up, ask: what’s the evidence, and is there another way to see it?',
    11: 'Listen for one distortion in your thinking (all-or-nothing, catastrophizing, mind-reading) and name it.',
    12: 'Run one stressful thought through a quick thought record: the thought, the evidence, a more balanced version.',
    13: 'If a worry starts to snowball, ask how likely the worst case really is, and how you would cope if it happened.',
    14: 'Look for one thing that went right today, even a small one.',
    15: 'When stress rises, name what you care about underneath it.',
    16: 'When stress shows up, connect it to a value: what matters to you here?',
    17: 'If something stresses you, ask: can I change this, or is it one to let go?',
    18: 'Catch one distorted thought and try rewording it more fairly.',
    19: 'If the situation you planned for comes up, try one step from your plan.',
    20: 'If you catch yourself expecting the worst, check how likely it really is.',
    21: 'Before bed, name one good thing from today, or one strength you used.',
    22: 'If a stressful moment comes, bring today’s exercise to it.',
    23: 'When stress shows up, try one move from today’s exercise.',
    24: 'Notice one moment of stress, and ask what it might be helping you do.',
    25: 'Try today’s exercise in miniature on one stressful thought: a few seconds is enough.',
    26: 'When something feels like a threat, see whether it could also be a challenge.',
    27: 'Notice one stressful moment, and what it says you care about.',
    28: 'Choose one tool from these four weeks you’d like to keep, and use it once more today.',
  },
}

const dropInvitedParagraph = step => step.type !== 'closing' ? step : {
  ...step,
  content: step.content.filter(c => !/^For the rest of today/.test(c.text ?? '')),
}

export const forTrial = (m, arm, day) => ({
  ...m,
  condition: CONDITION[arm],
  badge: BADGE,
  steps: m.steps.map(dropInvitedParagraph),
  lead_out: { ...m.lead_out, invite: INVITE[arm][day] },
})
