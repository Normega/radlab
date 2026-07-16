import { useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import { greetingFor } from '../ripple/greetings'

export default function Dashboard({ session }) {
  const navigate    = useNavigate()
  const user        = session?.user
  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'researcher'

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav session={session} />

      <div style={S.wrap}>
        {/* Welcome */}
        <div style={S.header}>
          <div>
            <p style={S.eyebrow}>Dashboard</p>
            <h1 style={S.title}>Hey, {displayName}.</h1>
            <p style={S.sub}>Your lab bench is almost ready.</p>
          </div>
          <div style={S.accountBadge}>
            <p style={S.badgeLabel}>Signed in as</p>
            <p style={S.badgeEmail}>{user?.email}</p>
          </div>
        </div>

        {/* Ripple */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ ...S.secLabel, marginBottom: 0 }}>// Ripple</p>
          <Link to="/profile" style={{ fontFamily: MONO, fontSize: 11, color: 'var(--tx3)', textDecoration: 'none', letterSpacing: '0.05em' }}>settings →</Link>
        </div>
        <RippleSection userId={user?.id} />

        {/* Game cards */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Games</p>
        <div style={S.gameGrid}>
          <StillWaterCard userId={user?.id} />
          <FaceReadCard userId={user?.id} />
          <DriftCard userId={user?.id} />
          <GameCard
            title="Ebb &amp; Flow"
            tag="Interoception · Breath sync"
            desc="Breathe with your Ripple and detect subtle shifts in rhythm. Each session adapts to your sensitivity."
            status="Play now →"
            to="/games/ebb-flow"
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <PondWatchCard userId={user?.id} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FarmJoyCard userId={user?.id} />
          </div>
          <ContactCard userId={user?.id} />
          <GameCard
            title="Owl Barn"
            tag="Auditory detection · Timing"
            desc="A dark barn fills with sounds. Read the hoots, pace your steps, and make it to the other side without getting swooped."
            status="Play now →"
            to="/games/owl-barn"
          />
        </div>

        {/* Stats */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Your stats</p>
        <YourStats userId={user?.id} />

        {/* Account info */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Account</p>
        <div style={S.infoCard}>
          <Row label="Email"        val={user?.email} />
          <Row label="User ID"      val={user?.id?.slice(0, 8) + '…'} mono />
          <Row label="Account type" val="Public" />
          <Row label="Member since" val={new Date(user?.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })} />
        </div>

        {/* Reminders */}
        <p style={{ ...S.secLabel, marginTop: 40 }}>// Reminders</p>
        <Reminders userId={user?.id} />
      </div>
    </div>
  )
}

// ── REMINDERS ────────────────────────────────────────────────────────────────

const REMINDER_OPTIONS = [
  { value: 'none',      label: 'No reminders' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Every two weeks' },
  { value: 'monthly',   label: 'Monthly' },
]

function Reminders({ userId }) {
  const [frequency, setFrequency] = useState('none')
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase.from('profiles').select('reminder_frequency').eq('id', userId).single()
      .then(({ data }) => { if (data?.reminder_frequency) setFrequency(data.reminder_frequency) })
  }, [userId])

  async function handleSelect(value) {
    if (value === frequency) return
    setFrequency(value)

    // TODO: reminder emails sent via Supabase Edge Function + Resend
    // Trigger: pg_cron job queries profiles where reminder_frequency != 'none'
    // and last session > N days ago. Runs weekly. See website.md for plan.
    await supabase.from('profiles').update({ reminder_frequency: value }).eq('id', userId)

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={S.remindersCard}>
      <p style={S.remindersDesc}>
        Get an email nudge when you haven't played in a while. We'll never send more than one email per week.
      </p>
      <div style={S.reminderRow}>
        <div style={S.btnGroup}>
          {REMINDER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              style={{ ...S.reminderBtn, ...(frequency === opt.value ? S.reminderBtnActive : {}) }}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {saved && <span style={S.savedLabel}>Saved</span>}
      </div>
    </div>
  )
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
  const toDot = r => ({ x: CX + r.composite_x * R, y: CY + r.composite_y * R })

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
  const vals = rows.map(r => field === 'valence' ? r.composite_x : -r.composite_y)
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
    ]).then(([{ data: profile }, { data: sessions }]) => {
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
          <div style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: 1 }}>{label}</div>
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
                  <div style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: 1 }}>{label}</div>
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
                  fontFamily: MONO, fontSize: 11, padding: '4px 10px', borderRadius: 8,
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
              <span style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)' }}>last sync</span>
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
// Fetches check_in_enabled once and gates the full Ripple section.

