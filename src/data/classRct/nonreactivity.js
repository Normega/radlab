// The class RCT (Fall 2026) — the non-reactivity arm, delivered as text.
//
// Pedagogical, not research: students take part in an RCT they then reflect
// on in an assignment, comparing a traditional mindfulness course with Sense
// Foraging. Minimal data (stress and mood). Opt-out and withdrawal at any time.
//
// Content is Liliana's Study 3 non-reactivity arm, from her script document
// ("Non-Reactivity", linked from the Study 3 Brainstorm doc), with her wording
// kept. Adaptations, all for text delivery:
//   - recorded video/audio → guided_text (one line at a time; quiet stretches
//     end with a soft tone), with each practice about as long as its video;
//   - "allow your eyes to close" → "in the quiet stretches you can close your
//     eyes", since the student has to read;
//   - long sentences split at their natural breaks.
// Liliana's own modules (non-reactivity-*) are untouched: these are copies
// under classrct-nr-* ids, and Study 3 keeps running as it is.
//
// The 28-day calendar spreads her 16 sessions over the Sense Foraging course's
// 28 days: new practices first, then "again" days that repeat earlier ones,
// ending on Graduation. Only the modules below are built so far; CALENDAR marks
// the rest as pending.

const OWL_IN  = 'owl_nonreactivity'
const OWL_OUT = 'owl_love'
const LEAD_OUT = 'You’ve finished today’s practice. Press Next for your closing check-in.'

const base = (day, title, subtitle, minutes, steps, extra = {}) => ({
  module_id: `classrct-nr-d${String(day).padStart(2, '0')}`,
  condition: 'non_reactivity',
  phase: 'phase1',
  lesson: day,
  day_label: `Day ${day}`,
  title,
  subtitle,
  lead_in: {
    owl: OWL_IN,
    text: `Today’s practice takes about ${minutes} minutes. Find a spot where you can sit comfortably, then press Next.`,
  },
  steps,
  lead_out: { owl: OWL_OUT, text: LEAD_OUT },
  ...extra,
})

const q = (quiet, text) => (text ? { quiet, text } : { quiet })

// ── Day 1 · Breath Sensation ──────────────────────────────────────────────────
// The interactive breathing figure (breath_practice), lengthened to about the
// video's 3.8 minutes: 150 s at the student's own rhythm instead of 60.
const d01 = base(1, 'Breath Sensation', 'Stabilizing attention', 4, [
  {
    type: 'breath_practice',
    key: 'breath_sensation',
    label: 'Breath sensation',
    natural_seconds: 150,
    intro_text:
      'This practice takes about four minutes. Sit or lie somewhere comfortable. Keep your eyes open with a soft, relaxed gaze.',
  },
])

// ── Day 2 · Breath Sensation with Labeling ────────────────────────────────────
const LABELING_LINES = [
  { text: 'Welcome to breath awareness and labelling, a practice that can help us become more aware of our breath and mental events.' },
  { text: 'Settle into a comfortable sitting or lying position.' },
  { text: 'Keep a soft gaze. In the quiet stretches, you can let your eyes close.' },
  { text: 'Begin by taking several long, slow, deep breaths, breathing in fully and exhaling fully.' },
  q(15, 'Long, slow breaths.'),
  { text: 'Breathe in through your nose, and out through your nose or mouth.' },
  { text: 'Allow your breath to find its own natural rhythm.' },
  q(10),
  { text: 'Find some aspect of your breath that you can sense, right here, and right now.' },
  { text: 'You may notice each in-breath as it enters your nostrils…' },
  { text: '…the movement of your shoulders, the expansion of your chest, the expansion of your belly.' },
  { text: 'On each out-breath, you may notice your belly and chest contract, your shoulders settle, the air passing back out.' },
  { text: 'Pick a place in your body that feels safe and comfortable to you, and invite your full attention to flow with your breath.' },
  q(20, 'With the breath.'),
  { text: 'If your mind wanders to thoughts, plans, or problems, simply notice your mind wandering.' },
  { text: 'Watch the thought as it enters your awareness, as neutrally as possible.' },
  { text: 'When you notice a thought, silently say: “thinking.”' },
  { text: 'No need to analyze it. No need to push it away.' },
  { text: 'Just label it once: “thinking.” Then gently return to the breath.' },
  q(40, 'The breath. “Thinking,” when a thought comes.'),
  { text: 'Notice that thoughts come and go on their own. You are able to observe them.' },
  { text: 'Our breath is an anchor you can return to, over and over again, when you become distracted by thoughts.' },
  q(40, 'Coming home to the breath.'),
  { text: 'Watch the gentle rise of your stomach on the in-breath, and the relaxing, letting go on the out-breath.' },
  q(30, 'Completely with the breath.'),
]
const LABELING_REFLECTION = {
  type: 'prompt_response',
  size: 'short',
  prompt: 'Did you notice any thoughts or emotions in this process? If so, did labeling change how they felt?',
  example: null,
  example_label: null,
}
const d02 = base(2, 'Breath Sensation with Labeling', 'Meta-awareness; Non-judgemental awareness', 6, [
  {
    type: 'guided_text',
    label: 'Breath awareness and labelling',
    lines: LABELING_LINES,
    close: 'When you’re ready, come back fully alert and awake.',
  },
  LABELING_REFLECTION,
])

