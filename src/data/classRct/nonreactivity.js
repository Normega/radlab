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
// ending on Graduation. Every day is built; "again" days reuse the practice they
// name, with their own id and lead-in.
//
// Lead-in lengths ("about N minutes") are computed from the content, never typed,
// so editing a script cannot leave a stale estimate behind.

import { aboutMinutes, pad } from './shared'

const OWL_IN  = 'owl_nonreactivity'
const OWL_OUT = 'owl_love'
const LEAD_OUT = 'You’ve finished today’s practice. Press Next for your closing check-in.'


// `lead` replaces the default lead-in sentence; "about N minutes" is always added.
const base = (day, title, subtitle, steps, { lead, ...extra } = {}) => {
  return {
    module_id: `classrct-nr-d${pad(day)}`,
    condition: 'non_reactivity',
    phase: 'phase1',
    lesson: day,
    day_label: `Day ${day}`,
    title,
    subtitle,
    lead_in: {
      owl: OWL_IN,
      text: `${lead ?? 'Find a spot where you can sit comfortably.'} ${aboutMinutes(steps)}. Press Next when you’re ready.`,
    },
    steps,
    lead_out: { owl: OWL_OUT, text: LEAD_OUT },
    ...extra,
  }
}

// An "again" day: the same practice, its own id and a lead-in that says so.
const again = (day, from) => ({
  ...from,
  module_id: `classrct-nr-d${pad(day)}`,
  lesson: day,
  day_label: `Day ${day} · again`,
  lead_in: {
    owl: OWL_IN,
    text: `Today you return to a practice from ${from.day_label}: ${from.title}. ${aboutMinutes(from.steps)}. Press Next when you’re ready.`,
  },
})

const q = (quiet, text) => (text ? { quiet, text } : { quiet })

