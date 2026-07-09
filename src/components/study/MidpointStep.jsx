import { useState, useEffect, useRef } from 'react'
import { supabase as globalSupabase } from '../../lib/supabase'
import { interventionStyles as S, OwlScreen } from './InterventionPage'

/**
 * Liliana Study 3 midpoint step (WP-L4) — mounted by StepDispatcher for
 * activity category 'midpoint'. Three-arm manipulation, group drawn at mount
 * via the shared draw_assignment primitive (slot 'midpoint_group'):
 *
 *   feedback_choice  — personalized Phase 1 feedback → free practice choice
 *   control_choice   — control display (no personal data) → free choice
 *   control_assigned — control display → states a preference → assigned to
 *                      one of the two NON-preferred practices (50/50, done
 *                      server-side in record_practice_decision); the owl
 *                      frames it as growth outside the comfort zone
 *
 * All decisions and the snapshot live server-side (get_liliana_midpoint_summary
 * / record_practice_decision, both SECURITY DEFINER + idempotent), so re-entry
 * resumes safely: an already-decided participant sees a confirmation screen.
 *
 * NOTE: participant-facing copy is placeholder pending Liliana's sign-off.
 */

const PRACTICES = {
  non_reactivity: {
    label: 'Non-Reactivity',
    owl:   'owl_nonreactivity',
    blurb: 'Noticing sensations and feelings as they are, and letting them pass without pushing back.',
  },
  reappraisal: {
    label: 'Reappraisal',
    owl:   'owl_reappraisal',
    blurb: 'Reframing stressful situations to change how they feel.',
  },
  self_compassion: {
    label: 'Self-Compassion',
    owl:   'owl_selfcompassion',
    blurb: 'Meeting difficulty with the same kindness you would offer a friend.',
  },
}

const CONTROL_TEXT =
  "You've made it to the midpoint — twelve days, three different practices. That's no small thing. " +
  'Each practice trains a different skill: noticing without reacting, reframing, and self-kindness. ' +
  'In Phase 2 you will settle into one practice and go deeper with it, day by day.'

