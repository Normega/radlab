import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * RouteTitle — per-route document.title, one central matcher (2026-08-22).
 * With ~140 routes, titles live here rather than in each page: first exact
 * match wins, then the longest matching prefix, else the site default.
 * Fixes six-identical-tabs syndrome; also what browser history shows.
 * Nothing else on the site writes document.title — keep it that way, or a
 * navigation will silently overwrite a page's hand-set title.
 */

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
  ['/academic/lecture-lounge/admin', 'Lecture Lounge Admin — RADlab'],
  ['/lecture-lounge/admin', 'Lecture Lounge Admin — RADlab'],
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

function titleFor(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (EXACT[clean]) return EXACT[clean]
  const game = clean.match(/^\/games\/([^/]+)/)
  if (game && GAMES[game[1]]) return `${GAMES[game[1]]} — RADlab`
  const hit = PREFIX.find(([p]) => clean.startsWith(p))
  if (hit) return hit[1]
  return DEFAULT
}

export default function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => { document.title = titleFor(pathname) }, [pathname])
  return null
}