// ── Day 1 · Breath Sensation ──────────────────────────────────────────────────
// The interactive breathing figure (breath_practice), lengthened to about the
// video's 3.8 minutes: 150 s at the student's own rhythm instead of 60.
const d01 = base(1, 'Breath Sensation', 'Stabilizing attention', [
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
const d02 = base(2, 'Breath Sensation with Labeling', 'Meta-awareness; Non-judgemental awareness', [
  {
    type: 'guided_text',
    label: 'Breath awareness and labelling',
    lines: LABELING_LINES,
    close: 'When you’re ready, come back fully alert and awake.',
  },
  LABELING_REFLECTION,
])

// ── Day 3 · Opening Awareness (hand opening) ──────────────────────────────────
const d03 = base(3, 'Opening Awareness', 'Meta-awareness & Acceptance', [
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
const d04 = base(4, 'Three-Minute Breathing Space', 'Application to a Current Stressor', [
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
const d05 = base(5, 'Body Scan', 'Stabilizing Attention', [
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
const d06 = base(6, 'The Five Senses Exercise', 'Stabilizing Attention', [
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

// ── Day 8 · Leaves on Stream ──────────────────────────────────────────────────
const d08 = base(8, 'Leaves on Stream', 'Meta-Awareness, Non-Judgement & Acceptance', [
  {
    type: 'guided_text',
    label: 'Leaves on a stream',
    lines: [
      { text: 'Welcome to leaves on a stream, a practice that can help us observe our thoughts and emotions pass by.' },
      { text: 'Settle into a comfortable position. Keep a soft gaze; in the quiet stretches, you can let your eyes close.' },
      { text: 'Begin by taking several long, slow, deep breaths, breathing in fully and exhaling fully.' },
      q(12),
      { text: 'Breathe in through your nose and out through your nose or mouth. Allow your breath to find its own natural rhythm.' },
      { text: 'Visualize yourself sitting beside a gently flowing stream, with leaves floating along the surface of the water.' },
      q(15, 'The stream, flowing.'),
      { text: 'For the next few minutes, take each thought that enters your mind and place it on a leaf… and let it float by.' },
      { text: 'Do this with each thought: pleasurable, painful, or neutral.' },
      { text: 'Even if you have joyous or enthusiastic thoughts, place them on a leaf and let them float by.' },
      q(30, 'Thoughts on leaves, floating by.'),
      { text: 'If your thoughts momentarily stop, continue to watch the stream. Sooner or later, your thoughts will start up again.' },
      { text: 'Allow the stream to flow at its own pace. Don’t try to speed it up and rush your thoughts along.' },
      { text: 'You’re not trying to rush the leaves along or “get rid” of your thoughts. You are allowing them to come and go at their own pace.' },
      q(30),
      { text: 'If your mind says “This is dumb,” “I’m bored,” or “I’m not doing this right,” recognize that even this is a moment of awareness!' },
      { text: 'Place those thoughts on leaves, too, and let them pass.' },
      q(25),
      { text: 'If a leaf gets stuck, allow it to hang around until it’s ready to float by. If the thought comes up again, watch it float by another time.' },
      { text: 'If a difficult or painful feeling arises, simply acknowledge it. Place it on a leaf, and allow it to float along.' },
      q(35, 'Leaves, floating by.'),
      { text: 'From time to time, your thoughts may hook you and distract you from being fully present in this exercise. This is normal.' },
      { text: 'As soon as you realize that you have become sidetracked, gently bring your attention back to the stream.' },
      q(25),
      { text: 'Breathing in. And breathing out.' },
    ],
    close: 'When you feel ready, continue with the rest of your day.',
  },
])

// ── Day 9 · See, Hear, Feel ───────────────────────────────────────────────────
// Her definitions of the six categories come first as a card to read at leisure;
// the practice itself then runs line by line.
const d09 = base(9, 'See, Hear, Feel Practice', 'Meta-Awareness & Non-Judgement', [
  {
    type: 'text',
    content: [
      { tag: 'p', text: 'Welcome to this guided See, Hear, Feel practice. This is a labeling practice that supports our ability to concentrate by turning towards, rather than away from, ourselves: bringing sensory clarity in the categories of See, Hear, and Feel, and bringing equanimity to whatever sensory experience is present, moment to moment.' },
      { tag: 'h3', text: 'See, Hear, Feel: in and out' },
      { tag: 'p', text: 'See out is what you see externally, or what appears behind closed eyes.' },
      { tag: 'p', text: 'See in is the inner mental screen: images, memories.' },
      { tag: 'p', text: 'Hear out is external sound, the sounds in your environment.' },
      { tag: 'p', text: 'Hear in is inner chatter: thoughts, mental talk.' },
      { tag: 'p', text: 'Feel out is physical sensation: temperature, pressure, movement in the body.' },
      { tag: 'p', text: 'Feel in is the emotional landscape, your inner weather system.' },
    ],
  },
  {
    type: 'guided_text',
    label: 'See, Hear, Feel',
    lines: [
      { text: 'Let’s begin. Sit upright, allowing the spine to be alert yet restful.' },
      { text: 'Soften the shoulders… relax the jaw.' },
      { text: 'Keep a soft gaze; in the quiet stretches, you can let your eyes close. Take a gentle breath out.' },
      { text: 'Now begin noticing what is present in your awareness.' },
      { text: 'Is it See… Hear… or Feel?' },
      { text: 'Gently label it.' },
      { text: 'You don’t need to say “in” or “out.” Just knowing it is there supports clarity.' },
      q(30, 'See… Hear… Feel…'),
      { text: 'Continue at your own pace. Label what stands out.' },
      { text: 'Stay with it for a few seconds. Notice if it fades… stays… shifts… or changes.' },
      { text: 'There is no need to chase what has passed, and no need to create anything new. Simply observing.' },
      q(35, 'See… Hear… Feel…'),
      { text: 'When something else draws your attention, turn toward it. Label it: See, Hear, or Feel.' },
      { text: 'If more than one is present, just choose one. Let curiosity guide you.' },
      q(35),
      { text: 'You may notice pleasant, unpleasant, or neutral experiences. Comfort, or discomfort.' },
      { text: 'Thoughts… sensations… sounds. Notice how experiences arise and pass, expand or contract.' },
      { text: 'Even the most subtle… or even the absence of sensation.' },
      q(40, 'See… Hear… Feel…'),
      { text: 'As you prepare to end your practice, notice this awareness of your experience through See, Hear, and Feel.' },
      { text: 'Notice your ability to turn toward experience with clarity and equanimity.' },
      { text: 'Allow this awareness to stay with you as you move into the rest of your day.' },
      { text: 'Gently wiggle your fingers and toes.' },
    ],
    close: 'May you carry this awareness with a sense of ease and kindness. Thank you.',
  },
])

// ── Day 10 · Mountain Meditation ──────────────────────────────────────────────
const d10 = base(10, 'Mountain Meditation', 'Deidentification', [
  {
    type: 'guided_text',
    label: 'Mountain meditation',
    lines: [
      { text: 'Welcome to the mountain meditation, a practice that can encourage inner stability, where our thoughts and emotions are not part of our self-identity.' },
      { text: 'Settle into a comfortable position. Keep a soft gaze; in the quiet stretches, you can let your eyes close.' },
      { text: 'Begin by taking several long, slow, deep breaths, breathing in fully and exhaling fully.' },
      q(12),
      { text: 'Breathe in through your nose and out through your nose or mouth. Allow your breath to find its own natural rhythm.' },
      { text: 'Begin to let an image form in your mind’s eye of the most magnificent mountain that you know of, or that you’ve seen, or that you can imagine.' },
      { text: 'Allow it to come into greater focus. Notice how massive this mountain is. How solid. Unmoving.' },
      q(20, 'The mountain.'),
      { text: 'As you observe this mountain, note its qualities.' },
      { text: 'There may be streams and waterfalls cascading down the slopes. Perhaps trees. Or maybe there are meadows and lakes.' },
      q(20),
      { text: 'With each breath, as you continue to sit, you become more like this mountain.' },
      { text: 'Alive and vital. Unwavering in your inner stillness. A centered, grounded, and unmoving presence.' },
      q(25, 'Sitting like the mountain.'),
      { text: 'As the mountain sits, it experiences how night follows day, and day follows night.' },
      { text: 'It remains still as the seasons flow into one another, and as the weather changes moment by moment and day by day.' },
      { text: 'The mountain remains at all times its essential self. Clouds may come and go. Tourists may visit, or not.' },
      { text: 'The mountain’s existence and beauty are not changed one bit by whether people see it or not. It simply sits.' },
      q(25),
      { text: 'At times the mountain is visited by violent storms.' },
      { text: 'But through it all, the mountain sits. Unmoved by the weather. Unmoved by what happens on its surface.' },
      { text: 'It remains its essential self through all of the seasons.' },
      q(30, 'The mountain sits.'),
      { text: 'As we sit in meditation, we can learn to experience how it feels to be the mountain.' },
      { text: 'We can embody the same unwavering stillness and groundedness in the face of everything that changes in our own lives.' },
      q(20),
      { text: 'Take one more slow breath. Breathing in. And breathing out.' },
    ],
    close: 'When you feel ready, continue with the rest of your day.',
  },
])

// ── Day 11 · Lighthouse Meditation ────────────────────────────────────────────
const d11 = base(11, 'Lighthouse Meditation', 'Deidentification', [
  {
    type: 'guided_text',
    label: 'Lighthouse meditation',
    lines: [
      { text: 'Welcome to the lighthouse meditation.' },
      { text: 'This practice invites you to notice that thoughts and emotions may come and go, like changing weather, while a deeper part of you can remain steady and stable.' },
      { text: 'Settle into a comfortable position. Keep a soft gaze; in the quiet stretches, you can let your eyes close.' },
      { text: 'Begin by taking several long, slow, deep breaths, breathing in fully and exhaling fully.' },
      q(12),
      { text: 'Breathe in through your nose and out through your nose or mouth. Allow your breath to find its own natural rhythm.' },
      { text: 'Now imagine that you are out at sea in a small boat. Around you, a storm begins to form.' },
      { text: 'The wind picks up. Waves rise and fall. The boat moves with the motion of the water.' },
      q(15),
      { text: 'Notice how storms can feel intense and unpredictable.' },
      { text: 'In the same way, our thoughts and emotions can sometimes feel like powerful waves. They rise, they move, and they change.' },
      q(15),
      { text: 'Now, in the distance, you notice a steady light. A lighthouse standing firmly on solid ground.' },
      { text: 'While the storm moves around it, the lighthouse remains stable. Its light shines calmly across the water, guiding the way.' },
      { text: 'Imagine that this lighthouse represents a stable place within you.' },
      q(20, 'The lighthouse.'),
      { text: 'Thoughts may come. Emotions may rise like waves.' },
      { text: 'But like the lighthouse, there is also a part of you that can remain steady, simply observing.' },
      { text: 'The storm moves around it, yet the lighthouse stays grounded and strong.' },
      q(20),
      { text: 'For a few moments, allow yourself to rest with this image.' },
      q(30, 'The waves may rise and fall. But the lighthouse continues to shine.'),
      { text: 'Stable. Steady. Unmoved by the passing storm.' },
      q(15),
      { text: 'Now gently allow the image of the lighthouse to fade. Bring your attention back to your breathing.' },
      { text: 'Notice the movement of the breath in the body. Feel where your body is supported by the surface beneath you.' },
      { text: 'Begin to notice the sounds around you.' },
      q(10),
    ],
    close: 'Take one more slow breath in… and out. And carry this sense of inner steadiness with you as you continue your day.',
  },
])

// ── Day 13 · Sensory Detective ────────────────────────────────────────────────
const d13 = base(13, 'Sensory Detective', 'Curiosity', [
  {
    type: 'guided_text',
    label: 'Sensory detective',
    lines: [
      { text: 'Welcome to the sensory detective meditation.' },
      { text: 'In this practice, you will explore your experience with curiosity, noticing sensations, thoughts, and feelings as they appear, without trying to change or solve them.' },
      { text: 'Like a detective, the goal is simply to observe and investigate, gently and with interest.' },
      { text: 'Settle into a comfortable position. Keep a soft gaze; in the quiet stretches, you can let your eyes close.' },
      { text: 'Begin by taking several long, slow, deep breaths, breathing in fully and exhaling fully.' },
      q(12),
      { text: 'Breathe in through your nose and out through your nose or mouth. Allow your breath to find its own natural rhythm.' },
      { text: 'Now choose one physical sensation in the body.' },
      { text: 'This might be the air moving through your nose, the pressure of your feet on the floor, or the temperature on your skin.' },
      { text: 'Let your attention gently zoom in on that sensation. And begin to explore it with curiosity.' },
      q(20),
      { text: 'You might ask yourself: Is it steady, or does it change?' },
      q(15),
      { text: 'Is it sharp, or soft? Is it moving, or still?' },
      q(20),
      { text: 'There is nothing to fix or change. Just observing.' },
      q(20, 'Investigating.'),
      { text: 'Now allow your attention to widen slightly. Notice if a thought or feeling is present.' },
      { text: 'You don’t need to search. Simply notice what is already here. If something appears, gently investigate it.' },
      q(15),
      { text: 'Is it words, or images? Is it fast, or slow? Is it loud, or quiet?' },
      q(15),
      { text: 'Does it feel tight, or spacious in the body?' },
      q(20),
      { text: 'Simply noticing. Curious observation. No solving. No judging. No pushing away.' },
      { text: 'Just allowing the experience to be present while you observe it.' },
      q(25),
      { text: 'Now gently bring your attention back to your breathing. Notice the natural rhythm of the breath.' },
      { text: 'Feel your body supported by the surface beneath you.' },
      q(10),
    ],
    close: 'Take one more slow breath in… and out. When you feel ready, continue with the rest of your day.',
  },
])

// ── Day 14 · Become a Sensory Scientist! ──────────────────────────────────────
// Already a written exercise: copied from non-reactivity-phase2-day8 as it runs
// in Study 3.
const d14 = base(14, 'Become a Sensory Scientist!', 'Curiosity', [
  {
    type: 'prompt_response',
    size: 'single_line',
    prompt: 'Step 1: Select an experience. This could be: a body sensation, a thought, an emotion or feeling. Write a short phrase describing what you noticed.',
    example: '"tightness in chest"\n"thinking about coursework."\n"warm feeling in hands"',
    example_label: 'For example:',
  },
  {
    type: 'text',
    content: [
      { tag: 'h3', text: 'Step 2: Investigate the Qualities' },
      { tag: 'p', text: 'Now gently bring your attention to this experience. If comfortable, you may close your eyes. Observe it closely, like a scientist examining a sample. You are only noticing qualities, not explaining the experience.' },
    ],
  },
  { type: 'prompt_response', size: 'single_line', prompt: 'Where do you notice it most strongly?', example: null, example_label: null },
  {
    type: 'quality_explorer',
    instruction: 'Please explore the qualities below by clicking on them. Each time you click, a different slider will appear for that quality. When you find one that helps you to describe your experience, rate your experience using the slider. You will then be asked to describe that quality in your own words.',
    describe_prompt: 'Describe this quality in your own words. Just simple descriptors — no sentences needed.',
    qualities: [
      { label: 'Hardness',    min_label: 'Hard',                max_label: 'Soft' },
      { label: 'Weight',      min_label: 'Heavy',               max_label: 'Light' },
      { label: 'Texture',     min_label: 'Rough',               max_label: 'Smooth' },
      { label: 'Motion',      min_label: 'Still',               max_label: 'Flowing' },
      { label: 'Temperature', min_label: 'Cool',                max_label: 'Warm' },
      { label: 'Energy',      min_label: 'Low energy',          max_label: 'Energized' },
      { label: 'Space',       min_label: 'Tight / Constricted', max_label: 'Open / Spacious' },
      { label: 'Distance',    min_label: 'Close / Immediate',   max_label: 'Distant / Far away' },
      { label: 'Time',        min_label: 'Constant',            max_label: 'Changing' },
      { label: 'Sharpness',   min_label: 'Dull',                max_label: 'Sharp' },
      { label: 'Clarity',     min_label: 'Fuzzy / Unclear',     max_label: 'Clear / Distinct' },
      { label: 'Intensity',   min_label: 'Subtle',              max_label: 'Strong' },
    ],
  },
  {
    type: 'prompt_response',
    size: 'short',
    heading: 'Step 3: Notice Commentary',
    preamble: 'Sometimes the mind adds commentary while we observe. For example: "I don\'t like this." "This shouldn\'t be happening." "Why is this here?"',
    prompt: 'If any commentary appears, simply note it. You don\'t need to stop it or correct it. Just include it as data. If nothing appears simply write N/A.',
    example: null,
    example_label: null,
  },
  {
    type: 'timer',
    heading: 'Step 4: Watch for Change',
    instruction: 'Observe the experience quietly for 30 seconds. Simply watch. Then check the option that best fits what you noticed.',
    duration_seconds: 30,
  },
  { type: 'training_response', prompt: 'Did the experience change?', options: ['No', 'Slight', 'Noticeable'] },
  { type: 'prompt_response', size: 'short', prompt: 'Optional: What shifted (if anything)?', required: false, example: null, example_label: null },
  {
    type: 'prompt_response',
    size: 'short',
    prompt: 'Step 5: Closing Reflection. Complete the sentence:\n\nI observed __________________ without trying to change it.',
    example: null,
    example_label: null,
  },
  {
    type: 'closing',
    content: [
      { tag: 'p', text: 'Experiences can be studied. They can be described. They can change on their own. Curiosity creates space.' },
      { tag: 'p', text: 'For the rest of today, if something arises, see if you can approach it the same way: Not as a problem to solve, but as data to observe.' },
      { tag: 'p', text: 'Enjoy the rest of your day.' },
    ],
  },
], { lead: 'Today’s practice is a written exercise. You’ll take on the role of a sensory scientist, observing your own experience with curiosity and collecting data about what you notice.' })

// ── Day 16 · Mindfulness of an Object ─────────────────────────────────────────
const d16 = base(16, 'Mindfulness of an Object', 'Exploring visual/tactile senses', [
  {
    type: 'guided_text',
    label: 'Mindfulness of an object',
    lines: [
      { text: 'Welcome to mindfulness of an object. In this practice, you will gently focus your attention on a simple object.' },
      { text: 'Take a moment to find a small, neutral object, such as a stone, a pen, a key, or a piece of jewelry.', seconds: 14 },
      { text: 'Once you have it, find a comfortable seated position. Pick up the object and hold it gently in your hands.' },
      { text: 'Take a slow breath in… and slowly breathe out. Again, breathing in… and breathing out. Allow your body to settle.' },
      { text: 'In the quiet stretch that follows, if comfortable, close your eyes. Notice the weight of the object in your hands.' },
      q(20, 'The weight of it.'),
      { text: 'Feel the temperature, perhaps cool, or warm.' },
      { text: 'Gently move your fingers across the surface. Is it smooth or rough? Soft or firm?' },
      q(25, 'Simply noticing the sensations of touch.'),
      { text: 'You may notice the mind wanting to move on, judge the experience, or lose interest.' },
      { text: 'Instead of reacting automatically, simply pause and observe. See what happens when you stay with the experience for another moment.' },
      q(20),
      { text: 'Now look at the object. Imagine you are seeing it for the very first time.' },
      { text: 'Notice its shape, color, and edges. Are there small details you hadn’t noticed before?' },
      q(20, 'Looking.'),
      { text: 'Allow your eyes to explore the object slowly. If your mind wanders, gently bring your attention back to the object.' },
      { text: 'Each return is a small moment of responding with awareness, rather than reacting automatically.' },
      q(20),
      { text: 'Now continue observing while holding the object. Notice both what you see and what you feel.' },
      { text: 'Perhaps you notice new textures, or small changes in how the object appears.' },
      { text: 'Just observing. No judging. No labeling. Just noticing.' },
      q(25),
      { text: 'Now gently bring your attention back to your breathing. Take one more slow breath in… and out.' },
    ],
    close: 'Carry this practice with you, remembering that when an experience arises, you can pause, observe, and respond with awareness rather than react automatically.',
  },
], { lead: 'You’ll need a small, neutral object for today’s practice: a stone, a pen, a key, or a piece of jewelry. Have it nearby.' })

// ── Day 17 · Guided Body Scan: exploring discomfort ───────────────────────────
const d17 = base(17, 'Guided Body Scan', 'Exploring discomfort', [
  {
    type: 'guided_text',
    label: 'Guided body scan',
    lines: [
      { text: 'Welcome to the guided body scan.' },
      { text: 'In this practice, you will gently bring awareness to a place in the body that feels mildly uncomfortable or imperfect, while staying within a sense of safety.' },
      { text: 'Sit comfortably with your feet on the floor and your hands resting in your lap, or lie down if you prefer.' },
      { text: 'Keep a soft gaze. In the quiet stretches, you can let your eyes close.' },
      q(12),
      { text: 'Now gently bring your attention to a place in your body that feels slightly uncomfortable or imperfect.' },
      { text: 'Perhaps a place that feels tight, tense, or simply not your favorite part of your body.' },
      { text: 'Choose a place that still feels safe to observe, not overwhelming. If nothing stands out, that’s okay: you can simply choose any area of the body.' },
      q(15),
      { text: 'Now just notice what is present there. Without judging. Without trying to change anything.' },
      { text: 'You might imagine the breath traveling gently to this place as you breathe in… and softening as you breathe out.' },
      q(25, 'Breathing with this place.'),
      { text: 'See if you can become curious about the sensations here.' },
      { text: 'Perhaps you notice pressure, warmth, tightness, or movement. Perhaps you notice very little at all. All experiences are welcome.' },
      q(20, 'Simply observing.'),
      { text: 'You may also notice the mind reacting. Perhaps thoughts like: “I don’t like this.” “This should go away.”' },
      { text: 'Just notice that reaction. Pause for a moment. And return your attention to the sensations.' },
      { text: 'Each time you pause like this, you are practicing responding rather than reacting.' },
      q(25),
      { text: 'Now see what happens when you stay with the sensation a little longer.' },
      { text: 'Does anything shift? Do new sensations appear?' },
      q(20),
      { text: 'Sometimes when we keep observing, we notice more than the first reaction. And when we notice more, we have more choice in how we respond.' },
      q(25, 'Just breathing. Observing. Allowing sensations to rise and fall.'),
      { text: 'Now expand your awareness to include your whole body. Sensing the body as a whole, sitting or lying here.' },
      q(15),
      { text: 'Take one more slow breath. Breathing in. And breathing out.' },
    ],
    close: 'Carry this practice with you, remembering that when discomfort appears, you can pause, observe, and respond with awareness rather than react automatically.',
  },
])

// ── Day 19 · Pause Before Reacting ────────────────────────────────────────────
// Already a written exercise: copied from non-reactivity-phase2-day11.
const d19 = base(19, 'Pause Before Reacting', 'Preparing for a Future Stressor', [
  {
    type: 'text',
    content: [
      { tag: 'p', text: 'Stressful situations often repeat themselves, and often our first reaction happens fast — before we even realize it!' },
      { tag: 'p', text: 'The goal of this exercise is to help you prepare for the next time stress, discomfort, or strong emotion arises. Instead of reacting immediately, you will practice imagining how you might pause, observe what is happening, and choose how you want to respond.' },
    ],
  },
  {
    type: 'prompt_response', size: 'short',
    prompt: 'Think of a situation that tends to create some stress, discomfort, or strong emotion for you. Choose something that feels meaningful, but not overwhelming. What situation came to mind?',
    example: 'Upcoming deadlines, social situations and relationships, academic pressure, receiving feedback, etc.',
    example_label: 'For example:',
  },
  {
    type: 'prompt_response', size: 'short',
    prompt: 'When this situation happens, what is your usual automatic reaction?',
    example: 'Overthinking, shutting down, procrastination, rushing, becoming defensive, self-criticism, reacting emotionally right away, etc.',
    example_label: 'For example:',
  },
  {
    type: 'prompt_response', size: 'short',
    prompt: 'When this situation happens, what do you usually notice first in your body or mind?',
    example: 'Tightness in the chest, tension on your shoulders, heat in your face, worry, an urge to escape, racing thoughts, replaying conversations in your head, etc.',
    example_label: 'For example:',
  },
  {
    type: 'text',
    content: [
      { tag: 'p', text: 'Now imagine this situation happening again. Instead of reacting right away, imagine taking one small pause. If you stayed curious for a few seconds longer, what else might you notice? Did the feeling change? Did it stay the same? Is there another thought, sensation, or urge? Remember, there is no right answer.' },
    ],
  },
  { type: 'prompt_response', size: 'short', prompt: 'What do you think you might notice if you paused before reacting?', example: null, example_label: null },
  {
    type: 'text',
    content: [
      { tag: 'h3', text: 'Step 5: Build Your Response Plan' },
      { tag: 'p', text: 'Now use what you wrote to create a simple plan for next time. Try starting with:' },
      { tag: 'p', text: '"When I notice ________, I will ________ before responding."' },
      { tag: 'p', text: '"When I notice myself getting overwhelmed, I will take one slow breath before responding."\n"When I notice racing thoughts, I will pause and observe them before responding."\n"When I notice tension in my body, I will remind myself that I do not have to react immediately before responding."' },
    ],
  },
  { type: 'prompt_response', size: 'short', prompt: 'Complete the sentence:\n\nWhen I notice ________, I will ________ before reacting.', example: null, example_label: null },
  {
    type: 'closing',
    content: [
      { tag: 'p', text: 'Non-reactivity does not mean suppressing emotions or ignoring problems. It means creating a small space between experience and reaction.' },
      { tag: 'p', text: 'Sometimes, when we pause and observe, we notice more than our first impulse. When we notice more, we often have more choice in how and whether we respond.' },
    ],
  },
], { lead: 'Today’s practice is a written exercise. You’ll reflect on a recurring stressful situation and build a simple plan for pausing before you react.' })

// ── Day 28 · Graduation Day! ──────────────────────────────────────────────────
// Copied from non-reactivity-phase2-day12, show_if branching included. The
// class's shared end-of-course questions (the same in both arms) are added when
// the study is configured, not here.
const WILL = { key: 'will_practice', equals: 'Yes' }
const d28 = base(28, 'Graduation Day!', 'Reflection & Intention Setting', [
  { type: 'prompt_response', size: 'short', prompt: 'Which mindfulness skills or practices stood out most to you during these exercises?', example: null, example_label: null },
  { type: 'prompt_response', size: 'short', prompt: 'Which practices or skills felt most helpful for you? Why?', example: null, example_label: null },
  { type: 'prompt_response', size: 'short', prompt: 'Were there any exercises that felt less helpful or more difficult to engage with?', example: null, example_label: null },
  { type: 'prompt_response', size: 'short', prompt: 'Did any of these practices change how you relate to your thoughts, emotions, or body sensations?', example: null, example_label: null },
  { type: 'prompt_response', size: 'short', prompt: 'Are there situations in your daily life where stress or strong emotions tend to arise in predictable ways? If so, what intention could you set for yourself in those moments?', example: null, example_label: null },
  { type: 'training_response', key: 'will_practice', prompt: 'Do you think you will use any of these practices in your everyday life?', options: ['Yes', 'No'] },
  {
    type: 'slider', min: 1, max: 6, show_if: WILL,
    prompt: 'How likely are you to use any of these practices in your everyday life?',
    min_label: 'Rarely', max_label: 'Almost always',
    point_labels: ['Rarely', 'Occasionally', 'Sometimes', 'Often', 'Very often', 'Almost always'],
  },
  { type: 'prompt_response', size: 'short', show_if: WILL, prompt: 'When will you practice? How often?', example: null, example_label: null },
  { type: 'prompt_response', size: 'short', show_if: WILL, prompt: 'Where will you practice?', example: null, example_label: null },
  { type: 'prompt_response', size: 'short', show_if: WILL, prompt: 'What\'s the biggest barrier you anticipate to practicing?', example: null, example_label: null },
  { type: 'prompt_response', size: 'short', show_if: WILL, prompt: 'How can you overcome this barrier?', example: null, example_label: null },
  { type: 'prompt_response', size: 'short', required: false, prompt: 'Do you have any additional comments about your experience with these exercises?', example: null, example_label: null },
  {
    type: 'closing',
    owl: 'Owl_graduation.png',
    content: [
      { tag: 'p', text: 'Mindfulness is not about eliminating difficult thoughts or emotions.' },
      { tag: 'p', text: 'Rather, it is about learning to notice them without judgment, recognizing that you are more than your experiences. With curiosity and gentle awareness, you can observe thoughts and emotions as they arise, without needing to become defined by them.' },
      { tag: 'p', text: 'Over time, this practice can help you respond with awareness rather than react automatically.' },
      { tag: 'p', text: 'Even small moments of pausing, breathing, and observing can create space for new responses.' },
      { tag: 'p', text: 'Thank you for taking part in these practices.' },
    ],
  },
], { lead: 'It’s Graduation Day! Congratulations on reaching the final day of this program. You did it! Today, you will take a few minutes to reflect on your experience with these practices.' })

// ── "Again" days ──────────────────────────────────────────────────────────────
const d07 = again(7, d02)
const d12 = again(12, d04)
const d15 = again(15, d08)
const d18 = again(18, d09)
const d20 = again(20, d10)
const d21 = again(21, d13)
const d22 = again(22, d01)
const d23 = again(23, d03)
const d24 = again(24, d11)
const d25 = again(25, d16)
const d26 = again(26, d05)
const d27 = again(27, d04)

export const MODULES = {
  1: d01, 2: d02, 3: d03, 4: d04, 5: d05, 6: d06, 7: d07,
  8: d08, 9: d09, 10: d10, 11: d11, 12: d12, 13: d13, 14: d14,
  15: d15, 16: d16, 17: d17, 18: d18, 19: d19, 20: d20, 21: d21,
  22: d22, 23: d23, 24: d24, 25: d25, 26: d26, 27: d27, 28: d28,
}

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