// ── Day 3 · Opening Awareness (hand opening) ──────────────────────────────────
const d03 = base(3, 'Opening Awareness', 'Meta-awareness & Acceptance', 5, [
  {
    type: 'guided_text',
    label: 'Hand opening',
    lines: [
      { text: 'Welcome to the hand opening exercise, a practice that can help us release physical, emotional, and mental tension by gently letting go of what we may be holding on to.' },
      { text: 'Settle into a comfortable sitting or lying position.' },
      { text: 'Keep a soft gaze. In the quiet stretches, you can let your eyes close.' },
      { text: 'Take a moment to notice your body as it is right now. There is nothing you need to change.' },
      { text: 'Take a few slow, deep breaths. Breathing in fully. And exhaling fully.' },
      q(12),
      { text: 'Inhale through your nose. Exhale through your nose or your mouth.' },
      { text: 'Allow the breath to gradually settle into its own natural rhythm.' },
      { text: 'Now gently close your hands into a loose fist. Not tight or tense, just gently closed.' },
      { text: 'Notice the sensation of your hands closing. Feel the subtle pressure in your palms and fingers.' },
      q(15, 'Hands closed. Breathing naturally.'),
      { text: 'Do you feel any different as you close your hand into a fist?' },
      { text: 'Harder or softer? More or less curious? More or less ready to take things in?' },
      q(20),
      { text: 'As you sit here, you may notice thoughts appearing. Perhaps plans, memories, or reactions. This is completely natural.' },
      { text: 'When you notice that the mind has wandered, simply acknowledge it. You do not need to do anything with the thought.' },
      { text: 'Then gently release your focus from the mental event by opening your hand.' },
      { text: 'Allow your fingers to slowly unfold. Notice the sensation of the hands opening.' },
      { text: 'You might imagine this movement as creating space. Space for thoughts. Space for sensations. Space for emotions.' },
      { text: 'There is nothing you need to push away. Just allowing.' },
      q(30, 'Hands open. Allowing.'),
      { text: 'Once your attention returns to the breath, gently close your hands again.' },
      { text: 'Perhaps noticing the difference between holding and releasing.' },
      q(35, 'Closing on the breath. Opening when a thought appears.'),
      { text: 'Continue in your own time: holding with the breath, releasing when a thought comes.' },
      q(30),
    ],
    close: 'When you are ready, take one final breath and continue with the rest of your day.',
  },
])

// ── Day 4 · Three-Minute Breathing Space ──────────────────────────────────────
const d04 = base(4, 'Three-Minute Breathing Space', 'Application to a Current Stressor', 6, [
  {
    type: 'guided_text',
    label: 'Three-minute breathing space',
    lines: [
      { text: 'Welcome to the three-minute breathing space, a practice that can be used when we find our thoughts or mood spiralling in a negative direction.' },
      { text: 'Settle into a comfortable position with a soft gaze. In the quiet stretches, you can let your eyes close.' },
      { text: 'Begin by taking several long, slow, deep breaths. In through your nose, out through your nose or mouth.' },
      q(12),
      { text: 'Allow your breath to find its own natural rhythm.' },
      { text: 'Now, if it feels comfortable, gently bring to mind a situation that is currently causing you some stress or tension.' },
      { text: 'Choose something that feels manageable, not overwhelming: perhaps a 3 out of 10 on your personal stress scale, not an 8 or a 9.' },
      q(15, 'Holding the situation lightly.'),
      { text: 'First, become aware of what is present right now.' },
      { text: 'What thoughts are around? See if you can notice these thoughts simply as mental events.' },
      { text: 'You might silently say to yourself, “thinking,” or “there is a thought.”' },
      q(20),
      { text: 'Now notice any feelings that may be present. Perhaps tension, uneasiness, pressure, or frustration.' },
      { text: 'Rather than pushing these feelings away, simply acknowledge them.' },
      q(20),
      { text: 'Now, having acknowledged what is here, collect your awareness on a single act: the movement of the breath.' },
      { text: 'Perhaps noticing the rise and fall of the abdomen as the breath moves in and out. Moment by moment, breath by breath.' },
      { text: 'If the mind drifts back to the stressful situation, gently acknowledge it, and return your attention to the breath.' },
      q(40, 'Let the breath be an anchor.'),
      { text: 'Now, for the third step, allow your awareness to expand. Let the breath remain present, but in the background.' },
      { text: 'Widen your attention to include the whole body, from head to toe.' },
      { text: 'Including any sensations related to the stressful situation. Perhaps areas of tension, holding, or bracing.' },
      q(40, 'Breathing with the body.'),
      { text: 'Holding everything that is here in this broader awareness. Breathing in. Breathing out.' },
      q(20),
    ],
    close: 'Take this sense of awareness with you as you continue with the rest of your day.',
  },
])