export default function MidpointStep({ enrollment, onComplete, supabaseClient, isSimMode = false }) {
  const db      = supabaseClient ?? globalSupabase
  const studyId = enrollment?.study_id

  const [screen,   setScreen]   = useState('loading')
  const [error,    setError]    = useState(null)
  const [group,    setGroup]    = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [selected, setSelected] = useState(null)
  const [result,   setResult]   = useState(null)
  const [saving,   setSaving]   = useState(false)
  const markedShown = useRef(false)

  useEffect(() => {
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

        if (snap?.decided_at) setScreen('alreadyDone')
        else if (g === 'feedback_choice') setScreen('intro')
        else setScreen('control')
      } catch (e) {
        setError(e.message ?? String(e))
        setScreen('error')
      }
    }
    load()
  }, [studyId, isSimMode])

  // Stamp shown_at the first time the feedback screen actually renders.
  // The .then() is load-bearing: supabase-js builders are lazy and never
  // execute unless awaited/then'd (WP-L5 dry-run finding).
  useEffect(() => {
    if (screen === 'feedback' && !markedShown.current) {
      markedShown.current = true
      db.rpc('get_liliana_midpoint_summary', { p_mark_shown: true })
        .then(({ error: e }) => { if (e) console.error('mark_shown failed:', e.message) })
    }
  }, [screen])

  async function submitDecision(source) {
    if (!selected || saving) return
    setSaving(true)
    try {
      const { data, error: re } = await db.rpc('record_practice_decision', {
        p_practice: selected,
        p_source:   source,
      })
      if (re) throw re
      setResult(data)
      setScreen(source === 'choice' ? 'confirm' : 'reveal')
    } catch (e) {
      setError(e.message ?? String(e))
      setScreen('error')
    } finally {
      setSaving(false)
    }
  }

  // ── simple full-page states ────────────────────────────────────────────────

  if (screen === 'loading') return <div style={M.msg}>Preparing your midpoint…</div>
  if (screen === 'error')   return <div style={{ ...M.msg, color: '#c0392b' }}>Midpoint step failed: {error}</div>
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

  const ranking  = snapshot?.ranking ?? []
  const decided  = result?.practice ?? snapshot?.phase2_practice
  const decidedP = PRACTICES[decided]

  let body = null
  let footer = null

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
        {ranking.map(r => {
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
              <div style={{ ...M.rankBadge, ...(r.rank === 1 ? M.rankBadgeTop : {}) }}>#{r.rank}</div>
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
    footer = <button style={S.btnNext} onClick={() => setScreen('choose')}>Choose my practice</button>
  }

  if (screen === 'control') {
    body = <OwlScreen owl="owl_still" text={CONTROL_TEXT} />
    footer = (
      <button
        style={S.btnNext}
        onClick={() => setScreen(group === 'control_choice' ? 'choose' : 'preference')}
      >
        Next
      </button>
    )
  }

  if (screen === 'choose' || screen === 'preference') {
    const isPreference = screen === 'preference'
    body = (
      <div>
        <h3 style={S.textH3}>
          {isPreference ? 'Which practice would you pick?' : 'Choose your practice for Phase 2'}
        </h3>
        <p style={S.textP}>
          {isPreference
            ? 'Before we continue, we would like to know which practice you would prefer. There are no right or wrong answers.'
            : 'You will work with this practice every day for the rest of the study. Pick the one that feels right for you.'}
        </p>
        {Object.entries(PRACTICES).map(([key, p]) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            style={{ ...M.pickCard, ...(selected === key ? M.pickCardSelected : {}) }}
          >
            <img src={`/assets/owls/${p.owl}.png`} alt="" style={M.cardOwl} />
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <p style={M.cardTitle}>{p.label}</p>
              <p style={M.cardMeta}>{p.blurb}</p>
            </div>
            <div style={{ ...M.radio, ...(selected === key ? M.radioOn : {}) }} />
          </button>
        ))}
      </div>
    )
    footer = (
      <button
        style={{ ...S.btnNext, ...(!selected || saving ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
        disabled={!selected || saving}
        onClick={() => submitDecision(isPreference ? 'anti_preference' : 'choice')}
      >
        {saving ? 'Saving…' : isPreference ? "That's my pick" : 'Lock it in'}
      </button>
    )
  }

  if (screen === 'reveal') {
    const prefP = PRACTICES[result?.stated_preference]
    body = (
      <div>
        <OwlScreen
          owl="owl_excited"
          text={
            `${prefP?.label ?? 'That'} — good to know, and I've made a note of it. ` +
            'But here is the thing about growth: it usually happens just outside the comfort zone \\o/ ' +
            `So for Phase 2, I'm placing you with ${decidedP?.label ?? 'a new practice'}.`
          }
        />
        {decidedP && (
          <div style={{ ...M.card, ...M.cardTop, marginTop: 18 }}>
            <img src={`/assets/owls/${decidedP.owl}.png`} alt="" style={M.cardOwl} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={M.cardTitle}>{decidedP.label}</p>
              <p style={M.cardMeta}>{decidedP.blurb}</p>
            </div>
          </div>
        )}
      </div>
    )
    footer = <button style={S.btnDone} onClick={() => onComplete?.({ practice: decided })}>Continue</button>
  }

  if (screen === 'confirm') {
    body = (
      <div>
        <OwlScreen
          owl="owl_love"
          text={`${decidedP?.label ?? 'Done'} it is! Your Phase 2 practice is set — from here on, your daily sessions will build on it, one day at a time.`}
        />
        {decidedP && (
          <div style={{ ...M.card, ...M.cardTop, marginTop: 18 }}>
            <img src={`/assets/owls/${decidedP.owl}.png`} alt="" style={M.cardOwl} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={M.cardTitle}>{decidedP.label}</p>
              <p style={M.cardMeta}>{decidedP.blurb}</p>
            </div>
          </div>
        )}
      </div>
    )
    footer = <button style={S.btnDone} onClick={() => onComplete?.({ practice: decided })}>Continue</button>
  }

  if (screen === 'alreadyDone') {
    body = (
      <OwlScreen
        owl="owl_happy"
        text={`Your Phase 2 practice is already set: ${decidedP?.label ?? snapshot?.phase2_practice}. See you in your next session!`}
      />
    )
    footer = <button style={S.btnDone} onClick={() => onComplete?.({ practice: decided })}>Continue</button>
  }

  return (
    <div style={S.bg}>
      <div style={S.page}>
        <div style={S.header}>
          <div style={S.practiceBadge}>
            <div style={S.badgeDot} />
            Midpoint
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
    fontSize: 15, color: '#888780',
  },
  card: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: '#faf9f7', border: '1px solid #e0ddd8', borderRadius: 12,
    padding: '14px 16px', marginBottom: 12, position: 'relative',
  },
  cardTop: { background: '#f4f9ee', border: '1px solid #3b6d11' },
  pickCard: {
    display: 'flex', alignItems: 'center', gap: 14, width: '100%',
    background: '#faf9f7', border: '1px solid #e0ddd8', borderRadius: 12,
    padding: '14px 16px', marginBottom: 12, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  pickCardSelected: { background: '#f4f9ee', border: '1px solid #3b6d11' },
  cardOwl:   { width: 52, height: 52, objectFit: 'contain', flexShrink: 0 },
  cardTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: '#1a1a18', fontFamily: 'system-ui,sans-serif' },
  cardMeta:  { margin: '3px 0 0', fontSize: 13.5, color: '#5f5e5a', fontFamily: 'system-ui,sans-serif', lineHeight: 1.45 },
  cardSub:   { margin: '4px 0 0', fontSize: 12, color: '#888780', fontFamily: 'system-ui,sans-serif' },
  rankBadge: {
    position: 'absolute', top: -9, left: 12,
    background: '#e0ddd8', color: '#5f5e5a', borderRadius: 8,
    fontSize: 11, fontWeight: 700, padding: '2px 8px',
    fontFamily: 'system-ui,sans-serif',
  },
  rankBadgeTop: { background: '#3b6d11', color: '#fff' },
  topTag: {
    marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#3b6d11',
    background: '#e7f2da', borderRadius: 6, padding: '2px 7px',
    verticalAlign: 'middle',
  },
  radio: {
    width: 20, height: 20, borderRadius: '50%',
    border: '2px solid #c0bdb8', flexShrink: 0,
  },
  radioOn: { border: '6px solid #3b6d11' },
}