function RippleSection({ userId }) {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('ripples')
        .select('check_in_enabled, prompt_cadence, last_checkin_on')
        .eq('user_id', userId).maybeSingle(),
      supabase.from('ripple_checkins')
        .select('local_date')
        .eq('user_id', userId)
        .order('local_date', { ascending: false })
        .limit(1),
    ]).then(([{ data: r }, { data: ci }]) => {
      const lastCheckinOn = r?.last_checkin_on ?? ci?.[0]?.local_date ?? null
      setConfig(r
        ? { enabled: r.check_in_enabled !== false, cadence: r.prompt_cadence ?? 'daily', lastCheckinOn }
        : { enabled: true, cadence: 'daily', lastCheckinOn }
      )
    })
  }, [userId])

  if (config === null) return null

  if (!config.enabled) return (
    <div style={{ fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', padding: '4px 0 20px', letterSpacing: '0.04em' }}>
      Check-ins are paused.{' '}
      <Link to="/profile" style={{ color: 'var(--pk)', textDecoration: 'none' }}>Manage →</Link>
    </div>
  )

  // Decide whether to show the greeting/prompt based on cadence
  const pad = n => String(n).padStart(2, '0')
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const daysSinceLast = config.lastCheckinOn
    ? Math.round((new Date(todayStr + 'T00:00:00') - new Date(config.lastCheckinOn + 'T00:00:00')) / 86400000)
    : null

  const showGreeting = (() => {
    if (config.cadence === 'never')       return false
    if (config.cadence === 'every_login') return true
    if (config.cadence === 'daily')       return daysSinceLast === null || daysSinceLast >= 1
    if (config.cadence === 'weekly')      return daysSinceLast === null || daysSinceLast >= 7
    return true
  })()

  return (
    <>
      {showGreeting && <RippleGreeting userId={userId} />}
      <RippleCard userId={userId} />
    </>
  )
}

// ── RIPPLE GREETING ───────────────────────────────────────────────────────────

function RippleGreeting({ userId }) {
  const [greeting, setGreeting] = useState(null)
  const [visible,  setVisible]  = useState(false)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('ripples')
        .select('streak_current, last_checkin_on')
        .eq('user_id', userId).maybeSingle(),
      supabase.from('ripple_checkins')
        .select('composite_label, composite_y, local_date')
        .eq('user_id', userId)
        .order('local_date', { ascending: false })
        .limit(7),
    ]).then(([{ data: ripple }, { data: checkins }]) => {
      const pad = n => String(n).padStart(2, '0')
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

      // Days since last check-in — fall back to ripple_checkins if ripples.last_checkin_on is stale
      const lastDate = ripple?.last_checkin_on ?? checkins?.[0]?.local_date ?? null
      let daysSinceLast = null
      if (lastDate) {
        if (lastDate === todayStr) {
          daysSinceLast = 0
        } else {
          const diffMs = new Date(todayStr + 'T00:00:00') - new Date(lastDate + 'T00:00:00')
          daysSinceLast = Math.round(diffMs / 86400000)
        }
      }

      // Arousal trend from last 7 composite_y values.
      // In the circumplex data: composite_y < 0 = high arousal (excited/tense side);
      // composite_y > 0 = low arousal (calm/sad side).
      const ys = (checkins ?? []).map(r => r.composite_y).filter(v => v != null)
      const meanY = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0
      const arousalTrend = meanY < -0.15 ? 'high' : meanY > 0.15 ? 'low' : 'neutral'

      setGreeting(greetingFor({
        compositeLabel: checkins?.[0]?.composite_label ?? null,
        streakDays:     ripple?.streak_current ?? 0,
        daysSinceLast,
        arousalTrend,
      }))
      setTimeout(() => setVisible(true), 80)
    })
  }, [userId])

  if (!greeting) return null

  return (
    <div style={{
      marginBottom: 20,
      opacity:   visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(6px)',
      transition: 'opacity 0.5s ease, transform 0.5s ease',
    }}>
      <p style={{ fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', fontWeight: 400, margin: '0 0 4px' }}>
        {greeting.headline}
      </p>
      <p style={{ fontFamily: MONO, fontSize: 12, color: 'var(--tx3)', margin: 0, letterSpacing: '0.04em' }}>
        {greeting.sub}
      </p>
    </div>
  )
}

// ── RIPPLE CARD ───────────────────────────────────────────────────────────────

function RippleCard({ userId }) {
  const [ripple,   setRipple]   = useState(null)
  const [checkins, setCheckins] = useState(null)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('ripples')
        .select('name, streak_current, last_checkin_on')
        .eq('user_id', userId).maybeSingle(),
      supabase.from('ripple_checkins')
        .select('composite_label, composite_x, composite_y, local_date')
        .eq('user_id', userId)
        .order('local_date', { ascending: true })
        .limit(30),
    ]).then(([{ data: r }, { data: c }]) => {
      setRipple(r ?? {})
      setCheckins(c ?? [])
    })
  }, [userId])

  if (ripple === null) return null

  const name   = ripple?.name
  const streak = ripple?.streak_current ?? 0

  const checkedInToday = (() => {
    if (!ripple?.last_checkin_on) return false
    const pad = n => String(n).padStart(2, '0')
    const now = new Date()
    return ripple.last_checkin_on === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  })()

  const last      = checkins?.length ? checkins[checkins.length - 1] : null
  const hasTrends = checkins && checkins.length >= 2

  // Mode composite label across all check-ins
  const modeLabel = (() => {
    if (!checkins?.length) return null
    const counts = {}
    checkins.forEach(c => { if (c.composite_label) counts[c.composite_label] = (counts[c.composite_label] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  })()

  return (
    <div style={S.gameCard}>
      <div style={S.gameCardInner}>
        {/* Header: name + streak badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <span style={S.gameBadge}>Daily check-in</span>
            <h2 style={S.gameTitle}>{name ?? 'Your Ripple'}</h2>
          </div>
          {streak > 0 && (
            <div style={{ textAlign: 'right', paddingTop: 4, flexShrink: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: 'var(--pk)', lineHeight: 1 }}>{streak}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)', marginTop: 3 }}>day streak</div>
            </div>
          )}
        </div>

        {/* No check-ins yet */}
        {!last && (
          <p style={S.gameDesc}>You haven't checked in yet. Start now to track how you're arriving each day.</p>
        )}

        {/* Single check-in — dot + label */}
        {last && !hasTrends && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <SwMoodGrid rows={[last]} />
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 19, color: 'var(--tx)', marginBottom: 3 }}>
                Feeling {last.composite_label?.toLowerCase() ?? 'balanced'}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--tx3)' }}>
                {checkedInToday ? 'Today' : last.local_date}
              </div>
            </div>
          </div>
        )}

        {/* 2+ check-ins — scatter + sparklines + stats */}
        {hasTrends && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', marginTop: 8 }}>
              <SwMoodGrid rows={checkins} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                <SwLinePlot rows={checkins} field="valence" label="VALENCE" color="#f068a4" />
                <SwLinePlot rows={checkins} field="arousal" label="AROUSAL" color="#9b6bb5" />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <StatCluster stats={[
                { label: 'check-ins',  value: checkins.length },
                { label: 'most often', value: modeLabel?.toLowerCase() ?? '—' },
                { label: 'today',      value: last.composite_label?.toLowerCase() ?? '—' },
              ]} />
            </div>
          </>
        )}
      </div>

      <Link to="/checkin" style={{ ...S.gameStatus, display: 'block', textDecoration: 'none' }}>
        {checkedInToday ? 'Check in again →' : 'Check in now →'}
      </Link>
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

