import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CATEGORIES } from '../data/games'
import {
  WINDOWS, windowById, emotionSummary, SECTORS, SECTOR_COLOR, intensityOf,
} from './metrics'

// ── InsightsWidget ────────────────────────────────────────────────────────────
// The single dashboard component from Onboarding Redesign v2 (Figma 4082:2349 →
// DashboardPage(User)/WithData). One bordered surface, a category tab row and a
// time filter across the top, content below. The tabs are the same four
// CATEGORIES the games page sorts by, so an insight always has an obvious home.
//
// Only Emotion is wired for now — it reads ripple_checkins, which is the one
// place on the platform with a real time series. The other three announce
// themselves as empty rather than pretending; games get wired in one tab at a
// time (see website.md roadmap).
//
// Everything is computed client-side from the user's own rows: no view, no
// migration, no RLS change. At this data volume that is not a compromise, and
// the time filter stays instant because it is a slice rather than a query.

// devRows: DEV-only escape hatch for /dev/insights-preview — supplies synthetic
// check-ins so every state can be eyeballed without an account that has months
// of history. Same pattern as WelcomeFlow's devInitialStep.
export default function InsightsWidget({ userId, devRows, initialWindow = 'month' }) {
  const [tab,      setTab]      = useState('emotion')
  const [windowId, setWindowId] = useState(initialWindow)
  const [fetched,  setFetched]  = useState(null)
  // Streak moved here 2026-07-31 when the check-in bar took the v2 three-field
  // shape, which has no room for it. Read from ripples rather than derived from
  // the rows below, so it stays the same number the rest of the app maintains.
  const [streak,   setStreak]   = useState(null)

  // devRows is read straight through rather than pushed into state: setting state
  // synchronously inside the effect would cascade an extra render for no reason.
  const checkins = devRows ?? fetched

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
        <div style={S.tabRow}>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setTab(c.id)}
              style={{ ...S.tab, ...(tab === c.id ? S.tabActive : {}) }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <TimeFilter value={windowId} onChange={setWindowId} />
      </div>

      <div style={S.body}>
        {tab === 'emotion'
          ? <EmotionTab checkins={checkins} windowId={windowId} streak={streak} />
          : <NotYetTab category={CATEGORIES.find(c => c.id === tab)} />}
      </div>
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

// ── Emotion tab ───────────────────────────────────────────────────────────────

function EmotionTab({ checkins, windowId, streak }) {
  const summary = useMemo(
    () => (checkins ? emotionSummary(checkins, windowId) : null),
    [checkins, windowId]
  )

  if (checkins === null) return <p style={S.muted}>Loading…</p>

  if (checkins.length === 0) return (
    <div style={S.empty}>
      <p style={S.emptyTitle}>Nothing to see yet.</p>
      <p style={S.emptySub}>
        Your first check-in starts the picture. A few days in, this fills with how
        your feeling shifts — and what it tends to settle into.
      </p>
      <Link to="/checkin" style={S.emptyCta}>Check in →</Link>
    </div>
  )

  if (summary.count === 0) return (
    <div style={S.empty}>
      <p style={S.emptyTitle}>No check-ins in this window.</p>
      <p style={S.emptySub}>You have {checkins.length} in total — widen the time filter to see them.</p>
    </div>
  )

  const single = summary.rated.length < 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={S.topRow}>
        <div style={{ flexShrink: 0 }}>
          <CircumplexDensity summary={summary} />
          <p style={S.figCaption}>Where you tend to land</p>
        </div>

        <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Gauge label="Positive activation" left="Sad" right="Excited" value={summary.pa} color="#f068a4" />
          <Gauge label="Negative activation" left="Calm" right="Tense" value={summary.na} color="#9b6bb5" />
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Meter
              label="Mixed feelings"
              value={summary.ambivalence}
              sub={summary.ratedCount ? `${summary.mixedCount} of ${summary.ratedCount}` : null}
              hint="How often feeling good and feeling on-edge show up in the same check-in"
            />
            <Meter
              label="Day-to-day swing"
              value={summary.volatility == null ? null : summary.volatility / 2}
              sub={single ? 'needs two' : null}
              hint="Average change in positive activation between one check-in and the next"
            />
            <Stat label="check-ins" value={summary.count} />
            {streak > 0 && <Stat label="day streak" value={streak} />}
            <Stat label="most often" value={summary.mode?.toLowerCase() ?? '—'} />
          </div>
        </div>
      </div>

      {/* A "past 24 hrs" calendar is one square — not worth the heading. */}
      {summary.days.length >= 3 && <CalendarHeat summary={summary} />}

      <div style={S.bottomRow}>
        <FollowThrough follow={summary.follow} />
        <TimeOfDay profile={summary.timeOfDay} />
      </div>

      <p style={S.footnote}>
        Averages weight recent check-ins more heavily — one from{' '}
        {summary.window.halfLife < 1 ? 'half a day' : `${summary.window.halfLife} days`} ago counts half as much as today's.
      </p>
    </div>
  )
}

