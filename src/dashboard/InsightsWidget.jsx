import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  WINDOWS, windowById, emotionSummary, takeHome, SECTORS, SECTOR_COLOR,
} from './metrics'

// ── InsightsWidget ────────────────────────────────────────────────────────────
// Simplified 2026-08-15 (Norm: "much too cluttered"). Two elements only:
//
//   1. A take-home sentence — are we getting good check-in data, and where has
//      the mood been heading. This LEADS; the graphic supports it.
//   2. The circumplex history — check-ins dotted on the mood wheel,
//      recency-weighted (recent = bigger, more solid) with a trajectory trail
//      through the latest few, so the sense of movement around the circle is
//      visible at a glance.
//
// Cut in the simplification: the PA/NA gauges, mixed-feelings and volatility
// meters, calendar heat strip, intention follow-through, time-of-day bars, and
// the three announced-empty category tabs (Body/Attention/Values). The tab row
// returns when a second tab has real content (the planned By-game panel).
//
// Everything is computed client-side from the user's own rows: no view, no
// migration, no RLS change. The take-home sentence deliberately ignores the
// time filter (its windows are fixed — see takeHome in metrics.js); the filter
// scopes the wheel and the small stats.

// devRows: DEV-only escape hatch for /dev/insights-preview — supplies synthetic
// check-ins so every state can be eyeballed without an account with history.
//
// games + renderGame (2026-08-16, Norm: "fold games completely into the same
// card"): when provided, the nav grows a Check-ins | Games tab pair, and the
// Games tab renders renderGame(selectedId) — one game at a time, picked from a
// dropdown that replaces the time filter on that tab. The game card components
// stay owned by Dashboard.jsx; the `.embedded-game-card` wrapper (index.css)
// flattens their own card chrome since this widget already supplies it.
export default function InsightsWidget({ userId, devRows, initialWindow = 'month', initialView = 'checkins', games = null, renderGame = null }) {
  const [view,     setView]     = useState(initialView)
  const [gameId,   setGameId]   = useState(games?.[0]?.id ?? null)
  const [windowId, setWindowId] = useState(initialWindow)
  const [fetched,  setFetched]  = useState(null)
  const [streak,   setStreak]   = useState(null)

  const checkins = devRows ?? fetched
  const hasGames = !!(games?.length && renderGame)
  const gamesView = hasGames && view === 'games'

  useEffect(() => {
    if (devRows || !userId) return
    supabase
      .from('ripple_checkins')
      .select('local_date, created_at, pos_rating, neg_rating, composite_x, composite_y, composite_label, intention, prev_intention_outcome')
      .eq('user_id', userId)
      .order('local_date', { ascending: true })
      .limit(1000)
      .then(({ data }) => setFetched(data ?? []))

    supabase.from('ripples')
      .select('streak_current')
      .eq('user_id', userId).maybeSingle()
      .then(({ data }) => setStreak(data?.streak_current ?? 0))
  }, [userId, devRows])

  return (
    <div style={S.widget}>
      <div style={S.nav}>
        {hasGames ? (
          <div style={S.tabRow}>
            <button onClick={() => setView('checkins')} style={{ ...S.tab, ...(view === 'checkins' ? S.tabActive : {}) }}>
              Check-ins
            </button>
            <button onClick={() => setView('games')} style={{ ...S.tab, ...(view === 'games' ? S.tabActive : {}) }}>
              Games
            </button>
          </div>
        ) : (
          <p style={S.navLabel}>Your check-ins</p>
        )}
        {gamesView
          ? <Picker options={games} value={gameId} onChange={setGameId} />
          : <TimeFilter value={windowId} onChange={setWindowId} />}
      </div>
      {gamesView ? (
        <div className="embedded-game-card">{renderGame(gameId)}</div>
      ) : (
        <div style={S.body}>
          <EmotionBody checkins={checkins} windowId={windowId} streak={streak} />
        </div>
      )}
    </div>
  )
}

// ── Time filter ───────────────────────────────────────────────────────────────

function TimeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={S.filterBtn}>
        {windowById(value).label} <span style={{ opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <div style={S.filterMenu}>
          {WINDOWS.map(w => (
            <button
              key={w.id}
              onClick={() => { onChange(w.id); setOpen(false) }}
              style={{ ...S.filterItem, color: w.id === value ? 'var(--pk)' : 'var(--tx2)' }}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Generic picker ────────────────────────────────────────────────────────────
// Same dropdown chrome as TimeFilter, for arbitrary {id, label} options — the
// Games tab's selector.

function Picker({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = options.find(o => o.id === value)

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={S.filterBtn}>
        {current?.label ?? '—'} <span style={{ opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <div style={S.filterMenu}>
          {options.map(o => (
            <button
              key={o.id}
              onClick={() => { onChange(o.id); setOpen(false) }}
              style={{ ...S.filterItem, color: o.id === value ? 'var(--pk)' : 'var(--tx2)' }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Take-home sentence ────────────────────────────────────────────────────────
// Copy register: non-striving, non-punitive — but DEFINITIVE (Norm,
// 2026-08-15): no hedges like "fairly" / "mostly" / "now and then". The
// consistency clause states the actual count; the mood clause commits to one
// of five readings. A quiet stretch is still stated as a fact with an open
// door, never as a failing.

function takeHomeSentence(th) {
  // Brand-new: not enough to characterize anything yet.
  if (th.total < 3) {
    return 'You’re just getting started — a few more check-ins and your patterns will show.'
  }

  // Nothing in two weeks: consistency is the whole story; a mood clause built
  // on month-old data would pretend a currency it doesn't have.
  if (th.days14 === 0) {
    return 'It’s been quiet here lately — your Ripple picks up wherever you left off.'
  }

  const n = th.days14
  const consistency =
    n >= 9 ? `You’ve checked in ${n} of the last 14 days — a steady rhythm` :
    n >= 4 ? `You’ve checked in ${n} of the last 14 days` :
             `You’ve checked in ${n === 1 ? 'once' : n === 2 ? 'twice' : '3 times'} these past two weeks`

  // Mood clause: WHERE THEY ARE ON AVERAGE first (28-day mean), then a drift
  // clause only when a recent drift actually exists (Norm, 2026-08-15). Both
  // speak the wheel's own axis — pleasant ↔ unpleasant — so the sentence and
  // the trend arrow describe the same movement in the same words. ("Heavier"
  // was tried and read as intensity, not valence.)
  let mood = null
  if (th.overall != null) {
    const level =
      th.overall >= 0.15  ? 'your mood has averaged on the pleasant side' :
      th.overall <= -0.15 ? 'your mood has averaged on the unpleasant side' :
                            'your mood has centred near neutral'
    const drift =
      th.delta != null && th.delta >= 0.15  ? ', with a recent drift toward the pleasant side' :
      th.delta != null && th.delta <= -0.15 ? ', with a recent drift toward the unpleasant side' :
      ''
    mood = `and ${level}${drift}`
  }

  return mood ? `${consistency}, ${mood}.` : `${consistency}.`
}

// ── Body ──────────────────────────────────────────────────────────────────────

function EmotionBody({ checkins, windowId, streak }) {
  const summary = useMemo(
    () => (checkins ? emotionSummary(checkins, windowId) : null),
    [checkins, windowId]
  )
  const th = useMemo(() => (checkins ? takeHome(checkins) : null), [checkins])

  if (checkins === null) return <p style={S.muted}>Loading…</p>

  if (checkins.length === 0) return (
    <div style={S.empty}>
      <p style={S.emptyTitle}>Nothing to see yet.</p>
      <p style={S.emptySub}>
        Your first check-in starts the picture. A few days in, this fills with how
        your feeling shifts — and where it settles.
      </p>
      <Link to="/checkin" style={S.emptyCta}>Check in →</Link>
    </div>
  )

  // Wheel left, sentence beside it (Norm, 2026-08-15) — the two elements read
  // as one unit rather than a headline over an illustration. Wraps on narrow
  // screens, sentence dropping below the wheel.
  return summary.count === 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={S.headline}>{takeHomeSentence(th)}</p>
      <p style={S.muted}>
        No check-ins in this window — you have {checkins.length} in total.
        Widen the time filter to see them on the wheel.
      </p>
    </div>
  ) : (
    <div style={S.mapRow}>
      {/* mx-auto md:mx-0 — when the row wraps on mobile the wheel centers in
          its own line; from md up it sits flush left beside the sentence. */}
      <div className="mx-auto md:mx-0" style={{ flexShrink: 0 }}>
        <CircumplexHistory summary={summary} th={th} />
        <p style={S.figCaption}>Where you&rsquo;ve been landing</p>
      </div>
      <div style={S.sideCol}>
        <p style={S.headline}>{takeHomeSentence(th)}</p>
        <div style={S.statRow}>
          <Stat label="check-ins" value={summary.count} />
          {streak > 0 && <Stat label="day streak" value={streak} />}
          {summary.mode && <Stat label="most often" value={summary.mode.toLowerCase()} />}
        </div>
      </div>
    </div>
  )
}

// ── Circumplex history ────────────────────────────────────────────────────────
// The mood wheel with every windowed check-in dotted on it. Recency does the
// visual work: sector wedges are filled by recency-weighted occupancy, dots
// grow and solidify as they approach today, and a trail connects the last few
// so the recent trajectory around the circle reads as a path, not a scatter.
//
// Note the sign on every y: maths convention (composite_y positive = high
// arousal) into SVG convention (y grows downward). Getting this wrong is what
// put alert check-ins in the calm corner on the old dashboard.

const CD = 232, CC = 116, CR = 98, CHOLE = 15

function polar(r, deg) {
  const rad = (deg * Math.PI) / 180
  return [CC + r * Math.cos(rad), CC - r * Math.sin(rad)]
}

function wedgePath(k) {
  const a1 = 45 * k - 22.5
  const a2 = 45 * k + 22.5
  const [ox1, oy1] = polar(CR, a1)
  const [ox2, oy2] = polar(CR, a2)
  const [ix1, iy1] = polar(CHOLE, a1)
  const [ix2, iy2] = polar(CHOLE, a2)
  return `M ${ix1} ${iy1} L ${ox1} ${oy1} A ${CR} ${CR} 0 0 0 ${ox2} ${oy2} L ${ix2} ${iy2} A ${CHOLE} ${CHOLE} 0 0 1 ${ix1} ${iy1} Z`
}

function CircumplexHistory({ summary, th }) {
  const { weights, max } = summary.sectors
  const halfLife = summary.window.halfLife

  // Chronological (rows arrive ordered by local_date ascending), coords only.
  const dots = summary.rows
    .filter(r => r.composite_x != null && r.composite_y != null)
    .map(r => {
      // Age proxy from position in sequence would lie across gaps, so weight by
      // real calendar age — same decay the sector fills use.
      const age = (new Date(summary.rows[summary.rows.length - 1].local_date) - new Date(r.local_date)) / 86_400_000
      const w   = Math.pow(0.5, age / halfLife)
      return {
        x: CC + r.composite_x * CR,
        y: CC - r.composite_y * CR,   // ← maths y-up into SVG y-down
        w,
        label: r.composite_label ?? 'neutral',
        date:  r.local_date,
      }
    })

  return (
    <svg width={CD} height={CD} viewBox={`0 0 ${CD} ${CD}`} style={{ display: 'block' }}>
      {SECTORS.map((name, k) => {
        const w = weights[name] ?? 0
        return (
          <path
            key={name}
            d={wedgePath(k)}
            fill={SECTOR_COLOR[name]}
            opacity={max ? 0.05 + 0.4 * (w / max) : 0.05}
            stroke="var(--bgc)"
            strokeWidth={1}
          >
            <title>{`${name} — ${w.toFixed(2)} weighted`}</title>
          </path>
        )
      })}

      <circle cx={CC} cy={CC} r={CHOLE} fill={SECTOR_COLOR.neutral}
        opacity={max ? 0.05 + 0.4 * ((weights.neutral ?? 0) / max) : 0.05} />
      <circle cx={CC} cy={CC} r={CR} fill="none" stroke="var(--bd)" strokeWidth={1} />

      {/* axis hairlines */}
      <line x1={CC - CR} y1={CC} x2={CC + CR} y2={CC} stroke="var(--bd)" strokeWidth={0.75} strokeDasharray="3,3" />
      <line x1={CC} y1={CC - CR} x2={CC} y2={CC + CR} stroke="var(--bd)" strokeWidth={0.75} strokeDasharray="3,3" />

      {[['Excited', 45], ['Tense', 135], ['Sad', 225], ['Calm', 315]].map(([label, deg]) => {
        const [x, y] = polar(CR - 16, deg)
        return (
          <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fontFamily="DM Sans, sans-serif" fill="var(--tx2)"
            stroke="var(--bgc)" strokeWidth={2.5} paintOrder="stroke">
            {label.toLowerCase()}
          </text>
        )
      })}

      {/* No per-point trail (tried, cut — Norm 2026-08-15: with the aggregate
          trend arrow present, raw segment lines between individual check-ins
          just tangled the middle of the wheel). TrendMark is the only line. */}
      {/* One color, one rule (Norm, 2026-08-15): every dot is radlab fuchsia,
          and recency alone does the talking — size and opacity both decay with
          age, so the most recent check-in is simply the biggest, most solid
          dot rather than a special-cased black one. Sector identity stays on
          the wedges. */}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y}
          r={2 + 3 * d.w}
          fill="var(--pk)"
          opacity={0.18 + 0.62 * d.w}>
          <title>{`${d.date} — ${d.label}`}</title>
        </circle>
      ))}

      <TrendMark th={th} />
    </svg>
  )
}

// ── Trend mark ────────────────────────────────────────────────────────────────
// The sentence's corroboration, drawn from the SAME takeHome() numbers: a pink
// arrow from the mean position of days 7–27 to the mean of the last 7 days.
// If the two means sit on top of each other (the "held steady" case) — or
// there's no earlier period to compare against — it collapses to a ring around
// the recent mean: "your mood has centred here".

function TrendMark({ th }) {
  if (!th?.recentXY) return null

  const rx = CC + th.recentXY.x * CR
  const ry = CC - th.recentXY.y * CR   // maths y-up into SVG y-down, as ever

  const ring = (
    <circle cx={rx} cy={ry} r={8} fill="none" stroke="var(--pk)" strokeWidth={2.5} opacity={0.9}>
      <title>Your average mood, last 7 days</title>
    </circle>
  )

  if (!th.priorXY) return ring

  const px = CC + th.priorXY.x * CR
  const py = CC - th.priorXY.y * CR
  const dx = rx - px, dy = ry - py
  const len = Math.hypot(dx, dy)
  if (len < 10) return ring   // means overlap — an arrow this short reads as noise

  // Shaft stops short of the tip so the head doesn't sit on a doubled line.
  const ang = Math.atan2(dy, dx)
  const sx  = rx - 9 * Math.cos(ang)
  const sy  = ry - 9 * Math.sin(ang)
  const headAt = (a, r_) => `${rx + r_ * Math.cos(a)},${ry + r_ * Math.sin(a)}`
  const head = `${rx},${ry} ${headAt(ang + Math.PI - 0.45, 10)} ${headAt(ang + Math.PI + 0.45, 10)}`

  return (
    <g opacity={0.9}>
      <title>Average mood: previous three weeks → last 7 days</title>
      {/* white halo keeps the arrow legible over weighted wedges */}
      <line x1={px} y1={py} x2={sx} y2={sy} stroke="var(--bgc)" strokeWidth={6} strokeLinecap="round" />
      <line x1={px} y1={py} x2={sx} y2={sy} stroke="var(--pk)" strokeWidth={2.5} strokeLinecap="round" />
      <polygon points={head} fill="var(--pk)" stroke="var(--bgc)" strokeWidth={1} />
      <circle cx={px} cy={py} r={3.5} fill="var(--bgc)" stroke="var(--pk)" strokeWidth={2} />
    </g>
  )
}

// ── Small parts ───────────────────────────────────────────────────────────────

function Stat({ label, value }) {
  return (
    <div>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, marginTop: 6 }}>{value ?? '—'}</div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'
const SANS  = '"DM Sans", system-ui, sans-serif'

const S = {
  widget: {
    background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 16,
    overflow: 'visible',
  },
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--bd)', flexWrap: 'wrap',
  },
  navLabel: {
    fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--tx3)', margin: 0,
  },
  tabRow: { display: 'flex', gap: 2, flexWrap: 'wrap' },
  tab: {
    padding: '8px 14px', borderRadius: 24, border: 'none', background: 'transparent',
    fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--tx2)',
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s, background 0.15s',
  },
  tabActive: { color: 'var(--tx)', background: 'var(--bgp)' },

  filterBtn: {
    padding: '8px 14px', borderRadius: 24, border: '1px solid var(--bgp)',
    background: 'var(--bg)', fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--tx2)', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  filterMenu: {
    position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 20,
    background: 'var(--bgc)', border: '1px solid var(--bgp)', borderRadius: 12,
    padding: 6, minWidth: 150, boxShadow: '0 8px 28px rgba(0,0,0,0.10)',
    display: 'flex', flexDirection: 'column',
  },
  filterItem: {
    textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none',
    background: 'transparent', fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em',
    textTransform: 'uppercase', cursor: 'pointer',
  },

  body: { padding: '22px 20px 22px' },

  headline: {
    fontFamily: SERIF, fontSize: 'clamp(19px, 2.6vw, 23px)', fontWeight: 400,
    color: 'var(--tx)', lineHeight: 1.45, margin: 0, maxWidth: 640,
  },

  mapRow:  { display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' },
  sideCol: { flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 260 },
  statRow: { display: 'flex', gap: 28, flexWrap: 'wrap' },

  figCaption: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx3)', textAlign: 'center', margin: '4px 0 0' },

  statLabel: { fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)' },
  statValue: { fontFamily: MONO, fontSize: 15, color: 'var(--tx)', fontWeight: 700 },

  empty:      { textAlign: 'center', padding: '38px 20px' },
  emptyTitle: { fontFamily: SERIF, fontSize: 21, color: 'var(--tx)', margin: '0 0 8px' },
  emptySub:   { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.6 },
  emptyCta:   { fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pk)', textDecoration: 'none' },

  muted: { fontFamily: SANS, fontSize: 13, color: 'var(--tx3)', margin: 0, lineHeight: 1.6 },
}
