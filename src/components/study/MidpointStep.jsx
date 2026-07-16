import { useState, useEffect, useRef } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import { interventionStyles as S, OwlScreen } from './InterventionPage'

/**
 * Liliana Study 3 midpoint step (WP-L4/L5b) — mounted by StepDispatcher for
 * activity category 'midpoint'. Three-arm manipulation, group drawn at mount
 * via the shared draw_assignment primitive (slot 'midpoint_group'):
 *
 *   feedback_choice  — personalized Phase 1 feedback → preference ranking →
 *                      free practice choice → assignment screen (chosen)
 *   control_choice   — control display (no personal data) → preference
 *                      ranking → free choice → assignment screen (chosen)
 *   control_assigned — control display → preference ranking → assigned to
 *                      one of the two NON-rank-1 practices (50/50, done
 *                      server-side in record_practice_decision) → assignment
 *                      screen (comfort-zone framing)
 *
 * Ranking is a drag-and-drop / arrow-reorder list (methods doc Appendix 16;
 * design + copy from Liliana's midpoint preview HTMLs, 2026-07-14). The full
 * ranking is stored on the snapshot; positions imply ranks so it is always
 * complete.
 *
 * All decisions and the snapshot live server-side (get_liliana_midpoint_summary
 * / record_practice_decision, both SECURITY DEFINER + idempotent), so re-entry
 * resumes safely: an already-decided participant sees their assignment screen.
 *
 * demoMode: renders the full experience with locally generated data and zero
 * network calls — an arm picker appears first, decisions are faked locally.
 * Used by the admin session demo (SessionDemoModal).
 */

// Labels + descriptions are Liliana's canonical wording (midpoint previews).
const PRACTICES = {
  non_reactivity: {
    label: 'Non-reactivity',
    owl:   'owl_nonreactivity',
    desc:  'Observing thoughts, emotions, and bodily sensations without reacting to them.',
    expect:
      'In this practice, you will learn to notice your thoughts and feelings as they arise ' +
      'without getting caught up in them. Like watching clouds pass across the sky, you will ' +
      'practice observing your inner experience with curiosity and without judgment.',
  },
  reappraisal: {
    label: 'Reappraisal',
    owl:   'owl_reappraisal',
    desc:  'Shifting from seeing stress as harmful to seeing it as potentially enhancing.',
    expect:
      'In this practice, you will learn to reinterpret stressful situations in a way that ' +
      'reduces their emotional impact. Rather than eliminating stress, you will explore how to ' +
      'change the meaning you give to it and, in doing so, change how it affects you.',
  },
  self_compassion: {
    label: 'Self-compassion',
    owl:   'owl_selfcompassion',
    desc:  'Cultivating a kinder, more accepting relationship with yourself.',
    expect:
      'In this practice, you will learn to treat yourself with the same kindness and ' +
      'understanding you would offer a good friend. You will develop tools to respond to ' +
      'difficult moments with care, rather than self-criticism.',
  },
}

const PRACTICE_KEYS = Object.keys(PRACTICES)

const CONTROL_TEXT =
  "You've made it to the midpoint — twelve days, three different practices. That's no small thing. " +
  'Each practice trains a different skill: noticing without reacting, reframing, and self-kindness. ' +
  'In Phase 2 you will settle into one practice and go deeper with it, day by day.'

const RANK_BADGE_COLORS = ['var(--pk)', 'var(--pkd)', 'var(--tx2)']

// Locally generated snapshot for demoMode — plausible random stats, ranked by
// mean Δstress (metric v2), never touching the network.
function generateDemoSnapshot() {
  const stats = PRACTICE_KEYS.map(key => {
    const delta     = Math.round((Math.random() * 3.5 - 0.5) * 10) / 10
    const appraisal = Math.round((2 + Math.random() * 4) * 10) / 10
    const n         = Math.random() < 0.25 ? 3 : 4
    return { condition: key, mean_delta_stress: delta, mean_appraisal: appraisal, n, low_n: n < 2 }
  })
  stats.sort((a, b) => b.mean_delta_stress - a.mean_delta_stress)
  return {
    ranking: stats.map((s, i) => ({ ...s, rank: i + 1 })),
    decided_at: null,
    phase2_practice: null,
    phase2_source: null,
  }
}