// ── Day 5 · Body Scan ─────────────────────────────────────────────────────────
const d05 = base(5, 'Body Scan', 'Stabilizing Attention', 5, [
  {
    type: 'guided_text',
    label: 'Body scan',
    lines: [
      { text: 'Welcome to the body scan, a practice that can help us use the sensations in the body to anchor our awareness in the present moment.' },
      { text: 'Please treat each instruction as an invitation. If a part of the body feels unsafe or uncomfortable, go back to your breath until a more comfortable place is mentioned.' },
      { text: 'Sit comfortably with your feet on the floor and your hands resting in your lap, or lie down if you prefer.' },
      { text: 'Keep a soft gaze. In the quiet stretches, you can let your eyes close.' },
      { text: 'Begin by finding some part of your breath that you can sense, right here and right now.' },
      q(12),
      { text: 'Bring your attention into your body. Notice your feet on the floor.' },
      { text: 'The sensations of your feet touching the floor. The weight and pressure, vibration, and heat.' },
      q(15),
      { text: 'Notice your legs against the chair: pressure, pulsing, heaviness, lightness.' },
      { text: 'Notice your back against the chair.' },
      q(15),
      { text: 'Bring your attention to your stomach. If it is tense or tight, let it soften. Take a breath.' },
      q(12),
      { text: 'Notice your hands. Are they tense or tight? See if you can allow them to soften.' },
      { text: 'Notice your arms. Feel any sensation in your arms. Let your shoulders be soft.' },
      q(15),
      { text: 'Notice your neck and throat. Let them be soft.' },
      { text: 'Soften your jaw. Let your face and facial muscles be soft.' },
      q(15),
      { text: 'Now expand your awareness to include your whole body. Sensing the body as a whole, sitting or lying here.' },
      q(35, 'The whole body.'),
      { text: 'Releasing awareness of the body, go back to your breath. Breathing in. And breathing out.' },
      q(20),
    ],
    close: 'When you feel ready, continue with the rest of your day.',
  },
])

