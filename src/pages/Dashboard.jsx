import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import SiteFooter from '../components/SiteFooter'
import EyebrowLabel from '../components/ui/EyebrowLabel'
import PrimaryCTA from '../components/ui/PrimaryCTA'
import InsightsWidget from '../dashboard/InsightsWidget'
import { modeLabel } from '../dashboard/metrics'
import RippleAvatar from '../ripple/RippleAvatar'
import { useAvatarConfig } from '../hooks/useAvatarConfig'
import { useDisplayName } from '../hooks/useDisplayName'
import { EMOTIONS, LABEL_TO_ID } from '../games/StillWater/constants'

const todayLong = () =>
  new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

export default function Dashboard({ session }) {
  const user        = session?.user
  // Reads profiles.display_name, not user_metadata — see useDisplayName for
  // why the greeting used to lag behind a rename.
  const { displayName } = useDisplayName(user)

  // handleSignOut + useNavigate removed 2026-07-30: dead since the account-menu
  // IA rework moved signing out into the avatar dropdown. Nothing rendered it.

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Nav session={session} />

      <div style={S.wrap}>
        {/* Welcome — "signed in as" badge dropped 2026-07-30 (Redesign v2): the
            greeting already confirms identity, so the badge was chrome. */}
        <div style={S.header}>
          <div>
            <h1 style={S.title}>Hey, {displayName}.</h1>
            <p style={S.sub}>Today is {todayLong()}. What&rsquo;s on your mind?</p>
          </div>
        </div>

        {/* Today's check-in — Ripple beside a bar of the day's fields. The
            "settings →" link that used to sit here is gone: reminder settings
            are in the avatar menu under Account, and it read as a setting for
            the check-in. */}
        <div style={{ marginBottom: 16 }}>
          <EyebrowLabel variant="white">Today&rsquo;s check-in</EyebrowLabel>
        </div>
        <RippleSection userId={user?.id} />

        {/* Insights — THE dashboard card (Redesign v2, folded further
            2026-08-16 per Norm): check-ins and per-game stats are two tabs of
            one card. The widget owns the tab/selector state; the per-game
            card components below are passed in via renderGame and every one
            stays reachable — the v2 condition ("per-game stats visible
            somewhere") holds with a single card on the page. Owl Barn's card
            was pulled 2026-08-13 when it went back to in-development (see
            src/data/games.js); the route still works. */}
        <div style={{ marginTop: 40, marginBottom: 16 }}>
          <EyebrowLabel variant="white">Insights</EyebrowLabel>
        </div>
        <InsightsWidget
          userId={user?.id}
          games={GAMES_MENU}
          renderGame={id => <SelectedGameCard game={id} userId={user?.id} />}
        />

        {/* Stats */}
        <div style={{ marginTop: 40, marginBottom: 16 }}>
          <EyebrowLabel variant="white">Your stats</EyebrowLabel>
        </div>
        <YourStats userId={user?.id} />

        {/*
          `// Account` moved to /profile (since merged into /account, 2026-08-13)
          and `// Reminders` was deleted outright (2026-07-30 account-menu IA
          rework). The reminders block wrote profiles.reminder_frequency, which
          nothing has ever read — the live engine is the ripple_reminder Edge
          Function reading ripples.reminder_enabled / prompt_cadence /
          reminder_time, now surfaced on /account. The dashboard is the daily
          view: Ripple, Games, stats.

          Merge note: main wrapped this block's write in the new dbWrite()
          helper the same day. Deleted rather than kept — dbWrite surfaces a
          write that fails, and this one succeeded every time into a column no
          reader has ever had.
        */}
      </div>

      <SiteFooter session={session} />
    </div>
  )
}

// ── GAME CARDS REGISTRY ───────────────────────────────────────────────────────
// Which single game card renders inside the Insights widget's Games tab. The
// widget owns the picker UI; these exports are what it picks from. Also
// imported by /dev/insights-preview. The full-width cards (Pond Watch, Farm
// Joy) were always happy at full width; the small ones simply stretch.

export const GAMES_MENU = [
  { id: 'still_water', label: 'Still Water' },
  { id: 'face_read',   label: 'Face Read' },
  { id: 'drift',       label: 'Drift' },
  { id: 'delve',       label: 'Delve' },
  { id: 'ebb_flow',    label: 'Ebb & Flow' },
  { id: 'pond_watch',  label: 'Pond Watch' },
  { id: 'farm_joy',    label: 'Farm Joy' },
  { id: 'contact',     label: 'Contact' },
]