export default function MidpointStep({ enrollment, onComplete, supabaseClient, isSimMode = false, demoMode = false }) {
  const db      = supabaseClient ?? globalSupabase
  const studyId = enrollment?.study_id

  const [screen,   setScreen]   = useState('loading')
  const [error,    setError]    = useState(null)
  const [group,    setGroup]    = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [selected, setSelected] = useState(null)
  // Preference ranking: array of practice keys, position = rank (always complete).
  const [order,    setOrder]    = useState(PRACTICE_KEYS)
  const [dragOver, setDragOver] = useState(null)
  const [result,   setResult]   = useState(null)
  const [saving,   setSaving]   = useState(false)
  const markedShown = useRef(false)
  const dragKey     = useRef(null)

  useEffect(() => {
    if (demoMode) { setSnapshot(generateDemoSnapshot()); setScreen('demoPick'); return }
    if (isSimMode) { setScreen('sim'); return }
    if (!studyId) { setError('No study id on enrollment.'); setScreen('error'); return }

    async function load() {
      try {
        const { data: draw, error: de } = await db.rpc('draw_assignment', {
          p_study_id: studyId,
          p_slot_key: 'midpoint_group',
        })
        if (de) throw de
        const g = draw?.value

        const { data: snap, error: se } = await db.rpc('get_liliana_midpoint_summary')
        if (se) throw se

        setGroup(g)
        setSnapshot(snap)

        if (snap?.decided_at) setScreen('assignment')
        else if (g === 'feedback_choice') setScreen('intro')
        else setScreen('control')
      } catch (e) {
        setError(e.message ?? String(e))
        setScreen('error')
      }
    }
    load()
  }, [studyId, isSimMode, demoMode])

  // Stamp shown_at the first time the feedback screen actually renders.
  // The .then() is load-bearing: supabase-js builders are lazy and never
  // execute unless awaited/then'd (WP-L5 dry-run finding).
  useEffect(() => {
    if (screen === 'feedback' && !markedShown.current && !demoMode) {
      markedShown.current = true
      db.rpc('get_liliana_midpoint_summary', { p_mark_shown: true })
        .then(({ error: e }) => { if (e) console.error('mark_shown failed:', e.message) })
    }
  }, [screen])

  async function submitDecision(source, practice) {
    if (!practice || saving) return

    if (demoMode) {
      // Fake the server decision locally: choice keeps the selection;
      // anti-preference picks one of the two non-rank-1 practices at random.
      const others = PRACTICE_KEYS.filter(k => k !== order[0])
      const final  = source === 'choice' ? practice : others[Math.floor(Math.random() * others.length)]
      setResult({ practice: final, stated_preference: order[0], preference_ranking: order, source })
      setScreen('assignment')
      return
    }

    setSaving(true)
    try {
      const { data, error: re } = await db.rpc('record_practice_decision', {
        p_practice: practice,
        p_source:   source,
        p_ranking:  order,
      })
      if (re) throw re
      setResult(data)
      setScreen('assignment')
    } catch (e) {
      setError(e.message ?? String(e))
      setScreen('error')
    } finally {
      setSaving(false)
    }
  }

  // ── ranking reorder (drag + arrows) ────────────────────────────────────────

  function moveBy(key, dir) {
    setOrder(prev => {
      const i = prev.indexOf(key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function handleDrop(targetKey) {
    const from = dragKey.current
    setDragOver(null)
    if (!from || from === targetKey) return
    setOrder(prev => {
      const next = prev.filter(k => k !== from)
      next.splice(prev.indexOf(targetKey) > prev.indexOf(from)
        ? next.indexOf(targetKey) + 1
        : next.indexOf(targetKey), 0, from)
      return next
    })
  }

  // ── simple full-page states ────────────────────────────────────────────────

  if (screen === 'loading') return <div style={M.msg}>Preparing your midpoint…</div>
  if (screen === 'error')   return <div style={{ ...M.msg, color: 'var(--err-tx)' }}>Midpoint step failed: {error}</div>
  if (screen === 'sim') {
    return (
      <div style={M.msg}>
        <div>
          <p style={{ margin: '0 0 16px' }}>Sim mode — midpoint step (no data saved)</p>
          <button style={S.btnNext} onClick={() => onComplete?.({ sim: true })}>Continue</button>
        </div>
      </div>
    )
  }

  // ── screen content ─────────────────────────────────────────────────────────

  const results = snapshot?.ranking ?? []   // per-practice feedback stats, rank order
  const decided  = result?.practice ?? snapshot?.phase2_practice
  const decidedP = PRACTICES[decided]
  const decidedSource = result?.source ?? snapshot?.phase2_source

  let body = null
  let footer = null

  if (screen === 'demoPick') {
    body = (
      <div>
        <h3 style={S.textH3}>Demo — pick a midpoint arm</h3>
        <p style={S.textP}>
          Admin preview with randomly generated Phase 1 data. Nothing is saved. Choose which
          experimental group to walk through:
        </p>
        {[
          ['feedback_choice',  'Choice with Feedback', 'Personal results → ranking → choice'],
          ['control_choice',   'Choice',               'Control display → ranking → choice'],
          ['control_assigned', 'No-Choice',            'Control display → ranking → assigned to a non-preferred practice'],
        ].map(([key, label, sub]) => (
          <button key={key} style={M.pickCard} onClick={() => {
            setGroup(key)
            setScreen(key === 'feedback_choice' ? 'intro' : 'control')
          }}>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <p style={M.cardTitle}>{label}</p>
              <p style={M.cardMeta}>{sub}</p>
            </div>
          </button>
        ))}
      </div>
    )
    footer = (
      <button style={S.btnNext} onClick={() => setSnapshot(generateDemoSnapshot())}>
        Regenerate random data
      </button>
    )
  }

  if (screen === 'intro') {
    body = (
      <OwlScreen
        owl="owl_thinking"
        text={"I've been reading through your check-ins from the past twelve days. Before you continue, I'd like to show you what they say about how each practice worked for you."}
      />
    )
    footer = <button style={S.btnNext} onClick={() => setScreen('feedback')}>See my results</button>
  }

  if (screen === 'feedback') {
    body = (
      <div>
        <h3 style={S.textH3}>Your Phase 1 results</h3>
        <p style={S.textP}>
          Based on your daily check-ins — how your stress changed after each practice, and how
          enjoyable and helpful you found it.
        </p>
        {results.map(r => {
          const p = PRACTICES[r.condition]
          if (!p) return null
          const d = r.mean_delta_stress
          const stressLine =
            d == null ? 'Not enough data'
            : d > 0   ? `Stress ↓ ${Math.abs(d).toFixed(1)} after practice`
            : d < 0   ? `Stress ↑ ${Math.abs(d).toFixed(1)} after practice`
            :           'Stress unchanged after practice'
          return (
            <div key={r.condition} style={{ ...M.card, ...(r.rank === 1 ? M.cardTop : {}) }}>
              <div style={{ ...M.feedbackBadge, ...(r.rank === 1 ? M.feedbackBadgeTop : {}) }}>#{r.rank}</div>
              <img src={`/assets/owls/${p.owl}.png`} alt="" style={M.cardOwl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={M.cardTitle}>
                  {p.label}
                  {r.rank === 1 && <span style={M.topTag}>your strongest</span>}
                </p>
                <p style={M.cardMeta}>{stressLine}</p>
                <p style={M.cardMeta}>
                  {r.mean_appraisal != null
                    ? `Enjoyment & helpfulness: ${Number(r.mean_appraisal).toFixed(1)} / 6`
                    : '—'}
                </p>
                <p style={M.cardSub}>
                  based on {r.n} session{r.n === 1 ? '' : 's'}{r.low_n ? ' · limited data' : ''}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    )
    footer = <button style={S.btnNext} onClick={() => setScreen('rank')}>Continue</button>
  }

  if (screen === 'control') {
    body = <OwlScreen owl="owl_still" text={CONTROL_TEXT} />
    footer = <button style={S.btnNext} onClick={() => setScreen('rank')}>Next</button>
  }

  if (screen === 'rank') {
    body = (
      <div>
        <h3 style={S.textH3}>Intervention Preference</h3>
        <p style={S.textP}>
          Please rank the following practices based on your current preference. Drag and drop the
          options below so that your top choice is ranked <strong>#1</strong> and your last choice
          is ranked <strong>#3</strong>.
        </p>
        <div style={{ marginBottom: 20 }}>
          {order.map((key, idx) => {
            const p = PRACTICES[key]
            return (
              <div
                key={key}
                draggable
                onDragStart={() => { dragKey.current = key }}
                onDragEnd={() => { dragKey.current = null; setDragOver(null) }}
                onDragOver={e => { e.preventDefault(); if (dragKey.current !== key) setDragOver(key) }}
                onDragLeave={() => setDragOver(d => (d === key ? null : d))}
                onDrop={e => { e.preventDefault(); handleDrop(key) }}
                style={{ ...M.rankItem, ...(dragOver === key ? M.rankItemOver : {}) }}
              >
                <div style={{ ...M.rankCircle, background: RANK_BADGE_COLORS[idx] }}>{idx + 1}</div>
                <img src={`/assets/owls/${p.owl}.png`} alt="" style={M.cardOwl} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={M.cardTitle}>{p.label}</p>
                  <p style={M.cardMeta}>{p.desc}</p>
                </div>
                <div style={M.arrowWrap}>
                  <button
                    style={{ ...M.arrowBtn, ...(idx === 0 ? M.arrowBtnOff : {}) }}
                    disabled={idx === 0}
                    onClick={() => moveBy(key, -1)}
                    aria-label={`Move ${p.label} up`}
                  >▲</button>
                  <button
                    style={{ ...M.arrowBtn, ...(idx === order.length - 1 ? M.arrowBtnOff : {}) }}
                    disabled={idx === order.length - 1}
                    onClick={() => moveBy(key, 1)}
                    aria-label={`Move ${p.label} down`}
                  >▼</button>
                </div>
                <div style={M.dragHandle} aria-hidden="true"><span style={M.dragBar} /><span style={M.dragBar} /><span style={M.dragBar} /></div>
              </div>
            )
          })}
        </div>
        <div style={M.resultBox}>
          <div style={M.resultTitle}>Your current ranking</div>
          {order.map((key, idx) => (
            <div key={key} style={M.resultRow}>
              <span style={M.resultNum}>#{idx + 1}</span>
              <span>{PRACTICES[key].label}</span>
            </div>
          ))}
        </div>
      </div>
    )
    footer = group === 'control_assigned' ? (
      <button
        style={{ ...S.btnNext, ...(saving ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
        disabled={saving}
        onClick={() => submitDecision('anti_preference', order[0])}
      >
        {saving ? 'Saving…' : 'Confirm Ranking'}
      </button>
    ) : (
      <button style={S.btnNext} onClick={() => setScreen('choose')}>
        Confirm Ranking
      </button>
    )
  }

  if (screen === 'choose') {
    body = (
      <div>
        <h3 style={S.textH3}>Choose your practice for Phase 2</h3>
        <p style={S.textP}>
          You will work with this practice every day for the rest of the study. Pick the one that
          feels right for you — it does not have to match your ranking.
        </p>
        {PRACTICE_KEYS.map(key => {
          const p = PRACTICES[key]
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              style={{ ...M.pickCard, ...(selected === key ? M.pickCardSelected : {}) }}
            >
              <img src={`/assets/owls/${p.owl}.png`} alt="" style={M.cardOwl} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <p style={M.cardTitle}>{p.label}</p>
                <p style={M.cardMeta}>{p.desc}</p>
              </div>
              <div style={{ ...M.radio, ...(selected === key ? M.radioOn : {}) }} />
            </button>
          )
        })}
      </div>
    )
    footer = (
      <button
        style={{ ...S.btnNext, ...(!selected || saving ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
        disabled={!selected || saving}
        onClick={() => submitDecision('choice', selected)}
      >
        {saving ? 'Saving…' : 'Lock it in'}
      </button>
    )
  }

  // Assignment screen — Liliana's design: chosen vs assigned variants share the
  // hero + "What to expect" structure and differ in framing copy.
  if (screen === 'assignment' && decidedP) {
    const isChosen = decidedSource === 'choice'
    body = (
      <div>
        <div style={M.hero}>
          <img src={`/assets/owls/${decidedP.owl}.png`} alt="" style={M.heroOwl} />
          <div style={M.heroEyebrow}>Phase 2</div>
          <div style={M.heroSub}>{isChosen ? 'Your chosen practice' : 'Your assigned practice'}</div>
          <div style={M.heroTitle}>{decidedP.label}</div>
          <p style={M.heroDesc}>{decidedP.desc}</p>
        </div>

        <div style={M.messageBox}>
          <div style={M.messageTitle}>
            {isChosen ? 'Great news!' : "Sometimes it's good to step outside your comfort zone!"}
          </div>
          <p style={M.messageText}>
            {isChosen ? (
              <>Based on your preferences, you have been assigned to the{' '}
              <strong>{decidedP.label}</strong> practice for Phase 2. We hope it feels like a
              great fit!</>
            ) : (
              <>For Phase 2, you have been randomly assigned to the{' '}
              <strong>{decidedP.label}</strong> practice. This may not have been your first pick,
              and that is okay! Research shows that trying approaches we would not naturally
              choose can lead to surprising benefits. You might discover something new about
              yourself.</>
            )}
          </p>
        </div>

        <div style={M.expectBox}>
          <div style={M.expectTitle}>What to expect</div>
          <p style={M.messageText}>{decidedP.expect}</p>
          <p style={{ ...M.messageText, marginTop: 10 }}>
            {isChosen
              ? 'Over the next 12 days, you will build on what you started in Phase 1. Each session is short, just a few minutes. I will be here with you every step of the way.'
              : 'Give it an open mind. You may be surprised by what you find. Over the next 12 days, I will guide you through each session. Each one is short, and we will take it one step at a time.'}
          </p>
        </div>
      </div>
    )
    footer = (
      <button style={S.btnDone} onClick={() => onComplete?.(demoMode ? { demo: true, practice: decided } : { practice: decided })}>
        Begin Phase 2
      </button>
    )
  }

  return (
    <div style={S.bg}>
      <div style={S.page}>
        <div style={S.header}>
          <div style={S.practiceBadge}>
            <div style={S.badgeDot} />
            Midpoint{demoMode ? ' · demo' : ''}
          </div>
          <div style={S.dayNumber}>Halfway there</div>
          <div style={S.daySubtitle}>Phase 1 complete — setting your course for Phase 2</div>
        </div>
        <div style={S.content}>{body}</div>
        <div style={S.footer}>{footer}</div>
      </div>
    </div>
  )
}

const M = {
  msg: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 300, padding: 40, textAlign: 'center',
    fontFamily: '"DM Sans",system-ui,sans-serif',
    fontSize: 15, color: 'var(--tx2)',
  },
  card: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'var(--bg)', border: '1px solid var(--bds)', borderRadius: 12,
    padding: '14px 16px', marginBottom: 12, position: 'relative',
  },
  cardTop: { background: 'var(--bgp)', border: '1px solid var(--pkd)' },
  pickCard: {
    display: 'flex', alignItems: 'center', gap: 14, width: '100%',
    background: 'var(--bg)', border: '1px solid var(--bds)', borderRadius: 12,
    padding: '14px 16px', marginBottom: 12, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  pickCardSelected: { background: 'var(--bgp)', border: '1px solid var(--pkd)' },
  cardOwl:   { width: 52, height: 52, objectFit: 'contain', flexShrink: 0 },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--tx)', fontFamily: '"DM Sans", system-ui, sans-serif' },
  cardMeta:  { margin: '3px 0 0', fontSize: 13.5, color: 'var(--tx2)', fontFamily: '"DM Sans", system-ui, sans-serif', lineHeight: 1.45 },
  cardSub:   { margin: '4px 0 0', fontSize: 12, color: 'var(--tx2)', fontFamily: '"DM Sans", system-ui, sans-serif' },
  feedbackBadge: {
    position: 'absolute', top: -9, left: 12,
    background: 'var(--bds)', color: 'var(--tx2)', borderRadius: 8,
    fontSize: 11, fontWeight: 600, padding: '2px 8px',
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  feedbackBadgeTop: { background: 'var(--pkd)', color: '#fff' },
  topTag: {
    marginLeft: 8, fontSize: 11, fontWeight: 600, color: 'var(--pkd)',
    background: 'var(--bgp)', borderRadius: 6, padding: '2px 7px',
    verticalAlign: 'middle',
  },
  radio: {
    width: 20, height: 20, borderRadius: '50%',
    border: '2px solid var(--gy)', flexShrink: 0,
  },
  radioOn: { border: '6px solid var(--pkd)' },

  // ── rank list (Liliana's preference-ranking preview) ──
  rankItem: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: '#fff', border: '1.5px solid var(--bds)', borderRadius: 12,
    padding: '14px 16px', marginBottom: 10, cursor: 'grab', userSelect: 'none',
    transition: 'box-shadow 0.15s, border-color 0.15s',
  },
  rankItemOver: { borderColor: 'var(--pk)', background: 'var(--bgp)', boxShadow: '0 4px 16px rgba(240,104,164,0.15)' },
  rankCircle: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 600, color: '#fff',
    fontFamily: '"DM Sans", system-ui, sans-serif', transition: 'background 0.2s',
  },
  arrowWrap: { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 },
  arrowBtn: {
    width: 28, height: 28, border: '1px solid var(--bds)', borderRadius: 6,
    background: 'var(--bgp)', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--tx)',
  },
  arrowBtnOff: { opacity: 0.25, cursor: 'default' },
  dragHandle: { display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, padding: '4px 2px', opacity: 0.35 },
  dragBar: { display: 'block', width: 18, height: 2, background: 'var(--tx)', borderRadius: 1 },
  resultBox: {
    background: 'var(--bg)', border: '1px solid var(--bds)', borderRadius: 10,
    padding: '14px 16px',
  },
  resultTitle: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--tx2)', marginBottom: 10, fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  resultRow: {
    display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
    color: 'var(--tx)', marginBottom: 6, fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  resultNum: { fontWeight: 600, color: 'var(--pk)', minWidth: 24 },

  // ── assignment screen (Liliana's assignment previews) ──
  hero: {
    background: 'var(--bg)', border: '1px solid var(--bds)', borderRadius: 14,
    padding: '24px 20px 20px', textAlign: 'center', marginBottom: 16,
  },
  heroOwl:     { width: 96, height: 96, objectFit: 'contain', marginBottom: 8 },
  heroEyebrow: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'var(--pk)', fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  heroSub:   { fontSize: 13, color: 'var(--tx2)', marginTop: 2, fontFamily: '"DM Sans", system-ui, sans-serif' },
  heroTitle: { fontSize: 24, fontWeight: 600, color: 'var(--tx)', marginTop: 6, fontFamily: '"DM Sans", system-ui, sans-serif' },
  heroDesc:  { fontSize: 13.5, color: 'var(--tx2)', marginTop: 6, lineHeight: 1.5, fontFamily: '"DM Sans", system-ui, sans-serif' },
  messageBox: {
    background: 'var(--bgp)', border: '1px solid var(--pkb)', borderRadius: 12,
    padding: '16px 18px', marginBottom: 16,
  },
  messageTitle: {
    fontSize: 15, fontWeight: 600, color: 'var(--pkd)', marginBottom: 8,
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  messageText: {
    fontSize: 14, lineHeight: 1.65, color: 'var(--tx)', margin: 0,
    fontFamily: '"DM Sans", system-ui, sans-serif',
  },
  expectBox: {
    background: 'var(--bg)', border: '1px solid var(--bds)', borderRadius: 12,
    padding: '16px 18px',
  },
  expectTitle: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--tx2)', marginBottom: 8, fontFamily: '"DM Sans", system-ui, sans-serif',
  },
}
