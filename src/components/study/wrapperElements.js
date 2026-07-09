// Standard session wrapper elements for Liliana's longitudinal study (Study 3).
//
// Every daily check-in session follows the fixed sequence:
//   Welcome → Check-in (pre) → Practice module → Check-in (post) → Farewell
//
// The practice module comes from `intervention_modules`; the check-ins are the
// two canonical VAS packages (managed at /admin/vas — the DB is the source of
// truth; see docs/markdowns/liliana_feedback_spec.md §1):
//   pre  = liliana_pre_intervention_ratings  (sleep, stress)
//   post = liliana_post_intervention_ratings (stress, helpful, enjoyment, effort)
//
// In a real session the check-ins run as their own vas_pkg_* steps around the
// training step (they are not rendered inside the InterventionPage chrome).
// The ▶ Demo at /admin/training fetches the live package contents, so this
// preview cannot drift from what participants actually see.

export const PRE_CHECKIN_PACKAGE_SLUG  = 'liliana_pre_intervention_ratings'
export const POST_CHECKIN_PACKAGE_SLUG = 'liliana_post_intervention_ratings'

// Progress-bar labels for the 5-slot session sequence (matches InterventionPage).
export const SESSION_SLOT_LABELS = ['Welcome', 'Check-in', 'Practice', 'Check-in', 'Farewell']

// Screen types:
//   { type: 'owl',         owl, text }  — owl + speech bubble
//   { type: 'vas_package', slug }       — the live VAS package, rendered with
//                                         the participant-facing VasRenderer
//                                         (previewMode: nothing is saved)
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
    description: 'Sleep + stress ratings taken immediately before the practice module — contents live from the liliana_pre_intervention_ratings package (/admin/vas).',
    screens: [
      { type: 'vas_package', slug: PRE_CHECKIN_PACKAGE_SLUG },
    ],
  },
  {
    key: 'checkin_post',
    name: 'Check-in (post)',
    slot: 3,
    description: 'Stress, helpfulness, enjoyment and effort ratings immediately after the practice module — contents live from the liliana_post_intervention_ratings package (/admin/vas).',
    screens: [
      {
        type: 'owl',
        owl: 'owl_excited',
        text: 'Nice work today! Before you go, take a moment to check in one more time.',
      },
      { type: 'vas_package', slug: POST_CHECKIN_PACKAGE_SLUG },
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