function Row({ label, val, mono }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={{ ...S.rowVal, ...(mono ? { fontFamily: '"Space Mono", monospace', fontSize: 12 } : {}) }}>{val}</span>
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
  gameGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  gameCard: { background: 'var(--bgc)', border: '1px solid var(--pkbs)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  gameCardMuted: { border: '1px solid var(--bd)' },
  gameCardInner: { padding: '24px 24px 20px', flex: 1 },
  gameBadge: { display: 'inline-block', fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', padding: '3px 9px', borderRadius: 5, background: 'var(--bgp)', color: 'var(--pkd)', border: '1px solid var(--pkb)', marginBottom: 10 },
  gameBadgeMuted: { background: 'var(--bg)', color: 'var(--tx3)', border: '1px solid var(--bd)' },
  gameTitle: { fontFamily: SERIF, fontSize: 24, color: 'var(--tx)', marginBottom: 8 },
  gameDesc:  { fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6 },
  gameStatus: { padding: '12px 24px', background: 'var(--bgp)', borderTop: '1px solid var(--pkb)', fontFamily: MONO, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--pk)' },
  gameStatusMuted: { background: 'var(--bg)', borderColor: 'var(--bd)', color: 'var(--tx3)' },
  statsPlaceholder: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '40px 32px', textAlign: 'center' },
  placeholderTitle: { fontFamily: SERIF, fontSize: 22, color: 'var(--tx)', marginBottom: 8 },
  placeholderSub:   { fontSize: 14, color: 'var(--tx2)', maxWidth: 360, margin: '0 auto' },
  infoCard: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, overflow: 'hidden' },
  row:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--bd)' },
  rowLabel: { fontFamily: MONO, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--tx3)' },
  rowVal:   { fontSize: 14, color: 'var(--tx)' },

  remindersCard:  { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 16, padding: '20px 24px' },
  remindersDesc:  { fontSize: 14, color: 'var(--tx2)', marginBottom: 16 },
  reminderRow:    { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  btnGroup:       { display: 'flex', gap: 8, flexWrap: 'wrap' },
  reminderBtn: {
    fontSize: 14, padding: '8px 16px', borderRadius: 9, cursor: 'pointer',
    border: '1px solid var(--bds)', background: 'var(--bgc)', color: 'var(--tx2)',
    fontFamily: 'inherit', transition: 'all 0.15s',
  },
  reminderBtnActive: {
    background: 'var(--pk)', borderColor: 'var(--pk)', color: '#fff',
  },
  savedLabel: { fontFamily: MONO, fontSize: 13, color: 'var(--pk)' },
}
