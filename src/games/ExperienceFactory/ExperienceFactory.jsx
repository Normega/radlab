import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Nav from '../../components/Nav'
import GameIntro from '../shared/GameIntro'
import AURenderer from '../shared/AURenderer'
import { EXPRESSION_TABLE } from '../shared/expressionTable'
import { supabase as globalSupabase } from '../../lib/supabase'
import { dbWrite } from '../../lib/dbWrite'
import { useSubmitLock } from '../../lib/useSubmitLock'
import {
  CATEGORIES, CATEGORY_META, LEVELS, MAX_LEVEL, UNLOCK_ACCURACY,
  POINTS_PER_MIN, POINTS_CAP, buildSortItems, buildPracticeItems, INTRO_TRIPLET,
} from './constants'

/*
 * Experience Factory — sort objects of awareness into thoughts, feelings and
 * sensations on a steampunk conveyor belt. Design: ./DESIGN.md (v0.2).
 *
 * Schema: supabase/migrations/20260915_experience_factory.sql
 * (experience_factory_trials is a response table: append-only triggers, RLS,
 * and an entry in src/lib/responsesAppendOnly.test.mjs RESPONSE_TABLES.)
 *
 * Feedback contract (Norm, 2026-09-15): per-trial feedback exists ONLY in the
 * practice block (wrong crates fall to the floor there, with a teaching note).
 * Real sort rounds and observe rounds give none — every crate rides to the
 * chosen orb — so labelling stays in a receptive noticing mode; correctness is
 * reported after each sort round, targeted at the 1-2 lowest-accuracy cells.
 */

// ─── AUDIO (procedural, no assets) ────────────────────────────────────────────

let _ctx = null
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

function envTone(ctx, freq, t0, decay, peak = 0.14) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = 'sine'; osc.frequency.value = freq
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.06)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + decay)
  osc.start(t0); osc.stop(t0 + decay + 0.05)
  return osc
}

function playSensationTone(spec) {
  try {
    const ctx = getCtx()
    const t = ctx.currentTime
    if (spec.type === 'tone') {
      envTone(ctx, spec.freq, t, spec.decay)
    } else if (spec.type === 'sweep') {
      const osc = envTone(ctx, spec.from, t, spec.dur + 0.2)
      osc.frequency.linearRampToValueAtTime(spec.to, t + spec.dur)
    } else if (spec.type === 'pair') {
      envTone(ctx, spec.freqs[0], t, spec.decay)
      envTone(ctx, spec.freqs[1], t + spec.gap, spec.decay)
    }
  } catch (_) { /* audio is decorative for muted contexts */ }
}

function playClunk() {
  try {
    const ctx = getCtx()
    envTone(ctx, 180, ctx.currentTime, 0.35, 0.1)
  } catch (_) { /* noop */ }
}

// ─── SESSION PLAN ─────────────────────────────────────────────────────────────

function buildPlan(levelCfg) {
  return [
    { type: 'practice', roundNumber: 0, items: buildPracticeItems(levelCfg, levelCfg.practiceCount) },
    { type: 'sort',     roundNumber: 1, items: buildSortItems(levelCfg, levelCfg.sortCount) },
    { type: 'report',   roundNumber: 1 },
    { type: 'observe',  roundNumber: 2, count: levelCfg.observeCount },
    { type: 'sort',     roundNumber: 3, items: buildSortItems(levelCfg, levelCfg.sortCount) },
    { type: 'report',   roundNumber: 3 },
    { type: 'observe',  roundNumber: 4, count: levelCfg.observeCount },
  ]
}

const TEACH_LINES = {
  thought:   'Words in the mind: a judgment, prediction, memory, or plan.',
  feeling:   'An emotion, named or shown. It colors everything and claims nothing.',
  sensation: 'The body or the senses speaking: pressure, warmth, sound, color.',
}

// ─── ANALYSIS ─────────────────────────────────────────────────────────────────

function analyzeSortTrials(trials) {
  const byCategory = {}
  const byTier = {}
  const hits = {}; const falseAlarms = {}
  for (const c of CATEGORIES) { byCategory[c] = { n: 0, correct: 0 }; hits[c] = 0; falseAlarms[c] = 0 }
  let missed = 0

  for (const t of trials) {
    const cat = t.item.category
    byCategory[cat].n += 1
    if (t.correct) byCategory[cat].correct += 1
    const tier = `tier${t.item.tier}`
    byTier[tier] = byTier[tier] ?? { n: 0, correct: 0 }
    byTier[tier].n += 1
    if (t.correct) byTier[tier].correct += 1
    if (t.chosen == null) { missed += 1; continue }
    if (t.chosen === cat) hits[cat] += 1
    else falseAlarms[t.chosen] += 1
  }

  const acc = cell => (cell.n > 0 ? cell.correct / cell.n : null)
  return {
    total: trials.length,
    correct: trials.filter(t => t.correct).length,
    missed,
    accuracyByCategory: Object.fromEntries(CATEGORIES.map(c => [c, acc(byCategory[c])])),
    accuracyByTier: Object.fromEntries(Object.entries(byTier).map(([k, v]) => [k, acc(v)])),
    countsByCategory: Object.fromEntries(CATEGORIES.map(c => [c, byCategory[c]])),
    hits, falseAlarms,
  }
}