// ── Circumplex density ────────────────────────────────────────────────────────
// The mood wheel as a density map: each of the eight sectors filled in
// proportion to how much time you have spent there, recency-weighted, with the
// individual check-ins dotted on top.
//
// Note the sign on every y: maths convention (composite_y positive = high
// arousal) into SVG convention (y grows downward). Getting this wrong is what
// put alert check-ins in the calm corner on the old dashboard.

const CD = 208, CC = 104, CR = 86, CHOLE = 14

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

function CircumplexDensity({ summary }) {
  const { weights, max } = summary.sectors
  const dots = summary.rows.filter(r => r.composite_x != null && r.composite_y != null)

  return (
    <svg width={CD} height={CD} viewBox={`0 0 ${CD} ${CD}`} style={{ display: 'block' }}>
      {SECTORS.map((name, k) => {
        const w = weights[name] ?? 0
        return (
          <path
            key={name}
            d={wedgePath(k)}
            fill={SECTOR_COLOR[name]}
            opacity={max ? 0.06 + 0.54 * (w / max) : 0.06}
            stroke="var(--bgc)"
            strokeWidth={1}
          >
            <title>{`${name} — ${w.toFixed(2)} weighted`}</title>
          </path>
        )
      })}

      <circle cx={CC} cy={CC} r={CHOLE} fill={SECTOR_COLOR.neutral}
        opacity={max ? 0.06 + 0.54 * ((weights.neutral ?? 0) / max) : 0.06} />
      <circle cx={CC} cy={CC} r={CR} fill="none" stroke="var(--bd)" strokeWidth={1} />

      {/* axis hairlines */}
      <line x1={CC - CR} y1={CC} x2={CC + CR} y2={CC} stroke="var(--bd)" strokeWidth={0.75} strokeDasharray="3,3" />
      <line x1={CC} y1={CC - CR} x2={CC} y2={CC + CR} stroke="var(--bd)" strokeWidth={0.75} strokeDasharray="3,3" />

      {[['Excited', 45], ['Tense', 135], ['Sad', 225], ['Calm', 315]].map(([label, deg]) => {
        const [x, y] = polar(CR - 15, deg)
        return (
          // White halo under the glyphs: these sit on top of sector fills whose
          // darkness varies with the data, so a flat grey would vanish on a
          // heavily-weighted wedge.
          <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fontFamily="DM Sans, sans-serif" fill="var(--tx2)"
            stroke="var(--bgc)" strokeWidth={2.5} paintOrder="stroke">
            {label.toLowerCase()}
          </text>
        )
      })}

      {dots.map((r, i) => {
        const x = CC + r.composite_x * CR
        const y = CC - r.composite_y * CR       // ← maths y-up into SVG y-down
        const isLast = i === dots.length - 1
        return (
          <circle key={i} cx={x} cy={y} r={isLast ? 4 : 2.5}
            fill={isLast ? 'var(--tx)' : SECTOR_COLOR[r.composite_label ?? 'neutral']}
            opacity={isLast ? 0.9 : 0.45}>
            <title>{`${r.local_date} — ${r.composite_label ?? 'neutral'}`}</title>
          </circle>
        )
      })}
    </svg>
  )
}

// ── Calendar heat ─────────────────────────────────────────────────────────────
// Days without a check-in stay in the picture as empty outlines. The gaps are
// the honest part — a strip that only showed the days you turned up would read
// as a perfect streak.

function cellStyle(day, size) {
  const base = {
    width: size, height: size, borderRadius: Math.max(2, size / 5),
    boxSizing: 'border-box',
  }
  if (!day.row) return { ...base, background: 'transparent', border: '1px solid var(--bd)' }
  const label = day.row.composite_label ?? 'neutral'
  return {
    ...base,
    background: SECTOR_COLOR[label],
    opacity: 0.3 + 0.7 * intensityOf(day.row),
    border: '1px solid transparent',
  }
}

