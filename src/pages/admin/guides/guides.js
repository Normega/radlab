// Lab guides: how-to pages for lab members, at /admin/guides (lab role only).
//
// Each guide is a markdown file in ./content, loaded only when its page opens.
// A line of the form `::figure name::` places a figure from the guide's figure
// module. The repository is public, so a guide never holds a password, a
// lockbox code, a participant ID or a link to a private document: those stay in
// the Google Doc that holds the log sheet.
export const GUIDES = [
  {
    slug: 'breathbelt',
    title: 'BreathBelt: running a session',
    summary: 'Setting up the Biopac rigs, choosing the left or right computer, and reading the trigger staircase.',
    updated: '2026-11-10',
    load: () => import('./content/breathbelt.md?raw').then(m => m.default),
    figures: () => import('./figures/BreathBeltFigures.jsx').then(m => m.FIGURES),
  },
]

export const findGuide = slug => GUIDES.find(g => g.slug === slug)
