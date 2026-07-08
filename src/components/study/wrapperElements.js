// Standard session wrapper elements for Liliana's longitudinal study (Study 3).
//
// Every daily check-in session follows the fixed sequence:
//   Welcome → Check-in (pre) → Practice module → Check-in (post) → Farewell
//
// The practice module comes from `intervention_modules`; the four screens defined
// here are platform-managed and identical across all days and conditions.
// TrainingLibrary renders these definitions directly (▶ Demo), so edits here are
// immediately inspectable at /admin/training.
//
// NOTE: the check-in rating items below are PLACEHOLDERS pending Liliana's final
// item wording. Edit CHECKIN_ITEMS in place — pre and post share the same items
// by design (repeated measure).

export const CHECKIN_ITEMS = [
  {
    id: 'valence',
    prompt: 'How pleasant or unpleasant do you feel right now?',
    min_label: 'Very\nunpleasant',
    max_label: 'Very\npleasant',
  },
  {
    id: 'energy',
    prompt: 'How calm or energized do you feel right now?',
    min_label: 'Very\ncalm',
    max_label: 'Very\nenergized',
  },
  {
    id: 'stress',
    prompt: 'How stressed do you feel right now?',
    min_label: 'Not at all\nstressed',
    max_label: 'Extremely\nstressed',
  },
]

// Progress-bar labels for the 5-slot session sequence (matches InterventionPage).
export const SESSION_SLOT_LABELS = ['Welcome', 'Check-in', 'Practice', 'Check-in', 'Farewell']

// Screen types:
//   { type: 'owl',     owl, text }                       — owl + speech bubble
//   { type: 'ratings', heading, sub, items }             — slider battery; Next
//                                                          unlocks once every
//                                                          slider has been moved
export const WRAPPER_ELEMENTS = [
  {
    key: 'welcome',
    name: 'Welcome',
    slot: 0,
    description: 'Opens every daily session — greets the participant before the pre-practice check-in.',
    screens: [
      {
        type: 'owl',
        owl: 'owl_waving',
        text: "Welcome back! It's time for today's session. Find a quiet spot where you can focus for the next few minutes, then press Next to begin with a quick check-in.",
      },
    ],
    finalButtonLabel: 'Next',
  },
  {
    key: 'checkin_pre',
    name: 'Check-in (pre)',
    slot: 1,
    description: 'Mood ratings taken immediately before the practice module.',
    screens: [
      {
        type: 'ratings',
        heading: 'Before you begin',
        sub: 'Move each slider to show how you feel right now. There are no right or wrong answers.',
        items: CHECKIN_ITEMS,
      },
    ],
    finalButtonLabel: 'Begin practice',
  },
  {
    key: 'checkin_post',
    name: 'Check-in (post)',
    slot: 3,
    description: 'The same ratings repeated immediately after the practice module.',
    screens: [
      {
        type: 'owl',
        owl: 'owl_excited',
        text: 'Nice work today! Before you go, take a moment to check in one more time.',
      },
      {
        type: 'ratings',
        heading: 'After your practice',
        sub: 'Move each slider to show how you feel right now.',
        items: CHECKIN_ITEMS,
      },
    ],
    finalButtonLabel: 'Next',
  },
  {
    key: 'farewell',
    name: 'Farewell',
    slot: 4,
    description: 'Closes the session after the post-practice check-in.',
    screens: [
      {
        type: 'owl',
        owl: 'owl_happy',
        text: "That's everything for today — your responses have been saved. See you tomorrow!",
      },
    ],
    finalButtonLabel: 'Finish',
    finalButtonGreen: true,
  },
]