export function SelectedGameCard({ game, userId }) {
  switch (game) {
    case 'face_read':  return <FaceReadCard userId={userId} />
    case 'drift':      return <DriftCard userId={userId} />
    case 'delve':      return <DelveCard userId={userId} />
    case 'ebb_flow':   return (
      <GameCard
        title="Ebb &amp; Flow"
        tag="Interoception · Breath sync"
        desc="Breathe with your Ripple and detect subtle shifts in rhythm. Each session adapts to your sensitivity."
        status="Play now →"
        to="/games/ebb-flow"
      />
    )
    case 'pond_watch': return <PondWatchCard userId={userId} />
    case 'farm_joy':   return <FarmJoyCard userId={userId} />
    case 'contact':    return <ContactCard userId={userId} />
    default:           return <StillWaterCard userId={userId} />
  }
}

// ── STILL WATER CARD ─────────────────────────────────────────────────────────

function StillWaterCard({ userId }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('stillwater_responses')
      .select('composite_x, composite_y')
      .eq('participant_id', userId)
      .order('created_at', { ascending: true })
      .limit(20)
      .then(({ data }) => setRows(data ?? []))
  }, [userId])

  const hasData = rows && rows.length > 0

  return (
    <div style={S.gameCard}>
      <div style={S.gameCardInner}>
        <span style={S.gameBadge}>Emotion check-in</span>
        <h2 style={S.gameTitle}>Still Water</h2>
        {!hasData ? (
          <p style={S.gameDesc}>
            {rows === null
              ? 'Loading…'
              : 'How are you arriving? Two quick questions map your current mood on the feeling wheel.'}
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', marginTop: 8 }}>
            <SwMoodGrid rows={rows} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
              <SwLinePlot rows={rows} field="valence" label="VALENCE" color="#f068a4" />
              <SwLinePlot rows={rows} field="arousal" label="AROUSAL" color="#9b6bb5" />
            </div>
          </div>
        )}
      </div>
      <Link to="/games/still-water" style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>
        {hasData ? 'Check in again →' : 'Check in →'}
      </Link>
    </div>
  )
}

function SwMoodGrid({ rows }) {
  const CX = 54, CY = 54, R = 46
  const last = rows[rows.length - 1]
  // composite_y is stored maths-convention: POSITIVE = high arousal (verified
  // against live rows — `Alert` sits at +0.50, `Excited` at +0.33, and
  // getCompositeLabel reads it with atan2). SVG y grows downward, so it must be
  // negated here. Until 2026-07-30 it was not, which drew a maximally alert
  // check-in in the corner labelled "calm".
  const toDot = r => ({ x: CX + r.composite_x * R, y: CY - r.composite_y * R })

  return (
    <svg width={108} height={108} viewBox="0 0 108 108" style={{ flexShrink: 0 }}>
      <defs>
        <clipPath id="sw-circ"><circle cx={CX} cy={CY} r={R} /></clipPath>
      </defs>
      <rect x={CX} y={0}  width={R + 10} height={CY}      fill="#FFF6E0" clipPath="url(#sw-circ)" />
      <rect x={0}  y={0}  width={CX}     height={CY}      fill="#EDE0F4" clipPath="url(#sw-circ)" />
      <rect x={CX} y={CY} width={R + 10} height={R + 10}  fill="#E8F5E9" clipPath="url(#sw-circ)" />
      <rect x={0}  y={CY} width={CX}     height={R + 10}  fill="#E8EAF6" clipPath="url(#sw-circ)" />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#E8D0E0" strokeWidth="1" />
      <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="#D8C0D0" strokeWidth="0.75" strokeDasharray="3,3" />
      <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="#D8C0D0" strokeWidth="0.75" strokeDasharray="3,3" />
      <text x={CX + R - 2} y={CY - R + 9}  textAnchor="end"   fontSize={7} fill="#C4A000" fontFamily="DM Sans,sans-serif">excited</text>
      <text x={CX - R + 2} y={CY - R + 9}  textAnchor="start" fontSize={7} fill="#804080" fontFamily="DM Sans,sans-serif">tense</text>
      <text x={CX + R - 2} y={CY + R - 2}  textAnchor="end"   fontSize={7} fill="#4a9a6a" fontFamily="DM Sans,sans-serif">calm</text>
      <text x={CX - R + 2} y={CY + R - 2}  textAnchor="start" fontSize={7} fill="#4888cc" fontFamily="DM Sans,sans-serif">sad</text>
      {rows.length > 1 && (
        <polyline
          points={rows.map(r => { const d = toDot(r); return `${d.x.toFixed(1)},${d.y.toFixed(1)}` }).join(' ')}
          fill="none" stroke="#f068a4" strokeWidth="0.75" opacity="0.18"
        />
      )}
      {rows.slice(0, -1).map((r, i) => {
        const d = toDot(r)
        return <circle key={i} cx={d.x} cy={d.y} r={2.5} fill="#f068a4" opacity={0.15 + 0.5 * ((i + 1) / rows.length)} />
      })}
      {last && (() => {
        const d = toDot(last)
        return <>
          <circle cx={d.x} cy={d.y} r={6}   fill="#f068a4" opacity={0.15} />
          <circle cx={d.x} cy={d.y} r={3.5}  fill="#f068a4" />
        </>
      })()}
    </svg>
  )
}

