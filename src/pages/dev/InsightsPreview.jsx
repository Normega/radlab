import { useSearchParams } from 'react-router-dom'
import InsightsWidget from '../../dashboard/InsightsWidget'
import { RippleFace, RippleCard, GAMES_MENU, SelectedGameCard } from '../Dashboard'
import { dayKey } from '../../dashboard/metrics'

/**
 * Dev-only preview of the dashboard Insights widget.
 * Route: /dev/insights-preview?state=rich|sparse|empty
 *
 * Feeds InsightsWidget synthetic check-ins so the states that take months of
 * real use — a filled year, a mixed-feelings streak — can be looked at now.
 * Nothing here touches the database.
 */

const LABELS = ['Good', 'Excited', 'Alert', 'Tense', 'Bad', 'Sad', 'Still', 'Calm']

// Deterministic pseudo-random so the preview does not reshuffle on every render.
function rng(seed) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function makeRows(count, spanDays, seed = 7) {
  const rand = rng(seed)
  const rows = []
  const today = new Date()
  const used = new Set()

  for (let i = 0; i < count; i++) {
    const back = Math.floor(rand() * spanDays)
    if (used.has(back)) continue
    used.add(back)

    const d = new Date(today)
    d.setDate(d.getDate() - back)

    const pos = 1 + Math.floor(rand() * 7)
    const neg = 1 + Math.floor(rand() * 7)
    const pa = (pos - 4) / 3
    const na = (neg - 4) / 3
    // Same composite the check-in flow computes: midpoint of the two diagonal
    // picks. p1 = (pa, pa), p2 = (-na, na).
    const cx = (pa - na) / 2
    const cy = (pa + na) / 2
    const ang = ((Math.atan2(cy, cx) * 180) / Math.PI + 360) % 360
    const label = Math.sqrt(cx * cx + cy * cy) < 0.15 ? 'neutral' : LABELS[Math.round(ang / 45) % 8]

    const hour = [8, 9, 13, 19, 22][Math.floor(rand() * 5)]
    const at = new Date(d)
    at.setHours(hour, 0, 0, 0)

    rows.push({
      local_date: dayKey(d),
      created_at: at.toISOString(),
      pos_rating: pos,
      neg_rating: neg,
      composite_x: cx,
      composite_y: cy,
      composite_label: label,
      intention: rand() > 0.5 ? 'Take one slow walk' : null,
      prev_intention_outcome: rand() > 0.4 ? ['did', 'partly', 'not_today'][Math.floor(rand() * 3)] : null,
    })
  }
  return rows.sort((a, b) => a.local_date.localeCompare(b.local_date))
}

const STATES = {
  rich:   () => makeRows(140, 320, 7),
  sparse: () => makeRows(4, 20, 3),
  empty:  () => [],
}

export default function InsightsPreview() {
  const [params] = useSearchParams()
  if (!import.meta.env.DEV) return <div style={{ padding: 40 }}>Dev only.</div>

  const state  = params.get('state') ?? 'rich'
  const window = params.get('window') ?? 'month'
  const rows   = (STATES[state] ?? STATES.rich)()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '40px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'var(--tx3)', marginBottom: 16 }}>
          /dev/insights-preview · state={state} · window={window} · {rows.length} synthetic check-ins ·{' '}
          <a href="?state=rich" style={{ color: 'var(--pk)' }}>rich</a>{' · '}
          <a href="?state=sparse" style={{ color: 'var(--pk)' }}>sparse</a>{' · '}
          <a href="?state=empty" style={{ color: 'var(--pk)' }}>empty</a>{' · '}
          <a href="?state=rich&window=year" style={{ color: 'var(--pk)' }}>year</a>
        </p>
        {/* Ripple portrait left of the check-in info, as it sits on the dashboard.
            One per mood sector, so every face the lookup can produce is visible
            at a glance rather than only whichever mood the previewer last felt. */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {['Good', 'Excited', 'Alert', 'Tense', 'Bad', 'Sad', 'Still', 'Calm', 'neutral'].map(label => (
            <div key={label} style={{ textAlign: 'center' }}>
              <RippleFace
                size={78}
                devAvatar={{ skin_color: '#FDBCB4', eye_color: '#4A90D9', species: 'human' }}
                last={{ composite_label: label, composite_x: 0.6, composite_y: 0.6 }}
              />
              <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 9, color: 'var(--tx3)', marginTop: 4, textTransform: 'uppercase' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* The assembled Ripple card as it sits above the widget on /dashboard. */}
        <div style={{ marginBottom: 24 }}>
          {/* Newest-first, matching the real query's ordering — RippleCard reads
              checkins[0] as "latest" and derives most-often from the whole set,
              so handing it ascending rows or a single row would preview a card
              that cannot exist. */}
          <RippleCard devState={{
            ripple: { name: 'Pickles', streak_current: 4, last_checkin_on: rows.at(-1)?.local_date ?? null },
            checkins: [...rows].reverse(),
          }} />
        </div>

        {/* games/renderGame with no userId: each game card shows its empty /
            description state — enough to eyeball the folded Games tab layout.
            ?view=games opens on the Games tab (headless screenshots can't click). */}
        <InsightsWidget
          devRows={rows}
          initialWindow={window}
          initialView={params.get('view') === 'games' ? 'games' : 'checkins'}
          games={GAMES_MENU}
          renderGame={id => <SelectedGameCard game={id} userId={null} />}
        />
      </div>
    </div>
  )
}