function CalendarHeat({ summary }) {
  const days  = summary.days
  const strip = days.length <= 35

  return (
    <div>
      <div style={S.sectionHead}>
        <p style={S.sectionLabel}>Check-ins over time</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['Good', 'Alert', 'Sad', 'Calm'].map(name => (
            <span key={name} style={S.legendItem}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: SECTOR_COLOR[name], display: 'inline-block' }} />
              {name === 'Good' ? 'pleasant' : name === 'Alert' ? 'activated' : name === 'Sad' ? 'low' : 'settled'}
            </span>
          ))}
        </div>
      </div>

      {strip ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {days.map(d => (
            <div key={d.date} style={cellStyle(d, 22)}
              title={`${d.date}${d.row ? ` — ${d.row.composite_label ?? 'neutral'}` : ' — no check-in'}`} />
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{
            display: 'grid', gridTemplateRows: 'repeat(7, 11px)',
            gridAutoFlow: 'column', gridAutoColumns: '11px', gap: 3,
          }}>
            {Array.from({ length: days[0]?.weekday ?? 0 }, (_, i) => <div key={`pad${i}`} />)}
            {days.map(d => (
              <div key={d.date} style={cellStyle(d, 11)}
                title={`${d.date}${d.row ? ` — ${d.row.composite_label ?? 'neutral'}` : ' — no check-in'}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Small parts ───────────────────────────────────────────────────────────────

function Gauge({ label, left, right, value, color }) {
  const pct = value == null ? 50 : ((value + 1) / 2) * 100
  return (
    <div>
      <div style={S.gaugeHead}>
        <span style={S.sectionLabel}>{label}</span>
        <span style={S.gaugeValue}>{value == null ? '—' : value.toFixed(2)}</span>
      </div>
      <div style={S.gaugeTrack}>
        <div style={S.gaugeMid} />
        {value != null && (
          <div style={{ ...S.gaugeDot, left: `${pct}%`, background: color, boxShadow: `0 0 0 3px var(--bgc)` }} />
        )}
      </div>
      <div style={S.gaugeEnds}>
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}

function Meter({ label, value, sub, hint }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100
  return (
    <div style={{ minWidth: 132 }} title={hint}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.gaugeTrack, marginTop: 4, marginBottom: 4 }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`,
          background: 'var(--pk)', borderRadius: 4, opacity: 0.75,
        }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={S.statValue}>{value == null ? '—' : `${Math.round(pct)}%`}</span>
        {sub && <span style={S.tinyLabel}>{sub}</span>}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, marginTop: 6 }}>{value ?? '—'}</div>
    </div>
  )
}

function FollowThrough({ follow }) {
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <p style={S.sectionLabel}>Intentions kept</p>
      {!follow ? (
        <p style={S.muted}>
          Set an intention at a check-in and the next one asks how it went. Nothing recorded yet.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', margin: '8px 0 8px' }}>
            {[['did', '#2a9d8f'], ['partly', '#e9c46a'], ['not_today', 'var(--bd)']].map(([k, c]) => (
              follow[k] > 0 && <div key={k} style={{ width: `${(follow[k] / follow.total) * 100}%`, background: c }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Stat label="kept" value={follow.did} />
            <Stat label="partly" value={follow.partly} />
            <Stat label="not yet" value={follow.not_today} />
          </div>
        </>
      )}
    </div>
  )
}

function TimeOfDay({ profile }) {
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <p style={S.sectionLabel}>When you check in</p>
      {!profile ? (
        <p style={S.muted}>Not enough check-ins yet.</p>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 64, marginTop: 8 }}>
          {profile.map(b => (
            <div key={b.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', height: Math.max(3, b.share * 44), background: 'var(--pk)',
                opacity: b.count ? 0.35 + 0.5 * b.share : 0.12, borderRadius: 4,
              }} title={`${b.count} check-in${b.count === 1 ? '' : 's'}`} />
              <span style={S.tinyLabel}>{b.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotYetTab({ category }) {
  return (
    <div style={S.empty}>
      <p style={S.emptyTitle}>{category?.label} insights are being built.</p>
      <p style={S.emptySub}>
        The games in this category already record their sessions — they are not
        summarised here yet. For now their cards below show what each one measured.
      </p>
      <Link to="/games" style={S.emptyCta}>Browse games →</Link>
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

  body: { padding: '24px 20px 22px' },

  topRow:    { display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-start' },
  bottomRow: { display: 'flex', gap: 26, flexWrap: 'wrap' },

  sectionHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 10 },
  sectionLabel: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx3)', margin: 0 },
  legendItem:   { display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', color: 'var(--tx3)', textTransform: 'uppercase' },

  figCaption: { fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx3)', textAlign: 'center', margin: '2px 0 0' },

  gaugeHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  gaugeValue: { fontFamily: MONO, fontSize: 13, fontWeight: 700, color: 'var(--tx)' },
  gaugeTrack: { position: 'relative', height: 8, borderRadius: 4, background: 'var(--bgp)' },
  gaugeMid:   { position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--bd)' },
  gaugeDot:   { position: 'absolute', top: -3, width: 14, height: 14, borderRadius: 7, transform: 'translateX(-50%)', transition: 'left 0.25s ease' },
  gaugeEnds:  { display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: SANS, fontSize: 11, color: 'var(--tx3)' },

  statLabel: { fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)' },
  statValue: { fontFamily: MONO, fontSize: 15, color: 'var(--tx)', fontWeight: 700 },
  tinyLabel: { fontFamily: MONO, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx3)' },

  empty:      { textAlign: 'center', padding: '38px 20px' },
  emptyTitle: { fontFamily: SERIF, fontSize: 21, color: 'var(--tx)', margin: '0 0 8px' },
  emptySub:   { fontFamily: SANS, fontSize: 14, color: 'var(--tx2)', maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.6 },
  emptyCta:   { fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--pk)', textDecoration: 'none' },

  muted:    { fontFamily: SANS, fontSize: 13, color: 'var(--tx3)', margin: '8px 0 0', lineHeight: 1.6 },
  footnote: { fontFamily: SANS, fontSize: 11, color: 'var(--tx3)', margin: 0, lineHeight: 1.5 },
}