const SW_VW = 300, SW_VH = 48
const SW_PAD = { t: 13, b: 5, l: 4, r: 4 }

function SwLinePlot({ rows, field, label, color }) {
  const pw = SW_VW - SW_PAD.l - SW_PAD.r
  const ph = SW_VH - SW_PAD.t - SW_PAD.b
  const n  = rows.length
  // Arousal plots composite_y directly: positive IS high arousal (see SwMoodGrid).
  // It was negated here until 2026-07-30, which drew the arousal trace upside-down.
  const vals = rows.map(r => field === 'valence' ? r.composite_x : r.composite_y)
  const xOf  = i => SW_PAD.l + (n < 2 ? pw / 2 : (i / (n - 1)) * pw)
  const yOf  = v => SW_PAD.t + (1 - v) / 2 * ph
  const pts  = vals.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${SW_VW} ${SW_VH}`} width="100%" height={SW_VH}
      preserveAspectRatio="none" style={{ display: 'block', borderRadius: 6, background: 'var(--bgp)' }}>
      <text x={SW_PAD.l + 2} y={SW_PAD.t - 2} fontSize={7} fill="var(--tx3)" fontFamily="Space Mono,monospace">{label}</text>
      <line
        x1={SW_PAD.l} y1={SW_PAD.t + ph / 2}
        x2={SW_PAD.l + pw} y2={SW_PAD.t + ph / 2}
        stroke="var(--bd)" strokeWidth={0.75} strokeDasharray="3,2"
      />
      {n > 1 && <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />}
      {vals.map((v, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(v)}
          r={i === n - 1 ? 3 : 2}
          fill={i === n - 1 ? color : 'var(--bgc)'}
          stroke={color} strokeWidth={1.5}
          opacity={i === n - 1 ? 1 : 0.5}
        />
      ))}
    </svg>
  )
}

// ── YOUR STATS ────────────────────────────────────────────────────────────────

function YourStats({ userId }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('profiles')
        .select('points, still_water_sessions')
        .eq('id', userId).single(),
      supabase.from('game_sessions')
        .select('game_name, started_at')
        .eq('user_id', userId)
        .not('ended_at', 'is', null),
      // Best streak + total check-ins — moved here from MyRipplePage's "Together
      // so far" section (2026-08-13 Account/My Ripple redesign): those numbers
      // read as user insights, which is what this section is for.
      supabase.from('ripples')
        .select('streak_best')
        .eq('user_id', userId).maybeSingle(),
      supabase.from('ripple_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]).then(([{ data: profile }, { data: sessions }, { data: ripple }, { count: checkinCount }]) => {
      const sess    = sessions ?? []
      const swCount = profile?.still_water_sessions ?? 0
      const games   = new Set(sess.map(s => s.game_name))
      if (swCount > 0) games.add('still_water')
      const earliest = sess.length
        ? sess.reduce((m, s) => (s.started_at < m ? s.started_at : m), sess[0].started_at)
        : null
      setStats({
        totalSessions: sess.length + swCount,
        points:        profile?.points ?? 0,
        gamesExplored: games.size,
        firstPlayed:   earliest,
        bestStreak:    ripple?.streak_best ?? 0,
        checkins:      checkinCount ?? 0,
      })
    })
  }, [userId])

  if (stats === null) {
    return <div style={S.statsPlaceholder}><p style={S.placeholderTitle}>Loading…</p></div>
  }

  if (stats.totalSessions === 0) {
    return (
      <div style={S.statsPlaceholder}>
        <p style={S.placeholderTitle}>No sessions yet</p>
        <p style={S.placeholderSub}>
          Complete your first game to see your reaction time, d′, and accuracy here.
        </p>
      </div>
    )
  }

  const daysInLab = stats.firstPlayed
    ? Math.max(1, Math.floor((Date.now() - new Date(stats.firstPlayed)) / 86_400_000))
    : null

  return (
    <div style={{ background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '28px 32px' }}>
      <StatCluster stats={[
        { label: 'sessions',       value: stats.totalSessions },
        { label: 'points',         value: stats.points },
        { label: 'games explored', value: stats.gamesExplored },
        { label: 'best streak',    value: `${stats.bestStreak}d` },
        { label: 'check-ins',      value: stats.checkins },
        ...(daysInLab != null ? [{ label: 'days in lab', value: daysInLab }] : []),
      ]} />
    </div>
  )
}

// ── SHARED PRIMITIVES ────────────────────────────────────────────────────────

const SP_VW = 300, SP_VH = 48, SP_PAD = { t: 13, b: 5, l: 4, r: 4 }

function MiniSparkline({ values, color = '#f068a4', label = '', refVal }) {
  const pw = SP_VW - SP_PAD.l - SP_PAD.r
  const ph = SP_VH - SP_PAD.t - SP_PAD.b
  const n  = values.length
  if (n === 0) return null
  const lo = Math.min(...values), hi = Math.max(...values)
  const pad = (hi - lo || 1) * 0.2
  const yMin = lo - pad, yMax = hi + pad
  const xOf = i => SP_PAD.l + (n < 2 ? pw / 2 : (i / (n - 1)) * pw)
  const yOf = v => SP_PAD.t + (1 - (v - yMin) / (yMax - yMin)) * ph
  const pts = values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
  const showRef = refVal !== undefined && refVal >= yMin && refVal <= yMax
  return (
    <svg viewBox={`0 0 ${SP_VW} ${SP_VH}`} width="100%" height={SP_VH}
      preserveAspectRatio="none" style={{ display: 'block', borderRadius: 6, background: 'var(--bgp)' }}>
      <text x={SP_PAD.l + 2} y={SP_PAD.t - 2} fontSize={7} fill="var(--tx3)" fontFamily="Space Mono,monospace">{label}</text>
      {showRef && (
        <line x1={SP_PAD.l} y1={yOf(refVal)} x2={SP_PAD.l + pw} y2={yOf(refVal)}
          stroke="var(--tx3)" strokeWidth={0.75} strokeDasharray="3,2" />
      )}
      {n > 1 && <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />}
      {values.map((v, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(v)}
          r={i === n - 1 ? 3 : 2}
          fill={i === n - 1 ? color : 'var(--bgc)'}
          stroke={color} strokeWidth={1.5}
          opacity={i === n - 1 ? 1 : 0.5}
        />
      ))}
    </svg>
  )
}

function StatCluster({ stats }) {
  return (
    <div style={{ display: 'flex', gap: 20, marginBottom: 10, flexWrap: 'wrap' }}>
      {stats.map(({ label, value }) => (
        <div key={label}>
          <div style={{ fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: 1 }}>{label}</div>
          <div style={{ fontFamily: MONO, fontSize: 15, color: 'var(--tx)', fontWeight: 700 }}>{value ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}

// ── FACE READ CARD ────────────────────────────────────────────────────────────

function FaceReadCard({ userId }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!userId) return
    supabase.from('face_read_performance')
      .select('mean_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20)
      .then(({ data }) => setRows(data ?? []))
  }, [userId])
  const hasData = rows && rows.length > 0
  const scores = (rows ?? []).map(r => r.mean_score)
  const last = scores[scores.length - 1]
  const best = scores.length ? Math.max(...scores) : null
  return (
    <div style={S.gameCard}>
      <div style={S.gameCardInner}>
        <span style={S.gameBadge}>Emotion recognition</span>
        <h2 style={S.gameTitle}>Face Read</h2>
        {!hasData ? (
          <p style={S.gameDesc}>{rows === null ? 'Loading…' : 'A face shifts into an expression. Name the feeling and its intensity across 10 trials.'}</p>
        ) : (
          <>
            <StatCluster stats={[
              { label: 'sessions', value: rows.length },
              { label: 'last', value: Math.round(last) },
              { label: 'best', value: Math.round(best) },
            ]} />
            <MiniSparkline values={scores} color="#f068a4" label="SCORE" />
          </>
        )}
      </div>
      <Link to="/games/face-read" style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>
        {hasData ? 'Play again →' : 'Play now →'}
      </Link>
    </div>
  )
}

// ── DRIFT CARD ────────────────────────────────────────────────────────────────

function DriftCard({ userId }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!userId) return
    supabase.from('drift_performance')
      .select('mean_ratio, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20)
      .then(({ data }) => setRows(data ?? []))
  }, [userId])
  const hasData = rows && rows.length > 0
  const ratios = (rows ?? []).map(r => r.mean_ratio)
  const last = ratios[ratios.length - 1]
  const mean = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null
  const tendency = mean == null ? null : mean > 1.05 ? 'expands' : mean < 0.95 ? 'compresses' : 'neutral'
  return (
    <div style={S.gameCard}>
      <div style={S.gameCardInner}>
        <span style={S.gameBadge}>Time perception · Felt duration</span>
        <h2 style={S.gameTitle}>Drift</h2>
        {!hasData ? (
          <p style={S.gameDesc}>{rows === null ? 'Loading…' : 'A tone marks an interval. Reproduce it from felt sense. Your ratio reveals where your nervous system is.'}</p>
        ) : (
          <>
            <StatCluster stats={[
              { label: 'sessions', value: rows.length },
              { label: 'last ratio', value: last?.toFixed(2) },
              { label: 'tendency', value: tendency },
            ]} />
            <MiniSparkline values={ratios} color="#7b61c4" label="RATIO" refVal={1.0} />
          </>
        )}
      </div>
      <Link to="/games/drift" style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>
        {hasData ? 'Play again →' : 'Play now →'}
      </Link>
    </div>
  )
}

// ── DELVE CARD ────────────────────────────────────────────────────────────────

function DelveCard({ userId }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!userId) return
    supabase.from('game_sessions')
      .select('started_at, performance(delve_duration_ms, delve_avg_dwell_ms)')
      .eq('user_id', userId)
      .eq('game_name', 'delve')
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: true })
      .limit(20)
      .then(({ data }) => {
        const perfs = (data ?? []).map(s => s.performance?.[0]).filter(Boolean)
        setRows(perfs)
      })
  }, [userId])
  const hasData = rows && rows.length > 0
  const last = rows?.[rows.length - 1]
  const dwells = (rows ?? []).map(r => r.delve_avg_dwell_ms).filter(v => v != null).map(v => v / 1000)
  const fmtMin = ms => {
    if (ms == null) return null
    const s = Math.round(ms / 1000)
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
  }
  return (
    <div style={S.gameCard}>
      <div style={S.gameCardInner}>
        <span style={S.gameBadge}>Attention · Sense foraging</span>
        <h2 style={S.gameTitle}>Delve</h2>
        {!hasData ? (
          <p style={S.gameDesc}>{rows === null ? 'Loading…' : 'An image waits behind haze. Rest your attention in one place and it slowly comes clear.'}</p>
        ) : (
          <>
            <StatCluster stats={[
              { label: 'sessions', value: rows.length },
              { label: 'last time', value: fmtMin(last.delve_duration_ms) },
              { label: 'avg dwell', value: last.delve_avg_dwell_ms != null ? `${(last.delve_avg_dwell_ms / 1000).toFixed(1)}s` : null },
            ]} />
            {dwells.length > 0 && <MiniSparkline values={dwells} color="#8a7f66" label="AVG DWELL (S)" />}
          </>
        )}
      </div>
      <Link to="/games/delve" style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>
        {hasData ? 'Delve again →' : 'Play now →'}
      </Link>
    </div>
  )
}

// ── POND WATCH CARD (full-width) ──────────────────────────────────────────────

function PondWatchCard({ userId }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!userId) return
    supabase.from('game_sessions')
      .select('started_at, performance(d_prime, hit_rate, false_alarm_rate, median_rt_ms)')
      .eq('user_id', userId)
      .eq('game_name', 'pond_watch')
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: true })
      .limit(20)
      .then(({ data }) => {
        const perfs = (data ?? []).map(s => s.performance?.[0]).filter(Boolean)
        setRows(perfs)
      })
  }, [userId])
  const hasData = rows && rows.length > 0
  const last = rows?.[rows.length - 1]
  const dPrimes = (rows ?? []).map(r => r.d_prime)
  return (
    <div style={S.gameCard}>
      <div style={S.gameCardInner}>
        <span style={S.gameBadge}>Go / No-Go · Reaction time</span>
        <h2 style={S.gameTitle}>Pond Watch</h2>
        {!hasData ? (
          <p style={S.gameDesc}>{rows === null ? 'Loading…' : 'Watch a pond. Hit spacebar when a duck surfaces. Withhold for everything else. Measures reaction time, sensitivity (d′), and response bias.'}</p>
        ) : (
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 28px', flexShrink: 0 }}>
              {[
                { label: "d′",           value: last.d_prime?.toFixed(2) },
                { label: 'median RT',    value: last.median_rt_ms ? `${Math.round(last.median_rt_ms)} ms` : null },
                { label: 'hit rate',     value: last.hit_rate != null ? `${Math.round(last.hit_rate * 100)}%` : null },
                { label: 'false alarms', value: last.false_alarm_rate != null ? `${Math.round(last.false_alarm_rate * 100)}%` : null },
                { label: 'sessions',     value: rows.length },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: 1 }}>{label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 15, color: 'var(--tx)', fontWeight: 700 }}>{value ?? '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MiniSparkline values={dPrimes} color="#2a9d8f" label="D′ OVER SESSIONS" refVal={0} />
            </div>
          </div>
        )}
      </div>
      <Link to="/games/pond-watch" style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>
        {hasData ? 'Play again →' : 'Play now →'}
      </Link>
    </div>
  )
}

// ── FARM JOY CARD (full-width) ────────────────────────────────────────────────

function FarmJoyCard({ userId }) {
  const [sessionCount, setSessionCount] = useState(null)
  const [words, setWords] = useState(null)
  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('farm_joy_performance')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase.from('farm_joy_value_history')
        .select('value_word, times_planted')
        .eq('user_id', userId)
        .gt('times_planted', 0)
        .order('times_planted', { ascending: false })
        .limit(8),
    ]).then(([sessRes, wordRes]) => {
      setSessionCount(sessRes.count ?? 0)
      setWords(wordRes.data ?? [])
    })
  }, [userId])
  const hasData = words && words.length > 0
  const maxPlanted = hasData ? Math.max(...words.map(w => w.times_planted)) : 1
  return (
    <div style={S.gameCard}>
      <div style={S.gameCardInner}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: hasData ? 0 : 4 }}>
          <div>
            <span style={S.gameBadge}>Values clarification</span>
            <h2 style={S.gameTitle}>Farm Joy</h2>
          </div>
          {hasData && (
            <StatCluster stats={[
              { label: 'sessions', value: sessionCount },
              { label: 'values grown', value: words.length },
            ]} />
          )}
        </div>
        {!hasData ? (
          <p style={S.gameDesc}>{words === null ? 'Loading…' : 'Harvest and grow the values that matter most. Each session reveals which words land in your greenhouse — and which ones take root.'}</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            {words.map(({ value_word, times_planted }) => {
              const t = times_planted / maxPlanted
              return (
                <span key={value_word} style={{
                  fontFamily: MONO, fontSize: 12, padding: '4px 10px', borderRadius: 8,
                  background: `rgba(74,154,106,${0.08 + 0.17 * t})`,
                  color: `rgba(22,90,46,${0.5 + 0.5 * t})`,
                  border: `1px solid rgba(74,154,106,${0.2 + 0.4 * t})`,
                  fontWeight: t > 0.7 ? 600 : 400,
                }}>
                  {value_word}
                </span>
              )
            })}
          </div>
        )}
      </div>
      <Link to="/games/farm-joy" style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>
        {hasData ? 'Play again →' : 'Play now →'}
      </Link>
    </div>
  )
}

// ── CONTACT CARD ─────────────────────────────────────────────────────────────

function ContactSyncArc({ value }) {
  const ARC = 'M 10 64 A 45 45 0 0 1 100 64'
  const ARC_LEN = 141.4
  const color = value >= 0.80 ? '#1D9E75' : value >= 0.50 ? '#7DAE18' : '#BA7517'
  const dashOffset = (ARC_LEN * (1 - Math.max(0, Math.min(1, value)))).toFixed(1)
  return (
    <svg viewBox="0 14 110 58" width={110} height={55} style={{ flexShrink: 0 }}>
      <path d={ARC} fill="none" stroke="var(--bgp)" strokeWidth={6} strokeLinecap="round" />
      <path d={ARC} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={ARC_LEN.toFixed(1)} strokeDashoffset={dashOffset} />
      <text x="55" y="58" textAnchor="middle"
        fontFamily='"Space Mono", monospace' fontSize={14} fontWeight={700} fill="var(--tx)">
        {Math.round(value * 100)}%
      </text>
    </svg>
  )
}

function ContactCard({ userId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('profiles')
      .select('deeper_contact_sessions, deeper_contact_best_sync, deeper_contact_last_sync')
      .eq('id', userId).single()
      .then(({ data: p }) => setData(p ?? {}))
  }, [userId])

  const sessions = data?.deeper_contact_sessions ?? 0
  const lastSync = parseFloat(data?.deeper_contact_last_sync ?? 0)
  const bestSync = parseFloat(data?.deeper_contact_best_sync ?? 0)
  const hasData  = data !== null && sessions > 0

  return (
    <div style={S.gameCard}>
      <div style={S.gameCardInner}>
        <span style={S.gameBadge}>Breath sync · Social sync</span>
        <h2 style={S.gameTitle}>Contact</h2>
        {!hasData ? (
          <p style={S.gameDesc}>
            {data === null
              ? 'Loading…'
              : 'Breathe with your Ripple to make contact and deepen your connection.'}
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <ContactSyncArc value={lastSync} />
              <span style={{ fontFamily: MONO, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)' }}>last sync</span>
            </div>
            <StatCluster stats={[
              { label: 'sessions', value: sessions },
              { label: 'best',     value: `${Math.round(bestSync * 100)}%` },
            ]} />
          </div>
        )}
      </div>
      <Link to="/games/first-contact" style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>
        {hasData ? 'Play again →' : 'Play now →'}
      </Link>
    </div>
  )
}

// ── RIPPLE SECTION ────────────────────────────────────────────────────────────
// Always renders (2026-08-13 Account/My Ripple redesign): the on-platform
// check-in nudge is no longer settings-controlled — same principle GamesPage's
// CheckinReminder already followed — so there's nothing left to gate on here.
//
// RippleGreeting (the contextual serif line that sat above the card) was
// removed 2026-08-15: the Insights widget now leads with a take-home sentence
// doing the same job better, and two stacked data-aware greetings — three
// counting "Hey, {name}" — were part of the clutter Norm called out. Its
// arousal-trend/greetingFor machinery went with it; src/ripple/greetings.js
// is now unreferenced (kept in case a login-prompt use returns).

function RippleSection({ userId }) {
  return <RippleCard userId={userId} />
}

// ── RIPPLE FACE ───────────────────────────────────────────────────────────────
// The Ripple portrait wearing the latest check-in's mood. Exported so
// /dev/insights-preview can render it against synthetic rows without an account.

export function RippleFace({ userId, last, size = 124, devAvatar, bare = false }) {
  const { data: fetched } = useAvatarConfig(devAvatar ? null : userId)
  const avatar = devAvatar ?? fetched

  const sectorId = last?.composite_label ? (LABEL_TO_ID[last.composite_label] ?? -1) : -1
  const em = sectorId >= 0 ? EMOTIONS[sectorId] : null

  const intensityT = last && last.composite_x != null && last.composite_y != null
    ? Math.min(1, Math.hypot(last.composite_x, last.composite_y))
    : 0

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      // `bare` = sits directly on the page beside the check-in bar, as the v2
      // frame draws it. The tiled form is kept for the preview grid.
      ...(bare ? {} : { borderRadius: 24, padding: 10, background: 'var(--bgp)' }),
      filter: em ? `drop-shadow(0 6px 18px ${em.outer}33)` : 'none',
    }}>
      <RippleAvatar
        skinColor={avatar?.skin_color ?? '#FDBCB4'}
        eyeColor={avatar?.eye_color ?? '#4A90D9'}
        species={avatar?.species ?? 'human'}
        hairStyle={avatar?.hair_style ?? 'none'}
        hairColor={avatar?.hair_color ?? '#784421'}
        valence={em ? em.valence : 0}
        arousal={em ? em.arousal : 0}
        intensityT={intensityT}
        pupilTier={em?.pupilTier ?? 1}
        glowColor={em ? em.outer : null}
        size={size}
      />
    </div>
  )
}

// ── RIPPLE CARD ───────────────────────────────────────────────────────────────

// devState: DEV-only escape hatch for /dev/insights-preview, so the assembled
// card can be looked at without a signed-in account with check-in history.
export function RippleCard({ userId, devState }) {
  const [ripple,   setRipple]   = useState(null)
  const [checkins, setCheckins] = useState(null)

  useEffect(() => {
    if (devState || !userId) return
    Promise.all([
      supabase.from('ripples')
        .select('name, streak_current, last_checkin_on')
        .eq('user_id', userId).maybeSingle(),
      // Latest row drives today's mood and intention; the label-only history
      // behind it is what "most often mood" is computed from. Trends themselves
      // live in InsightsWidget (2026-07-30) rather than being drawn twice.
      supabase.from('ripple_checkins')
        .select('composite_label, composite_x, composite_y, local_date, intention')
        .eq('user_id', userId)
        .order('local_date', { ascending: false })
        .limit(400),
    ]).then(([{ data: r }, { data: c }]) => {
      setRipple(r ?? {})
      setCheckins(c ?? [])
    })
  }, [userId, devState])

  const state = devState ?? (ripple === null ? null : { ripple, checkins })
  if (state === null) return null

  const checkedInToday = (() => {
    if (!state.ripple?.last_checkin_on) return false
    const pad = n => String(n).padStart(2, '0')
    const now = new Date()
    return state.ripple.last_checkin_on === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })()

  const last = state.checkins?.[0] ?? null
  const mode = modeLabel(state.checkins ?? [])

  // The Ripple sits OUTSIDE the bar, on the page, not inside the bordered
  // surface (v2 CheckinReminder frame). The face wears the latest mood — see
  // RippleFace for why the expression routes through the EMOTIONS lookup.
  return (
    <div style={S.checkinRow}>
      <RippleFace userId={userId} last={last} size={96} bare />

      <div style={S.checkinBar}>
        {!last ? (
          <p style={{ ...S.gameDesc, margin: 0, flex: 1, minWidth: 200 }}>
            You haven&rsquo;t checked in yet. Start now to track how you&rsquo;re arriving each day.
          </p>
        ) : (
          <>
            <CheckinField
              label={checkedInToday ? 'Today’s intention' : 'Last intention'}
              value={last.intention ? `“${last.intention}”` : '—'}
              italic={!!last.intention}
            />
            <CheckinField
              label={checkedInToday ? 'Today’s mood' : 'Last mood'}
              value={last.composite_label ?? '—'}
            />
            {/* Null until some mood actually repeats — see modeLabel(). */}
            <CheckinField label="Most often mood" value={mode ?? '—'} />
          </>
        )}

        {/* marginLeft:auto — fields pack left, the CTA holds the right edge, as
            the frame draws it. `auto` rather than a spacer so that when the row
            wraps on narrow screens the button simply drops below. */}
        <PrimaryCTA to="/checkin" style={{ flexShrink: 0, marginLeft: 'auto' }}>
          {checkedInToday ? 'Check in again →' : 'Check in now →'}
        </PrimaryCTA>
      </div>
    </div>
  )
}

function CheckinField({ label, value, italic = false }) {
  return (
    <div style={{ minWidth: 110, maxWidth: 320 }}>
      <EyebrowLabel style={{ fontSize: 12, padding: '4px 8px' }}>{label}</EyebrowLabel>
      <div style={{
        fontFamily: SERIF, fontSize: 17, color: 'var(--tx)', marginTop: 8,
        lineHeight: 1.35, fontStyle: italic ? 'italic' : 'normal',
      }}>
        {value}
      </div>
    </div>
  )
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

function GameCard({ title, tag, desc, status, to, muted }) {
  const footer = to
    ? <Link to={to} style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>{status}</Link>
    : <div style={{ ...S.gameStatus, ...(muted ? S.gameStatusMuted : {}) }}>{status}</div>
  return (
    <div style={{ ...S.gameCard, ...(muted ? S.gameCardMuted : {}) }}>
      <div style={S.gameCardInner}>
        <span style={{ ...S.gameBadge, ...(muted ? S.gameBadgeMuted : {}) }}>{tag}</span>
        <h2 style={{ ...S.gameTitle, ...(muted ? { color: 'var(--tx3)' } : {}) }}>{title}</h2>
        <p style={S.gameDesc}>{desc}</p>
      </div>
      {footer}
    </div>
  )
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const MONO  = '"Space Mono", "Courier New", monospace'
const SERIF = '"DM Serif Display", Georgia, serif'

const S = {
  wrap:    { maxWidth: 1100, margin: '0 auto', padding: '48px 32px' },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48, flexWrap: 'wrap', gap: 20 },
  eyebrow: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)', marginBottom: 8 },
  title:   { fontFamily: SERIF, fontSize: 42, color: 'var(--tx)', letterSpacing: -1, marginBottom: 6 },
  sub:     { fontSize: 15, color: 'var(--tx2)' },
  accountBadge: { background: 'var(--bgc)', border: '1px solid var(--bds)', borderRadius: 12, padding: '14px 18px', textAlign: 'right' },
  badgeLabel:   { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 4 },
  badgeEmail:   { fontSize: 14, color: 'var(--tx)', fontWeight: 600 },
  secLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 16 },

  // Check-in reminder: Ripple on the page at the left, bordered bar beside it.
  checkinRow: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  checkinBar: {
    flex: 1, minWidth: 300,
    display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
    background: 'var(--bgc)', border: '1px solid var(--pkbs)',
    borderRadius: 24, padding: '18px 22px',
  },
  gameCard: { background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  gameCardMuted: { border: '1px solid var(--bd)' },
  gameCardInner: { padding: '24px 24px 20px', flex: 1 },
  gameBadge: { display: 'inline-block', fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', padding: '3px 9px', borderRadius: 5, background: 'var(--bgp)', color: 'var(--pkd)', border: '1px solid var(--pkb)', marginBottom: 10 },
  gameBadgeMuted: { background: 'var(--bg)', color: 'var(--tx3)', border: '1px solid var(--bd)' },
  gameTitle: { fontFamily: SERIF, fontSize: 24, color: 'var(--tx)', marginBottom: 8 },
  gameDesc:  { fontSize: 14, color: 'var(--tx2)', lineHeight: 1.6 },
  gameStatus: { padding: '12px 24px', background: 'var(--bgp)', borderTop: '1px solid var(--pkb)', fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  gameStatusMuted: { background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--tx3)' },
  statsPlaceholder: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '40px 32px', textAlign: 'center' },
  placeholderTitle: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', marginBottom: 8 },
  placeholderSub:   { fontSize: 14, color: 'var(--tx2)', maxWidth: 360, margin: '0 auto' },
}