// ── Day 6 · The Five Senses Exercise ──────────────────────────────────────────
// Her structure unchanged (written intro, then each sense and its write-down);
// the five audio clips become short guided pieces that start on their own.
const sense = (label, lines) => ({
  type: 'guided_text', label, autostart: true, lines, close: 'Now write down what you noticed.',
})
const d06 = base(6, 'The Five Senses Exercise', 'Stabilizing Attention', 6, [
  {
    type: 'text',
    content: [
      { tag: 'p', text: 'The exercise below is a quick and simple way to bring your attention back to the present moment, especially on a stressful or busy day.' },
      { tag: 'h3', text: '1. Settle into your position' },
      { tag: 'p', text: 'Sit in a comfortable upright position with your feet planted flat on the ground. Rest your hands on your thighs or on your desk.' },
      { tag: 'h3', text: '2. Notice your breath' },
      { tag: 'p', text: 'Bring your attention to your breath. There is no need to breathe in any particular way. Simply notice each part of the breath: the inhale, the exhale, and the brief pause in between. Allow your breathing to remain natural.' },
      { tag: 'h3', text: '3. Explore the 5 senses' },
      { tag: 'p', text: 'Now bring awareness to each of your five senses. You will focus on one sense at a time. The goal is to simply notice what is present in the moment through each sense. There is no need to judge or analyze what you notice.' },
    ],
  },
  sense('Hearing', [
    { text: 'Begin to notice all of the sounds around you.' },
    { text: 'Try not to judge the sounds, just notice them. They are not good or bad, they just simply exist.' },
    { text: 'Some sounds may come from inside your body, like breathing or subtle movements.' },
    { text: 'Other sounds may come from nearby or from farther away, such as voices, traffic, or distant activity.' },
    q(20, 'Listening.'),
    { text: 'You may begin to notice subtle sounds you did not hear before. Can you hear them now?' },
    q(10),
  ]),
  { type: 'multi_response', size: 'single_line', count: 3, min_required: 3, prompt: 'Take a moment and write down 3 things I can hear:' },
  sense('Smell', [
    { text: 'Now shift your attention to notice the smells of your environment.' },
    { text: 'Maybe you smell food. You might notice the smell of trees or plants if you are outside, or the smell of books or paper.' },
    { text: 'Closing your eyes may help sharpen your attention to smell. Simply notice whatever scent is present.' },
    q(20, 'Smelling.'),
  ]),
  { type: 'multi_response', size: 'single_line', count: 2, min_required: 2, prompt: 'Take a moment and write down 2 things I can smell:' },
  sense('Sight', [
    { text: 'Now bring your attention to what you can see around you.' },
    { text: 'Observe your surroundings and notice the colors, shapes, and textures.' },
    { text: 'Look closely and see if you can notice small details that may have gone unnoticed before.' },
    q(20, 'Looking.'),
  ]),
  { type: 'multi_response', size: 'single_line', count: 5, min_required: 5, prompt: 'Take a moment and write down 5 things I can see:' },
  sense('Taste', [
    { text: 'Now bring awareness to your sense of taste.' },
    { text: 'Even if you do not have food in your mouth, you may notice subtle tastes. Perhaps an aftertaste from a recent drink or meal.' },
    { text: 'You can also notice your tongue in your mouth, your saliva, or the taste of your breath as you exhale.' },
    { text: 'If it helps, gently run your tongue along your teeth or the inside of your cheeks.' },
    q(15, 'Tasting.'),
  ]),
  { type: 'multi_response', size: 'single_line', count: 1, min_required: 1, prompt: 'Take a moment and write down 1 thing I can taste:' },
  sense('Touch', [
    { text: 'Finally, bring attention to the sensations of touch.' },
    { text: 'The sensations of skin contact with your chair, your clothing, and your feet on the floor.' },
    { text: 'The pressure between your feet and the floor, or your body and the chair.' },
    { text: 'You may also explore textures by touching objects around you, such as your desk or items nearby.' },
    q(20, 'Touching.'),
  ]),
  { type: 'multi_response', size: 'single_line', count: 4, min_required: 4, prompt: 'Take a moment and write down 4 things I can touch:' },
])

// ── Day 7 · again: Breath Sensation with Labeling ─────────────────────────────
const d07 = {
  ...d02,
  module_id: 'classrct-nr-d07',
  lesson: 7,
  day_label: 'Day 7 · again',
  lead_in: {
    owl: OWL_IN,
    text: 'Today you return to a practice from Day 2: breath awareness and labelling. About 6 minutes. Find a spot where you can sit comfortably, then press Next.',
  },
}

export const MODULES = { 1: d01, 2: d02, 3: d03, 4: d04, 5: d05, 6: d06, 7: d07 }

// The whole 28 days. `again` names the day whose practice repeats.
export const CALENDAR = [
  { day: 1,  title: 'Breath Sensation' },
  { day: 2,  title: 'Breath Sensation with Labeling' },
  { day: 3,  title: 'Opening Awareness' },
  { day: 4,  title: 'Three-Minute Breathing Space' },
  { day: 5,  title: 'Body Scan' },
  { day: 6,  title: 'The Five Senses Exercise' },
  { day: 7,  title: 'Breath Sensation with Labeling', again: 2 },
  { day: 8,  title: 'Leaves on Stream' },
  { day: 9,  title: 'See, Hear, Feel Practice' },
  { day: 10, title: 'Mountain Meditation' },
  { day: 11, title: 'Lighthouse Meditation' },
  { day: 12, title: 'Three-Minute Breathing Space', again: 4 },
  { day: 13, title: 'Sensory Detective' },
  { day: 14, title: 'Become a Sensory Scientist!' },
  { day: 15, title: 'Leaves on Stream', again: 8 },
  { day: 16, title: 'Mindfulness of an Object' },
  { day: 17, title: 'Guided Body Scan: exploring discomfort' },
  { day: 18, title: 'See, Hear, Feel Practice', again: 9 },
  { day: 19, title: 'Pause Before Reacting' },
  { day: 20, title: 'Mountain Meditation', again: 10 },
  { day: 21, title: 'Sensory Detective', again: 13 },
  { day: 22, title: 'Breath Sensation', again: 1 },
  { day: 23, title: 'Opening Awareness', again: 3 },
  { day: 24, title: 'Lighthouse Meditation', again: 11 },
  { day: 25, title: 'Mindfulness of an Object', again: 16 },
  { day: 26, title: 'Body Scan', again: 5 },
  { day: 27, title: 'Three-Minute Breathing Space', again: 4 },
  { day: 28, title: 'Graduation Day!' },
]