/** The 1-2 lowest-accuracy categories worth talking about, per DESIGN.md. */
function reportTargets(analysis) {
  return CATEGORIES
    .map(c => ({ category: c, ...analysis.countsByCategory[c], acc: analysis.accuracyByCategory[c] }))
    .filter(t => t.n > 0 && t.acc < 1)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 2)
}

// ─── SCENE ────────────────────────────────────────────────────────────────────

const ORB_X = { thought: '16%', feeling: '50%', sensation: '84%' }

function ItemFace({ item, size = 78 }) {
  return <AURenderer position={EXPRESSION_TABLE[item.emotion][item.zone]} size={size} />
}

function ItemCard({ item }) {
  if (item.modality === 'face') {
    return <div style={S.itemFace}><ItemFace item={item} /></div>
  }
  if (item.modality === 'color') {
    return <div style={{ ...S.itemColor, background: item.hex, boxShadow: `0 0 26px ${item.hex}` }} />
  }
  if (item.modality === 'tone') {
    return (
      <div style={S.itemTone} onClick={() => playSensationTone(item.spec)} title="Replay">
        <span style={{ fontSize: 30 }}>♪</span>
      </div>
    )
  }
  if (item.modality === 'orb') {
    return <div style={S.questionOrb}>?</div>
  }
  return <div style={S.itemText}>{item.text}</div>
}

function Crate({ label, color }) {
  return (
    <div style={{ ...S.crate, borderColor: color }}>
      <span style={{ ...S.crateLabel, color }}>{label}</span>
    </div>
  )
}

function Scene({ item, itemState, chosen, travelMs, orbCounts, orbPulse }) {
  const meta = chosen ? CATEGORY_META[chosen] : null

  let pos = { left: '-14%', top: 96, transform: 'translate(-50%, -50%)', opacity: 1, transitionDuration: '0ms' }
  if (itemState === 'entering') pos = { left: '50%', top: 96, transform: 'translate(-50%, -50%)', opacity: 1, transitionDuration: `${travelMs}ms`, transitionTimingFunction: 'linear' }
  if (itemState === 'gate')     pos = { left: '50%', top: 96, transform: 'translate(-50%, -50%)', opacity: 1, transitionDuration: '0ms' }
  if (itemState === 'crate' && meta) pos = { left: ORB_X[chosen], top: 216, transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0.15, transitionDuration: '650ms', transitionTimingFunction: 'ease-in' }
  if (itemState === 'floor')    pos = { left: '50%', top: 268, transform: 'translate(-50%, -50%) rotate(24deg)', opacity: 0, transitionDuration: '800ms', transitionTimingFunction: 'ease-in' }
  if (itemState === 'missed')   pos = { left: '116%', top: 96, transform: 'translate(-50%, -50%)', opacity: 0.7, transitionDuration: '650ms', transitionTimingFunction: 'linear' }

  return (
    <div style={S.scene}>
      {/* belt */}
      <div style={S.belt}>
        <div style={S.beltStripes} />
      </div>
      {/* gate arch */}
      <div style={S.gate} />
      {/* the travelling item (keyed by caller so each trial remounts) */}
      {item && itemState !== 'idle' && itemState !== 'teach' && (
        <div style={{ ...S.itemWrap, ...pos }}>
          {(itemState === 'crate' || itemState === 'floor') && meta && (
            <Crate label={meta.label} color={meta.color} />
          )}
          <ItemCard item={item} />
        </div>
      )}
      {/* orbs */}
      {CATEGORIES.map(c => {
        const m = CATEGORY_META[c]
        const count = orbCounts[c]
        const pulsing = orbPulse === c
        const dia = 44 + Math.min(22, count * 2)
        return (
          <div key={c} style={{ ...S.orbSlot, left: ORB_X[c] }}>
            <div style={{
              ...S.orb, width: dia, height: dia,
              background: `radial-gradient(circle at 35% 30%, #fff8, ${m.color} 60%, #00000030)`,
              boxShadow: `0 0 ${pulsing ? 34 : 16}px ${m.glow}`,
              transform: pulsing ? 'scale(1.12)' : 'scale(1)',
            }} />
            <div style={{ ...S.orbLabel, color: m.color }}>{m.label}s · {count}</div>
          </div>
        )
      })}
    </div>
  )
}

