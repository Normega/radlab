// titleFor.js -- the pure title matcher behind RouteTitle.jsx, split out so
// it can be unit-tested under plain node (the component file is JSX). Named
// titleFor rather than routeTitle because Windows resolves extensionless
// imports case-insensitively: a routeTitle.js would shadow RouteTitle.jsx.
// Nothing else on the site writes document.title.

const DEFAULT = 'RADlab — Regulatory & Affective Dynamics Lab'

const EXACT = {
  '/': DEFAULT,
  '/platform': 'Come, See — RADlab',
  '/games': 'Games — RADlab',
  '/dashboard': 'Dashboard — RADlab',
  '/account': 'Account — RADlab',
  '/settings': 'Account — RADlab',
  '/checkin': 'Check-in — RADlab',
  '/welcome': 'Welcome — RADlab',
  '/login': 'Log in — RADlab',
  '/signup': 'Join — RADlab',
  '/forgot-password': 'Reset password — RADlab',
  '/reset-password': 'Reset password — RADlab',
  '/verified': 'Email verified — RADlab',
  '/lab': 'About the Lab — RADlab',
  '/lab/about': 'About the Lab — RADlab',
  '/lab/people': 'People — RADlab',
  '/lab/research': 'Research — RADlab',
  '/lab/publications': 'Publications — RADlab',
  '/lab/media': 'In the Media — RADlab',
  '/lab/contact': 'Contact — RADlab',
  '/brand': 'Brand Assets — RADlab',
  '/study/join': 'Join a Study — RADlab',
  '/study/signup': 'Sign Up for a Study — RADlab',
  '/study/verify': 'Confirming Your Email — RADlab',
  '/keynote': 'Keynote — RADlab',
  '/talks': 'Talks — RADlab',
}

const GAMES = {
  'pond-watch': 'Pond Watch', 'owl-barn': 'Owl Barn', 'ebb-flow': 'Ebb & Flow',
  'still-water': 'Still Water', 'first-contact': 'First Contact', 'farm-joy': 'Farm Joy',
  'face-read': 'Face Read', 'color-max': 'ColourMax', 'word-max': 'WordMax',
  'breath-belt': 'Breath Belt', 'breath-guardian': 'Breath Guardian',
  'aptitude-suite': 'Aptitude Suite', 'drift': 'Drift', 'delve': 'Delve',
  'tune': 'Tune', 'alongside': 'Alongside', 'sidelong': 'Sidelong',
}

// Longest prefix wins; keep more specific entries above shorter ones.
const PREFIX = [
  ['/academic/admin', 'Academic Admin — RADlab'],
  ['/academic/lecture-lounge/admin', 'Academic Admin — RADlab'],
  ['/lecture-lounge/admin', 'Academic Admin — RADlab'],
  ['/academic/fieldguide', 'Field Guide — RADlab'],
  ['/class/', 'Lecture Lounge — RADlab'],
  ['/workbench', 'Workbench — RADlab'],
  ['/admin', 'Admin — RADlab'],
  ['/dev/', 'Dev — RADlab'],
  ['/demo/', 'Demo — RADlab'],
  ['/ripple', 'My Ripple — RADlab'],
  ['/study/', 'Study — RADlab'],
  ['/s/', 'Session — RADlab'],
]

// Course-scoped academic routes: /academic/:courseCode(/:segment/…). The
// static names that are NOT course codes fall through to PREFIX above.
const ACADEMIC_STATIC = new Set(['admin', 'fieldguide', 'lecture-lounge'])

export function titleFor(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (EXACT[clean]) return EXACT[clean]
  const game = clean.match(/^\/games\/([^/]+)/)
  if (game && GAMES[game[1]]) return `${GAMES[game[1]]} — RADlab`
  const ac = clean.match(/^\/academic\/([^/]+)(?:\/([^/]+))?/)
  if (ac && !ACADEMIC_STATIC.has(ac[1])) {
    const code = ac[1].toUpperCase()
    if (ac[2] === 'lounge') return 'Lecture Lounge — RADlab'
    if (ac[2]) return `${code} Field Guide — RADlab`
    return `${code} — RADlab`
  }
  const hit = PREFIX.find(([p]) => clean.startsWith(p))
  if (hit) return hit[1]
  return DEFAULT
}
