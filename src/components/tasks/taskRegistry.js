// What the Task Library (/admin/tasks, website.md §25a) knows about each game
// activity the session builder offers, keyed by activities.subcategory.
//
// The list of tasks itself comes from the database (activities where
// category = 'game'), exactly as the session builder reads it; this file adds
// only what the database does not hold.
//
//   name           — for the public preview page, which cannot read activities
//   route          — the game's own page, which plays it live and saves to the
//                    signed-in account (what /admin/games' "Review" opens)
//   previewable    — has a no-save preview (TaskPreviewPlayer). Only games that
//                    write but never read may be added: the preview's stub
//                    client answers reads with a placeholder row (previewClient.js)
//   timed          — has a session countdown, so a preview can run it short
//   runsInSessions — GameStepWrapper can render it as a study step. Kept equal to
//                    GameStepWrapper's GAME_COMPONENTS by taskRegistry.test.mjs
//   note           — shown on the card

export const TASKS = {
  aptitude_suite: { name: 'Aptitude Suite', route: '/games/aptitude-suite', previewable: true, timed: true, runsInSessions: true },
  color_max:      { name: 'ColorMax', route: '/games/color-max',      previewable: true, timed: true, runsInSessions: true },
  word_max:       { name: 'WordMax', route: '/games/word-max',       previewable: true, timed: true, runsInSessions: true },
  pond_watch:     { name: 'Pond Watch', route: '/games/pond-watch',     runsInSessions: true },
  still_water:    { name: 'Still Water', route: '/games/still-water',    runsInSessions: true },
  breath_belt:    { name: 'Breath Belt', route: '/games/breath-belt',    runsInSessions: true, note: 'Requires Polar H10 belt' },
  drift:          { name: 'Drift', route: '/games/drift' },
  ebb_and_flow:   { name: 'Ebb & Flow', route: '/games/ebb-flow' },
  face_read:      { name: 'Face Read', route: '/games/face-read' },
  farm_joy:       { name: 'Farm Joy', route: '/games/farm-joy' },
  first_contact:  { name: 'First Contact', route: '/games/first-contact' },
  owl_barn:       { name: 'Owl Barn', route: '/safari/owl-barn' },
}

export function taskInfo(slug) {
  return TASKS[slug] ?? {}
}

export const PREVIEWABLE_SLUGS = Object.keys(TASKS).filter(s => TASKS[s].previewable)