function SortButtons({ enabled, onChoose }) {
  return (
    <div style={S.buttonRow}>
      {CATEGORIES.map(c => {
        const m = CATEGORY_META[c]
        return (
          <button
            key={c}
            disabled={!enabled}
            onClick={() => onChoose(c)}
            style={{
              ...S.sortBtn,
              borderColor: m.color,
              color: enabled ? m.color : '#6b5c50',
              opacity: enabled ? 1 : 0.55,
              cursor: enabled ? 'pointer' : 'default',
            }}
          >
            <span style={S.sortBtnKey}>{m.key}</span>
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── SCREENS ──────────────────────────────────────────────────────────────────

function LeverSelector({ level, unlockedLevel, onSelect }) {
  return (
    <div style={S.lever}>
      <div style={S.leverTitle}>Difficulty lever</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {LEVELS.map(l => {
          const locked = l.level > unlockedLevel
          const active = l.level === level
          return (
            <button
              key={l.level}
              disabled={locked}
              onClick={() => onSelect(l.level)}
              style={{
                ...S.leverBtn,
                background: active ? '#B08D57' : 'rgba(255,255,255,0.07)',
                color: active ? '#241D18' : locked ? '#6b5c50' : '#E8D5B5',
                cursor: locked ? 'default' : 'pointer',
              }}
            >
              {locked ? '🔒 ' : ''}{l.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TripletCard() {
  return (
    <div style={S.triplet}>
      <div style={S.tripletHead}>One moment, three levels:</div>
      {INTRO_TRIPLET.map(t => (
        <div key={t.category} style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'center' }}>
          <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, color: CATEGORY_META[t.category].color, width: 78, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {CATEGORY_META[t.category].label}
          </span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

function ReportScreen({ analysis, roundNumber, onContinue }) {
  const targets = reportTargets(analysis)
  const solid = targets.length === 0

  return (
    <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
      <p style={S.eyebrow}>Inspection · Round {roundNumber === 1 ? 'one' : 'two'}</p>
      <h2 style={S.h2}>{solid ? 'The inspector nods.' : 'From the inspection log'}</h2>
      <p style={S.sub}>
        {analysis.correct} of {analysis.total} sorted true
        {analysis.missed > 0 ? ` · ${analysis.missed} drifted past unsorted` : ''}
      </p>

      {solid && (
        <div style={S.reportCard}>
          <p style={{ ...S.reportBody, margin: 0 }}>Every category held. The belt speeds on.</p>
        </div>
      )}

      {targets.map(t => {
        const m = CATEGORY_META[t.category]
        const systematic = t.acc < 0.34
        const misses = analysis.misses[t.category] ?? []
        return (
          <div key={t.category} style={S.reportCard}>
            <div style={{ ...S.reportHead, color: m.color }}>
              {m.label}s: {t.correct} of {t.n}
              {systematic ? ' · below chance' : ''}
            </div>
            <p style={S.reportBody}>
              {systematic
                ? `Fewer than a coin toss would get. Something about ${m.label.toLowerCase()}s is being read as another category — worth slowing down on.`
                : TEACH_LINES[t.category]}
            </p>
            {misses.slice(0, 2).map(x => (
              <div key={x.item.id} style={S.reportExample}>
                <span style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {x.item.modality === 'face' ? 'an expression'
                    : x.item.modality === 'color' ? x.item.text
                    : x.item.modality === 'tone' ? x.item.text
                    : `"${x.item.text}"`}
                </span>
                <span style={{ color: m.color }}> is a {m.label.toLowerCase()}</span>
                {x.item.note ? <span style={{ color: 'rgba(255,255,255,0.6)' }}> — {x.item.note}</span> : null}
              </div>
            ))}
          </div>
        )
      })}

      <button style={S.btnPrimary} onClick={onContinue}>Back to the floor →</button>
    </div>
  )
}

function SummaryScreen({ summary, levelCfg, orbCounts, onAgain, unlockedNext }) {
  const pct = Math.round(summary.sortAccuracy * 100)
  return (
    <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
      <p style={S.eyebrow}>Shift complete</p>
      <h1 style={S.h1}>{pct}% sorted true</h1>
      <p style={S.sub}>
        {levelCfg.name} setting · {summary.points} points earned
        {unlockedNext ? ` · ${LEVELS[levelCfg.level].name} unlocked on the lever` : ''}
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 22, margin: '18px 0 8px' }}>
        {CATEGORIES.map(c => {
          const m = CATEGORY_META[c]
          const dia = 52 + Math.min(34, orbCounts[c] * 2.5)
          return (
            <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: dia, height: dia, borderRadius: '50%',
                background: `radial-gradient(circle at 35% 30%, #fff8, ${m.color} 60%, #00000030)`,
                boxShadow: `0 0 22px ${m.glow}`,
              }} />
              <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, color: m.color }}>
                {m.label}s · {orbCounts[c]}
              </div>
            </div>
          )
        })}
      </div>

      <div style={S.summaryCard}>
        <div style={S.summaryRow}>
          <span>Sorting accuracy</span>
          <span>{summary.correct} / {summary.total}</span>
        </div>
        {CATEGORIES.map(c => (
          <div key={c} style={S.summaryRow}>
            <span style={{ color: CATEGORY_META[c].color }}>{CATEGORY_META[c].label}s</span>
            <span>{summary.accuracyByCategory[c] == null ? '—' : `${Math.round(summary.accuracyByCategory[c] * 100)}%`}</span>
          </div>
        ))}
        <div style={{ ...S.summaryRow, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          <span>Your own experience, sorted</span>
          <span>
            {CATEGORIES.map(c => summary.observeCounts[c]).join(' · ')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...S.btnOutline, flex: 1 }} onClick={onAgain}>Again</button>
        <Link to="/games" style={{ ...S.btnPrimary, flex: 1, marginTop: 0, textDecoration: 'none' }}>Games →</Link>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function ExperienceFactory({
  session,
  // Study contract (GameStepWrapper) — unused on the standalone route but
  // accepted from day one so study wiring later is one map entry.
  studyMode = false, userId: userIdProp, studyId = null, scheduleId = null,
  supabaseClient = null, isSimMode = false, onSessionComplete,
}) {
  const db = supabaseClient ?? globalSupabase
  const userId = userIdProp ?? session?.user?.id ?? null
  const [searchParams] = useSearchParams()
  const sim = isSimMode || searchParams.get('sim') === '1'

  const [phase, setPhase] = useState('intro')       // intro | round | report | summary
  const [level, setLevel] = useState(1)
  const [unlockedLevel, setUnlockedLevel] = useState(1)
  const [roundIdx, setRoundIdx] = useState(0)
  const [trialIdx, setTrialIdx] = useState(0)
  const [itemState, setItemState] = useState('idle') // idle | entering | gate | crate | floor | teach | missed
  const [chosen, setChosen] = useState(null)
  const [orbCounts, setOrbCounts] = useState({ thought: 0, feeling: 0, sensation: 0 })
  const [orbPulse, setOrbPulse] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [summary, setSummary] = useState(null)
  const [unlockedNext, setUnlockedNext] = useState(false)

  const planRef = useRef([])
  const sessionIdRef = useRef(null)
  const startTsRef = useRef(null)
  const gateTsRef = useRef(null)
  const sortTrialsRef = useRef([])       // real sort rounds only
  const roundTrialsRef = useRef([])      // current sort round, for the report
  const observeCountsRef = useRef({ thought: 0, feeling: 0, sensation: 0 })
  const timersRef = useRef([])
  const keyHandlerRef = useRef(null)
  const teachRef = useRef(null)          // { item, chosen } during practice teach

  const { submit } = useSubmitLock('experience_factory_complete')

  const levelCfg = LEVELS[level - 1]
  const round = planRef.current[roundIdx] ?? null
  const currentItem = round?.type === 'observe'
    ? { id: null, category: null, modality: 'orb', tier: null }
    : round?.items?.[trialIdx] ?? null

  const later = useCallback((fn, ms) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
    return t
  }, [])

  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  // Unlocked lever settings, derived from past performance rows: completing
  // level N at UNLOCK_ACCURACY unlocks N+1, strictly in sequence.
  useEffect(() => {
    if (!userId) return
    db.from('experience_factory_performance').select('level, sort_accuracy').eq('user_id', userId)
      .then(({ data }) => {
        if (!data) return
        let u = 1
        while (u < MAX_LEVEL && data.some(r => r.level === u && Number(r.sort_accuracy) >= UNLOCK_ACCURACY)) u++
        setUnlockedLevel(u)
      })
  }, [userId, db])

  // ── DB writes ──────────────────────────────────────────────────────────────

  function startSession() {
    if (!userId) return
    db.from('game_sessions').insert({
      user_id: userId, game_name: 'experience_factory', study_id: studyId,
      started_at: new Date().toISOString(),
    }).select('id').single().then(({ data }) => { sessionIdRef.current = data?.id ?? null })
  }

  function saveTrial({ roundType, roundNumber, trialIndex, item, chosenCat, correct, rtMs }) {
    if (!sessionIdRef.current) return
    db.from('experience_factory_trials').insert({
      session_id: sessionIdRef.current,
      user_id: userId,
      schedule_id: scheduleId,
      level,
      round_index: roundNumber,
      round_type: roundType,
      trial_index: trialIndex,
      item_id: item?.id ?? null,
      item_modality: item?.modality === 'orb' ? null : item?.modality ?? null,
      item_tier: item?.tier ?? null,
      canonical_category: item?.category ?? null,
      chosen_category: chosenCat,
      correct,
      rt_ms: rtMs,
      belt_speed: levelCfg.travelMs,
    }).then(() => {})
  }

  async function saveSessionComplete(finalSummary) {
    await submit(async () => {
      if (sessionIdRef.current) {
        await dbWrite(
          db.from('game_sessions')
            .update({ ended_at: new Date().toISOString() })
            .eq('id', sessionIdRef.current)
            .select('id'),
          'game_sessions.ended_at', { expectRows: true },
        )
        const { error } = await db.from('experience_factory_performance').insert({
          session_id: sessionIdRef.current,
          user_id: userId,
          schedule_id: scheduleId,
          level,
          sort_trials: finalSummary.total,
          sort_correct: finalSummary.correct,
          sort_missed: finalSummary.missed,
          sort_accuracy: parseFloat(finalSummary.sortAccuracy.toFixed(4)),
          accuracy_by_category: finalSummary.accuracyByCategory,
          accuracy_by_tier: finalSummary.accuracyByTier,
          hits_by_category: finalSummary.hits,
          false_alarms_by_category: finalSummary.falseAlarms,
          observe_counts: finalSummary.observeCounts,
          duration_s: finalSummary.durationS,
          points_awarded: finalSummary.points,
        })
        if (error) throw error
      }
      if (userId && !studyMode) {
        const { data: p } = await db.from('profiles').select('experience_factory_sessions, points').eq('id', userId).single()
        const updates = { experience_factory_sessions: (p?.experience_factory_sessions ?? 0) + 1 }
        if (p?.points !== undefined) updates.points = (p.points ?? 0) + finalSummary.points
        await dbWrite(
          db.from('profiles').update(updates).eq('id', userId).select('id'),
          'profiles.experience_factory_progress', { expectRows: true },
        )
      }
      onSessionComplete?.({
        sort_accuracy: finalSummary.sortAccuracy,
        sort_trials: finalSummary.total,
        observe_counts: finalSummary.observeCounts,
        level,
        points: finalSummary.points,
      })
    }).catch(() => { /* lock released by throw; participant can leave via nav */ })
  }

  // ── Flow ───────────────────────────────────────────────────────────────────

  function startGame() {
    getCtx() // warm up AudioContext inside the click (iOS policy)
    planRef.current = buildPlan(levelCfg)
    sortTrialsRef.current = []
    roundTrialsRef.current = []
    observeCountsRef.current = { thought: 0, feeling: 0, sensation: 0 }
    startTsRef.current = Date.now()
    setOrbCounts({ thought: 0, feeling: 0, sensation: 0 })
    setSummary(null)
    setUnlockedNext(false)
    setRoundIdx(0)
    setTrialIdx(0)
    setItemState('idle')
    setPhase('round')
    startSession()
    later(() => beginTrial(), 400)
  }

  function beginTrial() {
    setChosen(null)
    // 'pre' paints one frame at the belt's left edge so the ride to the gate
    // is a real CSS transition rather than an instant appearance.
    setItemState('pre')
  }

  useEffect(() => {
    if (itemState !== 'pre') return
    const t = later(() => setItemState('entering'), 40)
    return () => clearTimeout(t)
  }, [itemState, roundIdx, trialIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // entering → gate after travelMs (observe orbs ride the same belt)
  useEffect(() => {
    if (itemState !== 'entering' || !round) return
    const t = later(() => {
      gateTsRef.current = Date.now()
      setItemState('gate')
    }, levelCfg.travelMs)
    return () => clearTimeout(t)
  }, [itemState, roundIdx, trialIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // at the gate: play tone items; arm the dwell timeout on real sort rounds
  useEffect(() => {
    if (itemState !== 'gate' || !round) return
    if (currentItem?.modality === 'tone') playSensationTone(currentItem.spec)
    if (round.type === 'sort' && levelCfg.dwellMs != null) {
      const t = later(() => resolveMissed(), levelCfg.dwellMs)
      return () => clearTimeout(t)
    }
  }, [itemState, roundIdx, trialIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // sim mode: auto-answer at the gate, auto-advance interstitials
  useEffect(() => {
    if (!sim) return
    if (itemState === 'gate') {
      const t = later(() => {
        const pick = Math.random() < 0.85 && currentItem?.category
          ? currentItem.category
          : CATEGORIES[Math.floor(Math.random() * 3)]
        handleChoose(pick)
      }, 300)
      return () => clearTimeout(t)
    }
    if (itemState === 'teach') { const t = later(() => advanceTrial(), 300); return () => clearTimeout(t) }
    if (phase === 'report') { const t = later(() => continueFromReport(), 400); return () => clearTimeout(t) }
  }, [sim, itemState, phase, roundIdx, trialIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  function resolveMissed() {
    const item = round.items[trialIdx]
    const record = { item, chosen: null, correct: false, rtMs: null }
    roundTrialsRef.current.push(record)
    sortTrialsRef.current.push(record)
    saveTrial({ roundType: 'sort', roundNumber: round.roundNumber, trialIndex: trialIdx, item, chosenCat: null, correct: false, rtMs: null })
    setItemState('missed')
    later(() => advanceTrial(), 700)
  }

  function handleChoose(cat) {
    if (itemState !== 'gate' || !round) return
    const rtMs = Date.now() - gateTsRef.current
    setChosen(cat)

    if (round.type === 'observe') {
      observeCountsRef.current[cat] += 1
      saveTrial({ roundType: 'observe', roundNumber: round.roundNumber, trialIndex: trialIdx, item: null, chosenCat: cat, correct: null, rtMs })
      rideToOrb(cat)
      return
    }

    const item = round.items[trialIdx]
    const correct = cat === item.category
    const roundType = round.type
    const record = { item, chosen: cat, correct, rtMs }
    if (roundType === 'sort') {
      roundTrialsRef.current.push(record)
      sortTrialsRef.current.push(record)
    }
    saveTrial({ roundType, roundNumber: round.roundNumber, trialIndex: trialIdx, item, chosenCat: cat, correct, rtMs })

    if (roundType === 'practice' && !correct) {
      // The one place failure feedback exists: the crate misses the spur.
      setItemState('floor')
      playClunk()
      teachRef.current = { item, chosen: cat }
      later(() => setItemState('teach'), 820)
      return
    }
    rideToOrb(cat)
  }

  function rideToOrb(cat) {
    setItemState('crate')
    later(() => {
      playClunk()
      setOrbCounts(c => ({ ...c, [cat]: c[cat] + 1 }))
      setOrbPulse(cat)
      later(() => setOrbPulse(null), 450)
      advanceTrial()
    }, 680)
  }

  function advanceTrial() {
    teachRef.current = null
    const count = round.type === 'observe' ? round.count : round.items.length
    if (trialIdx + 1 < count) {
      setTrialIdx(i => i + 1)
      // Observe rounds keep the sort-round cadence (Norm, playtest 2026-09-15):
      // the next question orb arrives right away and waits at the gate, so the
      // participant self-paces by pressing when ready, not by waiting for orbs.
      setItemState('idle')
      later(() => beginTrial(), 420)
    } else {
      finishRound()
    }
  }

  function finishRound() {
    if (round.type === 'sort') {
      const trials = roundTrialsRef.current
      const analysis = analyzeSortTrials(trials)
      analysis.misses = {}
      for (const t of trials) {
        if (t.correct || t.chosen == null) continue
        ;(analysis.misses[t.item.category] = analysis.misses[t.item.category] ?? []).push(t)
      }
      roundTrialsRef.current = []
      setReportData({ analysis, roundNumber: round.roundNumber === 1 ? 1 : 2 })
      setRoundIdx(i => i + 1) // the report entry in the plan
      setItemState('idle')
      setPhase('report')
      return
    }
    // practice or observe: straight to the next plan entry
    const next = roundIdx + 1
    if (next < planRef.current.length) {
      setRoundIdx(next)
      setTrialIdx(0)
      setItemState('idle')
      later(() => beginTrial(), 800)
    } else {
      finishSession()
    }
  }

  function continueFromReport() {
    const next = roundIdx + 1
    setPhase('round')
    setReportData(null)
    if (next < planRef.current.length) {
      setRoundIdx(next)
      setTrialIdx(0)
      setItemState('idle')
      later(() => beginTrial(), 800)
    } else {
      finishSession()
    }
  }

  function finishSession() {
    const all = analyzeSortTrials(sortTrialsRef.current)
    const durationS = Math.round((Date.now() - startTsRef.current) / 1000)
    const points = Math.min(POINTS_CAP, Math.max(5, Math.round((durationS / 60) * POINTS_PER_MIN)))
    const sortAccuracy = all.total > 0 ? all.correct / all.total : 0
    const finalSummary = {
      ...all, sortAccuracy, durationS, points,
      observeCounts: { ...observeCountsRef.current },
    }
    const unlocked = sortAccuracy >= UNLOCK_ACCURACY && level < MAX_LEVEL
    setUnlockedNext(unlocked)
    if (unlocked) setUnlockedLevel(u => Math.max(u, level + 1))
    setSummary(finalSummary)
    setPhase('summary')
    saveSessionComplete(finalSummary)
  }

  // keyboard: 1/2/3 or T/F/S sort; Space advances teach panels
  keyHandlerRef.current = (e) => {
    if (phase !== 'round') return
    const k = e.key.toLowerCase()
    const byKey = { 1: 'thought', 2: 'feeling', 3: 'sensation', t: 'thought', f: 'feeling', s: 'sensation' }
    if (byKey[k]) { e.preventDefault(); handleChoose(byKey[k]) }
    if (e.code === 'Space' && itemState === 'teach') { e.preventDefault(); advanceTrial() }
  }
  useEffect(() => {
    const onKey = e => keyHandlerRef.current?.(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  const roundLabel = !round ? ''
    : round.type === 'practice' ? 'Practice — the belt waits for you'
    : round.type === 'sort' ? `Sort round ${round.roundNumber === 1 ? 'one' : 'two'}`
    : 'Observe — sort what is most present in you right now'

  const teach = teachRef.current

  return (
    <div style={S.page}>
      {!studyMode && <Nav session={session} />}
      <div style={S.stage}>

        {phase === 'intro' && (
          <GameIntro
            tone="dark"
            title="Experience Factory."
            lead={<>Everything that enters awareness arrives on this belt.<br />Your job at the gate: name what kind of thing it is.</>}
            visual={
              <div style={{ marginBottom: 20 }}>
                <TripletCard />
                <LeverSelector level={level} unlockedLevel={unlockedLevel} onSelect={setLevel} />
              </div>
            }
            steps={[
              { title: 'Sort the arrivals', body: 'Thought, feeling, or sensation — press the matching button and a labeled crate carries it to its orb.' },
              { title: 'Then sort yourself', body: 'A question orb means: whatever is most present in your own experience right now, sort that. There is no wrong answer there.' },
              { title: 'Read the inspection log', body: 'No grading mid-shift. After each sort round the log shows where your sorting held and where it slipped.' },
            ]}
            note="About 5 minutes. Sound on if you can — some arrivals are heard, not seen."
            cta="Clock in →"
            onStart={startGame}
          />
        )}

        {phase === 'round' && round && (
          <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={S.roundHead}>
              <span style={S.eyebrow}>{roundLabel}</span>
              <span style={S.trialCount}>
                {trialIdx + 1} / {round.type === 'observe' ? round.count : round.items.length}
              </span>
            </div>

            <Scene
              key={`${roundIdx}-${trialIdx}`}
              item={currentItem}
              itemState={itemState}
              chosen={chosen}
              travelMs={levelCfg.travelMs}
              orbCounts={orbCounts}
              orbPulse={orbPulse}
            />

            {itemState === 'teach' && teach ? (
              <div style={S.teachCard}>
                <div style={{ ...S.reportHead, color: CATEGORY_META[teach.item.category].color }}>
                  That was a {CATEGORY_META[teach.item.category].label.toLowerCase()}
                </div>
                <p style={S.reportBody}>{teach.item.note ?? TEACH_LINES[teach.item.category]}</p>
                <button style={{ ...S.btnPrimary, marginTop: 4 }} onClick={advanceTrial}>Next →</button>
              </div>
            ) : (
              <SortButtons enabled={itemState === 'gate'} onChoose={handleChoose} />
            )}

            {round.type === 'observe' && itemState === 'gate' && (
              <p style={S.hint}>take your time — sort it when you can name it</p>
            )}
          </div>
        )}

        {phase === 'report' && reportData && (
          <ReportScreen
            analysis={reportData.analysis}
            roundNumber={reportData.roundNumber}
            onContinue={continueFromReport}
          />
        )}

        {phase === 'summary' && summary && (
          <SummaryScreen
            summary={summary}
            levelCfg={levelCfg}
            orbCounts={orbCounts}
            unlockedNext={unlockedNext}
            onAgain={() => setPhase('intro')}
          />
        )}
      </div>
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const BRASS = '#B08D57'

const S = {
  page:  { background: '#241D18', minHeight: '100vh' },
  stage: { minHeight: 'calc(100vh - 57px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', userSelect: 'none' },

  eyebrow: { fontFamily: '"Space Mono", monospace', fontSize: 11, color: 'rgba(232,213,181,0.65)', letterSpacing: '0.1em', textTransform: 'uppercase' },
  h1:  { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 30, color: '#F3E9D7', fontWeight: 400, margin: '6px 0 8px' },
  h2:  { fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 24, color: '#F3E9D7', fontWeight: 400, margin: '6px 0 8px' },
  sub: { color: 'rgba(232,213,181,0.7)', fontSize: 13, marginBottom: 18, lineHeight: 1.6 },
  hint: { fontFamily: '"Space Mono", monospace', fontSize: 11, color: 'rgba(232,213,181,0.45)', letterSpacing: '0.06em', textAlign: 'center', margin: 0 },

  roundHead: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  trialCount: { fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'rgba(232,213,181,0.5)' },

  scene: { position: 'relative', width: '100%', maxWidth: 440, height: 300, background: 'linear-gradient(180deg, #2E251E 0%, #241D18 70%)', borderRadius: 18, border: `1px solid ${BRASS}44`, overflow: 'hidden' },
  belt:  { position: 'absolute', left: 0, right: 0, top: 118, height: 26, background: '#3A2F26', borderTop: `2px solid ${BRASS}66`, borderBottom: `2px solid ${BRASS}66` },
  beltStripes: { width: '100%', height: '100%', backgroundImage: `repeating-linear-gradient(90deg, transparent 0 22px, ${BRASS}22 22px 26px)` },
  gate:  { position: 'absolute', left: '50%', top: 20, transform: 'translateX(-50%)', width: 120, height: 118, border: `2px solid ${BRASS}55`, borderBottom: 'none', borderRadius: '14px 14px 0 0' },

  itemWrap: { position: 'absolute', transitionProperty: 'left, top, transform, opacity', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  itemText: { maxWidth: 150, background: '#F3E9D7', color: '#33261C', borderRadius: 10, padding: '10px 12px', fontSize: 13, lineHeight: 1.4, textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' },
  itemFace: { background: '#F3E9D7', borderRadius: 12, padding: 4, boxShadow: '0 4px 14px rgba(0,0,0,0.4)' },
  itemColor: { width: 74, height: 74, borderRadius: 12, border: '3px solid #F3E9D7' },
  itemTone: { width: 72, height: 72, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, #E8D5B5, ${BRASS})`, color: '#33261C', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.4)', cursor: 'pointer' },
  questionOrb: { width: 70, height: 70, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #ffffffcc, #cfc3e8 55%, #8f80b8)', color: '#4A3F6B', fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 26px rgba(200,185,235,0.5)' },

  crate: { position: 'absolute', inset: -8, border: '3px solid', borderRadius: 10, background: 'rgba(36,29,24,0.35)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pointerEvents: 'none' },
  crateLabel: { fontFamily: '"Space Mono", monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', background: '#241D18', padding: '1px 6px', borderRadius: 4, transform: 'translateY(-9px)' },

  orbSlot: { position: 'absolute', top: 196, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 110 },
  orb: { borderRadius: '50%', transition: 'all 0.35s' },
  orbLabel: { fontFamily: '"Space Mono", monospace', fontSize: 10, letterSpacing: '0.05em' },

  buttonRow: { display: 'flex', gap: 10, width: '100%' },
  sortBtn: { flex: 1, padding: '13px 4px', borderRadius: 12, border: '2px solid', background: 'rgba(255,255,255,0.05)', fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 14, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, touchAction: 'manipulation' },
  sortBtnKey: { fontFamily: '"Space Mono", monospace', fontSize: 10, opacity: 0.6 },

  lever: { margin: '0 0 18px' },
  leverTitle: { fontFamily: '"Space Mono", monospace', fontSize: 11, color: 'rgba(232,213,181,0.65)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 },
  leverBtn: { border: `1.5px solid ${BRASS}88`, borderRadius: 10, padding: '8px 12px', fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 12, fontWeight: 600 },

  triplet: { display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 },
  tripletHead: { fontFamily: '"Space Mono", monospace', fontSize: 10, color: 'rgba(232,213,181,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 },

  reportCard: { background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px', textAlign: 'left', marginBottom: 12 },
  reportHead: { fontFamily: '"Space Mono", monospace', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 },
  reportBody: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, margin: '0 0 8px' },
  reportExample: { fontSize: 12.5, lineHeight: 1.5, padding: '6px 0 0' },

  teachCard: { width: '100%', background: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px', textAlign: 'left' },

  summaryCard: { background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 16px', margin: '14px 0 18px', display: 'flex', flexDirection: 'column', gap: 8 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  btnPrimary: { background: BRASS, color: '#241D18', border: 'none', borderRadius: 12, padding: 13, fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'block', width: '100%', marginTop: 8 },
  btnOutline: { background: 'transparent', color: BRASS, border: `1.5px solid ${BRASS}`, borderRadius: 12, padding: 12, fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}
