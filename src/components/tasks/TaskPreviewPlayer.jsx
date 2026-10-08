import { lazy, Suspense, useEffect, useMemo } from 'react'
import { makePreviewClient, PREVIEW_ROW_ID } from '../../lib/previewClient'
import { setDemoOverride, DEMO_SECS } from '../../lib/demoMode'

// Plays a task with nothing saved (website.md §25a). Shared by the public
// share-link page (/preview/:token) and the lab's own preview
// (/admin/tasks/preview/:slug), so the lab sees exactly what a recipient sees.
//
// Every game here gets a stub database client that never reaches Supabase.
// Adding a game: it must take `supabaseClient` and use it for every write, and
// must not read data (see previewClient.js); then set previewable in taskRegistry.

const GAMES = {
  aptitude_suite: lazy(() => import('../../games/AptitudeSuite/AptitudeSuite')),
  color_max:      lazy(() => import('../../games/ColorMax/ColorMax')),
  word_max:       lazy(() => import('../../games/WordMax/WordMax')),
}

export default function TaskPreviewPlayer({ slug, name, quickDemo = false }) {
  const client = useMemo(() => makePreviewClient(), [])
  const Game = GAMES[slug]

  // Games read isDemoMode() while rendering, so the override is set before the
  // game's first render, not only in an effect.
  setDemoOverride(quickDemo)
  useEffect(() => {
    setDemoOverride(quickDemo)
    return () => setDemoOverride(false)
  }, [quickDemo])

  if (!Game) {
    return <p style={S.missing}>This task does not have a preview yet.</p>
  }

  return (
    <div style={S.page}>
      <div style={S.banner} role="note">
        <span style={S.tag}>Preview</span>
        <span>
          {name ? `${name}. ` : ''}Nothing you do here is saved.
          {quickDemo ? ` The timer is cut to ${DEMO_SECS} seconds.` : ''}
        </span>
      </div>
      <Suspense fallback={null}>
        <Game supabaseClient={client} userId={PREVIEW_ROW_ID} />
      </Suspense>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  banner: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    padding: '8px 16px',
    background: 'var(--bgp)', borderBottom: '1px solid var(--pkb)',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 14, color: 'var(--tx2)',
  },
  tag: {
    fontFamily: '"Space Mono",monospace', fontSize: 12, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--pkd)',
  },
  missing: {
    padding: 40, textAlign: 'center',
    fontFamily: '"DM Sans",system-ui,sans-serif', fontSize: 16, color: 'var(--tx2)',
  },
}
